# infrastructure/orchestration/agile_thinker_router.py
from typing import Any, Optional, Dict, List
import asyncio
import time
import re
from dataclasses import dataclass

from infrastructure.htdag_planner import HTDAGPlanner
from infrastructure.halo_router import HALORouter
from infrastructure.load_env import load_genesis_env

load_genesis_env()

import logging
logger = logging.getLogger(__name__)

@dataclass
class ReactivePattern:
    """Pattern for fast reactive execution."""
    pattern: str  # Regex pattern
    agent_name: str
    confidence: float
    avg_latency: float  # Historical average latency

class AgileThinkerRouter:
    """
    Dual-thread orchestration: reactive for speed, planning for depth.
    Based on arXiv:2511.04898 (Real-Time Reasoning Agents).

    Reactive Thread: Fast pattern matching + direct agent invocation
    Planning Thread: Full HTDAG decomposition + comprehensive execution
    """
    def __init__(
        self,
        htdag_planner: HTDAGPlanner,
        halo_router: HALORouter,
        max_cache_size: int = 1000
    ):
        self.htdag_planner = htdag_planner
        self.halo_router = halo_router
        self.max_cache_size = max_cache_size

        # Reactive patterns (learned from TrajectoryPool)
        self.reactive_patterns: List[ReactivePattern] = self._load_reactive_patterns()

        # Result cache for instant responses with LRU eviction
        self.result_cache: Dict[str, Any] = {}
        self.cache_access_order: List[str] = []  # LRU tracking

        # Performance tracking
        self.reactive_count = 0
        self.planning_count = 0
        self.cache_hits = 0

    async def route_task(
        self,
        task: str,
        deadline: Optional[float] = None,
        prefer_quality: bool = False
    ) -> Dict[str, Any]:
        """
        Route task through reactive or planning thread.

        Args:
            task: Task description
            deadline: Optional deadline in seconds
            prefer_quality: If True, always use planning thread

        Returns:
            Result dict with output, metadata, and performance stats
        """
        start_time = time.time()

        # Check cache first
        cache_key = self._get_cache_key(task)
        if cache_key in self.result_cache:
            self.cache_hits += 1
            # Update LRU order
            self.cache_access_order.remove(cache_key)
            self.cache_access_order.append(cache_key)
            logger.info(f"[AgileThinker] Cache hit for task '{task[:50]}...'")
            return {
                "output": self.result_cache[cache_key],
                "method": "cache",
                "latency": time.time() - start_time
            }

        # Match reactive patterns
        reactive_match = self._match_reactive_pattern(task)

        # Decision logic
        if prefer_quality:
            # Quality-critical: use planning thread only
            logger.info(f"[AgileThinker] Quality mode for task '{task[:50]}...'")
            return await self._planning_thread_only(task, start_time)

        elif reactive_match and reactive_match.confidence > 0.8:
            # High-confidence match: use reactive thread only
            logger.info(f"[AgileThinker] Fast path for task '{task[:50]}...'")
            return await self._reactive_thread_only(reactive_match, task, start_time)

        elif deadline:
            # Deadline-aware: run both threads, return first completion
            logger.info(f"[AgileThinker] Dual-thread (deadline={deadline}s) for task '{task[:50]}...'")
            return await self._dual_thread_with_deadline(task, deadline, start_time)

        else:
            # Default: try reactive, fallback to planning
            logger.info(f"[AgileThinker] Dual-thread (no deadline) for task '{task[:50]}...'")
            return await self._dual_thread_no_deadline(task, reactive_match, start_time)

    async def _reactive_thread_only(
        self,
        pattern: ReactivePattern,
        task: str,
        start_time: float
    ) -> Dict[str, Any]:
        """Execute via reactive thread only."""
        self.reactive_count += 1

        # Get agent from pattern
        agent = self.halo_router.route_task(pattern.agent_name, {})

        # Execute
        result = await agent.execute(task)

        # Cache result with LRU eviction
        cache_key = self._get_cache_key(task)
        self._add_to_cache(cache_key, result)

        return {
            "output": result,
            "method": "reactive",
            "pattern_matched": pattern.pattern,
            "agent_used": pattern.agent_name,
            "latency": time.time() - start_time
        }

    async def _planning_thread_only(
        self,
        task: str,
        start_time: float
    ) -> Dict[str, Any]:
        """Execute via planning thread only."""
        self.planning_count += 1

        # Full HTDAG decomposition
        dag = await self.htdag_planner.decompose_task(task)

        # Execute DAG
        result = await self._execute_dag(dag)

        return {
            "output": result,
            "method": "planning",
            "subtasks": len(dag.nodes),
            "latency": time.time() - start_time
        }

    async def _dual_thread_with_deadline(
        self,
        task: str,
        deadline: float,
        start_time: float
    ) -> Dict[str, Any]:
        """Run both threads in parallel, return first completion within deadline."""
        # Launch reactive thread
        reactive_task = asyncio.create_task(
            self._reactive_thread_best_effort(task)
        )

        # Launch planning thread
        planning_task = asyncio.create_task(
            self._planning_thread_only(task, start_time)
        )

        # Wait for first completion or deadline
        timeout = deadline - (time.time() - start_time)

        try:
            done, pending = await asyncio.wait(
                [reactive_task, planning_task],
                timeout=max(timeout, 0.1),  # At least 0.1s
                return_when=asyncio.FIRST_COMPLETED
            )

            # Cancel pending tasks
            for task_obj in pending:
                task_obj.cancel()

            # Return first completed result
            if done:
                completed_task = list(done)[0]
                result = completed_task.result()
                result["deadline_met"] = True
                result["latency"] = time.time() - start_time
                return result
            else:
                # Timeout: return partial result or error
                reactive_task.cancel()
                planning_task.cancel()
                return {
                    "output": None,
                    "method": "timeout",
                    "error": "Deadline exceeded",
                    "latency": time.time() - start_time,
                    "deadline_met": False
                }

        except Exception as e:
            logger.error(f"[AgileThinker] Error in dual-thread: {e}")
            return {
                "output": None,
                "method": "error",
                "error": str(e),
                "latency": time.time() - start_time
            }

    async def _dual_thread_no_deadline(
        self,
        task: str,
        reactive_match: Optional[ReactivePattern],
        start_time: float
    ) -> Dict[str, Any]:
        """Run both threads, prefer planning result but fallback to reactive."""
        # Launch both
        reactive_task = asyncio.create_task(
            self._reactive_thread_best_effort(task)
        )
        planning_task = asyncio.create_task(
            self._planning_thread_only(task, start_time)
        )

        # Wait for planning (preferred)
        try:
            planning_result = await asyncio.wait_for(planning_task, timeout=30.0)
            reactive_task.cancel()
            return planning_result

        except asyncio.TimeoutError:
            # Planning too slow, use reactive
            logger.warning("[AgileThinker] Planning timeout, using reactive result")
            planning_task.cancel()
            reactive_result = await reactive_task
            reactive_result["fallback"] = True
            return reactive_result

        except Exception as e:
            # Planning failed, use reactive
            logger.warning(f"[AgileThinker] Planning failed: {e}, using reactive result")
            reactive_result = await reactive_task
            reactive_result["fallback"] = True
            return reactive_result

    async def _reactive_thread_best_effort(self, task: str) -> Dict[str, Any]:
        """Reactive thread with best-effort pattern matching."""
        pattern = self._match_reactive_pattern(task)

        if pattern:
            return await self._reactive_thread_only(pattern, task, time.time())
        else:
            # No pattern match: use heuristic agent selection
            agent_name = self._heuristic_agent_selection(task)
            agent = self.halo_router.route_task(agent_name, {})
            result = await agent.execute(task)

            return {
                "output": result,
                "method": "reactive_heuristic",
                "agent_used": agent_name,
                "latency": 0.0
            }

    def _match_reactive_pattern(self, task: str) -> Optional[ReactivePattern]:
        """Match task against reactive patterns."""
        task_lower = task.lower()

        for pattern in self.reactive_patterns:
            if re.search(pattern.pattern, task_lower):
                return pattern

        return None

    def _heuristic_agent_selection(self, task: str) -> str:
        """Heuristic-based agent selection when no pattern matches."""
        task_lower = task.lower()

        # Simple keyword matching
        if any(kw in task_lower for kw in ["build", "create", "implement", "code"]):
            return "builder_agent"
        elif any(kw in task_lower for kw in ["test", "qa", "validate"]):
            return "qa_agent"
        elif any(kw in task_lower for kw in ["deploy", "release", "production"]):
            return "deploy_agent"
        elif any(kw in task_lower for kw in ["research", "investigate", "analyze"]):
            return "research_discovery_agent"
        else:
            return "builder_agent"  # Default

    def _load_reactive_patterns(self) -> List[ReactivePattern]:
        """Load reactive patterns from historical data."""
        # In production, learn these from TrajectoryPool
        # For now, use hand-crafted patterns
        return [
            ReactivePattern(
                pattern=r"(generate|create|build).*(simple|basic).*(component|function)",
                agent_name="builder_agent",
                confidence=0.9,
                avg_latency=2.5
            ),
            ReactivePattern(
                pattern=r"(run|execute).*(test|tests|testing)",
                agent_name="qa_agent",
                confidence=0.95,
                avg_latency=3.0
            ),
            ReactivePattern(
                pattern=r"(deploy|release).*(staging|prod|production)",
                agent_name="deploy_agent",
                confidence=0.9,
                avg_latency=4.0
            ),
            ReactivePattern(
                pattern=r"(fix|debug|repair).*(bug|error|issue)",
                agent_name="maintenance_agent",
                confidence=0.85,
                avg_latency=5.0
            ),
            ReactivePattern(
                pattern=r"(write|create).*(docs|documentation|readme)",
                agent_name="content_agent",
                confidence=0.9,
                avg_latency=3.5
            ),
        ]

    def _get_cache_key(self, task: str) -> str:
        """Generate cache key for task."""
        # Use full hash to avoid collisions (hex for readability)
        import hashlib
        return hashlib.sha256(task.lower().strip().encode()).hexdigest()[:16]

    def _add_to_cache(self, key: str, value: Any) -> None:
        """Add item to cache with LRU eviction."""
        # Check if cache is full
        if len(self.result_cache) >= self.max_cache_size and key not in self.result_cache:
            # Evict least recently used
            if self.cache_access_order:
                lru_key = self.cache_access_order.pop(0)
                self.result_cache.pop(lru_key, None)
                logger.debug(f"[AgileThinker] Evicted LRU cache entry")

        # Add to cache
        self.result_cache[key] = value
        if key in self.cache_access_order:
            self.cache_access_order.remove(key)
        self.cache_access_order.append(key)

    async def _execute_dag(self, dag) -> Any:
        """Execute TaskDAG (placeholder - use actual HTDAG execution)."""
        # This would use the actual DAG execution logic from GenesisMetaAgent
        # For now, return placeholder
        return {"status": "completed", "dag_nodes": len(dag.nodes)}

    def get_stats(self) -> Dict[str, Any]:
        """Get routing statistics."""
        total = self.reactive_count + self.planning_count
        return {
            "reactive_count": self.reactive_count,
            "planning_count": self.planning_count,
            "cache_hits": self.cache_hits,
            "total_routed": total,
            "reactive_percentage": (self.reactive_count / total * 100) if total > 0 else 0,
            "planning_percentage": (self.planning_count / total * 100) if total > 0 else 0,
            "cache_hit_rate": (self.cache_hits / total * 100) if total > 0 else 0
        }


# Singleton instance with thread-safety
import threading
_agile_thinker: Optional[AgileThinkerRouter] = None
_agile_thinker_lock = threading.Lock()

def get_agile_thinker(
    htdag_planner: Optional[HTDAGPlanner] = None,
    halo_router: Optional[HALORouter] = None
) -> AgileThinkerRouter:
    """Get singleton AgileThinker instance (thread-safe)."""
    global _agile_thinker
    if _agile_thinker is None:
        with _agile_thinker_lock:
            # Double-check locking pattern
            if _agile_thinker is None:
                if htdag_planner is None or halo_router is None:
                    raise ValueError("Must provide htdag_planner and halo_router on first call")
                _agile_thinker = AgileThinkerRouter(htdag_planner, halo_router)
    return _agile_thinker
