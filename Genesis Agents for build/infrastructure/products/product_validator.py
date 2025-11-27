"""
Product Validator - Quality and Security Validation for Generated Products

This module validates generated applications for:
- Code quality and best practices
- Security vulnerabilities (SQL injection, XSS, auth bypasses)
- Feature completeness
- Performance and scalability
- Integration with Claude Haiku 4.5 for fast validation

Architecture:
- AST-based code analysis (static analysis)
- Pattern matching for security vulnerabilities
- Feature checklist validation
- Quality scoring (0-100)
- Integration with SE-Darwin for learning
"""

import ast
import asyncio
import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    logging.warning("Anthropic SDK not available. Install with: pip install anthropic")

logger = logging.getLogger(__name__)


class SecurityIssue(Enum):
    """Security vulnerability types."""
    SQL_INJECTION = "sql_injection"
    XSS = "xss"
    AUTH_BYPASS = "auth_bypass"
    HARDCODED_SECRET = "hardcoded_secret"
    INSECURE_COOKIE = "insecure_cookie"
    MISSING_CSRF = "missing_csrf"
    UNSAFE_EVAL = "unsafe_eval"
    PATH_TRAVERSAL = "PATH_TRAVERSAL"


class Severity(Enum):
    """Issue severity levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class ValidationIssue:
    """Individual validation issue."""
    type: str
    severity: Severity
    message: str
    file: str
    line: Optional[int] = None
    suggestion: Optional[str] = None


@dataclass
class ValidationResult:
    """Complete validation result."""
    passed: bool
    quality_score: float  # 0-100
    security_issues: List[ValidationIssue] = field(default_factory=list)
    quality_issues: List[ValidationIssue] = field(default_factory=list)
    feature_completeness: Dict[str, bool] = field(default_factory=dict)
    performance_warnings: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    validation_time_seconds: float = 0.0


class ProductValidator:
    """
    Validate generated products for quality and security.

    Uses static analysis and Claude Haiku 4.5 for fast validation.
    Integrates with SE-Darwin for learning from validation results.
    """

    def __init__(
        self,
        anthropic_api_key: Optional[str] = None,
        use_llm_validation: bool = True,
        strict_mode: bool = False
    ):
        """
        Initialize product validator.

        Args:
            anthropic_api_key: Anthropic API key for LLM validation
            use_llm_validation: Use Claude Haiku 4.5 for advanced validation
            strict_mode: Fail validation on any security issue
        """
        import os
        self.api_key = anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")
        self.use_llm_validation = use_llm_validation
        self.strict_mode = strict_mode

        # Initialize Anthropic client
        self.client = None
        if ANTHROPIC_AVAILABLE and self.api_key and use_llm_validation:
            self.client = anthropic.Anthropic(api_key=self.api_key)

        # Validation model (fast and cheap)
        self.validation_model = "claude-haiku-4-20250514"

        # Security patterns (regex-based detection)
        self._init_security_patterns()

    def _init_security_patterns(self) -> None:
        """Initialize security vulnerability patterns."""
        self.security_patterns = {
            SecurityIssue.SQL_INJECTION: [
                re.compile(r'\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\s+', re.IGNORECASE),
                re.compile(r';\s*(SELECT|INSERT|UPDATE|DELETE|DROP)\s+', re.IGNORECASE),
                re.compile(r'--.*?(SELECT|INSERT|UPDATE)', re.IGNORECASE),
                re.compile(r'/\*.*?(SELECT|INSERT|UPDATE).*?\*/', re.IGNORECASE),
                re.compile(r'UNION\s+SELECT', re.IGNORECASE),
                re.compile(r'OR\s+1\s*=\s*1', re.IGNORECASE),
                re.compile(r'execute\([\'"].*\$\{.*\}.*[\'"]\)', re.IGNORECASE),
                re.compile(r'query\([\'"].*\+.*[\'"]\)', re.IGNORECASE),
                re.compile(r'raw\([\'"].*\$\{.*\}.*[\'"]\)', re.IGNORECASE),
            ],
            SecurityIssue.XSS: [
                re.compile(r'dangerouslySetInnerHTML', re.IGNORECASE),
                re.compile(r'innerHTML\s*=', re.IGNORECASE),
                re.compile(r'document\.write\(', re.IGNORECASE),
            ],
            SecurityIssue.AUTH_BYPASS: [
                re.compile(r'if\s*\(.*==.*[\'"]admin[\'"]\)', re.IGNORECASE),
                re.compile(r'session\s*=\s*\{.*\}', re.IGNORECASE),
                re.compile(r'isAdmin\s*=\s*true', re.IGNORECASE),
            ],
            SecurityIssue.HARDCODED_SECRET: [
                re.compile(r'api[_-]?key\s*=\s*[\'"][^\'"]+[\'"]', re.IGNORECASE),
                re.compile(r'secret\s*=\s*[\'"][^\'"]+[\'"]', re.IGNORECASE),
                re.compile(r'password\s*=\s*[\'"][^\'"]+[\'"]', re.IGNORECASE),
            ],
            SecurityIssue.INSECURE_COOKIE: [
                re.compile(r'secure\s*:\s*false', re.IGNORECASE),
                re.compile(r'httpOnly\s*:\s*false', re.IGNORECASE),
                re.compile(r'sameSite\s*:\s*[\'"]none[\'"]', re.IGNORECASE),
            ],
            SecurityIssue.UNSAFE_EVAL: [
                re.compile(r'\beval\s*\(', re.IGNORECASE),
                re.compile(r'Function\s*\(', re.IGNORECASE),
                re.compile(r'setTimeout\s*\([\'"]', re.IGNORECASE),
            ],
            SecurityIssue.PATH_TRAVERSAL: [
                re.compile(r'readFile\s*\([^)]*\+', re.IGNORECASE),
                re.compile(r'\.\./', re.IGNORECASE),
                re.compile(r'path\.join\([^)]*req\.(query|params|body)', re.IGNORECASE),
            ]
        }

    async def validate_product(
        self,
        files: Dict[str, str],
        required_features: List[str],
        business_type: str
    ) -> ValidationResult:
        """
        Validate complete product.

        Args:
            files: Product files (filename -> content)
            required_features: Features that must be implemented
            business_type: Type of business (saas, content, ecommerce)

        Returns:
            ValidationResult with all issues and quality score
        """
        import time
        start_time = time.time()

        logger.info(f"Validating {len(files)} files for {business_type} product")

        # Run validation checks in parallel
        security_task = asyncio.create_task(self._validate_security(files))
        quality_task = asyncio.create_task(self._validate_quality(files))
        features_task = asyncio.create_task(
            self._validate_features(files, required_features, business_type)
        )
        performance_task = asyncio.create_task(self._validate_performance(files))

        # Wait for all validations
        security_issues = await security_task
        quality_issues = await quality_task
        feature_completeness = await features_task
        performance_warnings = await performance_task

        # Calculate quality score
        quality_score = self._calculate_quality_score(
            security_issues=security_issues,
            quality_issues=quality_issues,
            feature_completeness=feature_completeness,
            performance_warnings=performance_warnings
        )

        # Determine if validation passed
        critical_issues = [
            issue for issue in security_issues
            if issue.severity == Severity.CRITICAL
        ]
        passed = len(critical_issues) == 0 if self.strict_mode else quality_score >= 70.0

        # Generate recommendations
        recommendations = self._generate_recommendations(
            security_issues=security_issues,
            quality_issues=quality_issues,
            feature_completeness=feature_completeness
        )

        # Create result
        result = ValidationResult(
            passed=passed,
            quality_score=quality_score,
            security_issues=security_issues,
            quality_issues=quality_issues,
            feature_completeness=feature_completeness,
            performance_warnings=performance_warnings,
            recommendations=recommendations,
            validation_time_seconds=time.time() - start_time
        )

        logger.info(
            f"Validation complete: passed={passed}, score={quality_score:.1f}, "
            f"security_issues={len(security_issues)}, quality_issues={len(quality_issues)}"
        )

        return result

    # ==================== SECURITY VALIDATION ====================

    async def _validate_security(self, files: Dict[str, str]) -> List[ValidationIssue]:
        """
        Validate security using pattern matching and AST analysis.

        Args:
            files: Product files

        Returns:
            List of security issues
        """
        issues = []

        for filename, content in files.items():
            # Skip non-code files
            if not self._is_code_file(filename):
                continue

            # Pattern-based detection
            for security_type, patterns in self.security_patterns.items():
                for pattern in patterns:
                    matches = pattern.finditer(content)
                    for match in matches:
                        line_number = content[:match.start()].count('\n') + 1
                        issues.append(ValidationIssue(
                            type=security_type.value,
                            severity=self._get_security_severity(security_type),
                            message=self._get_security_message(security_type),
                            file=filename,
                            line=line_number,
                            suggestion=self._get_security_suggestion(security_type)
                        ))

            # AST-based detection for Python/TypeScript
            if filename.endswith('.py'):
                issues.extend(self._validate_python_security(filename, content))
            elif filename.endswith(('.ts', '.tsx', '.js', '.jsx')):
                issues.extend(self._validate_typescript_security(filename, content))

        logger.debug(f"Found {len(issues)} security issues")
        return issues

    def _validate_python_security(self, filename: str, content: str) -> List[ValidationIssue]:
        """Validate Python file security using AST."""
        issues = []

        try:
            tree = ast.parse(content)

            # Check for dangerous imports
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name in ('pickle', 'shelve', 'marshal'):
                            issues.append(ValidationIssue(
                                type="unsafe_deserialization",
                                severity=Severity.HIGH,
                                message=f"Unsafe deserialization: {alias.name}",
                                file=filename,
                                line=node.lineno,
                                suggestion="Use json or msgpack for serialization"
                            ))

                # Check for subprocess with shell=True
                elif isinstance(node, ast.Call):
                    if hasattr(node.func, 'attr') and node.func.attr in ('call', 'run', 'Popen'):
                        for keyword in node.keywords:
                            if keyword.arg == 'shell' and isinstance(keyword.value, ast.Constant):
                                if keyword.value.value is True:
                                    issues.append(ValidationIssue(
                                        type="command_injection",
                                        severity=Severity.CRITICAL,
                                        message="Command injection risk: shell=True",
                                        file=filename,
                                        line=node.lineno,
                                        suggestion="Use shell=False and pass command as list"
                                    ))

        except SyntaxError:
            logger.warning(f"Failed to parse Python file: {filename}")

        return issues

    def _validate_typescript_security(self, filename: str, content: str) -> List[ValidationIssue]:
        """Validate TypeScript/JavaScript file security."""
        issues = []

        # Check for missing CSRF protection in API routes
        if '/api/' in filename or 'route.ts' in filename:
            if 'csrf' not in content.lower() and 'verifyToken' not in content:
                issues.append(ValidationIssue(
                    type=SecurityIssue.MISSING_CSRF.value,
                    severity=Severity.MEDIUM,
                    message="API route missing CSRF protection",
                    file=filename,
                    suggestion="Add CSRF token verification for state-changing operations"
                ))

        # Check for missing authentication checks
        if '/api/' in filename:
            if 'getSession' not in content and 'auth' not in content.lower():
                issues.append(ValidationIssue(
                    type=SecurityIssue.AUTH_BYPASS.value,
                    severity=Severity.HIGH,
                    message="API route missing authentication check",
                    file=filename,
                    suggestion="Add authentication middleware or getSession() check"
                ))

        return issues

    def _get_security_severity(self, security_type: SecurityIssue) -> Severity:
        """Get severity level for security issue type."""
        severity_map = {
            SecurityIssue.SQL_INJECTION: Severity.CRITICAL,
            SecurityIssue.XSS: Severity.HIGH,
            SecurityIssue.AUTH_BYPASS: Severity.CRITICAL,
            SecurityIssue.HARDCODED_SECRET: Severity.HIGH,
            SecurityIssue.INSECURE_COOKIE: Severity.MEDIUM,
            SecurityIssue.MISSING_CSRF: Severity.MEDIUM,
            SecurityIssue.UNSAFE_EVAL: Severity.HIGH,
            SecurityIssue.PATH_TRAVERSAL: Severity.HIGH,
        }
        return severity_map.get(security_type, Severity.MEDIUM)

    def _get_security_message(self, security_type: SecurityIssue) -> str:
        """Get human-readable message for security issue."""
        messages = {
            SecurityIssue.SQL_INJECTION: "Potential SQL injection vulnerability",
            SecurityIssue.XSS: "Potential cross-site scripting (XSS) vulnerability",
            SecurityIssue.AUTH_BYPASS: "Potential authentication bypass",
            SecurityIssue.HARDCODED_SECRET: "Hardcoded secret detected",
            SecurityIssue.INSECURE_COOKIE: "Insecure cookie configuration",
            SecurityIssue.MISSING_CSRF: "Missing CSRF protection",
            SecurityIssue.UNSAFE_EVAL: "Unsafe use of eval() or Function()",
            SecurityIssue.PATH_TRAVERSAL: "Potential path traversal vulnerability",
        }
        return messages.get(security_type, "Security issue detected")

    def _get_security_suggestion(self, security_type: SecurityIssue) -> str:
        """Get fix suggestion for security issue."""
        suggestions = {
            SecurityIssue.SQL_INJECTION: "Use parameterized queries or ORM (Prisma)",
            SecurityIssue.XSS: "Sanitize user input and use React's default escaping",
            SecurityIssue.AUTH_BYPASS: "Implement proper authentication middleware",
            SecurityIssue.HARDCODED_SECRET: "Move secrets to environment variables",
            SecurityIssue.INSECURE_COOKIE: "Set secure: true, httpOnly: true, sameSite: 'strict'",
            SecurityIssue.MISSING_CSRF: "Add CSRF token validation for POST/PUT/DELETE",
            SecurityIssue.UNSAFE_EVAL: "Avoid eval() - use JSON.parse() or safer alternatives",
            SecurityIssue.PATH_TRAVERSAL: "Validate and sanitize file paths",
        }
        return suggestions.get(security_type, "Review and fix security issue")

    # ==================== QUALITY VALIDATION ====================

    async def _validate_quality(self, files: Dict[str, str]) -> List[ValidationIssue]:
        """
        Validate code quality.

        Checks:
        - TypeScript usage (no 'any' types)
        - Error handling
        - Proper exports
        - Component structure
        - API route structure

        Args:
            files: Product files

        Returns:
            List of quality issues
        """
        issues = []

        for filename, content in files.items():
            if not self._is_code_file(filename):
                continue

            # TypeScript 'any' usage
            if filename.endswith(('.ts', '.tsx')):
                any_matches = re.finditer(r':\s*any\b', content)
                for match in any_matches:
                    line_number = content[:match.start()].count('\n') + 1
                    issues.append(ValidationIssue(
                        type="typescript_any",
                        severity=Severity.LOW,
                        message="Using 'any' type - reduces type safety",
                        file=filename,
                        line=line_number,
                        suggestion="Use specific types or 'unknown' instead"
                    ))

            # Missing error handling in API routes
            if '/api/' in filename or 'route.ts' in filename:
                if 'try' not in content or 'catch' not in content:
                    issues.append(ValidationIssue(
                        type="missing_error_handling",
                        severity=Severity.MEDIUM,
                        message="API route missing try-catch error handling",
                        file=filename,
                        suggestion="Wrap async operations in try-catch blocks"
                    ))

            # Missing TypeScript in Next.js files
            if filename.endswith(('.js', '.jsx')) and '/app/' in filename:
                issues.append(ValidationIssue(
                    type="missing_typescript",
                    severity=Severity.LOW,
                    message="Using JavaScript instead of TypeScript",
                    file=filename,
                    suggestion="Convert to TypeScript for better type safety"
                ))

            # Console.log in production
            if re.search(r'console\.(log|debug)\(', content):
                issues.append(ValidationIssue(
                    type="console_log",
                    severity=Severity.INFO,
                    message="Console.log found - should be removed in production",
                    file=filename,
                    suggestion="Use proper logging library or remove debug statements"
                ))

        logger.debug(f"Found {len(issues)} quality issues")
        return issues

    # ==================== FEATURE VALIDATION ====================

    async def _validate_features(
        self,
        files: Dict[str, str],
        required_features: List[str],
        business_type: str
    ) -> Dict[str, bool]:
        """
        Validate that required features are implemented.

        Args:
            files: Product files
            required_features: Features that must be present
            business_type: Type of business

        Returns:
            Dict mapping feature name to implemented status
        """
        feature_completeness = {}

        # Define feature detection patterns
        feature_patterns = {
            "authentication": ["auth", "signin", "signup", "login", "session"],
            "database": ["database", "prisma", "supabase", "query", "model"],
            "api_routes": ["api", "route.ts", "NextResponse"],
            "responsive_design": ["responsive", "mobile", "tablet", "sm:", "md:", "lg:"],
            "error_handling": ["try", "catch", "error", "ErrorBoundary"],
            "payment": ["stripe", "checkout", "payment", "billing"],
            "admin_dashboard": ["admin", "dashboard", "/admin/"],
            "shopping_cart": ["cart", "basket", "addToCart"],
            "blog": ["blog", "post", "article", "mdx"],
            "search": ["search", "query", "filter"],
        }

        # Check each required feature
        for feature in required_features:
            feature_lower = feature.lower()
            implemented = False

            # Find matching pattern
            for pattern_name, keywords in feature_patterns.items():
                if any(keyword in feature_lower for keyword in keywords):
                    # Check if pattern exists in files (content or filename)
                    for filename, content in files.items():
                        if any(keyword in content.lower() or keyword in filename.lower() for keyword in keywords):
                            implemented = True
                            break
                    break

            # If no pattern matched, check for feature name directly with fuzzy matching
            if not implemented:
                for content in files.values():
                    content_lower = content.lower()
                    # Try exact match first
                    if feature_lower in content_lower:
                        implemented = True
                        break
                    # Try keyword matching (any word in feature)
                    keywords = [w for w in feature_lower.split() if len(w) > 3]
                    if keywords and any(kw in content_lower for kw in keywords):
                        implemented = True
                        break

            feature_completeness[feature] = implemented

        logger.debug(
            f"Feature completeness: {sum(feature_completeness.values())}/{len(required_features)} "
            f"implemented"
        )

        return feature_completeness

    # ==================== PERFORMANCE VALIDATION ====================

    async def _validate_performance(self, files: Dict[str, str]) -> List[str]:
        """
        Validate performance best practices.

        Args:
            files: Product files

        Returns:
            List of performance warnings
        """
        warnings = []

        for filename, content in files.items():
            if not self._is_code_file(filename):
                continue

            # Missing Next.js Image optimization
            if filename.endswith(('.tsx', '.jsx')):
                if re.search(r'<img\s+', content) and 'next/image' not in content:
                    warnings.append(
                        f"{filename}: Using <img> tag instead of Next.js Image component"
                    )

            # Blocking data fetching (should be async)
            if '/page.tsx' in filename:
                if 'fetch(' in content and 'await' not in content:
                    warnings.append(
                        f"{filename}: Fetch without await - may block rendering"
                    )

            # Large bundle imports
            if 'import' in content:
                if re.search(r'import\s+\*\s+as\s+', content):
                    warnings.append(
                        f"{filename}: Wildcard import - increases bundle size"
                    )

        # Check for empty or suspiciously small critical files
        critical_files = ['package.json', 'page.tsx', 'layout.tsx']
        for filename, content in files.items():
            if any(cf in filename for cf in critical_files):
                if not content or len(content.strip()) < 50:
                    warnings.append(f"Critical file {filename} is empty or too small")

        logger.debug(f"Found {len(warnings)} performance warnings")
        return warnings

    # ==================== QUALITY SCORING ====================

    def _calculate_quality_score(
        self,
        security_issues: List[ValidationIssue],
        quality_issues: List[ValidationIssue],
        feature_completeness: Dict[str, bool],
        performance_warnings: List[str]
    ) -> float:
        """
        Calculate overall quality score (0-100).

        Scoring:
        - Start at 100
        - Deduct points for issues based on severity
        - Bonus for feature completeness

        Args:
            security_issues: Security problems
            quality_issues: Code quality problems
            feature_completeness: Feature implementation status
            performance_warnings: Performance warnings

        Returns:
            Quality score (0-100)
        """
        score = 100.0

        # Deduct for security issues
        severity_deductions = {
            Severity.CRITICAL: 25,
            Severity.HIGH: 10,
            Severity.MEDIUM: 5,
            Severity.LOW: 2,
            Severity.INFO: 0
        }

        for issue in security_issues:
            score -= severity_deductions.get(issue.severity, 5)

        # Deduct for quality issues (less severe)
        for issue in quality_issues:
            score -= severity_deductions.get(issue.severity, 2) * 0.5

        # Deduct for performance warnings
        score -= len(performance_warnings) * 1

        # Feature completeness bonus
        if feature_completeness:
            completeness_ratio = sum(feature_completeness.values()) / len(feature_completeness)
            feature_bonus = completeness_ratio * 10
            score += feature_bonus

        # Clamp to 0-100
        return max(0.0, min(100.0, score))

    # ==================== RECOMMENDATIONS ====================

    def _generate_recommendations(
        self,
        security_issues: List[ValidationIssue],
        quality_issues: List[ValidationIssue],
        feature_completeness: Dict[str, bool]
    ) -> List[str]:
        """Generate actionable recommendations."""
        recommendations = []

        # Security recommendations
        critical_security = [i for i in security_issues if i.severity == Severity.CRITICAL]
        if critical_security:
            recommendations.append(
                f"CRITICAL: Fix {len(critical_security)} critical security issues before deployment"
            )

        # Feature recommendations
        missing_features = [f for f, impl in feature_completeness.items() if not impl]
        if missing_features:
            recommendations.append(
                f"Implement {len(missing_features)} missing features: {', '.join(missing_features[:3])}"
            )

        # Quality recommendations
        if len(quality_issues) > 10:
            recommendations.append(
                f"Improve code quality: {len(quality_issues)} issues found"
            )

        # General recommendations
        if not recommendations:
            recommendations.append("Product meets quality standards - ready for deployment")

        return recommendations

    # ==================== HELPERS ====================

    def _is_code_file(self, filename: str) -> bool:
        """Check if file is a code file that should be validated."""
        code_extensions = {'.ts', '.tsx', '.js', '.jsx', '.py', '.sql'}
        return any(filename.endswith(ext) for ext in code_extensions)
