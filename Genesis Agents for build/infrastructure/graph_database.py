"""
Genesis Graph Database - NetworkX-based Relationship Tracking

This module provides graph-based memory relationship tracking for the Genesis
Hybrid RAG system, enabling agents to discover related memories through graph
traversal and centrality analysis.

Architecture:
- NetworkX DiGraph: Directed graph for memory relationships
- Nodes: Memory entries (namespace:key format)
- Edges: Relationships (similar_to, referenced_by, created_by, belongs_to)
- Algorithms: BFS traversal, PageRank centrality

Use Cases:
- Find related memories within N hops
- Calculate memory importance scores
- Track agent-memory connections
- Track business-agent connections

Integration:
- Vector DB compatibility: Uses same namespace_type:namespace_id:key ID format
- Memory Store integration: Automatic graph indexing on memory save
- Hybrid RAG: Combines with vector search for multi-modal retrieval

Performance:
- Pure Python (no C++ async wrapping needed per ASYNC_WRAPPER_PATTERN.md)
- File I/O uses asyncio.to_thread for GraphML persistence
- Thread-safe operations with asyncio.Lock
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple

import networkx as nx

from infrastructure.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class GraphNode:
    """
    Graph node representing a memory entry.

    Attributes:
        id: Unique node ID (format: "namespace_type:namespace_id:key")
        namespace: (namespace_type, namespace_id) tuple
        content: Memory content (for display/debugging)
        metadata: Optional metadata dict
    """
    id: str
    namespace: Tuple[str, str]
    content: str
    metadata: Dict[str, Any]


@dataclass
class GraphEdge:
    """
    Graph edge representing a relationship between memories.

    Attributes:
        source_id: Source node ID
        target_id: Target node ID
        relationship_type: Type of relationship
            - "similar_to": Semantically similar memories
            - "referenced_by": One memory references another
            - "created_by": Agent created memory
            - "belongs_to": Memory belongs to business/agent
        weight: Relationship strength (0.0-1.0)
    """
    source_id: str
    target_id: str
    relationship_type: str
    weight: float


class GraphDatabase:
    """
    NetworkX-based graph database for memory relationship tracking.

    This class provides graph operations for the Hybrid RAG system, enabling
    agents to discover related memories through graph traversal and importance
    scoring through centrality algorithms.

    Graph Structure:
        - Nodes: Memory entries with namespace, content, and metadata
        - Edges: Directed relationships with type and weight
        - Directed: Supports asymmetric relationships (A→B doesn't imply B→A)

    Thread Safety:
        - All operations use asyncio.Lock for concurrent access
        - Safe for multi-agent parallel memory operations

    Persistence:
        - GraphML format for standard interchange
        - Async I/O using asyncio.to_thread per ASYNC_WRAPPER_PATTERN.md

    Example Usage:
        ```python
        graph = GraphDatabase()

        # Add memory nodes
        await graph.add_node(
            node_id="agent:qa_001:bug_123",
            namespace=("agent", "qa_001"),
            content="API timeout error",
            metadata={"severity": "high"}
        )

        # Add relationship edge
        await graph.add_edge(
            source_id="agent:qa_001:bug_123",
            target_id="agent:qa_001:bug_456",
            relationship_type="similar_to",
            weight=0.85
        )

        # Traverse graph to find related memories
        related = await graph.traverse(
            start_nodes=["agent:qa_001:bug_123"],
            max_hops=2,
            relationship_filter=["similar_to"]
        )

        # Calculate memory importance
        scores = await graph.calculate_centrality(algorithm="pagerank")
        ```
    """

    def __init__(self):
        """Initialize empty directed graph with thread-safe lock."""
        self.graph = nx.DiGraph()  # Directed graph for asymmetric relationships
        self._lock = asyncio.Lock()  # Thread-safe concurrent operations
        logger.info("GraphDatabase initialized with empty DiGraph")

    async def add_node(
        self,
        node_id: str,
        namespace: Tuple[str, str],
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Add memory node to graph.

        Nodes represent memory entries in the Genesis system. Each node stores
        its namespace for filtering, content for display, and optional metadata.

        Args:
            node_id: Unique node ID (format: "namespace_type:namespace_id:key")
                Example: "agent:qa_001:bug_123"
            namespace: (namespace_type, namespace_id) tuple
                Examples: ("agent", "qa_001"), ("business", "saas_001")
            content: Memory content (for display/debugging)
                Typically a short summary or title
            metadata: Optional metadata dict (severity, tags, etc.)

        Thread Safety:
            Uses asyncio.Lock to prevent concurrent modification conflicts.

        Example:
            ```python
            await graph.add_node(
                node_id="agent:qa_001:bug_123",
                namespace=("agent", "qa_001"),
                content="API timeout error in payment endpoint",
                metadata={"severity": "high", "tags": ["api", "timeout"]}
            )
            ```
        """
        async with self._lock:
            self.graph.add_node(
                node_id,
                namespace=namespace,
                content=content,
                metadata=metadata or {},
                created_at=asyncio.get_event_loop().time()
            )

            logger.debug(
                f"Node added: {node_id}",
                extra={
                    "node_id": node_id,
                    "namespace": namespace,
                    "has_metadata": bool(metadata)
                }
            )

    async def add_edge(
        self,
        source_id: str,
        target_id: str,
        relationship_type: str,
        weight: float = 1.0
    ) -> None:
        """
        Add relationship edge between memory nodes.

        Edges represent typed relationships between memories, enabling graph
        traversal and relationship-based retrieval. Weights indicate strength
        of the relationship (e.g., semantic similarity score).

        Args:
            source_id: Source node ID
            target_id: Target node ID
            relationship_type: Type of relationship
                - "similar_to": Semantically similar memories (from vector search)
                - "referenced_by": One memory references another
                - "created_by": Agent created memory
                - "belongs_to": Memory belongs to business/agent
            weight: Relationship strength (0.0-1.0, default: 1.0)
                For "similar_to", this is typically cosine similarity score

        Thread Safety:
            Uses asyncio.Lock to prevent concurrent modification conflicts.

        Example:
            ```python
            # Link similar bugs with semantic similarity score
            await graph.add_edge(
                source_id="agent:qa_001:bug_123",
                target_id="agent:qa_001:bug_456",
                relationship_type="similar_to",
                weight=0.85  # 85% similar
            )

            # Link memory to creating agent
            await graph.add_edge(
                source_id="agent:qa_001:bug_123",
                target_id="agent:qa_001",
                relationship_type="created_by",
                weight=1.0
            )
            ```
        """
        async with self._lock:
            self.graph.add_edge(
                source_id,
                target_id,
                relationship_type=relationship_type,
                weight=weight,
                created_at=asyncio.get_event_loop().time()
            )

            logger.debug(
                f"Edge added: {source_id} -> {target_id} ({relationship_type})",
                extra={
                    "source_id": source_id,
                    "target_id": target_id,
                    "relationship_type": relationship_type,
                    "weight": weight
                }
            )

    async def traverse(
        self,
        start_nodes: List[str],
        max_hops: int = 2,
        relationship_filter: Optional[List[str]] = None
    ) -> Set[str]:
        """
        Traverse graph from seed nodes using Breadth-First Search (BFS).

        BFS explores all nodes at distance 1, then distance 2, etc., making it
        ideal for finding nearby related memories. Can filter by relationship
        type to follow only specific edge types.

        Args:
            start_nodes: Starting node IDs (seed memories)
            max_hops: Maximum traversal depth (1 or 2 recommended for performance)
                1 hop: Direct neighbors only
                2 hops: Friends-of-friends (exponential growth)
            relationship_filter: Optional list of relationship types to follow
                Example: ["similar_to", "referenced_by"] to follow only those edges

        Returns:
            Set of node IDs within max_hops distance (includes start_nodes)

        Performance:
            - 1 hop: O(E) where E = edges from start nodes
            - 2 hops: O(E^2) due to neighbor expansion
            - Keep max_hops ≤ 2 for production use

        Example:
            ```python
            # Find all memories related to bug_123 within 2 hops
            related = await graph.traverse(
                start_nodes=["agent:qa_001:bug_123"],
                max_hops=2,
                relationship_filter=["similar_to", "referenced_by"]
            )
            # Returns: {"agent:qa_001:bug_123", "agent:qa_001:bug_456", ...}
            ```
        """
        async with self._lock:
            visited = set(start_nodes)

            for hop in range(max_hops):
                new_nodes = set()

                for node in visited:
                    if node not in self.graph:
                        continue

                    # Get neighbors (outgoing edges in directed graph)
                    for neighbor in self.graph.successors(node):
                        edge_data = self.graph[node][neighbor]

                        # Filter by relationship type if specified
                        if relationship_filter:
                            if edge_data.get("relationship_type") not in relationship_filter:
                                continue

                        new_nodes.add(neighbor)

                visited.update(new_nodes)

            logger.debug(
                f"Traversal completed: {len(start_nodes)} seeds -> {len(visited)} nodes ({max_hops} hops)",
                extra={
                    "start_count": len(start_nodes),
                    "result_count": len(visited),
                    "max_hops": max_hops,
                    "relationship_filter": relationship_filter
                }
            )

            return visited

    async def get_neighbors(
        self,
        node_id: str,
        relationship_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get direct neighbors (1-hop) of a node with full metadata.

        This is a convenience method for getting immediate neighbors without
        full graph traversal. Returns neighbor metadata for display and ranking.

        Args:
            node_id: Node to get neighbors for
            relationship_type: Optional filter by relationship type

        Returns:
            List of neighbor dicts with id, relationship, weight, and content
            Sorted by weight (descending)

        Example:
            ```python
            neighbors = await graph.get_neighbors(
                node_id="agent:qa_001:bug_123",
                relationship_type="similar_to"
            )
            # Returns: [
            #     {"id": "agent:qa_001:bug_456", "relationship_type": "similar_to",
            #      "weight": 0.9, "content": "API timeout in checkout"},
            #     {"id": "agent:qa_001:bug_789", "relationship_type": "similar_to",
            #      "weight": 0.7, "content": "Slow API response"}
            # ]
            ```
        """
        async with self._lock:
            if node_id not in self.graph:
                logger.debug(f"Node not found: {node_id}")
                return []

            neighbors = []
            for neighbor in self.graph.successors(node_id):
                edge_data = self.graph[node_id][neighbor]

                # Filter by relationship type if specified
                if relationship_type and edge_data.get("relationship_type") != relationship_type:
                    continue

                neighbors.append({
                    "id": neighbor,
                    "relationship_type": edge_data.get("relationship_type"),
                    "weight": edge_data.get("weight", 1.0),
                    "content": self.graph.nodes[neighbor].get("content", "")
                })

            # Sort by weight (descending) for relevance ranking
            neighbors.sort(key=lambda x: x["weight"], reverse=True)

            logger.debug(
                f"Neighbors retrieved: {node_id} -> {len(neighbors)} neighbors",
                extra={
                    "node_id": node_id,
                    "neighbor_count": len(neighbors),
                    "relationship_filter": relationship_type
                }
            )

            return neighbors

    async def calculate_centrality(
        self,
        algorithm: str = "pagerank"
    ) -> Dict[str, float]:
        """
        Calculate node importance using centrality algorithms.

        Centrality measures identify "important" nodes in the graph based on
        their connectivity patterns. Useful for ranking memories by importance.

        Args:
            algorithm: Centrality algorithm to use
                - "pagerank": PageRank centrality (RECOMMENDED, default)
                    Nodes with many incoming edges = important
                    Used by Google Search for web page ranking
                    Best for identifying authoritative/referenced memories
                - "degree": Degree centrality (simple, fast)
                    Nodes with many connections (in+out) = important
                    Good for identifying "hub" memories
                - "betweenness": Betweenness centrality (expensive)
                    Nodes on many shortest paths = important
                    Good for identifying "bridge" memories
                    WARNING: O(n^3) complexity, slow on large graphs

        Returns:
            Dict mapping node_id to centrality score (0.0-1.0)
            Higher score = more important node

        Performance:
            - PageRank: O(E*k) where k=iterations (typically 100)
            - Degree: O(V+E)
            - Betweenness: O(V^3) - use sparingly!

        Example:
            ```python
            scores = await graph.calculate_centrality(algorithm="pagerank")
            # scores = {
            #     "agent:qa_001:bug_123": 0.05,  # Highly referenced
            #     "agent:qa_001:bug_456": 0.02,  # Less referenced
            #     ...
            # }

            # Sort memories by importance
            ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
            ```

        Raises:
            ValueError: If algorithm name is invalid
        """
        async with self._lock:
            if len(self.graph) == 0:
                logger.debug("Centrality calculation skipped: empty graph")
                return {}

            if algorithm == "pagerank":
                # PageRank: Nodes with many incoming edges = important
                # Weight parameter uses edge weights in calculation
                centrality = nx.pagerank(self.graph, weight="weight")
            elif algorithm == "degree":
                # Degree: Nodes with many connections = important
                centrality = nx.degree_centrality(self.graph)
                centrality = dict(centrality)
            elif algorithm == "betweenness":
                # Betweenness: Nodes on many paths = important
                # WARNING: Expensive O(n^3) computation
                centrality = nx.betweenness_centrality(self.graph, weight="weight")
            else:
                raise ValueError(
                    f"Unknown centrality algorithm: {algorithm}. "
                    f"Valid options: pagerank, degree, betweenness"
                )

            logger.debug(
                f"Centrality calculated: {algorithm} on {len(self.graph)} nodes",
                extra={
                    "algorithm": algorithm,
                    "node_count": len(self.graph),
                    "avg_score": sum(centrality.values()) / len(centrality) if centrality else 0
                }
            )

            return centrality

    async def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        """
        Get node data by ID.

        Args:
            node_id: Node ID to retrieve

        Returns:
            Dict with node attributes (namespace, content, metadata), or None if not found

        Example:
            ```python
            node = await graph.get_node("agent:qa_001:bug_123")
            # node = {
            #     "namespace": ("agent", "qa_001"),
            #     "content": "API timeout error",
            #     "metadata": {"severity": "high"},
            #     "created_at": 1729700000.0
            # }
            ```
        """
        async with self._lock:
            if node_id not in self.graph:
                return None
            return dict(self.graph.nodes[node_id])

    async def get_stats(self) -> Dict[str, Any]:
        """
        Get graph statistics for monitoring and debugging.

        Returns:
            Dict with total_nodes, total_edges, avg_degree, and density

        Example:
            ```python
            stats = await graph.get_stats()
            # stats = {
            #     "total_nodes": 150,
            #     "total_edges": 420,
            #     "avg_degree": 2.8,
            #     "density": 0.018
            # }
            ```
        """
        async with self._lock:
            total_nodes = self.graph.number_of_nodes()
            total_edges = self.graph.number_of_edges()

            if total_nodes > 0:
                # Average degree: avg number of connections per node
                avg_degree = sum(dict(self.graph.degree()).values()) / total_nodes
                # Density: ratio of actual edges to possible edges
                density = nx.density(self.graph)
            else:
                avg_degree = 0
                density = 0

            return {
                "total_nodes": total_nodes,
                "total_edges": total_edges,
                "avg_degree": avg_degree,
                "density": density
            }

    async def save(self, file_path: str) -> None:
        """
        Save graph to file in GraphML format.

        GraphML is a standard XML-based format for graph interchange, supported
        by many graph tools (Gephi, Cytoscape, etc.).

        Note: Converts tuple namespaces to strings for GraphML compatibility.

        Args:
            file_path: Path to save GraphML file

        Thread Safety:
            Uses asyncio.to_thread per ASYNC_WRAPPER_PATTERN.md for file I/O

        Example:
            ```python
            await graph.save("/data/memory_graph.graphml")
            ```
        """
        async with self._lock:
            # Create a copy with serializable attributes (GraphML doesn't support tuples)
            graph_copy = self.graph.copy()

            for node_id in graph_copy.nodes():
                node_data = graph_copy.nodes[node_id]

                # Convert namespace tuple to string
                if "namespace" in node_data and isinstance(node_data["namespace"], tuple):
                    node_data["namespace"] = f"{node_data['namespace'][0]}:{node_data['namespace'][1]}"

                # Convert metadata dict to JSON string
                if "metadata" in node_data and isinstance(node_data["metadata"], dict):
                    import json
                    node_data["metadata"] = json.dumps(node_data["metadata"])

            # NetworkX write_graphml is synchronous, wrap in thread
            await asyncio.to_thread(
                nx.write_graphml,
                graph_copy,
                file_path
            )

            logger.info(
                f"Graph saved to {file_path}",
                extra={
                    "file_path": file_path,
                    "node_count": self.graph.number_of_nodes(),
                    "edge_count": self.graph.number_of_edges()
                }
            )

    async def load(self, file_path: str) -> None:
        """
        Load graph from GraphML file.

        Replaces current graph with loaded graph. Use with caution.

        Note: Converts string namespaces back to tuples.

        Args:
            file_path: Path to GraphML file

        Thread Safety:
            Uses asyncio.to_thread per ASYNC_WRAPPER_PATTERN.md for file I/O

        Example:
            ```python
            await graph.load("/data/memory_graph.graphml")
            ```
        """
        async with self._lock:
            # NetworkX read_graphml is synchronous, wrap in thread
            self.graph = await asyncio.to_thread(
                nx.read_graphml,
                file_path
            )

            # Convert string namespaces back to tuples
            import json
            for node_id in self.graph.nodes():
                node_data = self.graph.nodes[node_id]

                # Convert namespace string back to tuple
                if "namespace" in node_data and isinstance(node_data["namespace"], str):
                    parts = node_data["namespace"].split(":", 1)
                    if len(parts) == 2:
                        node_data["namespace"] = (parts[0], parts[1])

                # Convert metadata JSON string back to dict
                if "metadata" in node_data and isinstance(node_data["metadata"], str):
                    try:
                        node_data["metadata"] = json.loads(node_data["metadata"])
                    except json.JSONDecodeError:
                        node_data["metadata"] = {}

            logger.info(
                f"Graph loaded from {file_path}",
                extra={
                    "file_path": file_path,
                    "node_count": self.graph.number_of_nodes(),
                    "edge_count": self.graph.number_of_edges()
                }
            )


# Export public API
__all__ = [
    "GraphDatabase",
    "GraphNode",
    "GraphEdge"
]
