"""
Spec Agent Memory Helper (FIXED)
Connects Spec Agent to ReasoningBank for design precedents and patterns

FIXES APPLIED:
- Pattern retrieval min_win_rate defaults to 0.0 (cold start)
- Tag matching improved
- Metadata handling fixed
- Added debug logging
"""

import logging
from typing import List, Dict, Any, Optional
from infrastructure.reasoning_bank import (
    get_reasoning_bank,
    MemoryType,
    OutcomeTag,
    StrategyNugget
)

logger = logging.getLogger(__name__)


class SpecMemoryHelper:
    """Helper for Spec Agent to query ReasoningBank - FIXED"""

    def __init__(self):
        self.bank = get_reasoning_bank()

    def get_design_precedents(
        self,
        component_type: str,
        architecture_pattern: str = None,
        top_n: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Retrieve design precedents from successful past specs

        FIX: min_win_rate=0.0 to allow newly seeded patterns
        """
        search_context = f"{component_type} {architecture_pattern or ''}".strip()

        logger.debug(f"Searching for precedents: '{search_context}'")

        # FIX: min_win_rate=0.0 for cold start (newly seeded patterns)
        strategies = self.bank.search_strategies(
            task_context=search_context,
            top_n=top_n,
            min_win_rate=0.0  # FIXED: Allow newly seeded patterns
        )

        logger.debug(f"Found {len(strategies)} strategies")

        precedents = []
        for strategy in strategies:
            precedent = {
                "pattern_name": strategy.description,
                "context": strategy.context,
                "win_rate": strategy.win_rate,
                "tools_used": list(strategy.tools_used),
                "steps": list(strategy.steps),
                "environment": strategy.environment
            }
            precedents.append(precedent)

        # FIX: Improved tag matching (substring/fuzzy)
        consensus_tags = self._normalize_tags(component_type)
        consensus_memories = self.bank.get_consensus_memory(tags=consensus_tags)

        logger.debug(f"Found {len(consensus_memories)} consensus memories")

        for memory in consensus_memories[:top_n]:
            if memory.outcome == OutcomeTag.SUCCESS.value and memory.win_rate >= 0.0:  # FIX: 0.0 threshold
                precedents.append({
                    "pattern_name": memory.metadata.get("name", "Unnamed Pattern"),
                    "context": memory.metadata.get("context", ""),
                    "win_rate": memory.win_rate,
                    "details": memory.content,
                    "type": "consensus"
                })

        logger.info(f"✅ Retrieved {len(precedents)} total precedents for '{component_type}'")
        return precedents[:top_n]

    def _normalize_tags(self, component_type: str) -> List[str]:
        """FIX: Generate normalized tags for better matching"""
        tags = []

        # Split multi-word types
        words = component_type.lower().replace("-", " ").replace("_", " ").split()
        tags.extend(words)

        # Add common synonyms
        if "api" in words or "rest" in words:
            tags.extend(["api", "rest", "restful", "endpoint"])
        if "security" in words or "auth" in words:
            tags.extend(["security", "authentication", "oauth"])
        if "data" in words or "database" in words or "db" in words:
            tags.extend(["database", "data", "model", "schema"])

        # Add "specification" tag
        tags.append("specification")

        return list(set(tags))  # Deduplicate

    def get_api_design_patterns(self) -> List[Dict[str, Any]]:
        """Get proven API design patterns"""
        return self.get_design_precedents(
            component_type="api",
            architecture_pattern="restful",
            top_n=5
        )

    def get_security_patterns(self) -> List[Dict[str, Any]]:
        """Get proven security implementation patterns"""
        return self.get_design_precedents(
            component_type="security",
            top_n=5
        )

    def get_data_model_patterns(self, domain: str = None) -> List[Dict[str, Any]]:
        """Get proven data modeling patterns"""
        search = f"data model {domain}" if domain else "data model"
        return self.get_design_precedents(
            component_type=search,
            top_n=5
        )

    def record_spec_outcome(
        self,
        spec_type: str,
        spec_content: Dict[str, Any],
        outcome: OutcomeTag,
        metadata: Dict[str, Any] = None
    ) -> str:
        """Record the outcome of a specification"""
        # FIX: Proper metadata merging
        base_metadata = {
            "spec_type": spec_type,
            "component": spec_content.get("component_name", "unknown")
        }

        # Merge user metadata, preserving base values
        if metadata:
            merged_metadata = {**metadata, **base_metadata}
        else:
            merged_metadata = base_metadata

        memory_id = self.bank.store_memory(
            memory_type=MemoryType.CONSENSUS,
            content=spec_content,
            metadata=merged_metadata,
            outcome=outcome,
            tags=[spec_type, "specification"]
        )

        logger.info(f"📝 Recorded spec outcome: {memory_id} (outcome: {outcome.value})")
        return memory_id

    def create_strategy_from_spec(
        self,
        description: str,
        context: str,
        spec_content: Dict[str, Any],
        tools_used: List[str],
        outcome: OutcomeTag
    ) -> str:
        """Extract a reusable strategy from a successful spec"""
        # Extract steps from spec
        steps = []
        if "requirements" in spec_content:
            steps.extend([f"Requirement: {r}" for r in spec_content["requirements"][:3]])
        if "architecture" in spec_content:
            arch = spec_content["architecture"]
            if isinstance(arch, dict):
                steps.append(f"Architecture: {arch.get('pattern', 'Unknown')}")
            else:
                steps.append(f"Architecture: {arch}")
        if "security_considerations" in spec_content:
            steps.extend([f"Security: {s}" for s in spec_content["security_considerations"][:2]])

        strategy_id = self.bank.store_strategy(
            description=description,
            context=context,
            task_metadata={
                "spec_type": spec_content.get("component_name", "unknown"),
                "architecture_type": spec_content.get("architecture_type", "unknown")
            },
            environment="genesis_spec_agent",
            tools_used=tools_used,
            outcome=outcome,
            steps=steps,
            learned_from=[spec_content.get("spec_id", "unknown")]
        )

        logger.info(f"💡 Created strategy from spec: {strategy_id}")
        return strategy_id

    def seed_initial_patterns(self):
        """Seed ReasoningBank with proven patterns from industry standards"""
        # Seed API design pattern
        api_pattern = {
            "pattern_name": "RESTful API with versioning",
            "architecture": "REST",
            "principles": [
                "Use HTTP verbs correctly (GET, POST, PUT, DELETE)",
                "Version APIs in URL path (/api/v1/)",
                "Use plural nouns for resources",
                "Return proper status codes",
                "Implement pagination for collections"
            ],
            "example_endpoints": [
                "GET /api/v1/users - List users",
                "POST /api/v1/users - Create user",
                "GET /api/v1/users/{id} - Get specific user",
                "PUT /api/v1/users/{id} - Update user",
                "DELETE /api/v1/users/{id} - Delete user"
            ]
        }

        self.bank.store_memory(
            memory_type=MemoryType.CONSENSUS,
            content=api_pattern,
            metadata={"name": "RESTful API Pattern", "context": "API design", "source": "industry_standard"},
            outcome=OutcomeTag.SUCCESS,
            tags=["api", "specification", "rest", "restful", "endpoint"]  # FIX: More tags
        )

        # Seed security pattern
        security_pattern = {
            "pattern_name": "OAuth 2.1 with JWT",
            "security_measures": [
                "OAuth 2.1 for authentication",
                "JWT tokens with short expiry (15 min)",
                "Refresh tokens with rotation",
                "Rate limiting per IP and per user",
                "Input validation and sanitization",
                "HTTPS only",
                "CORS configuration"
            ],
            "implementation": {
                "authentication": "OAuth 2.1 Authorization Code Flow",
                "authorization": "JWT claims-based",
                "token_expiry": "15 minutes (access), 7 days (refresh)",
                "rate_limits": "100 requests/minute per user"
            }
        }

        self.bank.store_memory(
            memory_type=MemoryType.CONSENSUS,
            content=security_pattern,
            metadata={"name": "OAuth 2.1 Security", "context": "authentication and authorization", "source": "industry_standard"},
            outcome=OutcomeTag.SUCCESS,
            tags=["security", "specification", "oauth", "authentication", "auth"]  # FIX: More tags
        )

        # Seed database pattern
        db_pattern = {
            "pattern_name": "Normalized relational schema with caching",
            "principles": [
                "3NF normalization for OLTP workloads",
                "Use UUIDs for primary keys in distributed systems",
                "Add created_at, updated_at to all tables",
                "Implement soft deletes with deleted_at",
                "Use foreign keys with cascading",
                "Index frequently queried columns"
            ],
            "caching_strategy": {
                "cache_layer": "Redis",
                "ttl_policy": "5 minutes for hot data, 1 hour for cold data",
                "invalidation": "Write-through on updates"
            }
        }

        self.bank.store_memory(
            memory_type=MemoryType.CONSENSUS,
            content=db_pattern,
            metadata={"name": "Normalized DB with Cache", "context": "data modeling", "source": "industry_standard"},
            outcome=OutcomeTag.SUCCESS,
            tags=["database", "specification", "cache", "data", "model", "schema"]  # FIX: More tags
        )

        logger.info("✅ Seeded ReasoningBank with 3 industry-standard patterns")


# Singleton helper
_spec_helper_instance: Optional[SpecMemoryHelper] = None


def get_spec_memory_helper() -> SpecMemoryHelper:
    """Get or create SpecMemoryHelper singleton"""
    global _spec_helper_instance
    if _spec_helper_instance is None:
        _spec_helper_instance = SpecMemoryHelper()
    return _spec_helper_instance
