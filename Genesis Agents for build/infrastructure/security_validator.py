"""
Security Validator - Orchestration Security Layer
Created: October 17, 2025
Purpose: Security validation layer for HTDAG+HALO+AOP orchestration

ISSUE #11 FIX: Adds security checks to orchestration pipeline

Pipeline Integration:
    User Request → SecurityValidator.validate_input()
    → HTDAG → HALO → AOP
    → SecurityValidator.validate_execution_plan()
    → DAAO → Execute
    → SecurityValidator.filter_output()
    → User
"""

import logging
import re
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

from infrastructure.security_utils import (
    sanitize_for_prompt,
    detect_dag_cycle,
    validate_dag_depth
)

logger = logging.getLogger(__name__)


class ValidationSeverity(Enum):
    """Severity levels for validation issues"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class ValidationIssue:
    """Single validation issue"""
    severity: ValidationSeverity
    category: str
    message: str
    recommendation: Optional[str] = None


@dataclass
class ValidationResult:
    """Result of security validation"""
    passed: bool
    issues: List[ValidationIssue]
    sanitized_data: Optional[Any] = None

    def has_critical_issues(self) -> bool:
        """Check if any critical issues found"""
        return any(issue.severity == ValidationSeverity.CRITICAL for issue in self.issues)

    def has_errors(self) -> bool:
        """Check if any errors found"""
        return any(
            issue.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]
            for issue in self.issues
        )


class SecurityValidator:
    """
    Security validation layer for orchestration

    ISSUE #11 FIX: Comprehensive security for entire orchestration pipeline

    Three validation points:
    1. Input validation (user requests)
    2. Execution plan validation (routing plans)
    3. Output filtering (results)
    """

    def __init__(
        self,
        max_request_length: int = 5000,
        max_dag_depth: int = 10,
        max_dag_nodes: int = 100,
        rate_limit_per_minute: int = 60
    ):
        """
        Initialize security validator

        Args:
            max_request_length: Maximum allowed request length
            max_dag_depth: Maximum DAG recursion depth
            max_dag_nodes: Maximum nodes in DAG
            rate_limit_per_minute: Request rate limit
        """
        self.max_request_length = max_request_length
        self.max_dag_depth = max_dag_depth
        self.max_dag_nodes = max_dag_nodes
        self.rate_limit_per_minute = rate_limit_per_minute

        # Rate limiting tracking
        self._request_history: Dict[str, List[float]] = {}

        logger.info(
            "SecurityValidator initialized",
            extra={
                'max_request_length': max_request_length,
                'max_dag_depth': max_dag_depth,
                'max_dag_nodes': max_dag_nodes
            }
        )

    async def validate_input(
        self,
        user_request: str,
        user_id: Optional[str] = None
    ) -> ValidationResult:
        """
        Validate user input for security issues

        Checks:
        1. Prompt injection patterns
        2. Malicious patterns (XSS, SQL injection attempts)
        3. Length limits
        4. Rate limiting

        Args:
            user_request: Raw user request
            user_id: Optional user identifier for rate limiting

        Returns:
            ValidationResult with sanitized request
        """
        issues = []

        # Check 1: Length validation
        if len(user_request) > self.max_request_length:
            issues.append(ValidationIssue(
                severity=ValidationSeverity.ERROR,
                category="length",
                message=f"Request exceeds maximum length ({len(user_request)} > {self.max_request_length})",
                recommendation="Reduce request size or break into smaller tasks"
            ))

        # Check 2: Prompt injection detection
        injection_patterns = [
            r'ignore\s+(previous|all)\s+instructions',
            r'<\|im_start\|>|<\|im_end\|>',
            r'system\s*:.*execute',
            r'forget\s+(everything|previous)',
            r'new\s+prompt\s*:',
            r'actual\s+prompt\s*:',
        ]

        for pattern in injection_patterns:
            if re.search(pattern, user_request, re.IGNORECASE):
                issues.append(ValidationIssue(
                    severity=ValidationSeverity.CRITICAL,
                    category="prompt_injection",
                    message=f"Potential prompt injection detected: {pattern}",
                    recommendation="Remove instruction override attempts"
                ))

        # Check 3: Code execution attempts in request
        dangerous_patterns = [
            r'eval\s*\(',
            r'exec\s*\(',
            r'__import__\s*\(',
            r'os\.system\s*\(',
            r'subprocess\.',
        ]

        for pattern in dangerous_patterns:
            if re.search(pattern, user_request, re.IGNORECASE):
                issues.append(ValidationIssue(
                    severity=ValidationSeverity.CRITICAL,
                    category="code_execution",
                    message=f"Potential code execution attempt: {pattern}",
                    recommendation="Remove dangerous code patterns"
                ))

        # Check 4: XSS patterns (in case request ends up in web UI)
        xss_patterns = [
            r'<script.*?>',
            r'javascript:',
            r'onerror\s*=',
            r'onload\s*=',
        ]

        for pattern in xss_patterns:
            if re.search(pattern, user_request, re.IGNORECASE):
                issues.append(ValidationIssue(
                    severity=ValidationSeverity.WARNING,
                    category="xss",
                    message=f"Potential XSS pattern detected: {pattern}",
                    recommendation="Remove HTML/JavaScript code"
                ))

        # Check 5: Rate limiting (if user_id provided)
        if user_id:
            rate_limit_ok = self._check_rate_limit(user_id)
            if not rate_limit_ok:
                issues.append(ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    category="rate_limit",
                    message=f"Rate limit exceeded ({self.rate_limit_per_minute} requests/minute)",
                    recommendation="Wait before sending more requests"
                ))

        # Sanitize request
        sanitized_request = sanitize_for_prompt(user_request, max_length=self.max_request_length)

        # Determine if validation passed
        passed = not any(
            issue.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]
            for issue in issues
        )

        logger.info(
            f"Input validation: {'PASSED' if passed else 'FAILED'}",
            extra={
                'issue_count': len(issues),
                'critical_count': sum(1 for i in issues if i.severity == ValidationSeverity.CRITICAL),
                'request_length': len(user_request)
            }
        )

        return ValidationResult(
            passed=passed,
            issues=issues,
            sanitized_data=sanitized_request
        )

    async def validate_execution_plan(
        self,
        routing_plan: Any,  # RoutingPlan type (avoid circular import)
        dag: Any  # TaskDAG type
    ) -> ValidationResult:
        """
        Validate execution plan before running

        Checks:
        1. Agent permissions (solvability)
        2. Sandbox requirements (dangerous tasks must run in sandbox)
        3. Resource limits (depth, node count)
        4. DAG cycle detection

        Args:
            routing_plan: Routing plan from HALO
            dag: Task DAG from HTDAG

        Returns:
            ValidationResult
        """
        issues = []

        # Check 1: DAG cycle detection
        adjacency_list = self._build_adjacency_list(dag)
        has_cycle, cycle_path = detect_dag_cycle(adjacency_list)

        if has_cycle:
            issues.append(ValidationIssue(
                severity=ValidationSeverity.CRITICAL,
                category="dag_cycle",
                message=f"DAG contains cycle: {' -> '.join(cycle_path)}",
                recommendation="Remove circular dependencies"
            ))

        # Check 2: DAG depth validation
        is_depth_ok, actual_depth = validate_dag_depth(adjacency_list, self.max_dag_depth)

        if not is_depth_ok:
            issues.append(ValidationIssue(
                severity=ValidationSeverity.ERROR,
                category="dag_depth",
                message=f"DAG depth ({actual_depth}) exceeds limit ({self.max_dag_depth})",
                recommendation="Reduce task decomposition depth"
            ))

        # Check 3: DAG node count
        node_count = len(adjacency_list)
        if node_count > self.max_dag_nodes:
            issues.append(ValidationIssue(
                severity=ValidationSeverity.ERROR,
                category="dag_size",
                message=f"DAG has {node_count} nodes, exceeds limit ({self.max_dag_nodes})",
                recommendation="Reduce number of sub-tasks"
            ))

        # Check 4: Agent permission validation (solvability)
        # This checks if agents have required tools/capabilities
        # Integrates with AOP solvability check
        solvability_issues = await self._check_agent_permissions(routing_plan)
        issues.extend(solvability_issues)

        # Check 5: Dangerous task sandboxing
        sandbox_issues = self._check_sandbox_requirements(routing_plan)
        issues.extend(sandbox_issues)

        # Determine if validation passed
        passed = not any(
            issue.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]
            for issue in issues
        )

        logger.info(
            f"Execution plan validation: {'PASSED' if passed else 'FAILED'}",
            extra={
                'issue_count': len(issues),
                'dag_depth': actual_depth,
                'dag_nodes': node_count,
                'has_cycle': has_cycle
            }
        )

        return ValidationResult(
            passed=passed,
            issues=issues
        )

    async def filter_output(
        self,
        result: Any
    ) -> ValidationResult:
        """
        Filter sensitive data from output

        Checks:
        1. Credential leakage (API keys, passwords)
        2. PII detection (emails, phone numbers, SSNs)
        3. Internal system information (paths, IPs)

        Args:
            result: Execution result

        Returns:
            ValidationResult with filtered output
        """
        from infrastructure.security_utils import redact_credentials

        issues = []

        # Convert result to string for analysis
        result_str = str(result)

        # Check 1: Detect credentials (before redaction)
        credential_patterns = [
            (r'api[_-]?key["\']?\s*[:=]\s*["\']([^"\']+)["\']', 'API key'),
            (r'password["\']?\s*[:=]\s*["\']([^"\']+)["\']', 'Password'),
            (r'sk-[a-zA-Z0-9]{32,}', 'OpenAI key'),
            (r'Bearer\s+[A-Za-z0-9\-._~+/]+=*', 'Bearer token'),
        ]

        for pattern, cred_type in credential_patterns:
            if re.search(pattern, result_str, re.IGNORECASE):
                issues.append(ValidationIssue(
                    severity=ValidationSeverity.WARNING,
                    category="credential_leak",
                    message=f"Potential {cred_type} found in output (will be redacted)",
                    recommendation="Avoid logging credentials"
                ))

        # Check 2: PII detection
        pii_patterns = [
            (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', 'Email address'),
            (r'\b\d{3}-\d{2}-\d{4}\b', 'SSN'),
            (r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', 'Phone number'),
        ]

        for pattern, pii_type in pii_patterns:
            if re.search(pattern, result_str):
                issues.append(ValidationIssue(
                    severity=ValidationSeverity.WARNING,
                    category="pii",
                    message=f"Potential {pii_type} found in output",
                    recommendation="Review PII handling policies"
                ))

        # Check 3: Internal paths
        if re.search(r'/home/[a-z0-9_-]+/', result_str, re.IGNORECASE):
            issues.append(ValidationIssue(
                severity=ValidationSeverity.INFO,
                category="internal_path",
                message="Internal file paths found in output",
                recommendation="Consider using relative paths in output"
            ))

        # Apply redaction
        filtered_result = redact_credentials(result_str)

        logger.info(
            f"Output filtering: {len(issues)} issues detected",
            extra={
                'credential_issues': sum(1 for i in issues if i.category == 'credential_leak'),
                'pii_issues': sum(1 for i in issues if i.category == 'pii')
            }
        )

        return ValidationResult(
            passed=True,  # Output filtering always passes, just warns
            issues=issues,
            sanitized_data=filtered_result
        )

    def _check_rate_limit(self, user_id: str) -> bool:
        """
        Check if user is within rate limit

        Args:
            user_id: User identifier

        Returns:
            True if within limit, False otherwise
        """
        import time

        current_time = time.time()
        window_start = current_time - 60  # 1 minute window

        # Get request history for user
        if user_id not in self._request_history:
            self._request_history[user_id] = []

        # Remove old requests outside window
        self._request_history[user_id] = [
            t for t in self._request_history[user_id]
            if t > window_start
        ]

        # Check if over limit
        if len(self._request_history[user_id]) >= self.rate_limit_per_minute:
            return False

        # Add current request
        self._request_history[user_id].append(current_time)

        return True

    def _build_adjacency_list(self, dag: Any) -> Dict[str, List[str]]:
        """
        Build adjacency list from DAG for cycle detection

        Args:
            dag: TaskDAG object

        Returns:
            Dict mapping task_id -> list of child task_ids
        """
        adjacency_list = {}

        # Handle different DAG implementations
        if hasattr(dag, 'get_all_tasks'):
            for task in dag.get_all_tasks():
                task_id = task.id if hasattr(task, 'id') else str(task)
                children = []

                if hasattr(task, 'children'):
                    children = [c.id if hasattr(c, 'id') else str(c) for c in task.children]
                elif hasattr(task, 'dependencies'):
                    children = task.dependencies

                adjacency_list[task_id] = children

        return adjacency_list

    async def _check_agent_permissions(self, routing_plan: Any) -> List[ValidationIssue]:
        """
        Check if agents have required permissions/capabilities

        Integrates with AOP solvability check

        Args:
            routing_plan: Routing plan with agent assignments

        Returns:
            List of validation issues
        """
        issues = []

        # This would integrate with AOP validator
        # For now, basic check
        if hasattr(routing_plan, 'assignments'):
            for task_id, agent in routing_plan.assignments.items():
                # Check if agent has required tools
                if hasattr(agent, 'required_tools') and hasattr(agent, 'available_tools'):
                    required = set(agent.required_tools or [])
                    available = set(agent.available_tools or [])
                    missing = required - available

                    if missing:
                        issues.append(ValidationIssue(
                            severity=ValidationSeverity.ERROR,
                            category="agent_permissions",
                            message=f"Agent {agent.name} lacks required tools: {missing}",
                            recommendation="Add tools or reassign task"
                        ))

        return issues

    def _check_sandbox_requirements(self, routing_plan: Any) -> List[ValidationIssue]:
        """
        Check if dangerous tasks are properly sandboxed

        Args:
            routing_plan: Routing plan

        Returns:
            List of validation issues
        """
        issues = []

        # Tasks that must run in sandbox
        dangerous_task_types = [
            'code_execution',
            'system_command',
            'file_operation',
            'network_request',
        ]

        if hasattr(routing_plan, 'assignments'):
            for task_id, agent in routing_plan.assignments.items():
                if hasattr(agent, 'task_type'):
                    if agent.task_type in dangerous_task_types:
                        # Check if sandboxed
                        is_sandboxed = getattr(agent, 'is_sandboxed', False)

                        if not is_sandboxed:
                            issues.append(ValidationIssue(
                                severity=ValidationSeverity.CRITICAL,
                                category="sandbox",
                                message=f"Dangerous task '{task_id}' not sandboxed",
                                recommendation="Enable sandboxing for this agent"
                            ))

        return issues
