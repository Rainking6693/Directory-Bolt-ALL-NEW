"""
A/B Testing Infrastructure for Fine-Tuned Models

Provides:
- Deterministic user assignment to variants
- Gradual rollout control (10% → 25% → 50% → 100%)
- Analytics tracking for variant comparison
"""

import hashlib
import logging
from typing import Dict, Optional, List, Any
from dataclasses import dataclass, field
from datetime import datetime
import json
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class VariantMetrics:
    """Metrics for a model variant"""
    variant_name: str
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    total_latency_ms: float = 0.0
    total_cost_usd: float = 0.0
    avg_latency_ms: float = 0.0
    avg_cost_usd: float = 0.0
    success_rate: float = 0.0
    
    def update(self, success: bool, latency_ms: float, cost_usd: float = 0.0):
        """Update metrics with a new request"""
        self.total_requests += 1
        if success:
            self.successful_requests += 1
        else:
            self.failed_requests += 1
        self.total_latency_ms += latency_ms
        self.total_cost_usd += cost_usd
        
        # Recalculate averages
        if self.total_requests > 0:
            self.avg_latency_ms = self.total_latency_ms / self.total_requests
            self.avg_cost_usd = self.total_cost_usd / self.total_requests
            self.success_rate = self.successful_requests / self.total_requests


class ABTestController:
    """
    Controls which model variant to use per request.
    
    Features:
    - Deterministic user assignment (same user always gets same variant)
    - Configurable rollout percentage
    - Analytics tracking
    """
    
    def __init__(self, rollout_percentage: int = 10, analytics_db_path: Optional[str] = None, enable_gap: bool = False):
        """
        Initialize A/B test controller
        
        Args:
            rollout_percentage: Percentage of users to use fine-tuned model (0-100)
            analytics_db_path: Optional path to SQLite database for analytics
            enable_gap: Enable GAP planner feature flag (Priority 3 integration)
        """
        if not 0 <= rollout_percentage <= 100:
            raise ValueError("rollout_percentage must be between 0 and 100")
        
        self.rollout_percentage = rollout_percentage
        self.analytics_db_path = analytics_db_path
        self.enable_gap = enable_gap
        
        # Check feature flag for GAP (Priority 3)
        try:
            from infrastructure.feature_flags import is_feature_enabled
            self.enable_gap = self.enable_gap or is_feature_enabled('gap_planner_enabled')
        except ImportError:
            pass  # Feature flags not available, use provided value
        
        # In-memory metrics tracking
        self.metrics: Dict[str, VariantMetrics] = {
            "baseline": VariantMetrics("baseline"),
            "finetuned": VariantMetrics("finetuned")
        }
        
        logger.info(f"ABTestController initialized: {rollout_percentage}% rollout, GAP: {self.enable_gap}")
    
    def should_use_finetuned(self, user_id: str) -> bool:
        """
        Deterministic per-user assignment to variant.
        
        Uses hash of user_id to ensure same user always gets same variant.
        
        Args:
            user_id: Unique identifier for user/request
        
        Returns:
            True if user should use fine-tuned model, False for baseline
        """
        # Hash user_id to get consistent assignment
        hash_value = int(hashlib.md5(user_id.encode()).hexdigest(), 16)
        hash_percentage = hash_value % 100
        return hash_percentage < self.rollout_percentage
    
    def get_model_variant(self, agent_name: str, user_id: str) -> str:
        """
        Return model variant identifier based on user assignment
        
        Args:
            agent_name: Name of the agent
            user_id: Unique identifier for user/request
        
        Returns:
            "finetuned" or "baseline"
        """
        if self.should_use_finetuned(user_id):
            return "finetuned"
        return "baseline"
    
    def log_request(
        self,
        user_id: str,
        agent_name: str,
        variant: str,
        success: bool,
        latency_ms: float,
        cost_usd: float = 0.0
    ):
        """
        Log a request for analytics
        
        Args:
            user_id: Unique identifier for user/request
            agent_name: Name of the agent
            variant: "finetuned" or "baseline"
            success: Whether request succeeded
            latency_ms: Request latency in milliseconds
            cost_usd: Request cost in USD
        """
        if variant not in self.metrics:
            self.metrics[variant] = VariantMetrics(variant)
        
        self.metrics[variant].update(success, latency_ms, cost_usd)
        
        # Optionally write to database if configured
        if self.analytics_db_path:
            self._write_to_db(user_id, agent_name, variant, success, latency_ms, cost_usd)
    
    def _write_to_db(self, user_id: str, agent_name: str, variant: str, 
                     success: bool, latency_ms: float, cost_usd: float):
        """Write analytics data to SQLite database"""
        # Simple JSON-based storage for now (can be upgraded to SQLite)
        db_path = Path(self.analytics_db_path)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "agent_name": agent_name,
            "variant": variant,
            "success": success,
            "latency_ms": latency_ms,
            "cost_usd": cost_usd
        }
        
        # Append to JSONL file
        with open(db_path, "a") as f:
            f.write(json.dumps(entry) + "\n")
    
    def compare_variants(self) -> Dict[str, Any]:
        """
        Compare metrics between baseline and fine-tuned variants
        
        Returns:
            Dictionary with comparison metrics
        """
        baseline = self.metrics.get("baseline", VariantMetrics("baseline"))
        finetuned = self.metrics.get("finetuned", VariantMetrics("finetuned"))
        
        comparison = {
            "baseline": {
                "total_requests": baseline.total_requests,
                "success_rate": baseline.success_rate,
                "avg_latency_ms": baseline.avg_latency_ms,
                "avg_cost_usd": baseline.avg_cost_usd,
                "total_cost_usd": baseline.total_cost_usd
            },
            "finetuned": {
                "total_requests": finetuned.total_requests,
                "success_rate": finetuned.success_rate,
                "avg_latency_ms": finetuned.avg_latency_ms,
                "avg_cost_usd": finetuned.avg_cost_usd,
                "total_cost_usd": finetuned.total_cost_usd
            },
            "comparison": {
                "success_rate_diff": finetuned.success_rate - baseline.success_rate,
                "latency_diff_ms": finetuned.avg_latency_ms - baseline.avg_latency_ms,
                "latency_diff_pct": (
                    ((finetuned.avg_latency_ms - baseline.avg_latency_ms) / baseline.avg_latency_ms * 100)
                    if baseline.avg_latency_ms > 0 else 0
                ),
                "cost_diff_usd": finetuned.avg_cost_usd - baseline.avg_cost_usd,
                "cost_diff_pct": (
                    ((finetuned.avg_cost_usd - baseline.avg_cost_usd) / baseline.avg_cost_usd * 100)
                    if baseline.avg_cost_usd > 0 else 0
                )
            }
        }
        
        return comparison
    
    def update_rollout_percentage(self, new_percentage: int):
        """
        Update rollout percentage
        
        Args:
            new_percentage: New rollout percentage (0-100)
        """
        if not 0 <= new_percentage <= 100:
            raise ValueError("rollout_percentage must be between 0 and 100")
        
        old_percentage = self.rollout_percentage
        self.rollout_percentage = new_percentage
        logger.info(f"Rollout percentage updated: {old_percentage}% → {new_percentage}%")
    
    def get_metrics_summary(self) -> str:
        """Get human-readable metrics summary"""
        comparison = self.compare_variants()
        
        summary = f"""
A/B Test Metrics Summary:
Rollout: {self.rollout_percentage}%

Baseline:
  Requests: {comparison['baseline']['total_requests']}
  Success Rate: {comparison['baseline']['success_rate']:.2%}
  Avg Latency: {comparison['baseline']['avg_latency_ms']:.2f}ms
  Avg Cost: ${comparison['baseline']['avg_cost_usd']:.6f}

Fine-Tuned:
  Requests: {comparison['finetuned']['total_requests']}
  Success Rate: {comparison['finetuned']['success_rate']:.2%}
  Avg Latency: {comparison['finetuned']['avg_latency_ms']:.2f}ms
  Avg Cost: ${comparison['finetuned']['avg_cost_usd']:.6f}

Comparison:
  Success Rate Diff: {comparison['comparison']['success_rate_diff']:+.2%}
  Latency Diff: {comparison['comparison']['latency_diff_ms']:+.2f}ms ({comparison['comparison']['latency_diff_pct']:+.1f}%)
  Cost Diff: ${comparison['comparison']['cost_diff_usd']:+.6f} ({comparison['comparison']['cost_diff_pct']:+.1f}%)
"""
        return summary

