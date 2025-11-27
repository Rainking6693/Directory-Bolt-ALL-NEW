"""
Memento Agent - Agent Wrapper with Case-Based Reasoning Memory

Based on Memento: Fine-tuning LLM Agents without Fine-tuning LLMs (arXiv:2508.16153)

BREAKTHROUGH: Context-augmented execution with past case learning
- Retrieve K=4 similar past cases before task execution
- Augment prompt with successful examples
- Learn from failures (negative examples)
- Store outcomes for future learning

Architecture:
1. Receive task
2. Retrieve similar past cases (K=4, reward>=0.6, similarity>=0.8)
3. Build context-augmented prompt with examples
4. Execute task with LLM
5. Validate solution quality
6. Store case for future learning

Integration:
- Works with any LLM client (GPT-4o, Claude, Gemini, etc.)
- Compatible with existing agent infrastructure
- Zero model fine-tuning required
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional, Protocol

# Genesis infrastructure
from infrastructure import get_logger
from infrastructure.casebank import Case, CaseBank, get_casebank
from infrastructure.security_utils import redact_credentials

# OTEL observability
try:
    from opentelemetry import trace
    from opentelemetry.trace import Status, StatusCode
    tracer = trace.get_tracer(__name__)
    HAS_OTEL = True
except ImportError:
    HAS_OTEL = False
    tracer = None

logger = get_logger(__name__)


class LLMClient(Protocol):
    """Protocol for LLM clients"""
    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate response from prompt"""
        ...


class MementoAgent:
    """
    Agent with case-based reasoning via CaseBank.

    Wraps any agent to add memory-based learning:
    - Retrieve similar past cases
    - Augment prompts with examples
    - Store outcomes for future learning
    - No model fine-tuning required
    """

    def __init__(
        self,
        agent_name: str,
        llm_client: Optional[LLMClient] = None,
        casebank: Optional[CaseBank] = None,
        k_cases: int = 4,
        min_reward: float = 0.6,
        min_similarity: float = 0.8,
        enable_storage: bool = True,
        enable_otel: bool = True
    ):
        """
        Initialize Memento agent wrapper.

        Args:
            agent_name: Name of wrapped agent
            llm_client: LLM client for task execution
            casebank: CaseBank instance (creates default if None)
            k_cases: Number of cases to retrieve (default 4 per paper)
            min_reward: Minimum reward for retrieval (default 0.6)
            min_similarity: Minimum similarity for retrieval (default 0.8)
            enable_storage: Store task outcomes (default True)
            enable_otel: Enable OpenTelemetry tracing
        """
        self.agent_name = agent_name
        self.llm_client = llm_client
        self.casebank = casebank or get_casebank()
        self.k_cases = k_cases
        self.min_reward = min_reward
        self.min_similarity = min_similarity
        self.enable_storage = enable_storage
        self.enable_otel = enable_otel and HAS_OTEL

        logger.info(
            f"MementoAgent initialized: agent={agent_name}, "
            f"K={k_cases}, min_reward={min_reward}, min_similarity={min_similarity}"
        )

    async def execute_with_memory(
        self,
        task: str,
        context: Optional[Dict[str, Any]] = None,
        validator: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Execute task with case-based memory augmentation.

        Workflow:
        1. Retrieve K similar past cases
        2. Build context-augmented prompt
        3. Execute with LLM
        4. Validate solution (if validator provided)
        5. Store outcome for future learning

        Args:
            task: Task description/query
            context: Optional additional context
            validator: Optional validation function (task, solution) -> float

        Returns:
            Dict with:
                - solution: Task output
                - reward: Quality score (0-1)
                - cases_used: Number of past cases retrieved
                - case_id: ID of stored case
        """
        if self.enable_otel and tracer:
            span = tracer.start_span("memento.execute_with_memory")
            span.set_attribute("agent", self.agent_name)
            span.set_attribute("task_length", len(task))
        else:
            span = None

        try:
            # Step 1: Retrieve similar past cases
            similar_cases = await self.casebank.retrieve_similar(
                query_state=task,
                k=self.k_cases,
                min_reward=self.min_reward,
                min_similarity=self.min_similarity,
                agent_filter=self.agent_name
            )

            logger.info(
                f"Retrieved {len(similar_cases)} similar cases for task "
                f"(agent={self.agent_name})"
            )

            # Step 2: Build context-augmented prompt
            if similar_cases:
                case_context = self.casebank.build_case_context(similar_cases)
                augmented_prompt = self._build_augmented_prompt(
                    task=task,
                    case_context=case_context,
                    context=context
                )
                had_context = True
            else:
                # Cold start - no past cases
                augmented_prompt = self._build_basic_prompt(task, context)
                had_context = False

            # Step 3: Execute with LLM
            if self.llm_client:
                solution = await self.llm_client.generate(augmented_prompt)
            else:
                # Mock execution for agents without LLM client
                solution = f"[Mock solution for: {task[:50]}...]"

            logger.info(
                f"Executed task with{'' if had_context else 'out'} case context "
                f"(agent={self.agent_name})"
            )

            # Step 4: Validate solution
            if validator:
                reward = await self._validate_with_validator(validator, task, solution)
            else:
                reward = await self._default_validation(task, solution)

            # Step 5: Store outcome for future learning
            stored_case = None
            if self.enable_storage:
                stored_case = await self.casebank.add_case(
                    state=task,
                    action=solution,
                    reward=reward,
                    metadata={
                        "agent": self.agent_name,
                        "had_context": had_context,
                        "cases_used": len(similar_cases)
                    }
                )

            # Build result
            result = {
                "solution": solution,
                "reward": reward,
                "cases_used": len(similar_cases),
                "case_id": stored_case.case_id if stored_case else None,
                "had_context": had_context
            }

            if span:
                span.set_attribute("cases_used", len(similar_cases))
                span.set_attribute("reward", reward)
                span.set_status(Status(StatusCode.OK))

            return result

        except Exception as e:
            logger.error(
                f"Execution failed for agent={self.agent_name}: {e}",
                exc_info=True
            )
            if span:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
            raise
        finally:
            if span:
                span.end()

    async def execute_batch_with_memory(
        self,
        tasks: List[str],
        context: Optional[Dict[str, Any]] = None,
        validator: Optional[callable] = None,
        parallel: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Execute multiple tasks with memory augmentation.

        Args:
            tasks: List of task descriptions
            context: Optional shared context
            validator: Optional validation function
            parallel: Execute in parallel (default True)

        Returns:
            List of result dicts (same format as execute_with_memory)
        """
        if parallel:
            # Execute in parallel
            results = await asyncio.gather(*[
                self.execute_with_memory(task, context, validator)
                for task in tasks
            ])
        else:
            # Execute sequentially
            results = []
            for task in tasks:
                result = await self.execute_with_memory(task, context, validator)
                results.append(result)

        logger.info(
            f"Executed {len(tasks)} tasks in {'parallel' if parallel else 'sequential'} "
            f"(agent={self.agent_name})"
        )

        return results

    async def get_memory_stats(self) -> Dict[str, Any]:
        """
        Get statistics about stored cases for this agent.

        Returns:
            Dict with memory statistics
        """
        all_cases = await self.casebank.get_all_cases(agent_filter=self.agent_name)

        if not all_cases:
            return {
                "agent": self.agent_name,
                "total_cases": 0,
                "avg_reward": 0.0,
                "high_quality_cases": 0
            }

        total = len(all_cases)
        avg_reward = sum(c.reward for c in all_cases) / total
        high_quality = len([c for c in all_cases if c.reward >= 0.8])

        return {
            "agent": self.agent_name,
            "total_cases": total,
            "avg_reward": avg_reward,
            "high_quality_cases": high_quality,
            "high_quality_ratio": high_quality / total if total > 0 else 0.0
        }

    async def clear_memory(self) -> int:
        """
        Clear all stored cases for this agent.

        Returns:
            Number of cases cleared
        """
        cleared = await self.casebank.clear_cases(agent_filter=self.agent_name)
        logger.info(f"Cleared {cleared} cases for agent={self.agent_name}")
        return cleared

    # Private methods

    def _build_augmented_prompt(
        self,
        task: str,
        case_context: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Build prompt augmented with past case examples.

        Args:
            task: Current task
            case_context: Formatted past cases
            context: Optional additional context

        Returns:
            Augmented prompt string
        """
        parts = []

        # Add case context (learning examples)
        parts.append(case_context)

        # Add current task
        parts.append("Current task:")
        parts.append(task)
        parts.append("")

        # Add additional context if provided
        if context:
            parts.append("Additional context:")
            for key, value in context.items():
                parts.append(f"  {key}: {value}")
            parts.append("")

        # Add instruction
        parts.append(
            "Based on the past successes and failures above, generate an optimal "
            "solution for the current task:"
        )

        return "\n".join(parts)

    def _build_basic_prompt(
        self,
        task: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Build basic prompt without case examples (cold start).

        Args:
            task: Current task
            context: Optional additional context

        Returns:
            Basic prompt string
        """
        parts = [task]

        if context:
            parts.append("")
            parts.append("Context:")
            for key, value in context.items():
                parts.append(f"  {key}: {value}")

        return "\n".join(parts)

    async def _validate_with_validator(
        self,
        validator: callable,
        task: str,
        solution: str
    ) -> float:
        """
        Validate solution using provided validator function.

        Args:
            validator: Validation function (task, solution) -> float
            task: Original task
            solution: Generated solution

        Returns:
            Reward score (0-1)
        """
        try:
            if asyncio.iscoroutinefunction(validator):
                reward = await validator(task, solution)
            else:
                reward = validator(task, solution)

            # Ensure reward is in [0, 1]
            return max(0.0, min(1.0, float(reward)))

        except Exception as e:
            logger.warning(
                f"Validation failed, using default: {e}",
                exc_info=True
            )
            return await self._default_validation(task, solution)

    async def _default_validation(self, task: str, solution: str) -> float:
        """
        Default validation when no validator provided.

        Simple heuristic: non-empty solution = 0.7, empty = 0.0

        Args:
            task: Original task
            solution: Generated solution

        Returns:
            Reward score (0-1)
        """
        # Basic validation: check if solution is non-empty
        if solution and len(solution.strip()) > 10:
            return 0.7  # Moderate quality by default
        else:
            return 0.0  # Failed


# Factory function for easy creation

def create_memento_agent(
    agent_name: str,
    llm_client: Optional[LLMClient] = None,
    **kwargs
) -> MementoAgent:
    """
    Create a Memento agent with default settings.

    Args:
        agent_name: Name of agent
        llm_client: Optional LLM client
        **kwargs: Additional MementoAgent parameters

    Returns:
        MementoAgent instance
    """
    return MementoAgent(
        agent_name=agent_name,
        llm_client=llm_client,
        **kwargs
    )
