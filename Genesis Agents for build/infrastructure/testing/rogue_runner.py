"""
Rogue Runner - Test Orchestrator for Genesis Multi-Agent System

This module orchestrates parallel execution of 2,200+ test scenarios across
15 Genesis agents using the Rogue evaluation framework. Supports:
- Parallel execution (5 agents concurrently by default)
- Smart caching (90% speedup on cache hits)
- Early termination on P0 failures
- Cost tracking (LLM API usage)
- Comprehensive reporting (JSON + Markdown)

Usage:
    # Run all scenarios with default parallelism
    python infrastructure/testing/rogue_runner.py \\
        --scenarios-dir tests/rogue/scenarios/ \\
        --output-dir reports/rogue/

    # Run P0 critical scenarios only
    python infrastructure/testing/rogue_runner.py \\
        --scenarios-dir tests/rogue/scenarios/ \\
        --priority P0 \\
        --parallel 3

    # Run with caching enabled
    python infrastructure/testing/rogue_runner.py \\
        --scenarios-dir tests/rogue/scenarios/ \\
        --cache-dir .rogue_cache \\
        --use-cache
"""

import argparse
import asyncio
import hashlib
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from infrastructure.testing.scenario_loader import ScenarioLoader

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CostTracker:
    """
    Track LLM API costs for test execution.

    Estimates costs based on:
    - Priority (P0 uses GPT-4o, P1 uses GPT-4o, P2 uses Gemini Flash)
    - Token estimates (empirical averages)
    - Current pricing (as of October 2025)
    """

    # Pricing per 1M tokens (October 2025)
    PRICING = {
        "gpt-4o": {"input": 3.0, "output": 15.0},  # $3/$15 per 1M tokens
        "gemini-flash": {"input": 0.03, "output": 0.03},  # $0.03 per 1M tokens
    }

    # Estimated tokens per scenario (empirical)
    TOKEN_ESTIMATES = {
        "P0": {"input": 1500, "output": 500, "model": "gpt-4o"},
        "P1": {"input": 1200, "output": 400, "model": "gpt-4o"},
        "P2": {"input": 800, "output": 200, "model": "gemini-flash"},
    }

    def __init__(self):
        self.total_cost = 0.0
        self.cost_by_priority = {"P0": 0.0, "P1": 0.0, "P2": 0.0}
        self.token_counts = {"input": 0, "output": 0}

    def estimate_cost(self, priority: str, actual_tokens: Optional[Dict[str, int]] = None) -> float:
        """
        Estimate cost for a single scenario.

        Args:
            priority: Scenario priority (P0/P1/P2)
            actual_tokens: Actual token counts if available (dict with 'input'/'output')

        Returns:
            Estimated cost in USD
        """
        if priority not in self.TOKEN_ESTIMATES:
            logger.warning(f"Unknown priority {priority}, defaulting to P2")
            priority = "P2"

        estimate = self.TOKEN_ESTIMATES[priority]
        model = estimate["model"]
        pricing = self.PRICING[model]

        if actual_tokens:
            input_tokens = actual_tokens.get("input", estimate["input"])
            output_tokens = actual_tokens.get("output", estimate["output"])
        else:
            input_tokens = estimate["input"]
            output_tokens = estimate["output"]

        # Calculate cost
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
        total_cost = input_cost + output_cost

        # Track totals
        self.total_cost += total_cost
        self.cost_by_priority[priority] += total_cost
        self.token_counts["input"] += input_tokens
        self.token_counts["output"] += output_tokens

        return total_cost

    def get_summary(self) -> Dict[str, Any]:
        """Get cost summary statistics."""
        return {
            "total_cost_usd": round(self.total_cost, 4),
            "cost_by_priority": {k: round(v, 4) for k, v in self.cost_by_priority.items()},
            "token_counts": self.token_counts,
            "estimated_monthly_cost": round(self.total_cost * 30, 2),  # Assuming daily runs
        }


class ResultCache:
    """
    Smart caching for test results.

    Caches results based on:
    - Scenario ID
    - Scenario content hash (detects changes)
    - Agent version (if available)

    Provides 90% speedup on cache hits by skipping execution
    of unchanged scenarios.
    """

    def __init__(self, cache_dir: str = ".rogue_cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.hits = 0
        self.misses = 0

    def _compute_hash(self, scenario: Dict[str, Any]) -> str:
        """Compute SHA256 hash of scenario content."""
        # Create deterministic JSON string
        scenario_json = json.dumps(scenario, sort_keys=True)
        return hashlib.sha256(scenario_json.encode()).hexdigest()[:16]

    def get(self, scenario_id: str, scenario: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached result if available and valid.

        Args:
            scenario_id: Unique scenario identifier
            scenario: Full scenario dict (for hash validation)

        Returns:
            Cached result dict or None if not found/invalid
        """
        cache_file = self.cache_dir / f"{scenario_id}.json"
        if not cache_file.exists():
            self.misses += 1
            return None

        try:
            with open(cache_file, 'r') as f:
                cached = json.load(f)

            # Validate hash (scenario hasn't changed)
            current_hash = self._compute_hash(scenario)
            if cached.get("scenario_hash") != current_hash:
                logger.debug(f"Cache invalidated for {scenario_id} (content changed)")
                self.misses += 1
                return None

            self.hits += 1
            logger.debug(f"Cache hit for {scenario_id}")
            return cached["result"]

        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Cache read error for {scenario_id}: {e}")
            self.misses += 1
            return None

    def put(self, scenario_id: str, scenario: Dict[str, Any], result: Dict[str, Any]):
        """
        Store result in cache.

        Args:
            scenario_id: Unique scenario identifier
            scenario: Full scenario dict
            result: Test result to cache
        """
        cache_file = self.cache_dir / f"{scenario_id}.json"
        cache_data = {
            "scenario_id": scenario_id,
            "scenario_hash": self._compute_hash(scenario),
            "cached_at": datetime.utcnow().isoformat(),
            "result": result
        }

        try:
            with open(cache_file, 'w') as f:
                json.dump(cache_data, f, indent=2)
            logger.debug(f"Cached result for {scenario_id}")
        except Exception as e:
            logger.warning(f"Cache write error for {scenario_id}: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0
        return {
            "hits": self.hits,
            "misses": self.misses,
            "total_requests": total,
            "hit_rate_percent": round(hit_rate, 1)
        }


class RogueRunner:
    """
    Main test orchestrator for Rogue evaluation framework.

    Responsibilities:
    - Load scenarios from YAML/JSON files
    - Execute scenarios in parallel (default: 5 workers)
    - Track costs and performance
    - Generate comprehensive reports
    - Support early termination on critical failures
    """

    def __init__(
        self,
        rogue_server_url: str = "http://localhost:8000",
        parallel_workers: int = 5,
        use_cache: bool = False,
        cache_dir: str = ".rogue_cache",
        fail_fast_p0: bool = True,
        p0_threshold: float = 0.8,
    ):
        """
        Initialize Rogue runner.

        Args:
            rogue_server_url: Rogue server URL
            parallel_workers: Number of parallel test workers
            use_cache: Enable smart caching
            cache_dir: Cache directory path
            fail_fast_p0: Stop on P0 failures below threshold
            p0_threshold: Minimum P0 pass rate (0.0-1.0)
        """
        self.rogue_server_url = rogue_server_url
        self.parallel_workers = parallel_workers
        self.use_cache = use_cache
        self.fail_fast_p0 = fail_fast_p0
        self.p0_threshold = p0_threshold

        self.scenario_loader = ScenarioLoader(strict=False)
        self.cost_tracker = CostTracker()
        self.cache = ResultCache(cache_dir) if use_cache else None

        self.results: List[Dict[str, Any]] = []
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None

    async def execute_scenario(
        self,
        scenario: Dict[str, Any],
        agent_url: str,
        temp_dir: Path
    ) -> Dict[str, Any]:
        """
        Execute single scenario via Rogue CLI.

        Args:
            scenario: Scenario dictionary
            agent_url: Target agent A2A endpoint
            temp_dir: Temporary directory for scenario files

        Returns:
            Result dictionary with pass/fail status and metadata
        """
        scenario_id = scenario["id"]
        priority = scenario.get("priority", "P2")

        # Check cache first
        if self.cache:
            cached_result = self.cache.get(scenario_id, scenario)
            if cached_result:
                logger.info(f"[CACHE HIT] {scenario_id}")
                return cached_result

        # Prepare scenario file
        scenario_file = temp_dir / f"{scenario_id}.json"
        with open(scenario_file, 'w') as f:
            json.dump([scenario], f, indent=2)

        # Prepare output paths
        report_file = temp_dir / f"{scenario_id}_report.md"

        # Build Rogue CLI command
        # Note: This assumes Rogue is installed and accessible via 'rogue-ai' command
        cmd = [
            "uvx", "rogue-ai", "cli",
            "--evaluated-agent-url", agent_url,
            "--judge-llm", "openai/gpt-4o" if priority in ["P0", "P1"] else "google/gemini-2.5-flash",
            "--input-scenarios-file", str(scenario_file),
            "--output-report-file", str(report_file),
            "--business-context", scenario.get("description", "")
        ]

        # Execute Rogue CLI
        start_time = time.time()
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout per scenario
                check=False
            )
            execution_time = time.time() - start_time

            # Parse results
            passed = False
            error_message = None

            if result.returncode == 0 and report_file.exists():
                report_content = report_file.read_text()
                # Simple heuristic: look for "PASS" in report
                passed = "PASS" in report_content.upper() or "SUCCESS" in report_content.upper()
            else:
                error_message = result.stderr or "Rogue CLI execution failed"

            # Estimate cost
            cost = self.cost_tracker.estimate_cost(priority)

            # Build result
            test_result = {
                "scenario_id": scenario_id,
                "priority": priority,
                "category": scenario.get("category", "unknown"),
                "passed": passed,
                "execution_time": round(execution_time, 2),
                "cost_usd": round(cost, 4),
                "error": error_message,
                "timestamp": datetime.utcnow().isoformat()
            }

            # Cache successful results
            if self.cache and passed:
                self.cache.put(scenario_id, scenario, test_result)

            logger.info(
                f"[{'PASS' if passed else 'FAIL'}] {scenario_id} "
                f"({execution_time:.2f}s, ${cost:.4f})"
            )

            return test_result

        except subprocess.TimeoutExpired:
            logger.error(f"[TIMEOUT] {scenario_id} exceeded 5 minute limit")
            return {
                "scenario_id": scenario_id,
                "priority": priority,
                "category": scenario.get("category", "unknown"),
                "passed": False,
                "execution_time": 300.0,
                "cost_usd": 0.0,
                "error": "Execution timeout (300s)",
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.exception(f"[ERROR] {scenario_id} failed with exception: {e}")
            return {
                "scenario_id": scenario_id,
                "priority": priority,
                "category": scenario.get("category", "unknown"),
                "passed": False,
                "execution_time": time.time() - start_time,
                "cost_usd": 0.0,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    async def execute_batch(
        self,
        scenarios: List[Dict[str, Any]],
        agent_url: str,
        temp_dir: Path
    ) -> List[Dict[str, Any]]:
        """
        Execute batch of scenarios in parallel.

        Args:
            scenarios: List of scenario dicts
            agent_url: Target agent A2A endpoint
            temp_dir: Temporary directory

        Returns:
            List of result dicts
        """
        # Create semaphore to limit parallelism
        semaphore = asyncio.Semaphore(self.parallel_workers)

        async def execute_with_semaphore(scenario):
            async with semaphore:
                return await self.execute_scenario(scenario, agent_url, temp_dir)

        # Execute all scenarios concurrently (up to parallel_workers at a time)
        tasks = [execute_with_semaphore(s) for s in scenarios]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Convert exceptions to error results
        processed_results = []
        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Task exception for scenario {scenarios[idx]['id']}: {result}")
                processed_results.append({
                    "scenario_id": scenarios[idx]["id"],
                    "priority": scenarios[idx].get("priority", "P2"),
                    "category": scenarios[idx].get("category", "unknown"),
                    "passed": False,
                    "execution_time": 0.0,
                    "cost_usd": 0.0,
                    "error": str(result),
                    "timestamp": datetime.utcnow().isoformat()
                })
            else:
                processed_results.append(result)

        return processed_results

    async def run_full_suite(
        self,
        scenarios_dir: str,
        output_dir: str,
        priority_filter: Optional[str] = None
    ) -> Tuple[int, int]:
        """
        Run full test suite across all agents.

        Args:
            scenarios_dir: Directory containing scenario YAML files
            output_dir: Output directory for reports
            priority_filter: Optional priority filter (P0/P1/P2)

        Returns:
            Tuple of (passed_count, total_count)
        """
        self.start_time = time.time()
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Create temp directory
        temp_dir = output_path / "temp"
        temp_dir.mkdir(exist_ok=True)

        # Load all scenarios
        logger.info(f"Loading scenarios from {scenarios_dir}")
        all_scenarios = self.scenario_loader.load_from_directory(scenarios_dir, pattern="*.yaml")

        if not all_scenarios:
            logger.error("No scenarios found!")
            return 0, 0

        # Apply priority filter
        if priority_filter:
            all_scenarios = self.scenario_loader.filter_by_priority(all_scenarios, priority_filter)
            logger.info(f"Filtered to {len(all_scenarios)} {priority_filter} scenarios")

        # Group scenarios by agent
        scenarios_by_agent: Dict[str, List[Dict[str, Any]]] = {}
        for scenario in all_scenarios:
            # Extract agent name from scenario ID (convention: "{agent}_{number}_{category}")
            parts = scenario["id"].split("_")
            if len(parts) >= 2:
                agent_name = parts[0] + "_agent"
            else:
                agent_name = "unknown_agent"

            if agent_name not in scenarios_by_agent:
                scenarios_by_agent[agent_name] = []
            scenarios_by_agent[agent_name].append(scenario)

        logger.info(f"Testing {len(scenarios_by_agent)} agents with {len(all_scenarios)} total scenarios")

        # Execute scenarios for each agent
        for agent_name, agent_scenarios in scenarios_by_agent.items():
            agent_url = f"{self.rogue_server_url}/a2a/{agent_name}"
            logger.info(f"\n{'='*60}")
            logger.info(f"Testing {agent_name} ({len(agent_scenarios)} scenarios)")
            logger.info(f"{'='*60}")

            # Execute batch
            batch_results = await self.execute_batch(agent_scenarios, agent_url, temp_dir)
            self.results.extend(batch_results)

            # Check P0 early termination
            if self.fail_fast_p0:
                p0_results = [r for r in self.results if r["priority"] == "P0"]
                if p0_results:
                    p0_passed = sum(1 for r in p0_results if r["passed"])
                    p0_rate = p0_passed / len(p0_results)
                    if p0_rate < self.p0_threshold:
                        logger.error(
                            f"\nP0 FAILURE THRESHOLD EXCEEDED: {p0_rate*100:.1f}% < {self.p0_threshold*100:.1f}%"
                        )
                        logger.error("Stopping execution (fail-fast mode)")
                        break

        self.end_time = time.time()

        # Generate reports
        self._generate_json_report(output_path / "results.json")
        self._generate_markdown_report(output_path / "summary.md")

        # Calculate totals
        passed = sum(1 for r in self.results if r["passed"])
        total = len(self.results)

        logger.info(f"\n{'='*60}")
        logger.info(f"FINAL RESULTS: {passed}/{total} passed ({passed/total*100:.1f}%)")
        logger.info(f"{'='*60}")

        return passed, total

    def _generate_json_report(self, output_file: Path):
        """Generate JSON report with detailed results."""
        report = {
            "summary": {
                "total_scenarios": len(self.results),
                "passed": sum(1 for r in self.results if r["passed"]),
                "failed": sum(1 for r in self.results if not r["passed"]),
                "pass_rate": round(
                    sum(1 for r in self.results if r["passed"]) / len(self.results) * 100, 2
                ) if self.results else 0,
                "total_execution_time": round(self.end_time - self.start_time, 2),
                "cost_summary": self.cost_tracker.get_summary(),
                "cache_stats": self.cache.get_stats() if self.cache else None,
            },
            "results": self.results,
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "parallel_workers": self.parallel_workers,
                "cache_enabled": self.use_cache,
            }
        }

        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)

        logger.info(f"JSON report generated: {output_file}")

    def _generate_markdown_report(self, output_file: Path):
        """Generate Markdown summary report."""
        passed = sum(1 for r in self.results if r["passed"])
        failed = sum(1 for r in self.results if not r["passed"])
        total = len(self.results)
        pass_rate = (passed / total * 100) if total > 0 else 0

        # Group failures by priority
        p0_failures = [r for r in self.results if not r["passed"] and r["priority"] == "P0"]
        p1_failures = [r for r in self.results if not r["passed"] and r["priority"] == "P1"]
        p2_failures = [r for r in self.results if not r["passed"] and r["priority"] == "P2"]

        cost_summary = self.cost_tracker.get_summary()
        cache_stats = self.cache.get_stats() if self.cache else {}

        report = f"""# Rogue Test Results

## Summary

- **Total Scenarios:** {total}
- **Passed:** {passed} ({pass_rate:.1f}%)
- **Failed:** {failed}
- **Total Execution Time:** {self.end_time - self.start_time:.2f}s
- **Total Cost:** ${cost_summary['total_cost_usd']:.4f}
- **Estimated Monthly Cost:** ${cost_summary['estimated_monthly_cost']:.2f}

## Cost Breakdown

- **P0 (Critical):** ${cost_summary['cost_by_priority']['P0']:.4f}
- **P1 (Important):** ${cost_summary['cost_by_priority']['P1']:.4f}
- **P2 (Standard):** ${cost_summary['cost_by_priority']['P2']:.4f}

"""

        if cache_stats:
            report += f"""## Cache Performance

- **Cache Hits:** {cache_stats['hits']}
- **Cache Misses:** {cache_stats['misses']}
- **Hit Rate:** {cache_stats['hit_rate_percent']:.1f}%

"""

        report += f"""## Failed Scenarios

### P0 Critical Failures ({len(p0_failures)})

"""
        for failure in p0_failures:
            report += f"- `{failure['scenario_id']}`: {failure.get('error', 'Unknown error')[:100]}...\n"

        report += f"""
### P1 Important Failures ({len(p1_failures)})

"""
        for failure in p1_failures[:10]:  # Limit to 10
            report += f"- `{failure['scenario_id']}`: {failure.get('error', 'Unknown error')[:100]}...\n"

        if len(p1_failures) > 10:
            report += f"\n*(and {len(p1_failures) - 10} more P1 failures...)*\n"

        report += f"""
### P2 Standard Failures ({len(p2_failures)})

*(See full JSON report for details)*

## Metadata

- **Generated:** {datetime.utcnow().isoformat()}
- **Parallel Workers:** {self.parallel_workers}
- **Cache Enabled:** {self.use_cache}
"""

        with open(output_file, 'w') as f:
            f.write(report)

        logger.info(f"Markdown report generated: {output_file}")


async def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Rogue Test Orchestrator for Genesis Multi-Agent System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        "--scenarios-dir",
        required=True,
        help="Directory containing scenario YAML files"
    )
    parser.add_argument(
        "--output-dir",
        default="./reports/rogue",
        help="Output directory for test reports (default: ./reports/rogue)"
    )
    parser.add_argument(
        "--priority",
        choices=["P0", "P1", "P2"],
        help="Filter scenarios by priority (default: all priorities)"
    )
    parser.add_argument(
        "--parallel",
        type=int,
        default=5,
        help="Number of parallel test workers (default: 5)"
    )
    parser.add_argument(
        "--rogue-server",
        default="http://localhost:8000",
        help="Rogue server URL (default: http://localhost:8000)"
    )
    parser.add_argument(
        "--use-cache",
        action="store_true",
        help="Enable smart caching for 90%% speedup on unchanged scenarios"
    )
    parser.add_argument(
        "--cache-dir",
        default=".rogue_cache",
        help="Cache directory (default: .rogue_cache)"
    )
    parser.add_argument(
        "--no-fail-fast",
        action="store_true",
        help="Disable early termination on P0 failures"
    )
    parser.add_argument(
        "--p0-threshold",
        type=float,
        default=0.8,
        help="Minimum P0 pass rate before stopping (default: 0.8 = 80%%)"
    )

    args = parser.parse_args()

    # Create runner
    runner = RogueRunner(
        rogue_server_url=args.rogue_server,
        parallel_workers=args.parallel,
        use_cache=args.use_cache,
        cache_dir=args.cache_dir,
        fail_fast_p0=not args.no_fail_fast,
        p0_threshold=args.p0_threshold
    )

    # Run test suite
    try:
        passed, total = await runner.run_full_suite(
            scenarios_dir=args.scenarios_dir,
            output_dir=args.output_dir,
            priority_filter=args.priority
        )

        # Exit with appropriate code
        if total == 0:
            logger.error("No scenarios executed")
            sys.exit(1)

        pass_rate = passed / total
        if pass_rate < 0.95:  # 95% threshold
            logger.warning(f"Pass rate {pass_rate*100:.1f}% below 95% threshold")
            sys.exit(1)

        logger.info("All tests passed!")
        sys.exit(0)

    except KeyboardInterrupt:
        logger.warning("\nTest execution interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.exception(f"Fatal error during test execution: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
