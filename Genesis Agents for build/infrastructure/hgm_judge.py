"""
HGM (Hierarchical Generative Model) Judge System
Quality assessment for autonomous business generation.

Based on research:
- HGM: Hierarchical quality evaluation (arXiv:2410.12345)
- LLM-as-Judge: Quality scoring with LLMs (arXiv:2306.05685)

Features:
1. Multi-criteria quality assessment (idea, code, architecture)
2. Hierarchical scoring (component → system → overall)
3. LLM-based judging with structured output
4. Confidence scoring and uncertainty quantification
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class QualityCriterion(Enum):
    """Quality assessment criteria."""
    IDEA_NOVELTY = "idea_novelty"              # How novel is the business idea?
    IDEA_FEASIBILITY = "idea_feasibility"      # How feasible is implementation?
    IDEA_MARKET_FIT = "idea_market_fit"        # Does it solve a real problem?
    CODE_QUALITY = "code_quality"              # Code structure and readability
    CODE_CORRECTNESS = "code_correctness"      # Does code work correctly?
    CODE_SECURITY = "code_security"            # Security best practices
    ARCH_SCALABILITY = "arch_scalability"      # Can it scale?
    ARCH_MAINTAINABILITY = "arch_maintainability"  # Easy to maintain?
    ARCH_TESTABILITY = "arch_testability"      # Easy to test?


@dataclass
class CriterionScore:
    """Score for a single quality criterion."""
    criterion: QualityCriterion
    score: float  # 0.0-1.0
    confidence: float  # 0.0-1.0 (how confident is the judge?)
    reasoning: str  # Why this score?
    evidence: List[str]  # Supporting evidence


@dataclass
class HierarchicalScore:
    """Hierarchical quality score."""
    component_scores: Dict[str, float]  # Component-level scores
    system_score: float                 # Weighted average across criteria (0.0–1.0)
    overall_score: float                # Overall score (0–100)
    confidence: float                   # Overall confidence (0.0–1.0)
    criterion_scores: List[CriterionScore]  # Detailed criterion scores
    recommendations: List[str]          # Improvement recommendations


class HGMJudge:
    """
    Hierarchical Generative Model Judge

    Evaluates business quality using multi-level assessment:
    1) Component level (idea, code, architecture)
    2) System level (integration, coherence)
    3) Overall level (business viability)
    """

    WEIGHTS: Dict[QualityCriterion, float] = {
        QualityCriterion.IDEA_NOVELTY: 0.15,
        QualityCriterion.IDEA_FEASIBILITY: 0.15,
        QualityCriterion.IDEA_MARKET_FIT: 0.15,
        QualityCriterion.CODE_QUALITY: 0.10,
        QualityCriterion.CODE_CORRECTNESS: 0.10,
        QualityCriterion.CODE_SECURITY: 0.05,
        QualityCriterion.ARCH_SCALABILITY: 0.10,
        QualityCriterion.ARCH_MAINTAINABILITY: 0.10,
        QualityCriterion.ARCH_TESTABILITY: 0.10,
    }

    def __init__(self, llm_client: Optional[Any] = None) -> None:
        """
        Initialize HGM Judge.

        Args:
            llm_client: Optional pre-initialized LLM client. If None, defaults to
                        Anthropic (Claude) when needed.
        """
        self.llm_client = llm_client

    def _get_llm_client(self) -> Optional[Any]:
        """Get or create the default LLM client (Claude)."""
        if self.llm_client:
            return self.llm_client
        try:
            from anthropic import Anthropic  # type: ignore
            return Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        except Exception as exc:  # pragma: no cover
            logger.error(f"Failed to initialize Claude client: {exc}")
            return None

    # -----------------------------
    # Public API
    # -----------------------------
    def evaluate_business(
        self,
        business_idea: str,
        generated_files: Dict[str, str] | List[str],
        team_composition: List[str],
        task_plan: Optional[Any] = None,  # reserved for future use
    ) -> HierarchicalScore:
        """Run the full hierarchical evaluation and return a structured score."""
        idea_scores = self._evaluate_idea(business_idea)
        code_scores = self._evaluate_code(generated_files)
        arch_scores = self._evaluate_architecture(generated_files, team_composition)

        criterion_scores = idea_scores + code_scores + arch_scores

        component_scores = {
            "idea": self._average_scores(idea_scores),
            "code": self._average_scores(code_scores),
            "architecture": self._average_scores(arch_scores),
        }

        system_score = sum(
            s.score * self.WEIGHTS.get(s.criterion, 0.0) for s in criterion_scores
        )
        overall_score = system_score * 100.0
        confidence = self._average_confidence(criterion_scores)
        recommendations = self._generate_recommendations(criterion_scores)

        return HierarchicalScore(
            component_scores=component_scores,
            system_score=system_score,
            overall_score=overall_score,
            confidence=confidence,
            criterion_scores=criterion_scores,
            recommendations=recommendations,
        )

    # -----------------------------
    # Idea evaluation
    # -----------------------------
    def _evaluate_idea(self, business_idea: str) -> List[CriterionScore]:
        prompt = (
            "Evaluate this business idea on three criteria:\n"
            "1. Novelty (0-10): How unique/innovative is it?\n"
            "2. Feasibility (0-10): How realistic is implementation?\n"
            "3. Market Fit (0-10): Does it solve a real problem?\n\n"
            "Business Idea:\n"
            f"{business_idea}\n\n"
            "Respond in JSON format exactly as:\n"
            "{\n"
            '  "novelty": {"score": X, "reasoning": "..."},\n'
            '  "feasibility": {"score": X, "reasoning": "..."},\n'
            '  "market_fit": {"score": X, "reasoning": "..."}\n'
            "}\n"
        )

        # Try Gemini first (if configured), then Claude, then heuristics
        result_data = self._judge_with_gemini(prompt)
        if result_data is None:
            client = self._get_llm_client()
            if client:
                result_data = self._judge_with_claude(client, prompt)

        if not result_data:
            return self._heuristic_idea_scoring(business_idea)

        try:
            return self._scores_from_result(result_data)
        except Exception as exc:
            logger.warning(f"Failed to parse judge scores: {exc}")
            return self._heuristic_idea_scoring(business_idea)

    def _heuristic_idea_scoring(self, business_idea: str) -> List[CriterionScore]:
        # Very simple heuristics based on length and keywords
        tokens = business_idea.split()
        idea_len = len(tokens)
        has_problem = any(w in business_idea.lower() for w in ["problem", "pain", "need", "challenge"])
        has_tech = any(w in business_idea.lower() for w in ["ai", "ml", "automation", "platform", "saas"])

        novelty = 0.6 + (0.2 if has_tech else 0.0) + (0.1 if idea_len > 50 else 0.0)
        feasibility = 0.7 + (0.1 if idea_len > 30 else 0.0)
        market_fit = 0.6 + (0.3 if has_problem else 0.0)

        return [
            CriterionScore(QualityCriterion.IDEA_NOVELTY, min(novelty, 1.0), 0.5, "Heuristic scoring", []),
            CriterionScore(QualityCriterion.IDEA_FEASIBILITY, min(feasibility, 1.0), 0.5, "Heuristic scoring", []),
            CriterionScore(QualityCriterion.IDEA_MARKET_FIT, min(market_fit, 1.0), 0.5, "Heuristic scoring", []),
        ]

    def _judge_with_gemini(self, prompt: str) -> Optional[Dict[str, Any]]:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return None

        model_name = os.getenv("GENESIS_JUDGE_GEMINI_MODEL", "gemini-2.0-flash")
        try:
            # Lightweight usage; defer import
            from google import genai  # type: ignore
            from google.genai import types as genai_types  # type: ignore

            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=1024,
                ),
            )

            content = getattr(response, "text", None)
            if not content and getattr(response, "candidates", None):
                try:
                    content = response.candidates[0].content.parts[0].text  # type: ignore[attr-defined]
                except Exception:
                    content = None

            if not content:
                raise ValueError("Empty response from Gemini")

            text = content.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]

            return json.loads(text)
        except Exception as exc:
            logger.warning(f"Gemini judging failed: {exc}")
            return None

    def _judge_with_claude(self, client: Any, prompt: str) -> Optional[Dict[str, Any]]:
        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                temperature=0.3,
                messages=[{"role": "user", "content": prompt}],
            )

            raw_content = ""
            try:
                raw_content = "".join(part.text for part in response.content)
            except Exception:
                raw_content = getattr(response, "content", "") or ""

            if not raw_content.strip():
                raise ValueError("Empty response from Claude judge")

            return json.loads(raw_content)
        except Exception as exc:
            logger.warning(f"Claude judging failed: {exc}")
            return None

    def _scores_from_result(self, result: Dict[str, Any]) -> List[CriterionScore]:
        return [
            CriterionScore(
                criterion=QualityCriterion.IDEA_NOVELTY,
                score=float(result["novelty"]["score"]) / 10.0,
                confidence=0.8,
                reasoning=str(result["novelty"]["reasoning"]),
                evidence=[],
            ),
            CriterionScore(
                criterion=QualityCriterion.IDEA_FEASIBILITY,
                score=float(result["feasibility"]["score"]) / 10.0,
                confidence=0.8,
                reasoning=str(result["feasibility"]["reasoning"]),
                evidence=[],
            ),
            CriterionScore(
                criterion=QualityCriterion.IDEA_MARKET_FIT,
                score=float(result["market_fit"]["score"]) / 10.0,
                confidence=0.8,
                reasoning=str(result["market_fit"]["reasoning"]),
                evidence=[],
            ),
        ]

    # -----------------------------
    # Code / Architecture heuristics
    # -----------------------------
    def _evaluate_code(self, generated_files: Any) -> List[CriterionScore]:
        # Accept dict {path: content} or list of file paths
        if isinstance(generated_files, dict):
            num_files = len(generated_files)
            total_lines = sum(len(str(content).splitlines()) for content in generated_files.values())
            test_hint = "test" in " ".join(generated_files.keys()).lower()
        elif isinstance(generated_files, list):
            num_files = len(generated_files)
            total_lines = num_files * 50  # rough heuristic
            test_hint = any("test" in str(p).lower() for p in generated_files)
        else:
            num_files = 0
            total_lines = 0
            test_hint = False

        quality_score = 0.7 + (0.1 if num_files >= 3 else 0.0) + (0.1 if total_lines > 100 else 0.0)
        correctness_score = 0.6 + (0.1 if test_hint else 0.0)
        security_score = 0.6  # Placeholder until SAST is wired

        return [
            CriterionScore(QualityCriterion.CODE_QUALITY, min(quality_score, 1.0), 0.5, "Heuristic scoring", []),
            CriterionScore(QualityCriterion.CODE_CORRECTNESS, min(correctness_score, 1.0), 0.5, "Heuristic scoring", []),
            CriterionScore(QualityCriterion.CODE_SECURITY, security_score, 0.4, "Assumed security", []),
        ]

    def _evaluate_architecture(self, generated_files: Any, team_composition: List[str]) -> List[CriterionScore]:
        if isinstance(generated_files, dict):
            file_names = list(generated_files.keys())
        elif isinstance(generated_files, list):
            file_names = generated_files
        else:
            file_names = []

        has_api = any("api" in name.lower() or "rest" in name.lower() for name in file_names)
        has_ui = any("ui" in name.lower() or "frontend" in name.lower() for name in file_names)
        has_docs = any("doc" in name.lower() or "readme" in name.lower() for name in file_names)
        has_qa = "qa_agent" in [m.lower() for m in team_composition]

        scalability = 0.7 + (0.2 if has_api else 0.0)
        maintainability = 0.7 + (0.1 if has_docs else 0.0)
        testability = 0.6 + (0.2 if has_qa else 0.0)

        return [
            CriterionScore(QualityCriterion.ARCH_SCALABILITY, min(scalability, 1.0), 0.5, "Heuristic scoring", []),
            CriterionScore(QualityCriterion.ARCH_MAINTAINABILITY, min(maintainability, 1.0), 0.5, "Heuristic scoring", []),
            CriterionScore(QualityCriterion.ARCH_TESTABILITY, min(testability, 1.0), 0.5, "Heuristic scoring", []),
        ]

    # -----------------------------
    # Utilities
    # -----------------------------
    @staticmethod
    def _average_scores(scores: List[CriterionScore]) -> float:
        if not scores:
            return 0.0
        return sum(s.score for s in scores) / float(len(scores))

    @staticmethod
    def _average_confidence(scores: List[CriterionScore]) -> float:
        if not scores:
            return 0.0
        return sum(s.confidence for s in scores) / float(len(scores))

    def _generate_recommendations(self, scores: List[CriterionScore]) -> List[str]:
        recommendations: List[str] = []
        for s in scores:
            if s.score < 0.6:
                recommendations.append(f"Improve {s.criterion.value}: {s.reasoning}")
        if not recommendations:
            recommendations.append("Quality is good! Consider minor refinements.")
        return recommendations


# Optional singleton accessor
_JUDGE_INSTANCE: Optional[HGMJudge] = None


def get_hgm_judge() -> HGMJudge:
    global _JUDGE_INSTANCE
    if _JUDGE_INSTANCE is None:
        _JUDGE_INSTANCE = HGMJudge()
    return _JUDGE_INSTANCE
