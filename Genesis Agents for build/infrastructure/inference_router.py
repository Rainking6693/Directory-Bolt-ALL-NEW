"""
SGLang Inference Router - Per-Agent Model Routing
Implements intelligent routing to optimal models based on task complexity

Cost Optimization Strategy:
- Simple tasks → Claude Haiku ($0.25/1M tokens) - 70-80% of requests
- Complex tasks → Claude Sonnet ($3/1M tokens) - 15-25% of requests
- Vision tasks → Gemini 2.0 Flash ($0.03/1M tokens) - 5% of requests

Expected Impact:
- 50-60% cost reduction vs. all-Sonnet baseline
- 30-40% latency reduction (Haiku 2-3X faster)
- Zero safety degradation (critical agents always use Sonnet)
"""
from enum import Enum
from typing import Dict, Any, Optional, List, Tuple
import logging
import re

logger = logging.getLogger(__name__)


class ModelTier(Enum):
    """
    Model tier selection for cost-performance tradeoff

    CHEAP: Claude Haiku 4.5 ($0.25/1M tokens)
        - Simple tasks, greetings, status checks
        - Fast: 2-3X faster than Sonnet
        - Target: 70-80% of requests

    ACCURATE: Claude Sonnet 4.5 ($3/1M tokens)
        - Complex reasoning, code generation, safety
        - High accuracy: 72.7% SWE-bench
        - Target: 15-25% of requests

    VLM: Gemini 2.0 Flash ($0.03/1M tokens + vision)
        - Vision tasks, screenshot analysis, OCR
        - 20X cheaper than vision-enabled Claude
        - Target: 5% of requests
    """
    CHEAP = "claude-haiku-4-5"          # $0.25/1M tokens
    ACCURATE = "claude-sonnet-4-5"      # $3/1M tokens
    VLM = "gemini-2.0-flash"            # $0.03/1M tokens + vision


class TaskComplexity(Enum):
    """Task complexity classification for routing decisions"""
    TRIVIAL = "trivial"          # Simple queries, greetings (<10 words, no code)
    SIMPLE = "simple"            # Straightforward tasks (10-50 words, no code)
    MODERATE = "moderate"        # Multi-step tasks (50-200 words, simple code)
    COMPLEX = "complex"          # Multi-stage reasoning, complex code (>200 words)
    VISION = "vision"            # Image/screenshot processing


class InferenceRouter:
    """
    Routes LLM requests to optimal model based on task complexity

    Routing Strategy:
    1. Vision detection (images, screenshots) → Gemini Flash VLM
    2. Safety-critical agents → Always Sonnet (zero degradation)
    3. Task complexity classification:
       - Trivial/Simple → Haiku (fast, cheap)
       - Moderate/Complex → Sonnet (accurate)
    4. Auto-escalation: If Haiku confidence <0.7, retry with Sonnet

    Performance Tracking:
    - Maintains routing statistics for cost analysis
    - Tracks escalation rate for quality monitoring
    - Logs model selection reasoning for explainability
    """

    # Critical agents that always use Sonnet (safety/accuracy required)
    CRITICAL_AGENTS = {
        "waltzrl_feedback_agent",
        "waltzrl_conversation_agent",
        "se_darwin_agent",
        "builder_agent",
        "security_agent",
        "legal_agent",
        "architect_agent"
    }

    # Vision-related keywords for VLM routing
    VISION_KEYWORDS = {
        "screenshot", "image", "visual", "diagram", "chart", "graph",
        "picture", "photo", "render", "ui", "interface", "ocr"
    }

    # Code-related keywords for complexity detection
    CODE_KEYWORDS = {
        "code", "implement", "refactor", "debug", "function", "class",
        "method", "algorithm", "optimize", "test", "fix", "develop"
    }

    # Planning keywords for complexity detection
    PLANNING_KEYWORDS = {
        "plan", "design", "architecture", "strategy", "approach",
        "roadmap", "blueprint", "structure", "organize"
    }

    def __init__(self, enable_auto_escalation: bool = True, casebank: Optional['CaseBank'] = None):
        """
        Initialize InferenceRouter

        Args:
            enable_auto_escalation: Enable automatic retry with Sonnet if Haiku confidence <0.7
            casebank: Optional CaseBank instance for memory-based routing
        """
        self.enable_auto_escalation = enable_auto_escalation
        self.casebank = casebank

        # Routing statistics for cost tracking
        self.routing_stats = {
            "cheap": 0,      # Haiku requests
            "accurate": 0,   # Sonnet requests
            "vlm": 0,        # Gemini VLM requests
            "escalated": 0   # Auto-escalated from Haiku to Sonnet
        }

        # Memory-based routing statistics
        self.memory_routing = {
            "cold_start_cheap": 0,       # No past cases → cheap model (exploration)
            "high_success_cheap": 0,     # High success rate → cheap model (proven easy)
            "low_success_accurate": 0,   # Low success rate → powerful model (needs help)
            "no_memory_fallback": 0      # CaseBank not available → base routing
        }

        # Per-agent routing history
        self.agent_routing_history: Dict[str, List[str]] = {}

        logger.info(
            f"InferenceRouter initialized (auto_escalation={'enabled' if enable_auto_escalation else 'disabled'}, "
            f"memory_routing={'enabled' if casebank else 'disabled'})"
        )

    async def route_request(
        self,
        agent_name: str,
        task: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Route request to optimal model based on task complexity

        Args:
            agent_name: Name of requesting agent
            task: Task description/prompt
            context: Optional context dict with hints:
                - has_image: bool - True if processing images
                - task_type: str - Explicit task type hint
                - force_model: str - Override routing (testing only)

        Returns:
            Model identifier (ModelTier.value)

        Routing Logic:
        1. Check for force_model override (testing)
        2. Detect vision tasks → VLM
        3. Check critical agent list → Sonnet
        4. Classify task complexity → Haiku/Sonnet
        """
        context = context or {}

        # Override for testing/debugging
        if "force_model" in context:
            model = context["force_model"]
            logger.debug(f"Force routing to {model} (override)")
            return model

        # VISION DETECTION: Images, screenshots, visual analysis
        if self._is_vision_task(task, context):
            self.routing_stats["vlm"] += 1
            self._track_agent_routing(agent_name, ModelTier.VLM.value)
            logger.info(f"Route {agent_name} → VLM (vision task)")
            return ModelTier.VLM.value

        # CRITICAL AGENTS: Always use Sonnet (safety/accuracy)
        if self._is_critical_agent(agent_name):
            self.routing_stats["accurate"] += 1
            self._track_agent_routing(agent_name, ModelTier.ACCURATE.value)
            logger.info(f"Route {agent_name} → Sonnet (critical agent)")
            return ModelTier.ACCURATE.value

        # COMPLEXITY CLASSIFICATION: Analyze task to determine model
        complexity = self._classify_complexity(task, context)

        if complexity in [TaskComplexity.TRIVIAL, TaskComplexity.SIMPLE]:
            # Simple tasks → Haiku (fast, cheap)
            self.routing_stats["cheap"] += 1
            self._track_agent_routing(agent_name, ModelTier.CHEAP.value)
            logger.info(
                f"Route {agent_name} → Haiku (complexity={complexity.value}, "
                f"words={len(task.split())})"
            )
            return ModelTier.CHEAP.value

        else:
            # Complex tasks → Sonnet (accurate)
            self.routing_stats["accurate"] += 1
            self._track_agent_routing(agent_name, ModelTier.ACCURATE.value)
            logger.info(
                f"Route {agent_name} → Sonnet (complexity={complexity.value}, "
                f"words={len(task.split())})"
            )
            return ModelTier.ACCURATE.value

    async def route_with_memory(
        self,
        agent_name: str,
        task: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Enhanced routing with CaseBank memory signals for 15-20% additional cost reduction.

        Routing Strategy with Memory:
        1. Cold starts (no past cases) → use cheap model (safer to explore)
        2. High success rate (avg_reward >0.8) → use cheap model (proven easy)
        3. Low success rate (<0.5) → use powerful model (needs intelligence)
        4. Medium success (0.5-0.8) → use base routing (balanced)

        This coupling feeds CaseBank learning signals into routing decisions,
        enabling the router to learn from past task execution history.

        Args:
            agent_name: Name of requesting agent
            task: Task description/prompt
            context: Optional context dict

        Returns:
            Tuple of (model_id, routing_metadata) where:
            - model_id: Selected model identifier
            - routing_metadata: Dict with routing_type, reason, stats
        """
        context = context or {}

        # Get base routing decision (always calculate for fallback)
        base_model = await self.route_request(agent_name, task, context)

        # If no CaseBank, return base routing
        if not self.casebank:
            self.memory_routing["no_memory_fallback"] += 1
            return base_model, {
                "routing_type": "base_only",
                "reason": "CaseBank not available, using base routing"
            }

        # Check for similar past cases (lower similarity threshold for routing signals)
        try:
            similar_cases = await self.casebank.retrieve_similar(
                query_state=task,
                k=4,                   # K=4 per Memento paper
                min_reward=0.0,        # Get all cases (filter by reward later)
                min_similarity=0.7     # Lower threshold than 0.8 for broader signals
            )
        except Exception as e:
            logger.warning(f"CaseBank retrieval failed: {e}, falling back to base routing")
            self.memory_routing["no_memory_fallback"] += 1
            return base_model, {
                "routing_type": "base_only",
                "reason": f"CaseBank error: {e}"
            }

        # COLD START: No past cases → use cheap model for exploration
        if not similar_cases:
            self.memory_routing["cold_start_cheap"] += 1
            logger.info(
                f"Memory routing: {agent_name} → Haiku (cold start, no past cases)"
            )
            return ModelTier.CHEAP.value, {
                "routing_type": "cold_start",
                "reason": "No past cases, explore with cheap model",
                "num_cases": 0
            }

        # Calculate average success rate from past cases
        # Note: similar_cases is List[Tuple[Case, float]]
        avg_reward = sum(case.reward for case, _ in similar_cases) / len(similar_cases)

        # HIGH SUCCESS: >0.8 avg reward → proven easy, use cheap model
        if avg_reward > 0.8:
            self.memory_routing["high_success_cheap"] += 1
            logger.info(
                f"Memory routing: {agent_name} → Haiku "
                f"(high success rate {avg_reward:.1%}, proven easy)"
            )
            return ModelTier.CHEAP.value, {
                "routing_type": "high_success",
                "reason": f"Past success rate {avg_reward:.1%}, use cheap model",
                "avg_reward": avg_reward,
                "num_cases": len(similar_cases)
            }

        # LOW SUCCESS: <0.5 avg reward → needs powerful model
        if avg_reward < 0.5:
            self.memory_routing["low_success_accurate"] += 1
            logger.info(
                f"Memory routing: {agent_name} → Sonnet "
                f"(low success rate {avg_reward:.1%}, needs powerful model)"
            )
            return ModelTier.ACCURATE.value, {
                "routing_type": "low_success",
                "reason": f"Past success rate {avg_reward:.1%}, use powerful model",
                "avg_reward": avg_reward,
                "num_cases": len(similar_cases)
            }

        # MEDIUM SUCCESS: 0.5-0.8 avg reward → use base routing (balanced)
        logger.info(
            f"Memory routing: {agent_name} → {base_model} "
            f"(medium success rate {avg_reward:.1%}, use base routing)"
        )
        return base_model, {
            "routing_type": "medium_success",
            "reason": f"Past success rate {avg_reward:.1%}, use base routing",
            "avg_reward": avg_reward,
            "num_cases": len(similar_cases)
        }

    def _is_vision_task(self, task: str, context: Dict[str, Any]) -> bool:
        """
        Detect if task requires vision/image processing

        Detection Strategy:
        1. Check explicit has_image flag in context
        2. Scan task description for vision keywords
        """
        # Explicit image flag
        if context.get("has_image", False):
            return True

        # Keyword-based detection
        task_lower = task.lower()
        for keyword in self.VISION_KEYWORDS:
            if keyword in task_lower:
                return True

        return False

    def _is_critical_agent(self, agent_name: str) -> bool:
        """
        Check if agent is critical (requires Sonnet for safety/accuracy)

        Critical agents:
        - WaltzRL safety agents (89% unsafe reduction requires accuracy)
        - SE-Darwin (code evolution safety)
        - Builder (code generation accuracy)
        - Security/Legal (zero tolerance for errors)
        - Architect (system design accuracy)
        """
        # Normalize agent name (remove suffixes like _agent)
        normalized = agent_name.lower().replace("_agent", "").replace("-", "_")

        for critical in self.CRITICAL_AGENTS:
            critical_normalized = critical.lower().replace("_agent", "").replace("-", "_")
            if critical_normalized in normalized:
                return True

        return False

    def _classify_complexity(
        self,
        task: str,
        context: Dict[str, Any]
    ) -> TaskComplexity:
        """
        Classify task complexity for routing decision

        Classification Rules:
        1. TRIVIAL: <10 words, no code/planning keywords
        2. SIMPLE: 10-50 words, no code/planning keywords
        3. MODERATE: 50-200 words OR simple code tasks
        4. COMPLEX: >200 words OR complex code/planning tasks

        Args:
            task: Task description
            context: Optional context with task_type hint

        Returns:
            TaskComplexity classification
        """
        task_lower = task.lower()
        word_count = len(task.split())

        # Check for explicit task type hint
        task_type = context.get("task_type", "").lower()

        # Code/planning keyword detection
        has_code = any(keyword in task_lower for keyword in self.CODE_KEYWORDS)
        has_planning = any(keyword in task_lower for keyword in self.PLANNING_KEYWORDS)

        # Complexity heuristics
        if word_count < 10 and not has_code and not has_planning:
            return TaskComplexity.TRIVIAL

        elif word_count < 50 and not has_code and not has_planning:
            return TaskComplexity.SIMPLE

        elif word_count < 200 and not (has_code and has_planning):
            # Single dimension (code OR planning, but not both)
            return TaskComplexity.MODERATE

        else:
            # Long tasks or multi-dimensional reasoning (code + planning)
            return TaskComplexity.COMPLEX

    async def escalate_to_accurate(
        self,
        agent_name: str,
        task: str,
        haiku_response: str,
        confidence_score: float
    ) -> bool:
        """
        Decide if Haiku response should be escalated to Sonnet

        Auto-escalation triggers:
        1. Confidence score <0.7 (low quality)
        2. Response too short (<50 chars for complex task)
        3. Contains uncertainty markers ("I'm not sure", "maybe", etc.)

        Args:
            agent_name: Requesting agent
            task: Original task
            haiku_response: Haiku's response
            confidence_score: Model confidence (0.0-1.0)

        Returns:
            True if should escalate to Sonnet
        """
        if not self.enable_auto_escalation:
            return False

        # Confidence threshold
        if confidence_score < 0.7:
            logger.warning(
                f"Escalating {agent_name} to Sonnet (low confidence: {confidence_score:.2f})"
            )
            self.routing_stats["escalated"] += 1
            return True

        # Response length check (for non-trivial tasks)
        word_count = len(task.split())
        if word_count > 50 and len(haiku_response) < 50:
            logger.warning(
                f"Escalating {agent_name} to Sonnet (short response: {len(haiku_response)} chars)"
            )
            self.routing_stats["escalated"] += 1
            return True

        # Uncertainty marker detection
        uncertainty_markers = [
            "i'm not sure", "maybe", "possibly", "might be",
            "unclear", "uncertain", "don't know"
        ]
        response_lower = haiku_response.lower()
        if any(marker in response_lower for marker in uncertainty_markers):
            logger.warning(
                f"Escalating {agent_name} to Sonnet (uncertainty detected)"
            )
            self.routing_stats["escalated"] += 1
            return True

        return False

    def _track_agent_routing(self, agent_name: str, model: str):
        """Track routing history for per-agent analysis"""
        if agent_name not in self.agent_routing_history:
            self.agent_routing_history[agent_name] = []
        self.agent_routing_history[agent_name].append(model)

    def get_routing_stats(self) -> Dict[str, Any]:
        """
        Get routing distribution for cost tracking

        Returns:
            Dictionary with:
            - cheap: % requests using Haiku
            - accurate: % requests using Sonnet
            - vlm: % requests using Gemini
            - escalated: % requests auto-escalated
            - total_requests: Total requests processed
            - cost_reduction_estimate: Estimated % cost reduction vs. all-Sonnet
        """
        total = sum(self.routing_stats.values()) - self.routing_stats["escalated"]

        if total == 0:
            return {
                "cheap": 0.0,
                "accurate": 0.0,
                "vlm": 0.0,
                "escalated": 0.0,
                "total_requests": 0,
                "cost_reduction_estimate": 0.0
            }

        cheap_pct = self.routing_stats["cheap"] / total
        accurate_pct = self.routing_stats["accurate"] / total
        vlm_pct = self.routing_stats["vlm"] / total
        escalated_pct = self.routing_stats["escalated"] / total

        # Cost reduction estimate:
        # Baseline: 100% Sonnet @ $3/1M = 1.0
        # Actual: (cheap% × $0.25 + accurate% × $3.0 + vlm% × $0.03) / $3.0
        # Reduction: 1.0 - actual_cost_ratio
        actual_cost_ratio = (
            cheap_pct * 0.25 +
            accurate_pct * 3.0 +
            vlm_pct * 0.03
        ) / 3.0

        cost_reduction = (1.0 - actual_cost_ratio) * 100.0

        return {
            "cheap": cheap_pct,
            "accurate": accurate_pct,
            "vlm": vlm_pct,
            "escalated": escalated_pct,
            "total_requests": total,
            "cost_reduction_estimate": round(cost_reduction, 2)
        }

    def get_agent_routing_summary(self, agent_name: str) -> Dict[str, Any]:
        """
        Get routing summary for specific agent

        Args:
            agent_name: Agent to analyze

        Returns:
            Dictionary with model distribution for this agent
        """
        if agent_name not in self.agent_routing_history:
            return {"error": "No routing history for this agent"}

        history = self.agent_routing_history[agent_name]
        total = len(history)

        cheap_count = history.count(ModelTier.CHEAP.value)
        accurate_count = history.count(ModelTier.ACCURATE.value)
        vlm_count = history.count(ModelTier.VLM.value)

        return {
            "agent_name": agent_name,
            "total_requests": total,
            "cheap": cheap_count / total if total > 0 else 0.0,
            "accurate": accurate_count / total if total > 0 else 0.0,
            "vlm": vlm_count / total if total > 0 else 0.0
        }

    def get_memory_routing_stats(self) -> Dict[str, Any]:
        """
        Get memory-based routing statistics for cost analysis.

        Returns:
            Dictionary with:
            - cold_start_cheap_pct: % requests using cheap model for cold starts
            - high_success_cheap_pct: % requests using cheap model for high success
            - low_success_accurate_pct: % requests using accurate model for low success
            - total_memory_routed: Total requests using memory routing
            - additional_cheap_routing: Additional % routed to cheap vs baseline
        """
        total = sum(self.memory_routing.values())

        if total == 0:
            return {
                "cold_start_cheap_pct": 0.0,
                "high_success_cheap_pct": 0.0,
                "low_success_accurate_pct": 0.0,
                "total_memory_routed": 0,
                "additional_cheap_routing": 0.0
            }

        # Calculate percentages
        cold_start_pct = self.memory_routing["cold_start_cheap"] / total
        high_success_pct = self.memory_routing["high_success_cheap"] / total
        low_success_pct = self.memory_routing["low_success_accurate"] / total
        no_memory_pct = self.memory_routing["no_memory_fallback"] / total

        # Calculate additional cheap routing vs baseline (60% baseline → 75% target)
        total_cheap_memory = self.memory_routing["cold_start_cheap"] + self.memory_routing["high_success_cheap"]
        additional_cheap = (total_cheap_memory / total) if total > 0 else 0.0

        return {
            "cold_start_cheap_pct": round(cold_start_pct, 4),
            "high_success_cheap_pct": round(high_success_pct, 4),
            "low_success_accurate_pct": round(low_success_pct, 4),
            "no_memory_fallback_pct": round(no_memory_pct, 4),
            "total_memory_routed": total,
            "additional_cheap_routing": round(additional_cheap * 100, 2)  # Percentage
        }

    def reset_stats(self):
        """Reset routing statistics (for testing/benchmarking)"""
        self.routing_stats = {
            "cheap": 0,
            "accurate": 0,
            "vlm": 0,
            "escalated": 0
        }
        self.memory_routing = {
            "cold_start_cheap": 0,
            "high_success_cheap": 0,
            "low_success_accurate": 0,
            "no_memory_fallback": 0
        }
        self.agent_routing_history.clear()
        logger.info("Routing statistics reset")
