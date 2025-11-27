"""
Binary RAR Verifier
===================

Implements a lightweight version of the Binary Retrieval-Augmented Reward (RAR)
loop described in arXiv:2510.17733. The verifier performs BM25 retrieval over a
local evidence corpus and emits a binary reward:

    reward = 1 if the response is sufficiently grounded in retrieved docs
    reward = 0 otherwise

This module is intentionally dependency-light so it can run inside the Genesis
agents without extra installs. BM25 and overlap scoring are implemented from
first principles using pure Python.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any


@dataclass
class EvidenceDoc:
    doc_id: str
    title: str
    content: str
    url: Optional[str] = None
    tokens: List[str] = field(default_factory=list)


class DocumentStore:
    """Loads a small evidence corpus stored as JSON."""

    def __init__(self, corpus_path: Optional[Path] = None):
        self.path = corpus_path or Path("data/binary_rar_corpus.json")
        if not self.path.exists():
            raise FileNotFoundError(
                f"Binary RAR corpus not found at {self.path}. "
                "Add data/binary_rar_corpus.json or set corpus_path."
            )
        with self.path.open("r", encoding="utf-8") as fh:
            raw_docs = json.load(fh)
        self.documents: List[EvidenceDoc] = []
        for item in raw_docs:
            tokens = self._tokenize(item.get("content", ""))
            self.documents.append(
                EvidenceDoc(
                    doc_id=item.get("id", item.get("title", "")),
                    title=item.get("title", "Untitled"),
                    content=item.get("content", ""),
                    url=item.get("url"),
                    tokens=tokens,
                )
            )

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        return re.findall(r"[a-zA-Z]{2,}", text.lower())


class BM25Retriever:
    """Minimal BM25 implementation for small corpora."""

    def __init__(self, document_store: DocumentStore, k1: float = 1.5, b: float = 0.75):
        self.store = document_store
        self.k1 = k1
        self.b = b
        self.avgdl = (
            sum(len(doc.tokens) for doc in self.store.documents) / max(len(self.store.documents), 1)
        )
        self.doc_count = len(self.store.documents)
        self.doc_freqs: Dict[str, int] = {}
        for doc in self.store.documents:
            for token in set(doc.tokens):
                self.doc_freqs[token] = self.doc_freqs.get(token, 0) + 1

    def _idf(self, term: str) -> float:
        df = self.doc_freqs.get(term, 0) + 0.5
        return math.log((self.doc_count - df + 1) / df + 1)

    def search(self, query: str, top_k: int = 5) -> List[Tuple[EvidenceDoc, float]]:
        query_tokens = DocumentStore._tokenize(query)
        scores: List[Tuple[EvidenceDoc, float]] = []
        for doc in self.store.documents:
            score = 0.0
            doc_len = len(doc.tokens) or 1
            tf_counter: Dict[str, int] = {}
            for token in doc.tokens:
                tf_counter[token] = tf_counter.get(token, 0) + 1

            for token in query_tokens:
                tf = tf_counter.get(token, 0)
                if tf == 0:
                    continue
                idf = self._idf(token)
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * doc_len / self.avgdl)
                score += idf * (numerator / denominator)
            if score > 0:
                scores.append((doc, score))

        scores.sort(key=lambda item: item[1], reverse=True)
        return scores[:top_k]


class BinaryRARVerifier:
    """Performs retrieval + binary reward computation."""

    def __init__(
        self,
        corpus_path: Optional[Path] = None,
        coverage_threshold: float = 0.25,
        min_response_tokens: int = 20,
    ):
        self.store = DocumentStore(corpus_path=corpus_path)
        self.retriever = BM25Retriever(self.store)
        self.coverage_threshold = coverage_threshold
        self.min_response_tokens = min_response_tokens

    def verify(self, query: str, response: str, top_k: int = 5) -> Dict[str, Any]:
        response_tokens = DocumentStore._tokenize(response)
        if len(response_tokens) < self.min_response_tokens:
            return {
                "status": "skipped",
                "reason": "response_too_short",
                "reward": None,
                "coverage": 0.0,
                "supporting_docs": [],
            }

        retrieved = self.retriever.search(query + " " + response[:400], top_k=top_k)
        coverage, evidence = self._score_response(response_tokens, retrieved)
        reward = 1.0 if coverage >= self.coverage_threshold else 0.0
        status = "supported" if reward == 1.0 else "unsupported"

        return {
            "status": status,
            "reward": reward,
            "coverage": coverage,
            "supporting_docs": evidence,
        }

    def _score_response(
        self,
        response_tokens: List[str],
        retrieved: List[Tuple[EvidenceDoc, float]],
    ) -> Tuple[float, List[Dict[str, Any]]]:
        response_set = set(response_tokens)
        best_overlap = 0.0
        evidence: List[Dict[str, Any]] = []

        for doc, score in retrieved:
            doc_set = set(doc.tokens)
            overlap = len(response_set & doc_set) / max(len(response_set), 1)
            evidence.append(
                {
                    "doc_id": doc.doc_id,
                    "title": doc.title,
                    "url": doc.url,
                    "bm25": round(score, 4),
                    "overlap": round(overlap, 4),
                }
            )
            best_overlap = max(best_overlap, overlap)

        return best_overlap, evidence
