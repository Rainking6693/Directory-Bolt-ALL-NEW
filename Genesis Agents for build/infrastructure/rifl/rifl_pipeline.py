"""
RIFL prompt evaluation pipeline (inspired by arXiv:2511.10507).

Implements a compact rubric generator + verifier that produces ternary rewards
(pass/partial/fail) for Darwin's prompt evolution loop.  The implementation is
heuristic so it can run offline without an additional LLM, but the API mirrors
the RIFL stages so we can swap in model-driven evaluators later.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
import re
from typing import Dict, List, Any


@dataclass
class RIFLRubric:
    """Represents rubric clauses used for verification."""

    improvement_type: str
    keywords: List[str]
    risk_clauses: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class RIFLPromptEvaluator:
    """
    Heuristic rubric/verification pipeline.

    1. Extract keywords from the diagnosis text
    2. Build rubric clauses tied to the requested improvement type
    3. Score generated code to determine whether clauses are satisfied
    4. Emit ternary reward: pass=1.0, partial=0.5, fail=0.0
    """

    def __init__(self, partial_reward: float = 0.5):
        self.partial_reward = partial_reward

    def evaluate(
        self,
        diagnosis: str,
        improvement_type: str,
        improved_code: str,
    ) -> Dict[str, Any]:
        rubric = self._build_rubric(diagnosis, improvement_type)
        code_lower = improved_code.lower()

        keyword_hits = sum(1 for kw in rubric.keywords if kw in code_lower)
        risk_hits = sum(1 for clause in rubric.risk_clauses if clause in code_lower)

        contains_todo = "todo" in code_lower or "pass" in code_lower
        contains_logger = "logger" in code_lower

        if len(rubric.keywords) > 4:
            required_hits = 3
        elif rubric.keywords:
            required_hits = 2
        else:
            required_hits = 2
        satisfied = keyword_hits + risk_hits
        line_count = len([line for line in improved_code.splitlines() if line.strip()])
        if contains_todo:
            verdict = "fail"
            reward = 0.0
        elif satisfied >= required_hits and line_count >= 4:
            verdict = "pass"
            reward = 1.0
        elif satisfied >= 1 or contains_logger:
            verdict = "partial"
            reward = self.partial_reward
        else:
            verdict = "fail"
            reward = 0.0

        return {
            "verdict": verdict,
            "reward": reward,
            "keyword_hits": keyword_hits,
            "risk_hits": risk_hits,
            "rubric": rubric.to_dict(),
        }

    def _build_rubric(self, diagnosis: str, improvement_type: str) -> RIFLRubric:
        keywords = self._extract_keywords(diagnosis, max_terms=4)
        type_lower = (improvement_type or "").lower()

        risk_clauses: List[str] = []
        if "bug" in type_lower or "error" in type_lower:
            risk_clauses.extend(["try:", "except", "raise", "validate"])
        if "optimization" in type_lower or "performance" in type_lower:
            risk_clauses.extend(["cache", "memo", "optimiz", "async"])
        if "feature" in type_lower or "refactor" in type_lower:
            risk_clauses.extend(["class ", "def ", "return"])
        if "error_handling" in type_lower:
            risk_clauses.extend(["logger", "warning", "fallback"])

        # Deduplicate while preserving order
        seen = set()
        deduped_keywords = []
        for kw in keywords:
            if kw not in seen:
                seen.add(kw)
                deduped_keywords.append(kw)

        seen.clear()
        deduped_risks = []
        for clause in risk_clauses:
            if clause not in seen:
                seen.add(clause)
                deduped_risks.append(clause)

        return RIFLRubric(
            improvement_type=improvement_type,
            keywords=deduped_keywords,
            risk_clauses=deduped_risks,
        )

    def _extract_keywords(self, text: str, max_terms: int = 5) -> List[str]:
        words = re.findall(r"[a-zA-Z]{5,}", text.lower())
        keywords = []
        for word in words:
            if word not in keywords:
                keywords.append(word)
            if len(keywords) >= max_terms:
                break
        return keywords or ["robust", "validate"]
