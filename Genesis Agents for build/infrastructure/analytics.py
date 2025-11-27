"""
Analytics Tracker for A/B Testing

Tracks variant performance metrics and generates comparison reports.
"""

import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

logger = logging.getLogger(__name__)


class AnalyticsTracker:
    """
    Tracks analytics for A/B testing variants
    
    Features:
    - Request logging (variant, success, latency, cost)
    - Metric aggregation
    - Comparison reports
    - Time-series analysis
    """
    
    def __init__(self, storage_path: Optional[str] = None):
        """
        Initialize analytics tracker
        
        Args:
            storage_path: Path to storage directory (defaults to data/analytics/)
        """
        if storage_path:
            self.storage_path = Path(storage_path)
        else:
            self.storage_path = Path("data/analytics")
        
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # In-memory cache for recent data
        self.recent_requests: List[Dict[str, Any]] = []
        self.max_cache_size = 1000
        
        logger.info(f"AnalyticsTracker initialized: {self.storage_path}")
    
    def log_variant(
        self,
        user_id: str,
        agent_name: str,
        variant: str,
        success: bool,
        latency_ms: float,
        cost_usd: float = 0.0,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Log which variant was used for a request
        
        Args:
            user_id: Unique identifier for user/request
            agent_name: Name of the agent
            variant: "finetuned" or "baseline"
            success: Whether request succeeded
            latency_ms: Request latency in milliseconds
            cost_usd: Request cost in USD
            metadata: Optional additional metadata
        """
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "agent_name": agent_name,
            "variant": variant,
            "success": success,
            "latency_ms": latency_ms,
            "cost_usd": cost_usd,
            "metadata": metadata or {}
        }
        
        # Add to cache
        self.recent_requests.append(entry)
        if len(self.recent_requests) > self.max_cache_size:
            self.recent_requests.pop(0)
        
        # Write to file
        log_file = self.storage_path / f"analytics_{datetime.utcnow().strftime('%Y%m%d')}.jsonl"
        with open(log_file, "a") as f:
            f.write(json.dumps(entry) + "\n")
    
    def log_gap_execution(
        self,
        user_id: str,
        query: str,
        task_count: int,
        level_count: int,
        speedup_factor: float,
        total_time_ms: float,
        success: bool,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Log GAP planner execution for analytics (Priority 3 integration)
        
        Args:
            user_id: Unique identifier for user/request
            query: Original user query
            task_count: Number of tasks in plan
            level_count: Number of DAG levels
            speedup_factor: Parallel speedup achieved
            total_time_ms: Total execution time
            success: Whether execution succeeded
            metadata: Optional additional metadata
        """
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "execution_type": "gap_planner",
            "query": query[:200],  # Truncate long queries
            "task_count": task_count,
            "level_count": level_count,
            "speedup_factor": speedup_factor,
            "total_time_ms": total_time_ms,
            "success": success,
            "metadata": metadata or {}
        }
        
        # Add to cache
        self.recent_requests.append(entry)
        if len(self.recent_requests) > self.max_cache_size:
            self.recent_requests.pop(0)
        
        # Write to file
        log_file = self.storage_path / f"analytics_{datetime.utcnow().strftime('%Y%m%d')}.jsonl"
        with open(log_file, "a") as f:
            f.write(json.dumps(entry) + "\n")
        
        logger.debug(f"Logged GAP execution: {task_count} tasks, {speedup_factor:.2f}x speedup")
    
    def compare_variants(
        self,
        time_window_hours: Optional[int] = None,
        agent_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Compare metrics: baseline vs fine-tuned
        
        Args:
            time_window_hours: Optional time window in hours (defaults to all data)
            agent_name: Optional filter by agent name
        
        Returns:
            Dictionary with comparison metrics
        """
        # Load relevant data
        data = self._load_data(time_window_hours, agent_name)
        
        if not data:
            return {
                "baseline": {},
                "finetuned": {},
                "comparison": {},
                "error": "No data available"
            }
        
        # Aggregate by variant
        baseline_data = [d for d in data if d["variant"] == "baseline"]
        finetuned_data = [d for d in data if d["variant"] == "finetuned"]
        
        baseline_metrics = self._calculate_metrics(baseline_data)
        finetuned_metrics = self._calculate_metrics(finetuned_data)
        
        # Calculate differences
        comparison = {
            "success_rate_diff": (
                finetuned_metrics["success_rate"] - baseline_metrics["success_rate"]
            ),
            "latency_diff_ms": (
                finetuned_metrics["avg_latency_ms"] - baseline_metrics["avg_latency_ms"]
            ),
            "latency_diff_pct": (
                ((finetuned_metrics["avg_latency_ms"] - baseline_metrics["avg_latency_ms"]) 
                 / baseline_metrics["avg_latency_ms"] * 100)
                if baseline_metrics["avg_latency_ms"] > 0 else 0
            ),
            "cost_diff_usd": (
                finetuned_metrics["avg_cost_usd"] - baseline_metrics["avg_cost_usd"]
            ),
            "cost_diff_pct": (
                ((finetuned_metrics["avg_cost_usd"] - baseline_metrics["avg_cost_usd"])
                 / baseline_metrics["avg_cost_usd"] * 100)
                if baseline_metrics["avg_cost_usd"] > 0 else 0
            )
        }
        
        return {
            "baseline": baseline_metrics,
            "finetuned": finetuned_metrics,
            "comparison": comparison,
            "time_window_hours": time_window_hours,
            "agent_name": agent_name
        }
    
    def _load_data(
        self,
        time_window_hours: Optional[int] = None,
        agent_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Load analytics data from storage"""
        data = []
        
        # Determine which files to load
        if time_window_hours:
            cutoff_time = datetime.utcnow() - timedelta(hours=time_window_hours)
        else:
            cutoff_time = None
        
        # Load from recent cache
        for entry in self.recent_requests:
            if cutoff_time:
                entry_time = datetime.fromisoformat(entry["timestamp"])
                if entry_time < cutoff_time:
                    continue
            
            if agent_name and entry.get("agent_name") != agent_name:
                continue
            
            data.append(entry)
        
        # Load from files
        for log_file in sorted(self.storage_path.glob("analytics_*.jsonl")):
            try:
                with open(log_file) as f:
                    for line in f:
                        entry = json.loads(line.strip())
                        
                        if cutoff_time:
                            entry_time = datetime.fromisoformat(entry["timestamp"])
                            if entry_time < cutoff_time:
                                continue
                        
                        if agent_name and entry.get("agent_name") != agent_name:
                            continue
                        
                        data.append(entry)
            except Exception as e:
                logger.warning(f"Error loading {log_file}: {e}")
        
        return data
    
    def _calculate_metrics(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate aggregate metrics from data"""
        if not data:
            return {
                "total_requests": 0,
                "success_rate": 0.0,
                "avg_latency_ms": 0.0,
                "avg_cost_usd": 0.0,
                "total_cost_usd": 0.0
            }
        
        total = len(data)
        successful = sum(1 for d in data if d.get("success", False))
        total_latency = sum(d.get("latency_ms", 0) for d in data)
        total_cost = sum(d.get("cost_usd", 0) for d in data)
        
        return {
            "total_requests": total,
            "success_rate": successful / total if total > 0 else 0.0,
            "avg_latency_ms": total_latency / total if total > 0 else 0.0,
            "avg_cost_usd": total_cost / total if total > 0 else 0.0,
            "total_cost_usd": total_cost
        }
    
    def generate_report(self, output_path: Optional[str] = None) -> str:
        """
        Generate markdown report comparing variants
        
        Args:
            output_path: Optional path to save report
        
        Returns:
            Markdown report content
        """
        comparison = self.compare_variants()
        
        report = f"""# A/B Testing Analytics Report

Generated: {datetime.utcnow().isoformat()}

## Summary

### Baseline Metrics
- Total Requests: {comparison['baseline'].get('total_requests', 0)}
- Success Rate: {comparison['baseline'].get('success_rate', 0):.2%}
- Avg Latency: {comparison['baseline'].get('avg_latency_ms', 0):.2f}ms
- Avg Cost: ${comparison['baseline'].get('avg_cost_usd', 0):.6f}

### Fine-Tuned Metrics
- Total Requests: {comparison['finetuned'].get('total_requests', 0)}
- Success Rate: {comparison['finetuned'].get('success_rate', 0):.2%}
- Avg Latency: {comparison['finetuned'].get('avg_latency_ms', 0):.2f}ms
- Avg Cost: ${comparison['finetuned'].get('avg_cost_usd', 0):.6f}

### Comparison
- Success Rate Difference: {comparison['comparison'].get('success_rate_diff', 0):+.2%}
- Latency Difference: {comparison['comparison'].get('latency_diff_ms', 0):+.2f}ms ({comparison['comparison'].get('latency_diff_pct', 0):+.1f}%)
- Cost Difference: ${comparison['comparison'].get('cost_diff_usd', 0):+.6f} ({comparison['comparison'].get('cost_diff_pct', 0):+.1f}%)

## Recommendation

"""
        
        # Add recommendation based on metrics
        success_diff = comparison['comparison'].get('success_rate_diff', 0)
        latency_diff_pct = comparison['comparison'].get('latency_diff_pct', 0)
        cost_diff_pct = comparison['comparison'].get('cost_diff_pct', 0)
        
        if success_diff > 0.05 and latency_diff_pct < 20 and cost_diff_pct < 50:
            report += "✅ **PROCEED WITH ROLLOUT** - Fine-tuned model shows improved success rate with acceptable latency/cost increase.\n"
        elif success_diff < -0.05:
            report += "⚠️ **ROLLBACK RECOMMENDED** - Fine-tuned model shows decreased success rate.\n"
        elif latency_diff_pct > 50:
            report += "⚠️ **OPTIMIZE OR ROLLBACK** - Fine-tuned model has significantly higher latency.\n"
        elif cost_diff_pct > 100:
            report += "⚠️ **COST CONCERN** - Fine-tuned model has significantly higher cost.\n"
        else:
            report += "📊 **MONITOR CLOSELY** - Metrics are within acceptable range, continue monitoring.\n"
        
        # Save report if path provided
        if output_path:
            with open(output_path, "w") as f:
                f.write(report)
            logger.info(f"Report saved to {output_path}")
        
        return report

