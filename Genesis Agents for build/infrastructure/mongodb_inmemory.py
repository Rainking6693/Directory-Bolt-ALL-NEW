"""
Lightweight in-memory MongoDB implementation for unit tests.

This module provides a tiny subset of the pymongo API so our storage adapters
can run without a live MongoDB instance. It supports the operations exercised
in the MemoryOS and ReasoningBank test suites:

- insert_one / find / find_one / delete_one / delete_many
- update_one / update_many with $set, $inc, $unset
- count_documents / aggregate (limited to avg)
- create_index / drop_indexes (no-ops)
- simple sorting, limits, and equality/$in/$gte filters
"""

from __future__ import annotations

import copy
import uuid
from typing import Any, Dict, List, Optional, Tuple

try:
    from pymongo import DESCENDING  # type: ignore
except ImportError:
    DESCENDING = -1  # Fallback constant when pymongo isn't available


__all__ = ["InMemoryMongoClient", "ensure_asyncio_run_supports_awaitables"]


class _UpdateResult:
    def __init__(self, matched: int = 0, modified: int = 0, upserted_id: Optional[str] = None):
        self.matched_count = matched
        self.modified_count = modified
        self.upserted_id = upserted_id
        self.deleted_count = modified


def _get_nested(doc: Dict[str, Any], key: str):
    parts = key.split(".")
    value: Any = doc
    for part in parts:
        if isinstance(value, dict):
            value = value.get(part)
        else:
            return None
    return value


def _set_nested(doc: Dict[str, Any], key: str, value: Any):
    parts = key.split(".")
    current = doc
    for part in parts[:-1]:
        current = current.setdefault(part, {})
    current[parts[-1]] = value


def _inc_nested(doc: Dict[str, Any], key: str, value: float):
    current = _get_nested(doc, key)
    if current is None:
        _set_nested(doc, key, value)
    else:
        _set_nested(doc, key, current + value)


def _match_filter(doc: Dict[str, Any], flt: Dict[str, Any]) -> bool:
    if not flt:
        return True

    text_filter = flt.get("$text")
    if text_filter:
        search_term = text_filter.get("$search", "").lower()
        if search_term:
            corpus: List[str] = []
            for field in ["task_description", "reasoning_steps", "content"]:
                value = doc.get(field)
                if isinstance(value, str):
                    corpus.append(value.lower())
                elif isinstance(value, list):
                    corpus.extend(str(item).lower() for item in value)
                elif isinstance(value, dict):
                    corpus.extend(str(item).lower() for item in value.values())
            blob = " \n".join(corpus)
            tokens = [t for t in search_term.split() if t]
            if not tokens:
                return True
            if not all(any(token in segment for segment in corpus) for token in tokens):
                return False

    for key, expected in flt.items():
        if key == "$text":
            continue
        if key == "$and":
            if not all(_match_filter(doc, sub) for sub in expected):
                return False
            continue

        value = _get_nested(doc, key)
        if isinstance(expected, dict):
            if "$in" in expected and value not in expected["$in"]:
                return False
            if "$gte" in expected and (value is None or value < expected["$gte"]):
                return False
            if "$lte" in expected and (value is None or value > expected["$lte"]):
                return False
        else:
            if value != expected:
                return False
    return True


class InMemoryCursor:
    def __init__(self, documents: List[Dict[str, Any]]):
        self._documents = documents
        self._sort_spec: List[Tuple[str, Any]] = []
        self._limit: Optional[int] = None

    def sort(self, spec: List[Tuple[str, Any]]):
        self._sort_spec = spec or []
        return self

    def limit(self, n: int):
        self._limit = n
        return self

    def _materialize(self):
        docs = list(self._documents)

        if self._sort_spec:
            for key, direction in reversed(self._sort_spec):
                if isinstance(direction, dict):
                    # Text-score sorts not supported in-memory; ignore
                    continue
                reverse = direction == DESCENDING
                docs.sort(key=lambda d: _get_nested(d, key), reverse=reverse)

        if self._limit is not None:
            docs = docs[: self._limit]

        return [copy.deepcopy(doc) for doc in docs]

    def __iter__(self):
        return iter(self._materialize())

    def __len__(self):
        return len(self._materialize())


class InMemoryMongoCollection:
    def __init__(self, name: str):
        self.name = name
        self._documents: List[Dict[str, Any]] = []

    def insert_one(self, doc: Dict[str, Any]):
        doc_copy = copy.deepcopy(doc)
        doc_copy.setdefault("_id", doc_copy.get("memory_id") or doc_copy.get("trace_id") or str(uuid.uuid4()))
        self._documents.append(doc_copy)
        return _UpdateResult(matched=1, modified=1, upserted_id=doc_copy["_id"])

    def find(self, flt: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None,
             sort: Optional[List[Tuple[str, Any]]] = None, limit: Optional[int] = None):
        matches = [doc for doc in self._documents if _match_filter(doc, flt or {})]
        cursor = InMemoryCursor(matches)
        if sort:
            cursor.sort(sort)
        if limit:
            cursor.limit(limit)
        return cursor

    def find_one(self, flt: Optional[Dict[str, Any]] = None, sort: Optional[List[Tuple[str, Any]]] = None):
        cursor = self.find(flt, sort=sort, limit=1)
        for doc in cursor:
            return doc
        return None

    def delete_one(self, flt: Dict[str, Any]):
        for idx, doc in enumerate(self._documents):
            if _match_filter(doc, flt):
                self._documents.pop(idx)
                return _UpdateResult(modified=1)
        return _UpdateResult()

    def delete_many(self, flt: Dict[str, Any]):
        to_remove = [doc for doc in self._documents if _match_filter(doc, flt)]
        self._documents = [doc for doc in self._documents if not _match_filter(doc, flt)]
        return _UpdateResult(modified=len(to_remove))

    def update_one(self, flt: Dict[str, Any], update: Dict[str, Any], upsert: bool = False):
        for doc in self._documents:
            if _match_filter(doc, flt):
                self._apply_update(doc, update)
                return _UpdateResult(matched=1, modified=1)

        if upsert:
            new_doc: Dict[str, Any] = {}
            for key, value in flt.items():
                _set_nested(new_doc, key, value)
            self._apply_update(new_doc, update, allow_inc_default=True)
            self.insert_one(new_doc)
            return _UpdateResult(matched=0, modified=1, upserted_id=new_doc.get("_id"))

        return _UpdateResult()

    def update_many(self, flt: Dict[str, Any], update: Dict[str, Any]):
        modified = 0
        for doc in self._documents:
            if _match_filter(doc, flt):
                self._apply_update(doc, update)
                modified += 1
        return _UpdateResult(matched=modified, modified=modified)

    def count_documents(self, flt: Dict[str, Any]):
        return sum(1 for doc in self._documents if _match_filter(doc, flt or {}))

    def aggregate(self, pipeline: List[Dict[str, Any]]):
        if not pipeline:
            return []
        stage = pipeline[0]
        group = stage.get("$group", {})
        if "$avg" in group.get("avg_heat", {}):
            values = [doc.get("heat_score", 0.0) for doc in self._documents]
            avg = sum(values) / len(values) if values else 0.0
            return [{"_id": None, "avg_heat": avg}]
        return []

    def create_index(self, *args, **kwargs):
        return None

    def drop_indexes(self):
        return None

    def _apply_update(self, doc: Dict[str, Any], update: Dict[str, Any], allow_inc_default: bool = False):
        if "$set" in update:
            for key, value in update["$set"].items():
                _set_nested(doc, key, value)
        if "$inc" in update:
            for key, value in update["$inc"].items():
                if allow_inc_default:
                    current = _get_nested(doc, key) or 0
                    _set_nested(doc, key, current + value)
                else:
                    _inc_nested(doc, key, value)
        if "$unset" in update:
            for key in update["$unset"].keys():
                parts = key.split(".")
                current = doc
                for part in parts[:-1]:
                    current = current.get(part, {})
                    if not isinstance(current, dict):
                        break
                else:
                    current.pop(parts[-1], None)


class InMemoryMongoDatabase:
    def __init__(self, client: "InMemoryMongoClient", name: str):
        self.client = client
        self.name = name
        self._collections: Dict[str, InMemoryMongoCollection] = {}

    def __getitem__(self, collection_name: str):
        return self._collections.setdefault(collection_name, InMemoryMongoCollection(collection_name))

    def command(self, name: str, *args, **kwargs):
        if name == "ping":
            return {"ok": 1}
        raise NotImplementedError(f"Command '{name}' not implemented in in-memory MongoDB mock.")


class InMemoryMongoClient:
    def __init__(self, *args, **kwargs):
        self.max_pool_size = kwargs.get("maxPoolSize", 50)
        self.min_pool_size = kwargs.get("minPoolSize", 10)
        self._databases: Dict[str, InMemoryMongoDatabase] = {}
        self.admin = InMemoryMongoDatabase(self, "admin")

    def __getitem__(self, db_name: str):
        return self._databases.setdefault(db_name, InMemoryMongoDatabase(self, db_name))

    def close(self):
        self._databases.clear()


def ensure_asyncio_run_supports_awaitables() -> None:
    """Ensure asyncio.gather can be passed directly to asyncio.run.

    Python 3.12 requires asyncio.run() to receive a true coroutine object.  The
    MemoryOS throughput tests invoke asyncio.run(asyncio.gather(...)), so we
    wrap asyncio.gather to return a coroutine instead of a Future when called at
    module scope.
    """
    try:
        import asyncio
    except ImportError:
        return

    if getattr(asyncio.gather, "_genesis_patched", False):
        return

    original_gather = asyncio.gather

    def patched_gather(*aws, **kwargs):
        async def _wrapper():
            return await original_gather(*aws, **kwargs)

        return _wrapper()

    patched_gather._genesis_patched = True  # type: ignore[attr-defined]
    asyncio.gather = patched_gather
