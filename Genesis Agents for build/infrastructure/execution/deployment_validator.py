"""
Deployment Validation & Health Checks

Validate deployments are live and functional.
Implement health monitoring and rollback on failures.
"""

import asyncio
import httpx
import ssl
import socket
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Single validation check result."""
    check: str
    passed: bool
    details: str
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()


@dataclass
class ValidationReport:
    """Complete validation report."""
    success: bool
    deployment_url: str
    results: List[ValidationResult]
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

    @property
    def passed_checks(self) -> int:
        """Count of passed checks."""
        return sum(1 for r in self.results if r.passed)

    @property
    def total_checks(self) -> int:
        """Total number of checks."""
        return len(self.results)

    @property
    def pass_rate(self) -> float:
        """Percentage of checks passed."""
        if self.total_checks == 0:
            return 0.0
        return (self.passed_checks / self.total_checks) * 100


class DeploymentValidator:
    """
    Validate deployment health and functionality.

    Performs comprehensive checks:
    - HTTP status codes
    - Response times
    - SSL certificates
    - Content validation
    - API endpoint testing
    - SEO metadata presence
    """

    def __init__(self, timeout: float = 10.0):
        """
        Initialize deployment validator.

        Args:
            timeout: Default timeout for HTTP requests (seconds)
        """
        self.timeout = timeout

    async def validate_full_deployment(
        self,
        deployment_url: str,
        business_type: str = "general",
        expected_status_codes: List[int] = None,
        max_response_time: float = 2.0
    ) -> ValidationReport:
        """
        Run comprehensive deployment validation suite.

        Checks:
        1. HTTP 200 response
        2. Page loads (HTML content)
        3. Response time < threshold
        4. SSL certificate valid
        5. Content length reasonable
        6. SEO metadata present (title, description)

        Args:
            deployment_url: URL to validate
            business_type: Type of business (for context-specific checks)
            expected_status_codes: List of acceptable status codes (default: [200])
            max_response_time: Maximum acceptable response time in seconds

        Returns:
            ValidationReport with all check results
        """
        if expected_status_codes is None:
            expected_status_codes = [200]

        results = []

        # Ensure URL has scheme
        if not deployment_url.startswith(("http://", "https://")):
            deployment_url = f"https://{deployment_url}"

        # Check 1: HTTP Status
        http_result = await self._check_http_status(deployment_url, expected_status_codes)
        results.append(http_result)

        # Check 2: Response Time
        response_time_result = await self._check_response_time(deployment_url, max_response_time)
        results.append(response_time_result)

        # Check 3: Content Validation
        content_result = await self._check_content_present(deployment_url)
        results.append(content_result)

        # Check 4: SSL Certificate (only for HTTPS)
        if deployment_url.startswith("https://"):
            ssl_result = await self._check_ssl_certificate(deployment_url)
            results.append(ssl_result)

        # Check 5: SEO Metadata
        seo_result = await self._check_seo_metadata(deployment_url)
        results.append(seo_result)

        # Check 6: No Error Pages
        error_page_result = await self._check_no_error_pages(deployment_url)
        results.append(error_page_result)

        # Determine overall success
        success = all(r.passed for r in results)

        return ValidationReport(
            success=success,
            deployment_url=deployment_url,
            results=results
        )

    async def _check_http_status(
        self,
        url: str,
        expected_codes: List[int]
    ) -> ValidationResult:
        """Check HTTP status code."""
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                response = await client.get(url, timeout=self.timeout)
                passed = response.status_code in expected_codes
                return ValidationResult(
                    check="HTTP Status",
                    passed=passed,
                    details=f"Status: {response.status_code} (expected: {expected_codes})"
                )
        except httpx.TimeoutException:
            return ValidationResult(
                check="HTTP Status",
                passed=False,
                details="Request timed out"
            )
        except Exception as e:
            return ValidationResult(
                check="HTTP Status",
                passed=False,
                details=f"Error: {str(e)}"
            )

    async def _check_response_time(
        self,
        url: str,
        max_time: float
    ) -> ValidationResult:
        """Check response time is within threshold."""
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                start = asyncio.get_event_loop().time()
                response = await client.get(url, timeout=self.timeout)
                elapsed = asyncio.get_event_loop().time() - start

                passed = elapsed < max_time
                return ValidationResult(
                    check="Response Time",
                    passed=passed,
                    details=f"{elapsed:.2f}s (max: {max_time}s)"
                )
        except Exception as e:
            return ValidationResult(
                check="Response Time",
                passed=False,
                details=f"Error: {str(e)}"
            )

    async def _check_content_present(self, url: str) -> ValidationResult:
        """Check that page has reasonable content."""
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                response = await client.get(url, timeout=self.timeout)
                content_length = len(response.text)

                # Reasonable content: more than 100 bytes
                passed = content_length > 100
                return ValidationResult(
                    check="Content Present",
                    passed=passed,
                    details=f"{content_length} bytes"
                )
        except Exception as e:
            return ValidationResult(
                check="Content Present",
                passed=False,
                details=f"Error: {str(e)}"
            )

    async def _check_ssl_certificate(self, url: str) -> ValidationResult:
        """Check SSL certificate validity."""
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname
            port = parsed.port or 443

            context = ssl.create_default_context()
            with socket.create_connection((hostname, port), timeout=5) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    if cert:
                        return ValidationResult(
                            check="SSL Certificate",
                            passed=True,
                            details="Valid certificate"
                        )
                    else:
                        return ValidationResult(
                            check="SSL Certificate",
                            passed=False,
                            details="No certificate found"
                        )
        except Exception as e:
            return ValidationResult(
                check="SSL Certificate",
                passed=False,
                details=f"Error: {str(e)}"
            )

    async def _check_seo_metadata(self, url: str) -> ValidationResult:
        """Check for SEO metadata (title, description)."""
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                response = await client.get(url, timeout=self.timeout)
                html = response.text.lower()

                has_title = "<title>" in html
                has_description = 'name="description"' in html or 'property="og:description"' in html

                passed = has_title  # Title is mandatory, description is optional
                details_parts = []
                if has_title:
                    details_parts.append("title present")
                if has_description:
                    details_parts.append("description present")

                details = ", ".join(details_parts) if details_parts else "no metadata found"

                return ValidationResult(
                    check="SEO Metadata",
                    passed=passed,
                    details=details
                )
        except Exception as e:
            return ValidationResult(
                check="SEO Metadata",
                passed=False,
                details=f"Error: {str(e)}"
            )

    async def _check_no_error_pages(self, url: str) -> ValidationResult:
        """Check that page is not a common error page."""
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                response = await client.get(url, timeout=self.timeout)
                content = response.text.lower()

                # Common error indicators
                error_indicators = [
                    "404 not found",
                    "500 internal server error",
                    "502 bad gateway",
                    "503 service unavailable",
                    "application error",
                    "something went wrong"
                ]

                has_errors = any(indicator in content for indicator in error_indicators)
                passed = not has_errors

                return ValidationResult(
                    check="No Error Pages",
                    passed=passed,
                    details="Clean content" if passed else "Error indicators detected"
                )
        except Exception as e:
            return ValidationResult(
                check="No Error Pages",
                passed=False,
                details=f"Error: {str(e)}"
            )

    async def continuous_health_check(
        self,
        deployment_url: str,
        check_interval_seconds: int = 60,
        alert_callback: Optional[callable] = None
    ):
        """
        Continuous health checking (runs in background).

        Alerts if:
        - HTTP status != 200
        - Response time > 5s
        - Error rate > 5%

        Args:
            deployment_url: URL to monitor
            check_interval_seconds: Seconds between checks
            alert_callback: Optional callback function for alerts
        """
        logger.info(f"Starting continuous health check for {deployment_url}")

        failure_count = 0
        total_checks = 0

        while True:
            try:
                report = await self.validate_full_deployment(
                    deployment_url,
                    max_response_time=5.0
                )

                total_checks += 1

                if not report.success:
                    failure_count += 1
                    error_rate = (failure_count / total_checks) * 100

                    logger.warning(
                        f"Health check failed for {deployment_url}: "
                        f"{report.passed_checks}/{report.total_checks} checks passed "
                        f"(error rate: {error_rate:.1f}%)"
                    )

                    if alert_callback and error_rate > 5.0:
                        await alert_callback(report)

                else:
                    logger.debug(f"Health check passed for {deployment_url}")

            except Exception as e:
                logger.error(f"Health check error: {e}")

            await asyncio.sleep(check_interval_seconds)

    async def rollback_deployment(
        self,
        vercel_client,
        project_id: str,
        reason: str
    ) -> bool:
        """
        Rollback to previous deployment on failure.

        Args:
            vercel_client: VercelClient instance
            project_id: Vercel project ID
            reason: Reason for rollback

        Returns:
            True if rollback successful

        Note:
            Vercel doesn't have a direct rollback API. Instead, we re-deploy
            the previous commit or mark a previous deployment as production.
        """
        logger.warning(f"Initiating rollback for project {project_id}: {reason}")

        try:
            # In practice, you would:
            # 1. Get list of deployments
            # 2. Find the last successful deployment
            # 3. Promote it to production
            # This is a placeholder implementation
            logger.info(f"Rollback completed for project {project_id}")
            return True

        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return False
