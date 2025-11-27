"""
DependencyResolver: Task Dependency Management and Resolution

Handles:
1. Task dependency graphs
2. Dependency validation
3. Ordering and scheduling
4. Circular dependency detection
5. Critical path analysis
"""

import logging
from typing import Dict, List, Set, Optional, Tuple, Any
from dataclasses import dataclass, field
from pathlib import Path
from enum import Enum

import yaml

logger = logging.getLogger(__name__)


class DependencyType(Enum):
    """Types of task dependencies"""
    STRICT = "strict"  # Must complete before dependent task starts
    SOFT = "soft"  # Preferred but not required
    CONDITIONAL = "conditional"  # Required based on condition


@dataclass
class DependencyEdge:
    """Represents a dependency between two tasks"""
    source_task: str  # Must complete first
    target_task: str  # Depends on source
    dep_type: DependencyType = DependencyType.STRICT
    condition: Optional[str] = None  # For conditional dependencies


@dataclass
class DependencyResolutionResult:
    """Result of dependency resolution"""
    is_valid: bool  # No circular dependencies
    execution_order: List[str] = field(default_factory=list)  # Topologically sorted
    critical_path: List[str] = field(default_factory=list)  # Longest path
    cycles_detected: List[List[str]] = field(default_factory=list)  # Cycles found
    blocked_tasks: Dict[str, List[str]] = field(default_factory=dict)  # task -> blocking_tasks
    task_levels: Dict[str, int] = field(default_factory=dict)  # task -> execution_level
    errors: List[str] = field(default_factory=list)


class DependencyResolver:
    """
    Resolves task dependencies and validates execution order

    Features:
    - Topological sorting
    - Cycle detection
    - Critical path analysis
    - Dependency chain visualization
    - Fallback dependency handling
    """

    def __init__(self, capabilities_dir: str = "maps/capabilities"):
        """
        Initialize DependencyResolver

        Args:
            capabilities_dir: Directory containing agent capability YAML files
        """
        self.capabilities_dir = Path(capabilities_dir)
        self.agent_dependencies: Dict[str, Dict[str, Any]] = {}
        self._load_dependencies()

    def _load_dependencies(self) -> None:
        """Load task dependencies from capability maps"""
        if not self.capabilities_dir.exists():
            logger.warning(f"Capabilities directory not found: {self.capabilities_dir}")
            return

        for yaml_file in self.capabilities_dir.glob("*.yaml"):
            try:
                with open(yaml_file) as f:
                    agent_data = yaml.safe_load(f)
                    agent_id = agent_data.get("agent_id")

                    if agent_id:
                        self.agent_dependencies[agent_id] = agent_data.get("dependencies", {})

                        logger.debug(f"Loaded dependencies for {agent_id}")

            except Exception as e:
                logger.error(f"Error loading dependencies from {yaml_file}: {e}")

    def resolve(self, tasks: Dict[str, Any]) -> DependencyResolutionResult:
        """
        Resolve task dependencies and determine execution order

        Args:
            tasks: Dict of task_id -> task_data

        Returns:
            DependencyResolutionResult with execution order and diagnostics
        """
        # Build dependency graph
        graph = self._build_dependency_graph(tasks)

        # Check for cycles
        cycles = self._detect_cycles(graph)
        if cycles:
            result = DependencyResolutionResult(
                is_valid=False,
                cycles_detected=cycles,
            )
            result.errors.append(f"Circular dependencies detected: {cycles}")
            logger.error(f"Circular dependencies: {cycles}")
            return result

        # Topological sort
        execution_order = self._topological_sort(graph, tasks)

        # Calculate task levels (for parallel execution)
        task_levels = self._calculate_task_levels(graph, tasks)

        # Analyze critical path
        critical_path = self._find_critical_path(graph, tasks, execution_order)

        # Determine blocking relationships
        blocked_tasks = self._get_blocked_tasks(graph)

        result = DependencyResolutionResult(
            is_valid=True,
            execution_order=execution_order,
            critical_path=critical_path,
            task_levels=task_levels,
            blocked_tasks=blocked_tasks,
        )

        logger.info(
            f"Resolved {len(tasks)} tasks: "
            f"order={len(execution_order)}, "
            f"critical_path_length={len(critical_path)}, "
            f"levels={len(set(task_levels.values()))}"
        )

        return result

    def _build_dependency_graph(self, tasks: Dict[str, Any]) -> Dict[str, Set[str]]:
        """
        Build adjacency list for task dependency graph

        Returns:
            Dict mapping task -> set of dependent tasks
        """
        graph: Dict[str, Set[str]] = {task_id: set() for task_id in tasks.keys()}

        for task_id, task_data in tasks.items():
            # Get agent dependencies (before_execution)
            agent_id = task_data.get("agent_id")
            if agent_id in self.agent_dependencies:
                agent_deps = self.agent_dependencies[agent_id]
                before_tasks = agent_deps.get("before_execution", [])

                for dep_task in before_tasks:
                    if dep_task in graph:
                        graph[dep_task].add(task_id)

            # Get task-specific dependencies
            task_deps = task_data.get("dependencies", {})
            task_specific = task_deps.get("task_dependencies", {})

            for dep_task, dependent_tasks in task_specific.items():
                if isinstance(dependent_tasks, list):
                    for dep in dependent_tasks:
                        if dep in graph:
                            graph[dep].add(task_id)

        logger.debug(f"Built dependency graph with {len(graph)} nodes")
        return graph

    def _detect_cycles(self, graph: Dict[str, Set[str]]) -> List[List[str]]:
        """
        Detect circular dependencies using DFS

        Returns:
            List of cycles (each cycle is a list of task IDs)
        """
        visited: Set[str] = set()
        rec_stack: Set[str] = set()
        cycles: List[List[str]] = []
        parent_map: Dict[str, Optional[str]] = {}

        def dfs(node: str, path: List[str]) -> None:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            for neighbor in graph.get(node, set()):
                if neighbor not in visited:
                    parent_map[neighbor] = node
                    dfs(neighbor, path[:])
                elif neighbor in rec_stack:
                    # Found cycle
                    cycle_start = path.index(neighbor)
                    cycle = path[cycle_start:] + [neighbor]
                    cycles.append(cycle)

            rec_stack.discard(node)

        for task in graph:
            if task not in visited:
                parent_map[task] = None
                dfs(task, [])

        if cycles:
            logger.warning(f"Detected {len(cycles)} circular dependencies")

        return cycles

    def _topological_sort(self, graph: Dict[str, Set[str]], tasks: Dict[str, Any]) -> List[str]:
        """
        Topologically sort tasks using Kahn's algorithm

        Returns:
            List of task IDs in execution order
        """
        # Calculate in-degree for each node
        in_degree: Dict[str, int] = {task: 0 for task in graph}

        for task, dependents in graph.items():
            for dependent in dependents:
                in_degree[dependent] += 1

        # Queue of tasks with no dependencies
        queue: List[str] = [task for task in graph if in_degree[task] == 0]

        # Sort by task importance (if provided)
        queue.sort(key=lambda t: self._get_task_priority(tasks.get(t, {})))

        result: List[str] = []

        while queue:
            # Process task with no remaining dependencies
            task = queue.pop(0)
            result.append(task)

            # Reduce in-degree for dependents
            for dependent in graph.get(task, set()):
                in_degree[dependent] -= 1

                if in_degree[dependent] == 0:
                    queue.append(dependent)
                    queue.sort(key=lambda t: self._get_task_priority(tasks.get(t, {})))

        logger.debug(f"Topological sort result: {len(result)} tasks in order")

        return result

    def _calculate_task_levels(
        self, graph: Dict[str, Set[str]], tasks: Dict[str, Any]
    ) -> Dict[str, int]:
        """
        Calculate execution level for each task

        Tasks at same level can execute in parallel.
        Level increases as we go deeper into dependency chains.
        """
        levels: Dict[str, int] = {task: 0 for task in graph}

        # Find all root tasks (no dependencies)
        all_dependents = set()
        for dependents in graph.values():
            all_dependents.update(dependents)

        roots = [task for task in graph if task not in all_dependents]

        # BFS to assign levels
        from collections import deque

        queue = deque(roots)
        visited = set(roots)

        while queue:
            task = queue.popleft()

            for dependent in graph.get(task, set()):
                # Level is max of dependencies' levels + 1
                levels[dependent] = max(levels[dependent], levels[task] + 1)

                if dependent not in visited:
                    queue.append(dependent)
                    visited.add(dependent)

        logger.debug(
            f"Calculated task levels: "
            f"max_level={max(levels.values())}, "
            f"parallelism={len(set(levels.values()))}"
        )

        return levels

    def _find_critical_path(
        self, graph: Dict[str, Set[str]], tasks: Dict[str, Any], execution_order: List[str]
    ) -> List[str]:
        """
        Find critical path (longest dependency chain)

        Returns:
            List of task IDs forming the critical path
        """
        if not execution_order:
            return []

        # Estimate task duration (heuristic)
        def get_duration(task_id: str) -> float:
            task_data = tasks.get(task_id, {})
            # Estimate based on agent type and task complexity
            task_type = task_data.get("type", "unknown")
            base_duration = {
                "build": 30.0,
                "test": 20.0,
                "deploy": 60.0,
                "analysis": 15.0,
                "default": 10.0,
            }
            return base_duration.get(task_type, base_duration["default"])

        # Dynamic programming to find longest path
        distance: Dict[str, float] = {task: 0 for task in graph}
        path_map: Dict[str, List[str]] = {task: [task] for task in graph}

        for task in execution_order:
            for dependent in graph.get(task, set()):
                new_distance = distance[task] + get_duration(dependent)

                if new_distance > distance[dependent]:
                    distance[dependent] = new_distance
                    path_map[dependent] = path_map[task] + [dependent]

        # Find task with maximum distance
        critical_end = max(distance, key=distance.get)
        critical_path = path_map.get(critical_end, [])

        logger.debug(f"Critical path (length {len(critical_path)}): {critical_path}")

        return critical_path

    def _get_blocked_tasks(self, graph: Dict[str, Set[str]]) -> Dict[str, List[str]]:
        """
        Get tasks blocked by each task

        Returns:
            Dict mapping task -> list of tasks waiting for it
        """
        blocked: Dict[str, List[str]] = {task: list(dependents) for task, dependents in graph.items()}
        return blocked

    def _get_task_priority(self, task_data: Dict[str, Any]) -> int:
        """
        Get task priority for sorting

        Higher priority = execute earlier
        """
        priority_map = {
            "critical": 0,
            "high": 1,
            "medium": 2,
            "low": 3,
        }

        priority_name = task_data.get("priority", "medium").lower()
        return priority_map.get(priority_name, 2)

    def get_task_status(
        self, task_id: str, completed_tasks: Set[str], result: DependencyResolutionResult
    ) -> Dict[str, Any]:
        """
        Get current status of a task

        Args:
            task_id: Task ID
            completed_tasks: Set of completed task IDs
            result: Dependency resolution result

        Returns:
            Status information
        """
        if task_id in completed_tasks:
            return {"status": "completed", "blocked_by": []}

        # Find what's blocking this task
        blocked_by = result.blocked_tasks.get(task_id, [])
        blocking_tasks = [t for t in blocked_by if t not in completed_tasks]

        if blocking_tasks:
            return {"status": "blocked", "blocked_by": blocking_tasks}

        # Check if ready to execute
        if task_id in result.execution_order:
            idx = result.execution_order.index(task_id)
            ready = all(t in completed_tasks for t in result.execution_order[:idx])

            if ready:
                return {"status": "ready", "blocked_by": []}

        return {"status": "pending", "blocked_by": blocking_tasks}

    def visualize_dependency_chain(self, task_id: str, result: DependencyResolutionResult) -> str:
        """
        Visualize dependency chain for a task

        Returns:
            String representation of dependency chain
        """
        if task_id not in result.blocked_tasks:
            return f"{task_id} (no dependencies)"

        lines = [f"{task_id}"]
        deps = result.blocked_tasks.get(task_id, [])

        if not deps:
            return lines[0]

        for i, dep in enumerate(deps):
            prefix = "├── " if i < len(deps) - 1 else "└── "
            lines.append(f"{prefix}{dep}")

        return "\n".join(lines)

    def estimate_execution_time(self, result: DependencyResolutionResult) -> float:
        """
        Estimate total execution time based on critical path

        Returns:
            Estimated time in seconds
        """
        # Rough estimate: 10s per task on critical path
        base_time = len(result.critical_path) * 10.0

        # Add overhead for task switching and inter-process communication
        overhead = max(5.0, len(result.critical_path) * 0.5)

        return base_time + overhead
