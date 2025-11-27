"""
PreToolRouter: Pre-Tool Middleware for Genesis Task Execution

Based on FunReason-MT and GAP papers, this middleware:
1. Intercepts tool calls before execution
2. Validates preconditions and dependencies
3. Routes to best tool/agent based on capability maps
4. Prevents pointless or unsafe operations

Key Features:
- Capability-based routing (cost, latency, success rate)
- Dependency resolution and validation
- Safety checks (PII detection, unsafe commands)
- Fallback agent routing on failure
- Comprehensive logging and tracing
"""

import logging
import json
import re
import hashlib
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from pathlib import Path
from datetime import datetime
from enum import Enum

import yaml

logger = logging.getLogger(__name__)


class RoutingDecision(Enum):
    """Tool routing decision outcomes"""
    ALLOWED = "allowed"
    DENIED = "denied"
    REQUIRES_FALLBACK = "requires_fallback"
    MISSING_DEPENDENCY = "missing_dependency"


@dataclass
class ToolCapability:
    """Describes a tool's capabilities and constraints"""
    tool_name: str
    preconditions: List[str] = field(default_factory=list)
    cost: float = 1.0
    latency_ms: float = 100.0
    success_rate: float = 0.95
    best_for: List[str] = field(default_factory=list)

    def matches_task_type(self, task_type: str) -> bool:
        """Check if tool is suitable for task type"""
        return task_type in self.best_for if self.best_for else True

    def get_score(self, context: Dict[str, Any]) -> float:
        """
        Calculate tool suitability score (0-1, higher = better)
        Factors: success_rate (50%), cost (30%), latency (20%)
        """
        success_weight = 0.5
        cost_weight = 0.30
        latency_weight = 0.20

        # Success rate (0-1)
        success_score = self.success_rate

        # Cost score (inverted: lower cost = higher score)
        # Normalize to 0-1 (assuming max cost is 10)
        cost_score = max(0, 1 - (self.cost / 10.0))

        # Latency score (inverted: lower latency = higher score)
        # Normalize to 0-1 (assuming max latency is 10000ms)
        latency_score = max(0, 1 - (self.latency_ms / 10000.0))

        return (
            success_weight * success_score
            + cost_weight * cost_score
            + latency_weight * latency_score
        )


@dataclass
class ToolRoutingDecision:
    """Result of tool routing decision"""
    decision: RoutingDecision
    tool_name: Optional[str] = None
    reason: str = ""
    recommended_tool: Optional[str] = None
    fallback_agent: Optional[str] = None
    modified_args: Dict[str, Any] = field(default_factory=dict)
    precondition_failures: List[str] = field(default_factory=list)
    score: float = 0.0

    def is_allowed(self) -> bool:
        """Check if tool call is allowed"""
        return self.decision == RoutingDecision.ALLOWED

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging"""
        return {
            "decision": self.decision.value,
            "tool_name": self.tool_name,
            "reason": self.reason,
            "recommended_tool": self.recommended_tool,
            "fallback_agent": self.fallback_agent,
            "precondition_failures": self.precondition_failures,
            "score": round(self.score, 3),
        }


class PreToolRouter:
    """
    Pre-tool middleware that validates and routes tool calls.

    Responsibilities:
    1. Load capability maps from YAML files
    2. Validate preconditions before tool execution
    3. Select best tool based on capabilities
    4. Check for unsafe/pointless operations
    5. Route to fallback agents on failure
    6. Track routing decisions for learning
    """

    def __init__(self, capabilities_dir: str = "maps/capabilities"):
        """
        Initialize PreToolRouter

        Args:
            capabilities_dir: Directory containing agent capability YAML files
        """
        self.capabilities_dir = Path(capabilities_dir)
        self.agent_capabilities: Dict[str, Dict[str, Any]] = {}
        self.tool_metadata: Dict[str, ToolCapability] = {}
        self.routing_history: List[Dict[str, Any]] = []
        self.precondition_cache: Dict[str, bool] = {}

        self._load_capability_maps()

    def _load_capability_maps(self) -> None:
        """Load all agent capability maps from YAML files"""
        if not self.capabilities_dir.exists():
            logger.warning(f"Capabilities directory not found: {self.capabilities_dir}")
            return

        for yaml_file in self.capabilities_dir.glob("*.yaml"):
            try:
                with open(yaml_file) as f:
                    agent_data = yaml.safe_load(f)
                    agent_id = agent_data.get("agent_id")

                    if not agent_id:
                        logger.warning(f"No agent_id in {yaml_file}")
                        continue

                    self.agent_capabilities[agent_id] = agent_data

                    # Extract tool metadata from capabilities.tool_dependencies
                    tool_deps = (
                        agent_data.get("capabilities", {}).get("tool_dependencies", {})
                    )
                    for tool_name, tool_spec in tool_deps.items():
                        if isinstance(tool_spec, dict):
                            if tool_name not in self.tool_metadata:
                                self.tool_metadata[tool_name] = ToolCapability(
                                    tool_name=tool_name,
                                    preconditions=tool_spec.get("preconditions", []),
                                    cost=float(tool_spec.get("cost", 1.0)),
                                    latency_ms=float(tool_spec.get("latency_ms", 100.0)),
                                    success_rate=float(tool_spec.get("success_rate", 0.95)),
                                    best_for=tool_spec.get("best_for", []),
                                )

                    logger.debug(f"Loaded capability map for {agent_id}")

            except Exception as e:
                logger.error(f"Error loading {yaml_file}: {e}")

        logger.info(
            f"Loaded capability maps for {len(self.agent_capabilities)} agents "
            f"and {len(self.tool_metadata)} tools"
        )

    def route_tool_call(
        self,
        agent_id: str,
        task_type: str,
        tool_name: str,
        args: Dict[str, Any],
        context: Dict[str, Any],
    ) -> ToolRoutingDecision:
        """
        Route a tool call through validation and capability checking

        Args:
            agent_id: ID of agent making the call
            task_type: Type of task being performed
            tool_name: Name of tool being called
            args: Arguments for the tool
            context: Execution context (task state, available resources)

        Returns:
            ToolRoutingDecision with routing decision and metadata
        """
        logger.debug(f"Routing tool call: agent={agent_id}, tool={tool_name}, task={task_type}")

        # Step 1: Check if agent has capability
        if not self._agent_supports_tool(agent_id, tool_name):
            return ToolRoutingDecision(
                decision=RoutingDecision.DENIED,
                tool_name=tool_name,
                reason=f"Agent {agent_id} does not support tool {tool_name}",
                fallback_agent=self._get_fallback_agent(agent_id),
            )

        # Step 2: Validate preconditions
        precondition_failures = self._check_preconditions(tool_name, context)
        if precondition_failures:
            return ToolRoutingDecision(
                decision=RoutingDecision.MISSING_DEPENDENCY,
                tool_name=tool_name,
                reason=f"Preconditions not met for {tool_name}",
                precondition_failures=precondition_failures,
                fallback_agent=self._get_fallback_agent(agent_id),
            )

        # Step 3: Validate tool inputs
        input_validation = self._validate_tool_inputs(tool_name, args)
        if not input_validation["valid"]:
            return ToolRoutingDecision(
                decision=RoutingDecision.DENIED,
                tool_name=tool_name,
                reason=f"Invalid inputs for {tool_name}: {input_validation['errors']}",
            )

        # Step 4: Check for unsafe/pointless operations
        safety_check = self._check_safety(tool_name, args, context)
        if not safety_check["safe"]:
            return ToolRoutingDecision(
                decision=RoutingDecision.DENIED,
                tool_name=tool_name,
                reason=safety_check["reason"],
            )

        # Step 5: Expand/normalize parameters
        expanded_args = self._expand_parameters(tool_name, args)

        # Step 6: Score tool suitability
        tool_capability = self.tool_metadata.get(tool_name)
        score = tool_capability.get_score(context) if tool_capability else 0.8

        # Step 7: Log routing decision
        decision = ToolRoutingDecision(
            decision=RoutingDecision.ALLOWED,
            tool_name=tool_name,
            reason="All checks passed",
            recommended_tool=tool_name,
            modified_args=expanded_args,
            score=score,
        )

        self._log_routing_decision(agent_id, task_type, decision)

        return decision

    def validate_and_route(
        self,
        task_type: str,
        agent_id: str,
        args: Dict[str, Any],
        context: Dict[str, Any],
    ) -> ToolRoutingDecision:
        """
        Validate task + route to best tool BEFORE execution

        Args:
            task_type: Type of task
            agent_id: Agent performing task
            args: Tool arguments
            context: Execution context

        Returns:
            ToolRoutingDecision with routing results
        """
        # Find best tool for task type
        best_tool = self._find_best_tool(task_type, args, context)

        if not best_tool:
            return ToolRoutingDecision(
                decision=RoutingDecision.DENIED,
                reason=f"No capable tool for task type: {task_type}",
                fallback_agent=self._get_fallback_agent(agent_id),
            )

        # Route through full validation
        return self.route_tool_call(agent_id, task_type, best_tool, args, context)

    def _agent_supports_tool(self, agent_id: str, tool_name: str) -> bool:
        """Check if agent supports tool"""
        if agent_id not in self.agent_capabilities:
            return False

        agent_data = self.agent_capabilities[agent_id]
        supported_tools = agent_data.get("capabilities", {}).get("supported_tools", [])

        # Check exact match
        if tool_name in supported_tools:
            return True

        # Check wildcard patterns (e.g., "Bash(pytest:*)")
        for pattern in supported_tools:
            if self._matches_pattern(tool_name, pattern):
                return True

        return False

    def _matches_pattern(self, tool_name: str, pattern: str) -> bool:
        """Match tool name against pattern (supports wildcards)"""
        regex_pattern = pattern.replace("*", ".*").replace("(", r"\(").replace(")", r"\)")
        return bool(re.match(f"^{regex_pattern}$", tool_name))

    def _check_preconditions(self, tool_name: str, context: Dict[str, Any]) -> List[str]:
        """Check if all preconditions are satisfied"""
        if tool_name not in self.tool_metadata:
            return []

        tool = self.tool_metadata[tool_name]
        failures = []

        for precondition in tool.preconditions:
            cache_key = f"{tool_name}:{precondition}"

            # Check cache first
            if cache_key in self.precondition_cache:
                if not self.precondition_cache[cache_key]:
                    failures.append(precondition)
                continue

            # Evaluate precondition
            is_met = self._evaluate_precondition(precondition, context)
            self.precondition_cache[cache_key] = is_met

            if not is_met:
                failures.append(precondition)

        return failures

    def _evaluate_precondition(self, precondition: str, context: Dict[str, Any]) -> bool:
        """Evaluate a single precondition"""
        checks = {
            "file_exists": lambda: context.get("file_path") and Path(context["file_path"]).exists(),
            "directory_exists": lambda: context.get("dir_path") and Path(context["dir_path"]).is_dir(),
            "test_files_exist": lambda: context.get("test_files_exist", True),  # Allow override in context
            "test_environment_setup": lambda: context.get("test_env_ready", True),
            "project_initialized": lambda: context.get("project_init", True),
            "codebase_indexed": lambda: context.get("codebase_indexed", True),
            "mongodb_running": lambda: context.get("mongodb_uri") is not None,
            "embeddings_exist": lambda: context.get("has_embeddings", False),
            "api_key": lambda: context.get("api_key") is not None,
            "docker_installed": lambda: self._check_command_available("docker"),
            "docker_daemon_running": lambda: self._check_command_available("docker ps"),
            "kubernetes_cluster_accessible": lambda: self._check_command_available("kubectl cluster-info"),
            "kubectl_installed": lambda: self._check_command_available("kubectl version"),
            "python_installed": lambda: self._check_command_available("python --version"),
            "nodejs_installed": lambda: self._check_command_available("node --version"),
            "git_repository_initialized": lambda: Path(".git").exists(),
            "output_directory_writable": lambda: self._check_writable_directory(context.get("output_dir", ".")),
            "knowledge_base_available": lambda: context.get("kb_available", True),
            "documentation_indexed": lambda: context.get("docs_indexed", True),
            "legal_templates_available": lambda: context.get("legal_templates", True),
            "compliance_rules_defined": lambda: context.get("compliance_rules", True),
            "regulatory_database_updated": lambda: context.get("regulatory_db", True),
            "data_sources_available": lambda: context.get("data_sources", True),
            "analysis_tools_configured": lambda: context.get("analysis_tools", True),
            "databases_running": lambda: context.get("databases_running", True),
            "content_templates_available": lambda: context.get("content_templates", True),
            "brand_guidelines_defined": lambda: context.get("brand_guidelines", True),
            "seo_keywords_prepared": lambda: context.get("seo_keywords", True),
            "market_data_available": lambda: context.get("market_data", True),
            "analytics_tools_configured": lambda: context.get("analytics_tools", True),
            "campaign_templates_ready": lambda: context.get("campaign_templates", True),
            "sendgrid_api_key_available": lambda: context.get("sendgrid_key") is not None,
            "email_lists_prepared": lambda: context.get("email_lists_ready", True),
            "email_templates_available": lambda: context.get("email_templates", True),
            "recipient_lists_validated": lambda: context.get("recipients_validated", True),
            "benchmark_scenarios_available": lambda: context.get("benchmarks_available", True),
            "code_validator_configured": lambda: context.get("validator_configured", True),
        }

        check_func = checks.get(precondition)
        if check_func:
            try:
                return check_func()
            except Exception as e:
                logger.warning(f"Error evaluating precondition {precondition}: {e}")
                return False

        # Unknown precondition - assume it's met
        logger.debug(f"Unknown precondition: {precondition}")
        return True

    def _check_command_available(self, command: str) -> bool:
        """Check if a command is available in PATH"""
        import subprocess
        import shlex

        try:
            # SECURITY FIX: Use shlex.split() and shell=False to prevent command injection
            # Original: subprocess.run(command, shell=True) - VULNERABLE to shell injection
            # Fixed: Parse command safely and use shell=False
            cmd_parts = shlex.split(command)
            result = subprocess.run(
                cmd_parts,  # List of arguments (safe)
                shell=False,  # SECURITY: Prevent shell injection
                capture_output=True,
                timeout=2,
            )
            return result.returncode == 0
        except Exception:
            return False

    def _check_writable_directory(self, path: str) -> bool:
        """Check if directory is writable"""
        try:
            return Path(path).exists() and os.access(path, os.W_OK)
        except Exception:
            return False

    def _validate_tool_inputs(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Validate tool-specific input requirements"""
        validators = {
            "Read": self._validate_read_args,
            "Write": self._validate_write_args,
            "Edit": self._validate_edit_args,
            "Grep": self._validate_grep_args,
            "Bash": self._validate_bash_args,
            "Glob": self._validate_glob_args,
            "genesis_vector_search": self._validate_vector_search_args,
        }

        validator = validators.get(tool_name)
        if validator:
            return validator(args)

        # Default: no specific validation
        return {"valid": True, "errors": []}

    def _validate_read_args(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Read tool arguments"""
        if "file_path" not in args:
            return {"valid": False, "errors": ["file_path required"]}
        return {"valid": True, "errors": []}

    def _validate_write_args(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Write tool arguments"""
        if "file_path" not in args or "content" not in args:
            return {"valid": False, "errors": ["file_path and content required"]}
        return {"valid": True, "errors": []}

    def _validate_edit_args(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Edit tool arguments"""
        required = ["file_path", "old_string", "new_string"]
        missing = [k for k in required if k not in args]
        if missing:
            return {"valid": False, "errors": [f"Missing: {', '.join(missing)}"]}
        return {"valid": True, "errors": []}

    def _validate_grep_args(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Grep tool arguments"""
        if "pattern" not in args:
            return {"valid": False, "errors": ["pattern required"]}
        # Check for invalid regex
        try:
            re.compile(args["pattern"])
        except re.error as e:
            return {"valid": False, "errors": [f"Invalid regex: {e}"]}
        return {"valid": True, "errors": []}

    def _validate_bash_args(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Bash tool arguments"""
        if "command" not in args:
            return {"valid": False, "errors": ["command required"]}
        return {"valid": True, "errors": []}

    def _validate_glob_args(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Glob tool arguments"""
        if "pattern" not in args:
            return {"valid": False, "errors": ["pattern required"]}
        return {"valid": True, "errors": []}

    def _validate_vector_search_args(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Validate vector search arguments"""
        if "query" not in args:
            return {"valid": False, "errors": ["query required"]}
        return {"valid": True, "errors": []}

    def _check_safety(
        self, tool_name: str, args: Dict[str, Any], context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Check for unsafe or pointless operations

        Returns:
            {"safe": bool, "reason": str}
        """
        # Veto 1: Destructive Bash commands
        if tool_name.startswith("Bash"):
            command = args.get("command", "")
            unsafe_patterns = [
                "rm -rf /",
                "rm -rf",
                "mkfs",
                "dd if=/dev/",
                "> /dev/",
                ":/etc/",
            ]
            if any(pattern in command for pattern in unsafe_patterns):
                return {"safe": False, "reason": f"Unsafe command blocked: {command}"}

        # Veto 2: Pointless operations (same file read twice)
        if tool_name == "Read":
            if context.get("last_read_file") == args.get("file_path"):
                return {"safe": False, "reason": "File already read in last step (pointless)"}

        # Veto 3: Empty regex patterns
        if tool_name == "Grep":
            pattern = args.get("pattern", "")
            if pattern in ["^$", ".*", ".", "*", ""]:
                return {"safe": False, "reason": f"Pointless regex pattern: {pattern}"}

        # Veto 4: PII in Read operations
        if tool_name == "Read":
            file_path = args.get("file_path", "")
            if self._contains_pii_filename(file_path):
                logger.warning(f"Potential PII in filename: {file_path}")

        return {"safe": True, "reason": ""}

    def _contains_pii_filename(self, filename: str) -> bool:
        """Check if filename contains potential PII"""
        pii_patterns = [
            r"password",
            r"secret",
            r"key",
            r"token",
            r"credential",
            r"config.*sensitive",
        ]
        filename_lower = filename.lower()
        return any(re.search(pattern, filename_lower) for pattern in pii_patterns)

    def _expand_parameters(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Fill in default parameters for tool call"""
        defaults = {
            "Read": {"limit": 2000, "offset": 0},
            "Grep": {"output_mode": "files_with_matches", "head_limit": 20},
            "Bash": {"timeout": 120000},
            "Glob": {"path": "."},
            "genesis_tei_embed": {"batch_size": 32},
            "genesis_vector_search": {"limit": 10},
        }

        # Merge defaults with provided args (args take precedence)
        default_args = defaults.get(tool_name, {})
        return {**default_args, **args}

    def _find_best_tool(
        self, task_type: str, args: Dict[str, Any], context: Dict[str, Any]
    ) -> Optional[str]:
        """
        Find the best tool for a task type based on capabilities

        Ranks tools by:
        1. Best for this task type
        2. Success rate
        3. Cost
        4. Latency
        """
        candidates = []

        for tool_name, tool_capability in self.tool_metadata.items():
            # Check if tool is suitable for task type
            if tool_capability.matches_task_type(task_type):
                score = tool_capability.get_score(context)
                candidates.append((tool_name, score))

        if not candidates:
            return None

        # Sort by score (highest first)
        candidates.sort(key=lambda x: x[1], reverse=True)

        logger.debug(f"Tool candidates for {task_type}: {candidates}")

        return candidates[0][0]

    def _get_fallback_agent(self, agent_id: str) -> Optional[str]:
        """Get fallback agent for failed routing"""
        if agent_id not in self.agent_capabilities:
            return "orchestration_agent"

        agent_data = self.agent_capabilities[agent_id]
        fallback_agents = agent_data.get("fallback_agents", [])

        return fallback_agents[0] if fallback_agents else "orchestration_agent"

    def _log_routing_decision(
        self, agent_id: str, task_type: str, decision: ToolRoutingDecision
    ) -> None:
        """Log routing decision for analytics and learning"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "agent_id": agent_id,
            "task_type": task_type,
            "decision": decision.to_dict(),
        }

        self.routing_history.append(log_entry)

        # Periodic persistence (every 100 decisions)
        if len(self.routing_history) % 100 == 0:
            self._persist_routing_history()

    def _persist_routing_history(self) -> None:
        """Save routing history to disk for analysis"""
        try:
            history_file = Path("logs/routing_history.jsonl")
            history_file.parent.mkdir(parents=True, exist_ok=True)

            with open(history_file, "a") as f:
                for entry in self.routing_history[-100:]:
                    f.write(json.dumps(entry) + "\n")

            logger.debug(f"Persisted {len(self.routing_history)} routing decisions")
        except Exception as e:
            logger.error(f"Error persisting routing history: {e}")


# Required import
import os
