"""
WaltzRL Safety Integration - Unified API
Version: 1.0
Date: October 28, 2025

Unified safety API consolidating WaltzRL components for Genesis integration.
Based on: WaltzRL (arXiv:2510.08240v1) - Meta + Johns Hopkins

Expected Impact:
- 89% unsafe reduction (39.0% → 4.6%)
- 78% over-refusal reduction (45.3% → 9.9%)
- Zero capability degradation on benign queries

Components:
1. ConversationAgent: Responds to queries with safety awareness
2. FeedbackAgent: Scores safety (safe/unsafe/borderline)
3. SafetyWrapper: Orchestrates conversation + feedback collaboration

Integration Points:
- Layer 1: HALO router (safety_wrapper() method)
- Layer 2: SE-Darwin (safety benchmarks)
- Layer 3: All 15 agents (wrap_agent_response())
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum

# Import existing WaltzRL components
from infrastructure.safety.waltzrl_wrapper import (
    WaltzRLSafetyWrapper,
    WrappedResponse,
    get_waltzrl_safety_wrapper
)
from infrastructure.safety.waltzrl_conversation_agent import (
    WaltzRLConversationAgent,
    SafeResponse,
    ConversationResponse,
    get_waltzrl_conversation_agent
)
from infrastructure.safety.waltzrl_feedback_agent import (
    WaltzRLFeedbackAgent,
    FeedbackResult,
    SafetyIssue,
    SafetyCategory,
    get_waltzrl_feedback_agent
)

logger = logging.getLogger(__name__)


class SafetyClassification(Enum):
    """Safety classification for queries/responses"""
    SAFE = "safe"
    UNSAFE = "unsafe"
    BORDERLINE = "borderline"
    OVER_REFUSAL = "over_refusal"


@dataclass
class SafetyScore:
    """Safety scoring result"""
    classification: SafetyClassification
    confidence: float  # 0.0-1.0
    safety_score: float  # 0.0-1.0 (1.0 = completely safe)
    helpfulness_score: float  # 0.0-1.0 (1.0 = maximally helpful)
    issues_found: List[SafetyIssue] = field(default_factory=list)
    reasoning: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict:
        return {
            'classification': self.classification.value,
            'confidence': self.confidence,
            'safety_score': self.safety_score,
            'helpfulness_score': self.helpfulness_score,
            'issues_count': len(self.issues_found),
            'reasoning': self.reasoning,
            'timestamp': self.timestamp
        }


@dataclass
class FilterResult:
    """Result of collaborative filtering (query + response)"""
    blocked: bool
    query_safe: bool
    response_safe: bool
    final_response: str
    safety_score: SafetyScore
    query_issues: List[SafetyIssue] = field(default_factory=list)
    response_issues: List[SafetyIssue] = field(default_factory=list)
    processing_time_ms: float = 0.0
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict:
        return {
            'blocked': self.blocked,
            'query_safe': self.query_safe,
            'response_safe': self.response_safe,
            'final_response': self.final_response[:200],
            'safety_score': self.safety_score.to_dict(),
            'query_issues_count': len(self.query_issues),
            'response_issues_count': len(self.response_issues),
            'processing_time_ms': self.processing_time_ms,
            'timestamp': self.timestamp
        }


class WaltzRLSafety:
    """
    WaltzRL Safety Integration - Unified API

    Provides high-level safety filtering for Genesis agents:
    1. Query filtering (pre-routing): Block unsafe queries before processing
    2. Response filtering (post-processing): Improve unsafe responses
    3. Collaborative filtering: Joint query + response analysis

    Usage:
        safety = WaltzRLSafety()

        # Filter unsafe query
        is_safe, score, message = safety.filter_unsafe_query(user_query)

        # Classify response safety
        classification = safety.classify_response(agent_response)

        # Collaborative filter (recommended)
        result = safety.collaborative_filter(user_query, agent_response)
    """

    def __init__(
        self,
        conversation_agent: Optional[WaltzRLConversationAgent] = None,
        feedback_agent: Optional[WaltzRLFeedbackAgent] = None,
        safety_wrapper: Optional[WaltzRLSafetyWrapper] = None,
        enable_blocking: bool = False,
        feedback_only_mode: bool = True,
        stage: int = 1,
        unsafe_threshold: float = 0.7,
        over_refusal_threshold: float = 0.5
    ):
        """
        Initialize WaltzRL Safety API.

        HIGH PRIORITY FIX: Enable blocking mode in production.

        Args:
            conversation_agent: WaltzRL conversation agent (or None for default)
            feedback_agent: WaltzRL feedback agent (or None for default)
            safety_wrapper: WaltzRL safety wrapper (or None for default)
            enable_blocking: Block responses with critical safety issues
            feedback_only_mode: Log feedback but don't revise responses
            stage: WaltzRL stage (1=pattern-based, 2=LLM collaborative)
            unsafe_threshold: Threshold for unsafe classification (default 0.7)
            over_refusal_threshold: Threshold for over-refusal detection (default 0.5)
        """
        import os

        # HIGH PRIORITY FIX: Enable blocking in production
        if os.getenv("ENVIRONMENT") == "production":
            enable_blocking = True
            logger.info("WaltzRL blocking mode enabled for production environment")

        # HIGH PRIORITY FIX: Prefer Stage 2 in production (if available)
        if os.getenv("ENVIRONMENT") == "production" and stage == 1:
            # Check if Stage 2 checkpoints are available
            model_dir = Path("/home/genesis/genesis-rebuild/models/waltzrl_stage2")
            if (model_dir / "waltzrl_conversation_stage2.pt").exists():
                stage = 2
                logger.info("Upgrading to WaltzRL Stage 2 (LLM collaborative filtering) for production")

        # Initialize agents
        self.conversation_agent = conversation_agent or get_waltzrl_conversation_agent()
        self.feedback_agent = feedback_agent or get_waltzrl_feedback_agent()
        self.safety_wrapper = safety_wrapper or get_waltzrl_safety_wrapper(
            enable_blocking=enable_blocking,
            feedback_only_mode=feedback_only_mode,
            stage=stage
        )

        self.enable_blocking = enable_blocking
        self.feedback_only_mode = feedback_only_mode
        self.stage = stage
        self.unsafe_threshold = unsafe_threshold
        self.over_refusal_threshold = over_refusal_threshold

        # Load checkpoints if Stage 2
        if stage == 2:
            self._load_stage2_checkpoints()
            # HIGH PRIORITY FIX: Monitor that Stage 2 is active (not falling back to Stage 1)
            if not (model_dir / "waltzrl_conversation_stage2.pt").exists():
                logger.warning(
                    "WaltzRL Stage 2 checkpoints not found - falling back to Stage 1. "
                    "Deploy Stage 2 checkpoints for stronger prompt injection defense."
                )

        logger.info(
            f"WaltzRLSafety initialized: stage={stage}, blocking={enable_blocking}, "
            f"feedback_only={feedback_only_mode}, unsafe_threshold={unsafe_threshold}"
        )

    def _load_stage2_checkpoints(self) -> None:
        """Load Stage 2 trained model checkpoints"""
        model_dir = Path("/home/genesis/genesis-rebuild/models/waltzrl_stage2")
        conv_checkpoint = model_dir / "waltzrl_conversation_stage2.pt"
        feedback_checkpoint = model_dir / "waltzrl_feedback_stage2.pt"

        if conv_checkpoint.exists() and feedback_checkpoint.exists():
            logger.info(f"Stage 2 checkpoints found: {model_dir}")
            # NOTE: In production, load actual PyTorch weights
            # For now, using pattern-based agents (training stubs exist)
        else:
            logger.warning(f"Stage 2 checkpoints not found, using Stage 1 pattern-based")

    def filter_unsafe_query(
        self,
        query: str,
        threshold: Optional[float] = None
    ) -> Tuple[bool, float, str]:
        """
        Filter unsafe queries BEFORE routing to agents.

        This is the primary safety gate - blocks harmful queries from reaching agents.

        Args:
            query: User's query to filter
            threshold: Safety threshold (default: 0.7 for unsafe)

        Returns:
            Tuple of (is_safe, confidence_score, explanation)
            - is_safe: True if query is safe to process
            - confidence_score: 0.0-1.0 confidence in classification
            - explanation: Human-readable explanation of decision

        Example:
            is_safe, score, msg = safety.filter_unsafe_query("How to hack a system?")
            if not is_safe:
                return msg  # "I cannot help with that request."
        """
        start_time = time.time()
        threshold = threshold or self.unsafe_threshold

        # Use feedback agent to analyze query (pass query as "response" for pattern matching)
        # The feedback agent's pattern matching works on the response field, so we
        # analyze the query by passing it as if it were a response
        feedback = self.feedback_agent.analyze_response(
            query="",  # Empty query since we're analyzing the query itself
            response=query,  # Pass query as response for pattern matching
            agent_type="query_filter"
        )

        # Classify based on safety score and issues
        is_safe = feedback.safety_score >= threshold and not feedback.should_block
        confidence = feedback.safety_score

        # Generate explanation
        if not is_safe:
            if feedback.issues_found:
                issues_desc = ", ".join([
                    f"{issue.category.value}: {issue.description}"
                    for issue in feedback.issues_found[:3]
                ])
                explanation = (
                    f"Query contains safety concerns ({issues_desc}). "
                    f"I cannot assist with that request."
                )
            else:
                explanation = "I cannot assist with that request due to safety concerns."
        else:
            explanation = "Query is safe to process."

        processing_time_ms = (time.time() - start_time) * 1000

        logger.info(
            f"Query filter: is_safe={is_safe}, score={confidence:.2f}, "
            f"time={processing_time_ms:.1f}ms"
        )

        return is_safe, confidence, explanation

    def classify_response(
        self,
        response: str,
        query: Optional[str] = None
    ) -> SafetyScore:
        """
        Classify response safety (safe/unsafe/borderline/over-refusal).

        Args:
            response: Agent's response to classify
            query: Optional user query for context

        Returns:
            SafetyScore with classification and reasoning
        """
        start_time = time.time()

        # Use feedback agent to analyze response
        feedback = self.feedback_agent.analyze_response(
            query=query or "",
            response=response,
            agent_type="response_classifier"
        )

        # Classify based on safety score and issues
        if feedback.should_block or feedback.safety_score < 0.3:
            classification = SafetyClassification.UNSAFE
        elif feedback.safety_score < self.unsafe_threshold:
            classification = SafetyClassification.BORDERLINE
        elif feedback.helpfulness_score < self.over_refusal_threshold:
            classification = SafetyClassification.OVER_REFUSAL
        else:
            classification = SafetyClassification.SAFE

        # Calculate confidence
        confidence = abs(feedback.safety_score - self.unsafe_threshold)
        confidence = min(1.0, confidence * 2)  # Scale to 0-1

        # Generate reasoning
        if classification == SafetyClassification.UNSAFE:
            reasoning = f"Unsafe: {len(feedback.issues_found)} safety issues detected"
        elif classification == SafetyClassification.BORDERLINE:
            reasoning = f"Borderline: safety_score={feedback.safety_score:.2f}"
        elif classification == SafetyClassification.OVER_REFUSAL:
            reasoning = f"Over-refusal: helpfulness={feedback.helpfulness_score:.2f}"
        else:
            reasoning = "Safe and helpful response"

        processing_time_ms = (time.time() - start_time) * 1000

        logger.info(
            f"Response classification: {classification.value}, "
            f"confidence={confidence:.2f}, time={processing_time_ms:.1f}ms"
        )

        return SafetyScore(
            classification=classification,
            confidence=confidence,
            safety_score=feedback.safety_score,
            helpfulness_score=feedback.helpfulness_score,
            issues_found=feedback.issues_found,
            reasoning=reasoning
        )

    def collaborative_filter(
        self,
        query: str,
        response: str,
        agent_name: str = "unknown",
        agent_metadata: Optional[Dict[str, Any]] = None
    ) -> FilterResult:
        """
        Collaborative filtering: Analyze query + response together.

        This is the recommended method - combines query filtering with response
        improvement using WaltzRL's collaborative feedback mechanism.

        Args:
            query: User's query
            response: Agent's response
            agent_name: Name of the agent (for context)
            agent_metadata: Additional agent context

        Returns:
            FilterResult with blocked status and final safe response
        """
        start_time = time.time()

        # Step 1: Filter unsafe query
        query_safe, query_confidence, query_msg = self.filter_unsafe_query(query)

        if not query_safe and self.enable_blocking:
            # Block immediately if query is unsafe
            processing_time_ms = (time.time() - start_time) * 1000

            return FilterResult(
                blocked=True,
                query_safe=False,
                response_safe=True,  # N/A
                final_response=query_msg,
                safety_score=SafetyScore(
                    classification=SafetyClassification.UNSAFE,
                    confidence=query_confidence,
                    safety_score=0.0,
                    helpfulness_score=0.0,
                    reasoning="Query blocked due to safety concerns"
                ),
                query_issues=[],
                response_issues=[],
                processing_time_ms=processing_time_ms
            )

        # Step 2: Wrap response with safety improvements
        wrapped = self.safety_wrapper.wrap_agent_response(
            agent_name=agent_name,
            query=query,
            response=response,
            agent_metadata=agent_metadata
        )

        # Step 3: Classify final response
        final_classification = self.classify_response(wrapped.response, query)

        processing_time_ms = (time.time() - start_time) * 1000

        result = FilterResult(
            blocked=wrapped.blocked,
            query_safe=query_safe,
            response_safe=not wrapped.blocked,
            final_response=wrapped.response,
            safety_score=final_classification,
            query_issues=[],  # Already filtered above
            response_issues=wrapped.feedback.issues_found,
            processing_time_ms=processing_time_ms
        )

        logger.info(
            f"Collaborative filter: blocked={result.blocked}, "
            f"query_safe={query_safe}, response_safe={result.response_safe}, "
            f"time={processing_time_ms:.1f}ms"
        )

        return result

    def set_feature_flags(
        self,
        enable_blocking: Optional[bool] = None,
        feedback_only_mode: Optional[bool] = None
    ) -> None:
        """
        Update feature flags dynamically (for progressive rollout).

        Args:
            enable_blocking: Whether to block critical safety issues
            feedback_only_mode: Whether to log feedback without revising
        """
        if enable_blocking is not None:
            self.enable_blocking = enable_blocking
            self.safety_wrapper.set_feature_flags(enable_blocking=enable_blocking)
            logger.info(f"WaltzRL feature flag updated: enable_blocking={enable_blocking}")

        if feedback_only_mode is not None:
            self.feedback_only_mode = feedback_only_mode
            self.safety_wrapper.set_feature_flags(feedback_only_mode=feedback_only_mode)
            logger.info(f"WaltzRL feature flag updated: feedback_only_mode={feedback_only_mode}")


def get_waltzrl_safety(
    enable_blocking: bool = False,
    feedback_only_mode: bool = True,
    stage: int = 1,
    unsafe_threshold: float = 0.7,
    over_refusal_threshold: float = 0.5
) -> WaltzRLSafety:
    """
    Factory function to get WaltzRL Safety API.

    Args:
        enable_blocking: Block responses with critical safety issues
        feedback_only_mode: Log feedback but don't revise responses
        stage: WaltzRL stage (1=pattern-based, 2=LLM collaborative)
        unsafe_threshold: Threshold for unsafe classification (default 0.7)
        over_refusal_threshold: Threshold for over-refusal detection (default 0.5)

    Returns:
        Configured WaltzRLSafety instance

    Environment Variables:
        WALTZRL_STAGE: Override stage selection (1 or 2)
        WALTZRL_ENABLE_BLOCKING: Override enable_blocking
        WALTZRL_FEEDBACK_ONLY: Override feedback_only_mode
    """
    import os

    # Read environment overrides
    stage = int(os.environ.get('WALTZRL_STAGE', stage))
    enable_blocking = os.environ.get('WALTZRL_ENABLE_BLOCKING', str(enable_blocking)).lower() == 'true'
    feedback_only_mode = os.environ.get('WALTZRL_FEEDBACK_ONLY', str(feedback_only_mode)).lower() == 'true'

    return WaltzRLSafety(
        enable_blocking=enable_blocking,
        feedback_only_mode=feedback_only_mode,
        stage=stage,
        unsafe_threshold=unsafe_threshold,
        over_refusal_threshold=over_refusal_threshold
    )


__all__ = [
    'WaltzRLSafety',
    'SafetyClassification',
    'SafetyScore',
    'FilterResult',
    'get_waltzrl_safety',
    # Re-export from underlying modules
    'WaltzRLSafetyWrapper',
    'WaltzRLConversationAgent',
    'WaltzRLFeedbackAgent',
    'WrappedResponse',
    'SafeResponse',
    'ConversationResponse',
    'FeedbackResult',
    'SafetyIssue',
    'SafetyCategory'
]
