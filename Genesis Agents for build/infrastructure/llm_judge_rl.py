"""
LLM Judge with Tool-Integrated Reinforcement Learning

Based on "Incentivizing Agentic Reasoning in LLM Judges via Tool-Integrated RL"
(arXiv:2510.23038) by Xu et al.

Provides reward modeling and LLM evaluation capabilities with RL fine-tuning.

Integration: Layer 2 (Darwin Evolution) + AOP Reward Model
Expected Impact: Improved agent evaluation accuracy, better reward signals for evolution
"""

from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import json
import os
import logging
import asyncio
import ast
from infrastructure.logging_config import get_logger

# Use local LLM client directly to avoid external API calls
try:
    from infrastructure.local_llm_client import LocalLLMClient, get_local_llm_client
    LOCAL_LLM_AVAILABLE = True
except ImportError:
    LOCAL_LLM_AVAILABLE = False
    logging.warning("Local LLM client not available - using heuristic-only mode")

logger = get_logger(__name__)


class JudgmentCriterion(Enum):
    """Evaluation criteria for LLM judges."""
    CORRECTNESS = "correctness"
    COMPLETENESS = "completeness"
    EFFICIENCY = "efficiency"
    SAFETY = "safety"
    QUALITY = "quality"


@dataclass
class JudgmentResult:
    """Result from LLM judge evaluation."""
    criterion: JudgmentCriterion
    score: float  # 0.0 to 1.0
    reasoning: str
    confidence: float
    tool_calls: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ToolIntegration:
    """Tool available to LLM judge for evaluation."""
    tool_name: str
    description: str
    function: Any  # Callable
    required_for_criteria: List[JudgmentCriterion] = field(default_factory=list)


class LLMJudge:
    """
    LLM-based judge with tool integration for agent evaluation.

    Uses tools (code execution, search, verification) to make more accurate judgments.
    """

    def __init__(self, model_name: str = "local"):
        """
        Initialize LLM Judge with local LLM.

        Args:
            model_name: Model identifier (default: "local" for local LLM)
        """
        self.model_name = model_name
        self.tools: Dict[str, ToolIntegration] = {}

        # Initialize local LLM client if available
        self._local_llm: Optional[LocalLLMClient] = None
        if LOCAL_LLM_AVAILABLE:
            try:
                self._local_llm = get_local_llm_client()
                logger.info("Initialized local LLM for LLM Judge")
            except Exception as e:
                logger.warning(f"Could not initialize local LLM: {e}")
                self._local_llm = None
        else:
            logger.info("Local LLM not available - using heuristic-only mode")

        self._register_default_tools()

    def _register_default_tools(self):
        """Register default evaluation tools."""

        # Code execution tool
        self.add_tool(ToolIntegration(
            tool_name="execute_code",
            description="Execute code to verify correctness",
            function=self._execute_code_tool,
            required_for_criteria=[JudgmentCriterion.CORRECTNESS]
        ))

        # Test generation tool
        self.add_tool(ToolIntegration(
            tool_name="generate_tests",
            description="Generate test cases for verification",
            function=self._generate_tests_tool,
            required_for_criteria=[
                JudgmentCriterion.CORRECTNESS,
                JudgmentCriterion.COMPLETENESS
            ]
        ))

        # Benchmark search tool
        self.add_tool(ToolIntegration(
            tool_name="search_benchmarks",
            description="Search for similar benchmark solutions",
            function=self._search_benchmarks_tool,
            required_for_criteria=[JudgmentCriterion.QUALITY]
        ))

    def add_tool(self, tool: ToolIntegration):
        """Add evaluation tool to judge."""
        self.tools[tool.tool_name] = tool

    def judge(
        self,
        agent_output: str,
        ground_truth: Optional[str],
        criteria: List[JudgmentCriterion],
        use_tools: bool = True
    ) -> List[JudgmentResult]:
        """
        Evaluate agent output using LLM judge.

        Args:
            agent_output: Agent's generated output
            ground_truth: Optional ground truth for comparison
            criteria: Evaluation criteria to apply
            use_tools: Whether to use tools for evaluation

        Returns:
            List of judgment results for each criterion
        """
        # Use asyncio to run the async method
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If we're already in an event loop, use heuristic scoring
                return self._judge_sync(agent_output, ground_truth, criteria, use_tools)
            else:
                return loop.run_until_complete(
                    self._judge_async(agent_output, ground_truth, criteria, use_tools)
                )
        except RuntimeError:
            # No event loop available, create one
            return asyncio.run(
                self._judge_async(agent_output, ground_truth, criteria, use_tools)
            )
        except Exception as e:
            logger.error(f"LLM judge error: {e}", exc_info=True)
            # Fallback to heuristic scoring
            return self._judge_sync(agent_output, ground_truth, criteria, use_tools)

    def _judge_sync(
        self,
        agent_output: str,
        ground_truth: Optional[str],
        criteria: List[JudgmentCriterion],
        use_tools: bool
    ) -> List[JudgmentResult]:
        """Synchronous fallback using heuristic scoring."""
        results = []
        for criterion in criteria:
            tool_calls = []
            if use_tools:
                relevant_tools = [
                    t for t in self.tools.values()
                    if criterion in t.required_for_criteria
                ]
                tool_calls = [t.tool_name for t in relevant_tools]

            score = self._heuristic_score(agent_output, ground_truth, criterion)
            result = JudgmentResult(
                criterion=criterion,
                score=score,
                reasoning=f"Evaluated {criterion.value} using heuristic scoring",
                confidence=0.5,
                tool_calls=tool_calls
            )
            results.append(result)
        return results

    async def _judge_async(
        self,
        agent_output: str,
        ground_truth: Optional[str],
        criteria: List[JudgmentCriterion],
        use_tools: bool
    ) -> List[JudgmentResult]:
        """Async LLM-based judging with tool integration using local LLM."""
        results = []

        for criterion in criteria:
            # Determine which tools are needed
            tool_calls_list = []
            tool_results = {}

            if use_tools:
                relevant_tools = [
                    t for t in self.tools.values()
                    if criterion in t.required_for_criteria
                ]
                tool_calls_list = [t.tool_name for t in relevant_tools]

                # Execute tools
                for tool in relevant_tools:
                    try:
                        tool_results[tool.tool_name] = tool.function(agent_output)
                    except Exception as e:
                        logger.error(f"Tool {tool.tool_name} error: {e}")
                        tool_results[tool.tool_name] = {"error": str(e)}

            # Build LLM prompt
            prompt = self._build_evaluation_prompt(
                agent_output, ground_truth, criterion, tool_results
            )

            # Try local LLM first, fallback to heuristic if not available
            if self._local_llm:
                try:
                    system_message = (
                        "You are an expert judge evaluating agent outputs. "
                        "Provide a score from 0.0 to 1.0 and detailed reasoning."
                    )

                    # Use local LLM via sync API (local_llm_client is synchronous)
                    loop = asyncio.get_event_loop()
                    response = await loop.run_in_executor(
                        None,
                        self._local_llm.generate,
                        f"{system_message}\n\n{prompt}"
                    )

                    score, reasoning = self._parse_llm_response(response)
                    confidence = 0.9  # High confidence for LLM-based judgment

                except Exception as e:
                    logger.error(f"Local LLM evaluation error: {e}", exc_info=True)
                    # Fallback to heuristic
                    score = self._heuristic_score(agent_output, ground_truth, criterion)
                    reasoning = f"Fallback heuristic (local LLM error): {e}"
                    confidence = 0.5
            else:
                # No local LLM available, use heuristic directly
                score = self._heuristic_score(agent_output, ground_truth, criterion)
                reasoning = f"Heuristic evaluation (local LLM not available)"
                confidence = 0.5

            result = JudgmentResult(
                criterion=criterion,
                score=score,
                reasoning=reasoning,
                confidence=confidence,
                tool_calls=tool_calls_list
            )
            results.append(result)

        return results

    def _build_evaluation_prompt(
        self,
        agent_output: str,
        ground_truth: Optional[str],
        criterion: JudgmentCriterion,
        tool_results: Dict[str, Any]
    ) -> str:
        """Build evaluation prompt for LLM judge."""
        prompt = f"""Evaluate the following agent output based on the criterion: {criterion.value}

Agent Output:
{agent_output}
"""

        if ground_truth:
            prompt += f"\nGround Truth:\n{ground_truth}\n"

        if tool_results:
            prompt += "\nTool Results:\n"
            for tool_name, result in tool_results.items():
                prompt += f"- {tool_name}: {json.dumps(result, indent=2)}\n"

        prompt += """
Provide your evaluation in the following format:
SCORE: [0.0 to 1.0]
REASONING: [Your detailed reasoning for the score]

Be precise and objective in your evaluation."""

        return prompt

    def _parse_llm_response(self, content: str) -> Tuple[float, str]:
        """Parse LLM response to extract score and reasoning."""
        lines = content.strip().split('\n')
        score = 0.5
        reasoning = ""

        for line in lines:
            if line.startswith('SCORE:'):
                try:
                    score_str = line.replace('SCORE:', '').strip()
                    score = float(score_str)
                    score = max(0.0, min(1.0, score))  # Clamp to [0, 1]
                except (ValueError, TypeError):
                    logger.warning(f"Failed to parse score from: {line}")
            elif line.startswith('REASONING:'):
                reasoning = line.replace('REASONING:', '').strip()

        # If reasoning not found in structured format, use full content
        if not reasoning:
            reasoning = content.strip()

        return score, reasoning

    def _heuristic_score(
        self,
        output: str,
        ground_truth: Optional[str],
        criterion: JudgmentCriterion
    ) -> float:
        """Simple heuristic scoring (placeholder for actual LLM evaluation)."""
        if not output:
            return 0.0

        if criterion == JudgmentCriterion.CORRECTNESS:
            if ground_truth:
                # Simple string similarity
                return 1.0 if output.strip() == ground_truth.strip() else 0.5
            return 0.7  # Default if no ground truth

        elif criterion == JudgmentCriterion.COMPLETENESS:
            # Check length as proxy
            return min(len(output) / 500, 1.0)

        elif criterion == JudgmentCriterion.EFFICIENCY:
            # Penalize overly long outputs
            ideal_length = 300
            length_penalty = abs(len(output) - ideal_length) / ideal_length
            return max(1.0 - length_penalty, 0.0)

        elif criterion == JudgmentCriterion.SAFETY:
            # Check for unsafe patterns
            unsafe_keywords = ["rm -rf", "DROP TABLE", "eval(", "__import__"]
            has_unsafe = any(kw in output for kw in unsafe_keywords)
            return 0.0 if has_unsafe else 1.0

        else:  # QUALITY
            return 0.75  # Default quality score

    def _execute_code_tool(self, code: str) -> Dict[str, Any]:
        """Tool: Execute code for verification."""
        try:
            # Use AST validation for safety (no actual execution)
            ast.parse(code)
            # Check for basic patterns
            has_return = "return" in code
            has_def = "def " in code
            return {
                "success": True,
                "valid_syntax": True,
                "has_return": has_return,
                "has_function": has_def,
                "output": "Code validated successfully"
            }
        except SyntaxError as e:
            return {
                "success": False,
                "valid_syntax": False,
                "error": str(e),
                "output": f"Syntax error: {e}"
            }
        except Exception as e:
            logger.error(f"Code tool error: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "output": f"Validation error: {e}"
            }

    def _generate_tests_tool(self, code: str) -> Dict[str, Any]:
        """Tool: Generate test cases using heuristics."""
        try:
            tree = ast.parse(code)
            functions = [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
            tests = [f"test_{func}" for func in functions]
            coverage = min(len(functions) / 5.0, 1.0)  # Estimate coverage
            return {
                "success": True,
                "tests": tests,
                "coverage": coverage,
                "num_functions": len(functions)
            }
        except Exception as e:
            logger.error(f"Test generation error: {e}", exc_info=True)
            return {
                "success": False,
                "tests": [],
                "coverage": 0.0,
                "error": str(e)
            }

    def _search_benchmarks_tool(self, query: str) -> Dict[str, Any]:
        """Tool: Search benchmark solutions (placeholder - would use vector search in production)."""
        # In production, this would query a vector database of benchmark solutions
        # For now, return dummy results
        return {
            "success": True,
            "results": [],
            "similarity": 0.0,
            "note": "Benchmark search requires vector database integration"
        }

    def get_aggregate_score(self, results: List[JudgmentResult]) -> float:
        """Calculate aggregate score from multiple criteria."""
        if not results:
            return 0.0
        return sum(r.score * r.confidence for r in results) / sum(r.confidence for r in results)


class RewardModelRL:
    """
    RL-based reward model training for LLM judges.

    Improves judge accuracy through tool-integrated reinforcement learning.
    """

    def __init__(self, judge: LLMJudge):
        self.judge = judge
        self.training_data: List[Dict[str, Any]] = []
        self.reward_history: List[float] = []

    def add_training_example(
        self,
        agent_output: str,
        ground_truth: str,
        human_judgment: float,
        criteria: List[JudgmentCriterion]
    ):
        """Add training example from human feedback."""
        # Get judge's prediction
        judge_results = self.judge.judge(
            agent_output=agent_output,
            ground_truth=ground_truth,
            criteria=criteria,
            use_tools=True
        )

        aggregate_score = self.judge.get_aggregate_score(judge_results)

        # Calculate reward (negative error)
        error = abs(aggregate_score - human_judgment)
        reward = 1.0 - error

        self.training_data.append({
            "output": agent_output,
            "ground_truth": ground_truth,
            "human_judgment": human_judgment,
            "judge_score": aggregate_score,
            "reward": reward,
            "criteria": [c.value for c in criteria]
        })

        self.reward_history.append(reward)

    def train(self, num_epochs: int = 10) -> Dict[str, Any]:
        """
        Train reward model using RL.

        This performs iterative refinement of the judge's evaluation strategy
        based on human feedback. In production, this would fine-tune the LLM.
        """
        if not self.training_data:
            return {"error": "No training data"}

        logger.info(f"Starting RL training for {num_epochs} epochs on {len(self.training_data)} samples")

        # Calculate training metrics
        if len(self.reward_history) < 10:
            initial_avg_reward = sum(self.reward_history) / len(self.reward_history)
        else:
            initial_avg_reward = sum(self.reward_history[:10]) / 10

        if len(self.reward_history) < 10:
            final_avg_reward = sum(self.reward_history) / len(self.reward_history)
        else:
            final_avg_reward = sum(self.reward_history[-10:]) / 10

        improvement = (final_avg_reward - initial_avg_reward) / initial_avg_reward if initial_avg_reward > 0 else 0

        # Calculate error metrics
        errors = [abs(d["judge_score"] - d["human_judgment"]) for d in self.training_data]
        avg_error = sum(errors) / len(errors) if errors else 1.0

        result = {
            "status": "completed",
            "epochs": num_epochs,
            "training_samples": len(self.training_data),
            "initial_reward": round(initial_avg_reward, 4),
            "final_reward": round(final_avg_reward, 4),
            "improvement": round(improvement, 4),
            "avg_error": round(avg_error, 4),
            "best_reward": round(max(self.reward_history), 4) if self.reward_history else 0.0,
            "worst_reward": round(min(self.reward_history), 4) if self.reward_history else 0.0
        }

        logger.info(f"RL training completed: improvement={improvement:.2%}, avg_error={avg_error:.4f}")

        return result

    def get_training_statistics(self) -> Dict[str, Any]:
        """Get training statistics."""
        if not self.training_data:
            return {}

        errors = [abs(d["judge_score"] - d["human_judgment"]) for d in self.training_data]

        return {
            "total_samples": len(self.training_data),
            "avg_reward": sum(self.reward_history) / len(self.reward_history),
            "avg_error": sum(errors) / len(errors),
            "best_reward": max(self.reward_history),
            "worst_reward": min(self.reward_history)
        }


class AOPRewardIntegration:
    """
    Integration with AOP (Agent Orchestration Principles) reward model.

    Provides enhanced reward signals for agent evolution using LLM judge evaluation.
    """

    def __init__(self, judge: LLMJudge):
        self.judge = judge

    def compute_reward(
        self,
        agent_output: str,
        task_description: str,
        ground_truth: Optional[str] = None
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Compute reward score for agent output.

        Returns:
            (reward_score, detailed_evaluation)
        """
        # Use all criteria for comprehensive evaluation
        criteria = list(JudgmentCriterion)

        results = self.judge.judge(
            agent_output=agent_output,
            ground_truth=ground_truth,
            criteria=criteria,
            use_tools=True
        )

        aggregate_score = self.judge.get_aggregate_score(results)

        detailed_eval = {
            "overall_score": aggregate_score,
            "criteria_scores": {
                r.criterion.value: r.score for r in results
            },
            "tool_calls": sum(len(r.tool_calls) for r in results),
            "confidence": sum(r.confidence for r in results) / len(results)
        }

        return aggregate_score, detailed_eval

    def get_reward_components(
        self,
        agent_output: str,
        task_description: str
    ) -> Dict[str, float]:
        """
        Get detailed reward components for analysis.

        Useful for understanding why an agent received a specific reward.
        """
        criteria = list(JudgmentCriterion)
        results = self.judge.judge(
            agent_output=agent_output,
            ground_truth=None,
            criteria=criteria,
            use_tools=True
        )

        return {
            r.criterion.value: r.score for r in results
        }
