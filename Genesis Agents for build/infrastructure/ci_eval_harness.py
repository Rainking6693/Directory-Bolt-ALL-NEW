"""
CI Evaluation Harness for Automated Benchmark Validation

Runs comprehensive benchmark suites on every PR, detects regressions, blocks merges.
Target: <5 min execution, 95% confidence regression detection.

Integration:
- BenchmarkRunner: Existing benchmark infrastructure
- GitHub Actions: Automated CI execution
- Observability: OTEL metrics and tracing
"""

import json
import asyncio
import time
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict, field
from pathlib import Path
from infrastructure.benchmark_runner import BenchmarkRunner, BenchmarkType, BenchmarkResult
from infrastructure.observability import ObservabilityManager, SpanType, CorrelationContext

logger = logging.getLogger(__name__)


@dataclass
class EvaluationScenario:
    """Single evaluation scenario"""
    scenario_id: str
    agent_name: str
    benchmark_type: str
    description: str
    timeout_ms: int = 5000


@dataclass
class ScenarioResult:
    """Result from single scenario execution"""
    scenario_id: str
    agent_name: str
    success: bool
    execution_time_ms: float
    quality_score: float
    cost_usd: float
    memory_mb: float
    error: Optional[str] = None


@dataclass
class EvaluationReport:
    """Aggregated evaluation report"""
    total_scenarios: int
    passed: int
    failed: int
    avg_execution_time_ms: float
    avg_quality_score: float
    total_cost_usd: float
    regressions: List[Dict[str, Any]] = field(default_factory=list)
    improvements: List[Dict[str, Any]] = field(default_factory=list)
    by_agent: Dict[str, Dict[str, Any]] = field(default_factory=dict)


class CIEvalHarness:
    """
    CI Evaluation Harness for automated benchmark validation.

    Runs benchmark suite and detects regressions vs. baseline.
    Target: <5 min execution for 270 scenarios.
    """

    def __init__(
        self,
        obs_manager: Optional[ObservabilityManager] = None,
        regression_threshold: float = 0.05,  # 5% regression tolerance
        max_concurrent: int = 5
    ):
        """
        Initialize CI Eval Harness

        Args:
            obs_manager: Observability manager for tracing
            regression_threshold: Threshold for regression detection (0.05 = 5%)
            max_concurrent: Maximum concurrent scenario executions
        """
        self.obs_manager = obs_manager or ObservabilityManager()
        self.regression_threshold = regression_threshold
        self.max_concurrent = max_concurrent
        self.benchmark_runner = BenchmarkRunner()

    async def run_full_evaluation(
        self,
        agent_names: Optional[List[str]] = None,
        baseline_results_path: Optional[Path] = None,
        output_path: Optional[Path] = None
    ) -> EvaluationReport:
        """
        Run full benchmark evaluation.

        Args:
            agent_names: Agents to evaluate (None = all agents)
            baseline_results_path: Path to baseline results JSON
            output_path: Path to save results JSON

        Returns:
            EvaluationReport with results and regressions
        """
        ctx = self.obs_manager.create_correlation_context("CI Evaluation")

        with self.obs_manager.span(
            "ci_eval.run_full",
            SpanType.ORCHESTRATION,
            ctx
        ) as span:
            start_time = time.time()

            # Load baseline results if provided
            baseline_results = None
            if baseline_results_path and baseline_results_path.exists():
                baseline_results = self._load_baseline_results(baseline_results_path)
                logger.info(f"Loaded baseline results: {len(baseline_results)} scenarios")

            # Load evaluation scenarios
            scenarios = self._load_evaluation_scenarios(agent_names)

            logger.info(f"Running {len(scenarios)} benchmark scenarios...")

            span.set_attribute("scenarios_count", len(scenarios))

            # Run benchmarks in parallel
            results = await self._run_scenarios_parallel(scenarios, ctx)

            # Aggregate results
            report = self._aggregate_results(results, baseline_results)

            elapsed_time = time.time() - start_time

            span.set_attribute("elapsed_time_seconds", elapsed_time)
            span.set_attribute("pass_rate", report.passed / report.total_scenarios if report.total_scenarios > 0 else 0)

            self.obs_manager.record_metric(
                "ci_eval.total_time_seconds",
                elapsed_time,
                unit="s",
                labels={"correlation_id": ctx.correlation_id}
            )

            self.obs_manager.record_metric(
                "ci_eval.scenarios_run",
                len(scenarios),
                unit="count",
                labels={"correlation_id": ctx.correlation_id}
            )

            self.obs_manager.record_metric(
                "ci_eval.pass_rate",
                report.passed / report.total_scenarios if report.total_scenarios > 0 else 0,
                unit="ratio",
                labels={"correlation_id": ctx.correlation_id}
            )

            self.obs_manager.record_metric(
                "ci_eval.regressions_detected",
                len(report.regressions),
                unit="count",
                labels={"correlation_id": ctx.correlation_id}
            )

            # Save results if output path provided
            if output_path:
                self._save_results(report, results, output_path)

            return report

    def _load_evaluation_scenarios(
        self,
        agent_names: Optional[List[str]] = None
    ) -> List[EvaluationScenario]:
        """
        Load evaluation scenarios.

        For now, creates scenarios from benchmark types.
        Future: Load from JSON files.
        """
        scenarios = []

        # Default agents if none specified
        if agent_names is None:
            agent_names = [
                "builder_agent",
                "deploy_agent",
                "marketing_agent",
                "support_agent",
                "monitor_agent",
                "analyst_agent",
                "spec_agent",
                "qa_agent",
                "security_agent",
                "design_agent",
                "content_agent",
                "seo_agent",
                "sales_agent",
                "hr_agent",
                "finance_agent"
            ]

        # Create scenarios for each agent (18 scenarios per agent = 270 total)
        benchmark_types = [
            BenchmarkType.GENESIS_CUSTOM,
            BenchmarkType.UNIT_TESTS,
            BenchmarkType.PERFORMANCE
        ]

        for agent_name in agent_names:
            for idx, benchmark_type in enumerate(benchmark_types):
                for scenario_num in range(1, 7):  # 6 scenarios per type
                    scenarios.append(EvaluationScenario(
                        scenario_id=f"{agent_name}_{benchmark_type.value}_scenario_{scenario_num}",
                        agent_name=agent_name,
                        benchmark_type=benchmark_type.value,
                        description=f"{agent_name} {benchmark_type.value} scenario {scenario_num}",
                        timeout_ms=5000
                    ))

        return scenarios

    async def _run_scenarios_parallel(
        self,
        scenarios: List[EvaluationScenario],
        context: CorrelationContext
    ) -> List[ScenarioResult]:
        """Run scenarios in parallel with concurrency limit"""
        semaphore = asyncio.Semaphore(self.max_concurrent)

        async def run_with_semaphore(scenario):
            async with semaphore:
                return await self._run_single_scenario(scenario, context)

        tasks = [run_with_semaphore(s) for s in scenarios]
        return await asyncio.gather(*tasks, return_exceptions=False)

    async def _run_single_scenario(
        self,
        scenario: EvaluationScenario,
        context: CorrelationContext
    ) -> ScenarioResult:
        """
        Run single benchmark scenario.

        For now, returns mock results.
        Future: Execute real agent benchmarks.
        """
        with self.obs_manager.span(
            f"ci_eval.scenario.{scenario.scenario_id}",
            SpanType.EXECUTION,
            context,
            attributes={
                "scenario_id": scenario.scenario_id,
                "agent_name": scenario.agent_name,
                "benchmark_type": scenario.benchmark_type
            }
        ) as span:
            start_time = time.time()

            try:
                # Simulate execution (replace with real benchmark execution)
                await asyncio.sleep(0.1)  # Placeholder

                execution_time_ms = (time.time() - start_time) * 1000

                # Mock successful result
                result = ScenarioResult(
                    scenario_id=scenario.scenario_id,
                    agent_name=scenario.agent_name,
                    success=True,
                    execution_time_ms=execution_time_ms,
                    quality_score=0.87,
                    cost_usd=0.002,
                    memory_mb=150.0
                )

                span.set_attribute("success", True)
                span.set_attribute("execution_time_ms", execution_time_ms)

                return result

            except Exception as e:
                execution_time_ms = (time.time() - start_time) * 1000

                span.set_attribute("success", False)
                span.set_attribute("error", str(e))

                return ScenarioResult(
                    scenario_id=scenario.scenario_id,
                    agent_name=scenario.agent_name,
                    success=False,
                    execution_time_ms=execution_time_ms,
                    quality_score=0.0,
                    cost_usd=0.0,
                    memory_mb=0.0,
                    error=str(e)
                )

    def _aggregate_results(
        self,
        results: List[ScenarioResult],
        baseline_results: Optional[Dict[str, ScenarioResult]]
    ) -> EvaluationReport:
        """Aggregate results and detect regressions"""
        passed = sum(1 for r in results if r.success)
        failed = len(results) - passed

        successful_results = [r for r in results if r.success]

        avg_execution_time = (
            sum(r.execution_time_ms for r in results) / len(results)
            if results else 0.0
        )

        avg_quality = (
            sum(r.quality_score for r in successful_results) / len(successful_results)
            if successful_results else 0.0
        )

        total_cost = sum(r.cost_usd for r in results)

        # Aggregate by agent
        by_agent = {}
        for result in results:
            agent_name = result.agent_name
            if agent_name not in by_agent:
                by_agent[agent_name] = {
                    "passed": 0,
                    "failed": 0,
                    "avg_quality": 0.0,
                    "avg_time_ms": 0.0
                }

            by_agent[agent_name]["passed" if result.success else "failed"] += 1

        # Calculate agent averages
        for agent_name in by_agent:
            agent_results = [r for r in results if r.agent_name == agent_name and r.success]
            if agent_results:
                by_agent[agent_name]["avg_quality"] = sum(r.quality_score for r in agent_results) / len(agent_results)
                by_agent[agent_name]["avg_time_ms"] = sum(r.execution_time_ms for r in agent_results) / len(agent_results)

        # Detect regressions and improvements
        regressions = []
        improvements = []

        if baseline_results:
            for result in results:
                baseline = baseline_results.get(result.scenario_id)
                if baseline and baseline.success and result.success:
                    # Check quality regression
                    quality_change = (
                        (result.quality_score - baseline.quality_score) / baseline.quality_score
                        if baseline.quality_score > 0 else 0.0
                    )

                    if quality_change < -self.regression_threshold:
                        regressions.append({
                            "scenario_id": result.scenario_id,
                            "metric": "quality_score",
                            "baseline": baseline.quality_score,
                            "current": result.quality_score,
                            "change_percent": quality_change * 100
                        })
                    elif quality_change > self.regression_threshold:
                        improvements.append({
                            "scenario_id": result.scenario_id,
                            "metric": "quality_score",
                            "baseline": baseline.quality_score,
                            "current": result.quality_score,
                            "change_percent": quality_change * 100
                        })

                    # Check execution time regression
                    time_change = (
                        (result.execution_time_ms - baseline.execution_time_ms) / baseline.execution_time_ms
                        if baseline.execution_time_ms > 0 else 0.0
                    )

                    if time_change > 0.2:  # 20% slower
                        regressions.append({
                            "scenario_id": result.scenario_id,
                            "metric": "execution_time_ms",
                            "baseline": baseline.execution_time_ms,
                            "current": result.execution_time_ms,
                            "change_percent": time_change * 100
                        })

        return EvaluationReport(
            total_scenarios=len(results),
            passed=passed,
            failed=failed,
            avg_execution_time_ms=avg_execution_time,
            avg_quality_score=avg_quality,
            total_cost_usd=total_cost,
            regressions=regressions,
            improvements=improvements,
            by_agent=by_agent
        )

    def _load_baseline_results(self, path: Path) -> Dict[str, ScenarioResult]:
        """Load baseline results from JSON file"""
        try:
            with open(path, 'r') as f:
                data = json.load(f)

            baseline = {}
            for result_dict in data.get("results", []):
                result = ScenarioResult(**result_dict)
                baseline[result.scenario_id] = result

            return baseline

        except Exception as e:
            logger.error(f"Failed to load baseline results: {e}")
            return {}

    def _save_results(
        self,
        report: EvaluationReport,
        results: List[ScenarioResult],
        output_path: Path
    ):
        """Save results to JSON file"""
        output_data = {
            "report": asdict(report),
            "results": [asdict(r) for r in results],
            "timestamp": time.time()
        }

        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w') as f:
            json.dump(output_data, f, indent=2)

        logger.info(f"Results saved to {output_path}")

    def generate_markdown_report(self, report: EvaluationReport) -> str:
        """Generate markdown report for CI"""
        markdown = f"""## CI Evaluation Report

**Overall Results:**
- Total Scenarios: {report.total_scenarios}
- Passed: {report.passed} ({report.passed/report.total_scenarios*100:.1f}%)
- Failed: {report.failed}

**Performance Metrics:**
- Avg Execution Time: {report.avg_execution_time_ms:.1f} ms
- Avg Quality Score: {report.avg_quality_score:.3f}
- Total Cost: ${report.total_cost_usd:.4f}

**Regressions Detected:** {len(report.regressions)}
"""

        if report.regressions:
            markdown += "\n### ⚠️ Regressions:\n"
            for reg in report.regressions:
                markdown += f"- `{reg['scenario_id']}`: {reg['metric']} regressed by {abs(reg['change_percent']):.1f}%\n"
                markdown += f"  - Baseline: {reg['baseline']:.3f}, Current: {reg['current']:.3f}\n"

        if report.improvements:
            markdown += "\n### ✅ Improvements:\n"
            for imp in report.improvements[:10]:  # Show top 10
                markdown += f"- `{imp['scenario_id']}`: {imp['metric']} improved by {imp['change_percent']:.1f}%\n"

        # Per-agent breakdown
        if report.by_agent:
            markdown += "\n### Per-Agent Results:\n"
            for agent_name, metrics in sorted(report.by_agent.items()):
                total = metrics["passed"] + metrics["failed"]
                pass_rate = (metrics["passed"] / total * 100) if total > 0 else 0
                markdown += f"- **{agent_name}:** {metrics['passed']}/{total} passed ({pass_rate:.1f}%)"
                if metrics["avg_quality"] > 0:
                    markdown += f", Quality: {metrics['avg_quality']:.2f}"
                markdown += "\n"

        return markdown

    def has_regressions(self, report: EvaluationReport) -> bool:
        """Check if report contains any regressions"""
        return len(report.regressions) > 0
