"""
Scratchpad - Short-Term Ring Buffer Memory for Agents

High-speed, in-memory circular buffer for recent agent interactions.
Complements CaseBank (long-term RAG storage) with fast short-term memory.

Design:
- Ring buffer with fixed capacity (default 100 messages)
- O(1) append, O(n) recent retrieval
- Thread-safe for concurrent agent access
- Automatic overflow handling (oldest messages dropped)
- No persistence (intentionally ephemeral)

Use Cases:
- Recent conversation context (<10 minutes)
- Working memory for active tasks
- Rapid lookback for immediate decisions
- Context for next-step reasoning

Integration:
- Intent Layer: Recent user commands
- DAAO Router: Recent routing decisions
- All Agents: Recent task outcomes
"""

import logging
import threading
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Deque

# Genesis infrastructure
from infrastructure import get_logger

# OTEL observability
try:
    from opentelemetry import trace, metrics
    tracer = trace.get_tracer(__name__)
    meter = metrics.get_meter(__name__)

    # Metrics
    write_counter = meter.create_counter(
        "scratchpad.writes.performed",
        description="Number of writes to scratchpad"
    )
    read_counter = meter.create_counter(
        "scratchpad.reads.performed",
        description="Number of reads from scratchpad"
    )
    overflow_counter = meter.create_counter(
        "scratchpad.overflows.occurred",
        description="Number of buffer overflows"
    )
    HAS_OTEL = True
except ImportError:
    HAS_OTEL = False
    tracer = None

logger = get_logger(__name__)


@dataclass
class ScratchpadEntry:
    """
    Single entry in scratchpad memory.

    Attributes:
        content: Entry content (string or structured data)
        entry_type: Entry type (command, decision, outcome, etc.)
        agent: Agent that created entry
        timestamp: When entry was created
        metadata: Additional entry metadata
    """
    content: Any
    entry_type: str
    agent: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "content": str(self.content),  # Convert to string for serialization
            "entry_type": self.entry_type,
            "agent": self.agent,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata
        }

    def age_seconds(self) -> float:
        """Calculate age of entry in seconds"""
        return (datetime.now(timezone.utc) - self.timestamp).total_seconds()


class Scratchpad:
    """
    Ring buffer for short-term agent memory.

    Thread-safe circular buffer with automatic overflow handling.
    Designed for high-speed reads/writes with minimal overhead.
    """

    DEFAULT_CAPACITY = 100  # Last 100 interactions
    DEFAULT_MAX_AGE_SECONDS = 600  # 10 minutes

    def __init__(
        self,
        capacity: int = DEFAULT_CAPACITY,
        max_age_seconds: int = DEFAULT_MAX_AGE_SECONDS,
        enable_otel: bool = True
    ):
        """
        Initialize Scratchpad.

        Args:
            capacity: Maximum number of entries in buffer
            max_age_seconds: Maximum age of entries (older entries dropped)
            enable_otel: Enable OpenTelemetry tracing/metrics
        """
        self.capacity = capacity
        self.max_age_seconds = max_age_seconds
        self.enable_otel = enable_otel and HAS_OTEL

        # Ring buffer (thread-safe deque)
        self.buffer: Deque[ScratchpadEntry] = deque(maxlen=capacity)
        self._lock = threading.RLock()  # Reentrant lock for nested calls

        # Metrics
        self.total_writes = 0
        self.total_reads = 0
        self.total_overflows = 0

        logger.info(
            f"Scratchpad initialized: capacity={capacity}, "
            f"max_age_seconds={max_age_seconds}"
        )

    def write(
        self,
        content: Any,
        entry_type: str,
        agent: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ScratchpadEntry:
        """
        Write entry to scratchpad.

        Thread-safe O(1) append with automatic overflow handling.

        Args:
            content: Entry content
            entry_type: Entry type (command, decision, outcome, etc.)
            agent: Agent name
            metadata: Optional additional metadata

        Returns:
            Created ScratchpadEntry
        """
        with self._lock:
            # Create entry
            entry = ScratchpadEntry(
                content=content,
                entry_type=entry_type,
                agent=agent,
                metadata=metadata or {}
            )

            # Check if buffer is full (will overflow)
            was_full = len(self.buffer) >= self.capacity

            # Append (automatic overflow if full)
            self.buffer.append(entry)

            # Update metrics
            self.total_writes += 1
            if was_full:
                self.total_overflows += 1

            # OTEL metrics
            if self.enable_otel:
                write_counter.add(1, {"agent": agent, "entry_type": entry_type})
                if was_full:
                    overflow_counter.add(1)

            logger.debug(
                f"Scratchpad write: agent={agent}, type={entry_type}, "
                f"buffer_size={len(self.buffer)}/{self.capacity}"
            )

            return entry

    def read_recent(
        self,
        limit: int = 10,
        agent_filter: Optional[str] = None,
        entry_type_filter: Optional[str] = None,
        max_age_seconds: Optional[int] = None
    ) -> List[ScratchpadEntry]:
        """
        Read recent entries from scratchpad.

        Thread-safe O(n) retrieval with optional filtering.

        Args:
            limit: Maximum number of entries to return
            agent_filter: Filter by agent name
            entry_type_filter: Filter by entry type
            max_age_seconds: Override default max age

        Returns:
            List of recent entries (newest first)
        """
        with self._lock:
            # Use override or default
            max_age = max_age_seconds or self.max_age_seconds
            cutoff_time = datetime.now(timezone.utc) - timedelta(seconds=max_age)

            # Filter entries
            filtered: List[ScratchpadEntry] = []

            for entry in reversed(self.buffer):  # Newest first
                # Age filter
                if entry.timestamp < cutoff_time:
                    continue

                # Agent filter
                if agent_filter and entry.agent != agent_filter:
                    continue

                # Entry type filter
                if entry_type_filter and entry.entry_type != entry_type_filter:
                    continue

                filtered.append(entry)

                # Limit reached
                if len(filtered) >= limit:
                    break

            # Update metrics
            self.total_reads += 1

            # OTEL metrics
            if self.enable_otel:
                read_counter.add(1, {"found": len(filtered)})

            logger.debug(
                f"Scratchpad read: limit={limit}, agent={agent_filter}, "
                f"type={entry_type_filter}, found={len(filtered)}"
            )

            return filtered

    def read_all(
        self,
        agent_filter: Optional[str] = None,
        entry_type_filter: Optional[str] = None
    ) -> List[ScratchpadEntry]:
        """
        Read all entries from scratchpad.

        Args:
            agent_filter: Filter by agent name
            entry_type_filter: Filter by entry type

        Returns:
            All matching entries (newest first)
        """
        return self.read_recent(
            limit=self.capacity,
            agent_filter=agent_filter,
            entry_type_filter=entry_type_filter,
            max_age_seconds=None  # No age limit
        )

    def clear(self, agent_filter: Optional[str] = None) -> int:
        """
        Clear scratchpad entries.

        Args:
            agent_filter: If provided, only clear entries from this agent

        Returns:
            Number of entries cleared
        """
        with self._lock:
            if agent_filter:
                # Selective clear
                before = len(self.buffer)
                self.buffer = deque(
                    (e for e in self.buffer if e.agent != agent_filter),
                    maxlen=self.capacity
                )
                cleared = before - len(self.buffer)
            else:
                # Clear all
                cleared = len(self.buffer)
                self.buffer.clear()

            logger.info(f"Scratchpad cleared: {cleared} entries (agent={agent_filter})")
            return cleared

    def get_summary(self) -> Dict[str, Any]:
        """
        Get scratchpad summary statistics.

        Returns:
            Dictionary with summary metrics
        """
        with self._lock:
            # Count by agent
            agent_counts: Dict[str, int] = {}
            # Count by entry type
            type_counts: Dict[str, int] = {}
            # Oldest and newest timestamps
            oldest = None
            newest = None

            for entry in self.buffer:
                # Agent counts
                agent_counts[entry.agent] = agent_counts.get(entry.agent, 0) + 1
                # Type counts
                type_counts[entry.entry_type] = type_counts.get(entry.entry_type, 0) + 1
                # Timestamps
                if oldest is None or entry.timestamp < oldest:
                    oldest = entry.timestamp
                if newest is None or entry.timestamp > newest:
                    newest = entry.timestamp

            return {
                "total_entries": len(self.buffer),
                "capacity": self.capacity,
                "capacity_utilization": len(self.buffer) / self.capacity,
                "agent_counts": agent_counts,
                "type_counts": type_counts,
                "oldest_timestamp": oldest.isoformat() if oldest else None,
                "newest_timestamp": newest.isoformat() if newest else None,
                "age_range_seconds": (newest - oldest).total_seconds() if oldest and newest else 0,
                "total_writes": self.total_writes,
                "total_reads": self.total_reads,
                "total_overflows": self.total_overflows
            }

    def cleanup_old_entries(self) -> int:
        """
        Remove entries older than max_age_seconds.

        Returns:
            Number of entries removed
        """
        with self._lock:
            cutoff_time = datetime.now(timezone.utc) - timedelta(seconds=self.max_age_seconds)
            before = len(self.buffer)

            self.buffer = deque(
                (e for e in self.buffer if e.timestamp >= cutoff_time),
                maxlen=self.capacity
            )

            removed = before - len(self.buffer)

            if removed > 0:
                logger.info(f"Cleaned up {removed} old scratchpad entries")

            return removed


# Singleton instance
_scratchpad_instance: Optional[Scratchpad] = None
_scratchpad_lock = threading.Lock()


def get_scratchpad(
    capacity: int = Scratchpad.DEFAULT_CAPACITY,
    reset: bool = False
) -> Scratchpad:
    """
    Get global Scratchpad singleton instance (thread-safe).

    Args:
        capacity: Buffer capacity (only used on first init)
        reset: If True, create new instance (for testing)

    Returns:
        Scratchpad instance
    """
    global _scratchpad_instance

    if reset or _scratchpad_instance is None:
        with _scratchpad_lock:
            # Double-check locking
            if reset or _scratchpad_instance is None:
                _scratchpad_instance = Scratchpad(capacity=capacity)

    return _scratchpad_instance
