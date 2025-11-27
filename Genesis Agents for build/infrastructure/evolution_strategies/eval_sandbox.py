"""
ES EVALUATION SANDBOX - Isolated Router
Version: 1.0
Last Updated: November 8, 2025

SECURITY CRITICAL: This module provides an isolated router for Evolution Strategies
fitness evaluation that CANNOT access production systems or external APIs.

Key Security Features:
1. No network access to external APIs (OpenAI, Anthropic, Google)
2. Mock LLM responses from fixtures
3. Resource limits (CPU, memory)
4. Separate logging to es-eval.log
5. No access to production database/cache

WHY THIS EXISTS:
During ES training, we sample N perturbed models and evaluate their fitness.
These perturbed models are UNTESTED and could:
- Make expensive API calls
- Corrupt production data
- Execute malicious prompts
- Overload production systems

The sandbox ensures perturbed models ONLY execute against mock data.
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

# Configure isolated logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [ES-EVAL-SANDBOX] - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/es-eval.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class Task:
    """Task representation for evaluation"""
    task_id: str
    agent_name: str
    description: str
    expected_output: Any
    required_capabilities: List[str]
    complexity: str  # "simple" | "moderate" | "complex"


@dataclass
class RoutingResult:
    """Result of routing a task"""
    task_id: str
    success: bool
    output: Any
    latency_ms: float
    model_used: str
    error: Optional[str] = None


class MockLLMClient:
    """
    Mock LLM client that returns deterministic responses

    SECURITY: This client NEVER makes external API calls.
    All responses come from pre-generated fixtures.
    """

    def __init__(self, fixtures_dir: str = "/app/fixtures"):
        self.fixtures_dir = Path(fixtures_dir)
        self.mock_responses = self._load_mock_responses()
        logger.info(f"Loaded {len(self.mock_responses)} mock responses from {fixtures_dir}")

    def _load_mock_responses(self) -> Dict[str, Any]:
        """Load mock LLM responses from fixtures"""
        fixtures_file = self.fixtures_dir / "es_test_tasks.json"

        if not fixtures_file.exists():
            logger.warning(f"Fixtures file not found: {fixtures_file}. Using default mocks.")
            return self._get_default_mocks()

        try:
            with open(fixtures_file, 'r') as f:
                data = json.load(f)
                return data.get("mock_responses", {})
        except Exception as e:
            logger.error(f"Failed to load fixtures: {e}. Using default mocks.")
            return self._get_default_mocks()

    def _get_default_mocks(self) -> Dict[str, Any]:
        """Default mock responses if fixtures not available"""
        return {
            "default": {
                "content": "This is a mock response from the sandboxed LLM.",
                "model": "mock-gpt-4o",
                "latency_ms": 150
            }
        }

    async def generate(
        self,
        prompt: str,
        model: str = "gpt-4o",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate mock LLM response

        SECURITY: This NEVER calls external APIs.
        Returns deterministic mock data based on prompt hash.
        """
        # Simulate latency
        await asyncio.sleep(0.1)

        # Deterministic mock selection based on prompt hash
        prompt_hash = hash(prompt) % len(self.mock_responses)
        mock_key = list(self.mock_responses.keys())[prompt_hash]
        response = self.mock_responses[mock_key]

        logger.debug(f"Mock LLM response for model={model}: {response['content'][:100]}...")

        return {
            "content": response.get("content", "Mock response"),
            "model": f"mock-{model}",
            "latency_ms": response.get("latency_ms", 100)
        }


class SandboxedRouter:
    """
    Sandboxed HALO Router for ES evaluation

    SECURITY GUARANTEES:
    1. NO external API calls (uses MockLLMClient)
    2. NO database access (in-memory only)
    3. NO file system writes (except logs)
    4. Resource limited (2 CPU, 4GB RAM via Docker)
    5. Network isolated (no internet access)

    This router is ONLY for evaluating perturbed models during ES training.
    Production routing uses the real HALORouter.
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        mock_mode: bool = True
    ):
        """
        Initialize sandboxed router

        Args:
            model_path: Path to perturbed model (for ES evaluation)
            mock_mode: If True, use mock LLM client (ALWAYS True in sandbox)
        """
        # SECURITY: Force mock mode in sandbox
        if os.getenv("ES_EVAL_MODE") == "ISOLATED":
            mock_mode = True
            logger.info("SECURITY: Forced mock_mode=True in isolated environment")

        self.model_path = model_path
        self.mock_mode = mock_mode
        self.llm_client = MockLLMClient() if mock_mode else None
        self.execution_count = 0
        self.max_executions = 100  # DoS prevention

        logger.info(f"SandboxedRouter initialized: model_path={model_path}, mock_mode={mock_mode}")

    def load_model(self, model_path: str) -> None:
        """
        Load perturbed model for evaluation

        Args:
            model_path: Path to perturbed model checkpoint
        """
        logger.info(f"Loading perturbed model: {model_path}")
        self.model_path = model_path
        # In mock mode, we just record the path
        # Real implementation would load model weights

    async def route_task(self, task: Task) -> RoutingResult:
        """
        Route task using sandboxed router

        SECURITY: This method NEVER calls production APIs.
        All LLM responses come from MockLLMClient.

        Args:
            task: Task to route

        Returns:
            RoutingResult with mock execution data
        """
        # DoS prevention
        self.execution_count += 1
        if self.execution_count > self.max_executions:
            raise RuntimeError(
                f"SECURITY: Max execution limit reached ({self.max_executions}). "
                f"Possible DoS attack from perturbed model."
            )

        start_time = time.time()

        try:
            # SECURITY CHECK: Ensure we're in mock mode
            if not self.mock_mode:
                raise RuntimeError(
                    "SECURITY VIOLATION: SandboxedRouter must use mock_mode=True. "
                    "Perturbed models cannot access production APIs."
                )

            # Simulate routing logic
            logger.info(f"Routing task {task.task_id} for agent {task.agent_name}")

            # Get mock LLM response
            prompt = f"Task: {task.description}\nRequired capabilities: {task.required_capabilities}"
            llm_response = await self.llm_client.generate(
                prompt=prompt,
                model="gpt-4o"  # Mock model name
            )

            # Simulate task execution
            await asyncio.sleep(0.05)  # Simulate processing time

            # Determine success (mock logic)
            success = self._evaluate_mock_success(task, llm_response)

            latency_ms = (time.time() - start_time) * 1000

            result = RoutingResult(
                task_id=task.task_id,
                success=success,
                output=llm_response["content"],
                latency_ms=latency_ms,
                model_used=llm_response["model"],
                error=None if success else "Mock execution failed"
            )

            logger.info(
                f"Task {task.task_id} completed: success={success}, "
                f"latency={latency_ms:.2f}ms, model={result.model_used}"
            )

            return result

        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            logger.error(f"Task {task.task_id} failed: {str(e)}")

            return RoutingResult(
                task_id=task.task_id,
                success=False,
                output=None,
                latency_ms=latency_ms,
                model_used="error",
                error=str(e)
            )

    def _evaluate_mock_success(self, task: Task, llm_response: Dict[str, Any]) -> bool:
        """
        Evaluate mock success (deterministic for testing)

        In production, this would validate against task.expected_output.
        In sandbox, we use deterministic logic for reproducibility.
        """
        # Simple heuristic: success if response contains keywords
        content = llm_response.get("content", "").lower()
        keywords = ["success", "completed", "done", "correct"]
        return any(keyword in content for keyword in keywords)


class AgentTaskFitness:
    """
    Fitness function for Evolution Strategies evaluation

    SECURITY: Uses SandboxedRouter instead of production HALORouter.
    This ensures perturbed models ONLY execute against mock data.
    """

    def __init__(self, fixtures_dir: str = "/app/fixtures"):
        self.test_tasks = self._load_test_tasks(fixtures_dir)
        self.router: Optional[SandboxedRouter] = None
        logger.info(f"AgentTaskFitness initialized with {len(self.test_tasks)} test tasks")

    def _load_test_tasks(self, fixtures_dir: str) -> List[Task]:
        """Load test tasks from fixtures"""
        fixtures_file = Path(fixtures_dir) / "es_test_tasks.json"

        if not fixtures_file.exists():
            logger.warning(f"Test tasks file not found: {fixtures_file}. Using default tasks.")
            return self._get_default_tasks()

        try:
            with open(fixtures_file, 'r') as f:
                data = json.load(f)
                tasks = []
                for task_data in data.get("test_tasks", []):
                    tasks.append(Task(**task_data))
                return tasks
        except Exception as e:
            logger.error(f"Failed to load test tasks: {e}. Using default tasks.")
            return self._get_default_tasks()

    def _get_default_tasks(self) -> List[Task]:
        """Default test tasks if fixtures not available"""
        return [
            Task(
                task_id=f"test_task_{i}",
                agent_name="qa_agent",
                description=f"Test task {i}",
                expected_output={"status": "success"},
                required_capabilities=["testing"],
                complexity="simple"
            )
            for i in range(20)
        ]

    async def __call__(self, model_path: str) -> float:
        """
        Evaluate model fitness on test tasks

        SECURITY: This creates a NEW SandboxedRouter for each evaluation.
        The router is isolated and cannot access production systems.

        Args:
            model_path: Path to perturbed model

        Returns:
            Fitness score (0.0 to 1.0)
        """
        logger.info(f"Evaluating fitness for model: {model_path}")

        # Create sandboxed router (ISOLATED from production)
        self.router = SandboxedRouter(model_path=model_path, mock_mode=True)

        # Run test tasks
        scores = []
        for task in self.test_tasks:
            result = await self.router.route_task(task)

            # Multi-factor scoring
            score = self._score_result(result, task)
            scores.append(score)

        # Calculate mean fitness
        fitness = float(np.mean(scores))
        logger.info(f"Model {model_path} fitness: {fitness:.4f} (mean of {len(scores)} tasks)")

        return fitness

    def _score_result(self, result: RoutingResult, task: Task) -> float:
        """
        Score individual task result

        Multi-factor scoring:
        - Correctness: 50% (did it succeed?)
        - Latency: 25% (was it fast?)
        - Cost: 25% (did it use cheap model?)
        """
        score = 0.0

        # Correctness (50%)
        if result.success:
            score += 0.5

        # Latency (25%) - faster is better (target: <1000ms)
        latency_score = max(0, 1 - (result.latency_ms / 1000))
        score += 0.25 * latency_score

        # Cost (25%) - cheaper model is better
        if "flash" in result.model_used.lower():
            cost_score = 1.0
        elif "gpt-4o" in result.model_used.lower():
            cost_score = 0.5
        else:
            cost_score = 0.75

        score += 0.25 * cost_score

        return score


    async def main():
    """
    Main entry point for sandboxed ES evaluation

    This runs inside the isolated Docker container.

    HIGH PRIORITY FIX: Runtime enforcement for ES_EVAL_MODE=ISOLATED
    """
    logger.info("=" * 60)
    logger.info("ES EVALUATION SANDBOX STARTED")
    logger.info("=" * 60)

    # HIGH PRIORITY FIX: Enforce ISOLATED mode at runtime
    eval_mode = os.getenv("ES_EVAL_MODE", "").upper()
    if eval_mode != "ISOLATED":
        raise RuntimeError(
            f"SECURITY VIOLATION: ES evaluation must run in ISOLATED mode. "
            f"Current mode: {eval_mode}. "
            f"Set ES_EVAL_MODE=ISOLATED environment variable. "
            f"Perturbed models cannot access production systems."
        )

    logger.info("SECURITY: Verified ES_EVAL_MODE=ISOLATED")

    # Create fitness evaluator
    fitness_fn = AgentTaskFitness(fixtures_dir="/app/fixtures")

    # Simulate evaluating a perturbed model
    test_model_path = "/app/models/perturbed_model_0.pt"
    fitness_score = await fitness_fn(test_model_path)

    logger.info(f"Evaluation complete: fitness={fitness_score:.4f}")
    logger.info("=" * 60)
    logger.info("ES EVALUATION SANDBOX FINISHED")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
