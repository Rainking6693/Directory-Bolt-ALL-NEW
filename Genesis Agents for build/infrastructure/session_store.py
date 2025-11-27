"""
Session Store - Persistent Conversation Log with TTL + Compaction

Implements a lightweight session service for Genesis agents. Designed to back the
Context-Engineering upgrades from the Google/Kaggle whitepaper:

- Per-user isolation (user_id required for every read/write)
- Deterministic ordering via monotonically increasing sequence numbers
- Configurable TTL enforcement with periodic purge helpers
- Compaction hooks so background jobs can summarize old events

Storage is powered by SQLite with WAL enabled so it works everywhere Genesis
runs (Windows, Linux, CI). The class is thread-safe and can be shared across
FastAPI workers or background tasks.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_DB_PATH = Path("data/sessions/genesis_sessions.db")
DEFAULT_TTL_HOURS = int(os.getenv("GENESIS_SESSION_TTL_HOURS", "720"))  # 30 days


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


@dataclass
class SessionEvent:
    """Represents a single event in a session timeline."""

    role: str
    content: str
    payload: Dict[str, Any] = field(default_factory=dict)
    sequence: Optional[int] = None
    created_at: str = field(default_factory=lambda: _iso(_utc_now()))

    def to_record(self) -> Dict[str, Any]:
        record = asdict(self)
        record["payload"] = json.dumps(self.payload, ensure_ascii=False)
        return record


class SessionStore:
    """
    Persistent session service with per-user isolation.

    The schema uses three tables:
        sessions            -> metadata row per session
        events              -> ordered log of conversation/tool events
        compaction_chunks   -> summaries of pruned event ranges
    """

    def __init__(
        self,
        db_path: Path | str = DEFAULT_DB_PATH,
        default_ttl_hours: int = DEFAULT_TTL_HOURS,
        extend_ttl_on_write: bool = True,
    ):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.default_ttl = max(1, int(default_ttl_hours))
        self.extend_ttl_on_write = extend_ttl_on_write
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._configure_connection()
        self._init_schema()

    # ------------------------------------------------------------------ #
    # connection + schema helpers
    # ------------------------------------------------------------------ #
    def _configure_connection(self) -> None:
        with self._conn:
            self._conn.execute("PRAGMA journal_mode=WAL;")
            self._conn.execute("PRAGMA foreign_keys=ON;")

    def _init_schema(self) -> None:
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    metadata TEXT DEFAULT '{}'
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    sequence INTEGER NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    payload TEXT DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
                        ON DELETE CASCADE,
                    UNIQUE(session_id, sequence)
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS compaction_chunks (
                    chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    start_sequence INTEGER NOT NULL,
                    end_sequence INTEGER NOT NULL,
                    summary TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
                        ON DELETE CASCADE
                )
                """
            )

    # ------------------------------------------------------------------ #
    # public API
    # ------------------------------------------------------------------ #
    def start_session(
        self,
        *,
        user_id: str,
        session_id: Optional[str] = None,
        ttl_hours: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Create (or upsert) a session for a user."""
        user_id = self._sanitize_user_id(user_id)
        if not session_id:
            session_id = str(uuid.uuid4())
        ttl = max(1, int(ttl_hours or self.default_ttl))
        now = _utc_now()
        expires_at = now + timedelta(hours=ttl)
        metadata_json = json.dumps(metadata or {}, ensure_ascii=False)

        with self._lock, self._conn:
            existing = self._conn.execute(
                "SELECT user_id FROM sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()
            if existing:
                if existing["user_id"] != user_id:
                    raise ValueError("Session belongs to a different user")
                self._conn.execute(
                    """
                    UPDATE sessions
                    SET updated_at = ?, expires_at = ?, metadata = COALESCE(?, metadata)
                    WHERE session_id = ?
                    """,
                    (_iso(now), _iso(expires_at), metadata_json, session_id),
                )
            else:
                self._conn.execute(
                    """
                    INSERT INTO sessions (session_id, user_id, created_at, updated_at, expires_at, metadata)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (session_id, user_id, _iso(now), _iso(now), _iso(expires_at), metadata_json),
                )
        return session_id

    def append_event(
        self,
        *,
        user_id: str,
        session_id: str,
        role: str,
        content: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> SessionEvent:
        """Append an event to the session log."""
        session_id = session_id.strip()
        user_id = self._sanitize_user_id(user_id)
        if not session_id:
            raise ValueError("session_id is required")

        payload = payload or {}
        event = SessionEvent(role=role, content=content, payload=payload)

        with self._lock, self._conn:
            owner = self._conn.execute(
                "SELECT user_id FROM sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()
            if not owner:
                # Implicitly create the session if it does not exist.
                self.start_session(user_id=user_id, session_id=session_id)
            elif owner["user_id"] != user_id:
                raise ValueError("User is not allowed to append to this session")

            next_seq = self._conn.execute(
                "SELECT COALESCE(MAX(sequence), 0) + 1 AS seq FROM events WHERE session_id = ?",
                (session_id,),
            ).fetchone()["seq"]

            event.sequence = next_seq
            self._conn.execute(
                """
                INSERT INTO events (session_id, sequence, role, content, payload, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    event.sequence,
                    event.role,
                    event.content,
                    json.dumps(event.payload, ensure_ascii=False),
                    event.created_at,
                ),
            )

            if self.extend_ttl_on_write:
                expires_at = _iso(_utc_now() + timedelta(hours=self.default_ttl))
                self._conn.execute(
                    """
                    UPDATE sessions
                    SET updated_at = ?, expires_at = ?
                    WHERE session_id = ?
                    """,
                    (event.created_at, expires_at, session_id),
                )
        return event

    def count_events(self, session_id: str) -> int:
        with self._lock, self._conn:
            row = self._conn.execute(
                "SELECT COUNT(*) AS cnt FROM events WHERE session_id = ?",
                (session_id,),
            ).fetchone()
            return int(row["cnt"])

    def get_session(
        self,
        *,
        user_id: str,
        session_id: str,
        limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Return session metadata plus ordered events."""
        user_id = self._sanitize_user_id(user_id)
        with self._lock, self._conn:
            session_row = self._conn.execute(
                "SELECT * FROM sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()
            if not session_row:
                raise KeyError("Session not found")
            if session_row["user_id"] != user_id:
                raise ValueError("User is not allowed to read this session")

            query = "SELECT * FROM events WHERE session_id = ? ORDER BY sequence ASC"
            params: Tuple[Any, ...]
            params = (session_id,)
            if limit:
                query += " LIMIT ?"
                params = (session_id, int(limit))
            event_rows = self._conn.execute(query, params).fetchall()

        events = [
            {
                "sequence": row["sequence"],
                "role": row["role"],
                "content": row["content"],
                "payload": json.loads(row["payload"] or "{}"),
                "created_at": row["created_at"],
            }
            for row in event_rows
        ]

        return {
            "session_id": session_row["session_id"],
            "user_id": session_row["user_id"],
            "created_at": session_row["created_at"],
            "updated_at": session_row["updated_at"],
            "expires_at": session_row["expires_at"],
            "metadata": json.loads(session_row["metadata"] or "{}"),
            "events": events,
        }

    def list_sessions(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List sessions optionally filtered by user."""
        with self._lock, self._conn:
            if user_id:
                rows = self._conn.execute(
                    "SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC",
                    (self._sanitize_user_id(user_id),),
                ).fetchall()
            else:
                rows = self._conn.execute(
                    "SELECT * FROM sessions ORDER BY updated_at DESC"
                ).fetchall()
        return [
            {
                "session_id": row["session_id"],
                "user_id": row["user_id"],
                "updated_at": row["updated_at"],
                "expires_at": row["expires_at"],
            }
            for row in rows
        ]

    def purge_expired_sessions(self, batch_size: int = 100) -> int:
        """Remove expired sessions to keep storage bounded."""
        now_iso = _iso(_utc_now())
        with self._lock, self._conn:
            rows = self._conn.execute(
                "SELECT session_id FROM sessions WHERE expires_at < ? LIMIT ?",
                (now_iso, batch_size),
            ).fetchall()
            ids = [row["session_id"] for row in rows]
            if not ids:
                return 0
            self._conn.executemany(
                "DELETE FROM sessions WHERE session_id = ?", ((sid,) for sid in ids)
            )
        return len(ids)

    def record_compaction_chunk(
        self,
        session_id: str,
        start_sequence: int,
        end_sequence: int,
        summary: str,
    ) -> None:
        """Persist a summary chunk for auditing."""
        with self._lock, self._conn:
            self._conn.execute(
                """
                INSERT INTO compaction_chunks (session_id, start_sequence, end_sequence, summary, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    start_sequence,
                    end_sequence,
                    summary,
                    _iso(_utc_now()),
                ),
            )

    def delete_event_range(
        self,
        session_id: str,
        start_sequence: int,
        end_sequence: int,
    ) -> int:
        """Delete a contiguous block of events."""
        with self._lock, self._conn:
            cur = self._conn.execute(
                """
                DELETE FROM events
                WHERE session_id = ?
                  AND sequence BETWEEN ? AND ?
                """,
                (session_id, start_sequence, end_sequence),
            )
            return cur.rowcount

    def get_oldest_events(
        self, session_id: str, window: int
    ) -> List[Dict[str, Any]]:
        with self._lock, self._conn:
            rows = self._conn.execute(
                """
                SELECT sequence, role, content, payload, created_at
                FROM events
                WHERE session_id = ?
                ORDER BY sequence ASC
                LIMIT ?
                """,
                (session_id, int(window)),
            ).fetchall()
        return [
            {
                "sequence": row["sequence"],
                "role": row["role"],
                "content": row["content"],
                "payload": json.loads(row["payload"] or "{}"),
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    # ------------------------------------------------------------------ #
    # helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _sanitize_user_id(user_id: str) -> str:
        if not user_id:
            return "anonymous"
        safe = "".join(ch for ch in user_id if ch.isalnum() or ch in {"-", "_", "@"})
        return safe or "anonymous"


class SessionCompactor:
    """
    Simple deterministic compactor.

    Compacts sessions whenever they exceed max_events by summarizing the
    oldest window into a single summary chunk. This avoids growing the
    SQLite file without making any LLM calls (summary is heuristic).
    """

    def __init__(
        self,
        store: SessionStore,
        max_events: int = int(os.getenv("GENESIS_SESSION_EVENT_LIMIT", "80")),
        window: int = int(os.getenv("GENESIS_SESSION_COMPACTION_WINDOW", "20")),
    ):
        self.store = store
        self.max_events = max(10, max_events)
        self.window = max(5, window)

    def maybe_compact(self, user_id: str, session_id: str) -> Optional[Dict[str, Any]]:
        """Run compaction if the session exceeds the configured threshold."""
        total = self.store.count_events(session_id)
        if total <= self.max_events:
            return None

        window = min(self.window, total - self.max_events // 2)
        chunk = self.store.get_oldest_events(session_id, window)
        if len(chunk) < 2:
            return None

        start_seq = chunk[0]["sequence"]
        end_seq = chunk[-1]["sequence"]
        summary = self._summarize(chunk)
        deleted = self.store.delete_event_range(session_id, start_seq, end_seq)
        if deleted:
            self.store.record_compaction_chunk(
                session_id=session_id,
                start_sequence=start_seq,
                end_sequence=end_seq,
                summary=summary,
            )
        return {
            "start_sequence": start_seq,
            "end_sequence": end_seq,
            "deleted_events": deleted,
            "summary": summary,
        }

    @staticmethod
    def _summarize(events: List[Dict[str, Any]]) -> str:
        """Create a deterministic summary from a block of events."""
        parts = []
        for event in events:
            content_preview = event["content"].strip().replace("\n", " ")
            if len(content_preview) > 120:
                content_preview = content_preview[:117] + "..."
            parts.append(f"{event['role']}: {content_preview}")
        joined = " | ".join(parts)
        if len(joined) > 900:
            joined = joined[:897] + "..."
        return joined


__all__ = ["SessionStore", "SessionCompactor", "SessionEvent"]
