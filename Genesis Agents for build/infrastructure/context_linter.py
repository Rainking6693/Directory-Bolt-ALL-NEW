"""
SLICE Context Linter - Fix Agent Failures at the Source

Based on: https://www.theunwindai.com/p/ai-agents-fail-on-bad-context-not-bad-models
Key insight: Agents fail on bad CONTEXT, not bad models. SLICE fixes this.

SLICE Components:
- S: Source validation (max tokens per source)
- L: Latency cutoff (recency filtering)
- I: Information density (deduplication)
- C: Content filtering (domain allow-list)
- E: Error detection (malformed context)

Expected Impact:
- 30-50% token reduction
- 20-30% latency improvement
- 70% overall performance boost
- Better agent decision quality
"""

import hashlib
import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Set, Tuple
from urllib.parse import urlparse

# Genesis infrastructure
from infrastructure import get_logger

# OTEL observability
try:
    from opentelemetry import trace, metrics
    from opentelemetry.trace import Status, StatusCode
    tracer = trace.get_tracer(__name__)
    meter = metrics.get_meter(__name__)

    # Metrics
    lint_counter = meter.create_counter(
        "context_linter.lints.performed",
        description="Number of context linting operations"
    )
    token_savings_histogram = meter.create_histogram(
        "context_linter.tokens.saved",
        description="Tokens saved by linting"
    )
    HAS_OTEL = True
except ImportError:
    HAS_OTEL = False
    tracer = None

logger = get_logger(__name__)


@dataclass
class Message:
    """
    Single message in context history.

    Attributes:
        content: Message text content
        role: Message role (user, assistant, system)
        timestamp: When message was created
        source: Where message came from (api, file, memory, etc.)
        tokens: Estimated token count
        metadata: Additional message metadata
    """
    content: str
    role: str
    timestamp: datetime
    source: str = "unknown"
    tokens: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Estimate tokens if not provided"""
        if self.tokens == 0:
            self.tokens = self._estimate_tokens(self.content)

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        """Estimate token count (~1.3 tokens per word)"""
        if not text:
            return 0
        return int(len(text.split()) * 1.3)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "content": self.content,
            "role": self.role,
            "timestamp": self.timestamp.isoformat(),
            "source": self.source,
            "tokens": self.tokens,
            "metadata": self.metadata
        }


@dataclass
class LintedContext:
    """
    Context after SLICE linting.

    Attributes:
        messages: Cleaned message list
        original_count: Original message count
        original_tokens: Original token count
        cleaned_count: Cleaned message count
        cleaned_tokens: Cleaned token count
        lint_metadata: Linting operation metadata
    """
    messages: List[Message]
    original_count: int
    original_tokens: int
    cleaned_count: int
    cleaned_tokens: int
    lint_metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def token_reduction_percent(self) -> float:
        """Calculate token reduction percentage"""
        if self.original_tokens == 0:
            return 0.0
        return ((self.original_tokens - self.cleaned_tokens) / self.original_tokens) * 100

    @property
    def message_reduction_percent(self) -> float:
        """Calculate message reduction percentage"""
        if self.original_count == 0:
            return 0.0
        return ((self.original_count - self.cleaned_count) / self.original_count) * 100

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "messages": [m.to_dict() for m in self.messages],
            "original_count": self.original_count,
            "original_tokens": self.original_tokens,
            "cleaned_count": self.cleaned_count,
            "cleaned_tokens": self.cleaned_tokens,
            "token_reduction_percent": self.token_reduction_percent,
            "message_reduction_percent": self.message_reduction_percent,
            "lint_metadata": self.lint_metadata
        }


class ContextLinter:
    """
    SLICE Context Linter - Clean and optimize agent context.

    Implements the SLICE algorithm to fix bad context that causes agent failures:
    - S: Source validation (max tokens per source)
    - L: Latency cutoff (recency filtering)
    - I: Information density (deduplication)
    - C: Content filtering (domain allow-list)
    - E: Error detection (malformed context)
    """

    # Default configuration
    DEFAULT_MAX_TOKENS = 8000
    DEFAULT_RECENCY_HOURS = 168  # 7 days
    DEFAULT_DEDUP_THRESHOLD = 0.85  # 85% similarity = duplicate
    DEFAULT_MAX_TOKENS_PER_SOURCE = 2000

    # Error patterns to detect malformed context
    ERROR_PATTERNS = [
        r'<error>.*?</error>',
        r'ERROR:.*',
        r'FAILED:.*',
        r'Exception:.*',
        r'Traceback \(most recent call last\):',
        r'\[ERROR\]',
        r'null reference',
        r'undefined variable',
    ]

    def __init__(
        self,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        recency_hours: int = DEFAULT_RECENCY_HOURS,
        dedup_threshold: float = DEFAULT_DEDUP_THRESHOLD,
        max_tokens_per_source: int = DEFAULT_MAX_TOKENS_PER_SOURCE,
        allowed_domains: Optional[Set[str]] = None,
        enable_otel: bool = True
    ):
        """
        Initialize ContextLinter.

        Args:
            max_tokens: Maximum total tokens in context
            recency_hours: Maximum message age in hours
            dedup_threshold: Similarity threshold for deduplication
            max_tokens_per_source: Maximum tokens per source
            allowed_domains: Allowed URL domains (None = allow all)
            enable_otel: Enable OpenTelemetry tracing/metrics
        """
        self.max_tokens = max_tokens
        self.recency_hours = recency_hours
        self.dedup_threshold = dedup_threshold
        self.max_tokens_per_source = max_tokens_per_source
        self.allowed_domains = allowed_domains
        self.enable_otel = enable_otel and HAS_OTEL

        # Compile error patterns
        self.error_regexes = [re.compile(p, re.IGNORECASE) for p in self.ERROR_PATTERNS]

        logger.info(
            f"ContextLinter initialized: max_tokens={max_tokens}, "
            f"recency_hours={recency_hours}, dedup_threshold={dedup_threshold}"
        )

    def lint_context(
        self,
        messages: List[Message],
        max_tokens: Optional[int] = None,
        recency_hours: Optional[int] = None,
        dedup_threshold: Optional[float] = None,
        max_tokens_per_source: Optional[int] = None,
        allowed_domains: Optional[Set[str]] = None
    ) -> LintedContext:
        """
        Apply SLICE algorithm to clean context.

        Args:
            messages: Input message list
            max_tokens: Override default max tokens
            recency_hours: Override default recency hours
            dedup_threshold: Override default dedup threshold
            max_tokens_per_source: Override default max tokens per source
            allowed_domains: Override default allowed domains

        Returns:
            LintedContext with cleaned messages and metrics
        """
        if self.enable_otel and tracer:
            span = tracer.start_span("context_linter.lint_context")
            span.set_attribute("input_messages", len(messages))
        else:
            span = None

        try:
            # Use overrides or defaults
            max_tokens = max_tokens or self.max_tokens
            recency_hours = recency_hours or self.recency_hours
            dedup_threshold = dedup_threshold or self.dedup_threshold
            max_tokens_per_source = max_tokens_per_source or self.max_tokens_per_source
            allowed_domains = allowed_domains or self.allowed_domains

            # Track original metrics
            original_count = len(messages)
            original_tokens = sum(m.tokens for m in messages)

            lint_start = datetime.now(timezone.utc)
            lint_metadata = {
                "slice_operations": [],
                "lint_timestamp": lint_start.isoformat()
            }

            # Apply SLICE operations in order
            cleaned = messages.copy()

            # S: Source validation
            cleaned, source_metrics = self._validate_sources(cleaned, max_tokens_per_source)
            lint_metadata["slice_operations"].append({
                "step": "S_source_validation",
                "removed": original_count - len(cleaned),
                "metrics": source_metrics
            })

            # L: Latency cutoff (recency filtering)
            cleaned, latency_metrics = self._filter_by_recency(cleaned, recency_hours)
            lint_metadata["slice_operations"].append({
                "step": "L_latency_cutoff",
                "removed": len(messages) - len(cleaned),
                "metrics": latency_metrics
            })

            # I: Information density (deduplication)
            cleaned, dedup_metrics = self._deduplicate_messages(cleaned, dedup_threshold)
            lint_metadata["slice_operations"].append({
                "step": "I_information_density",
                "removed": original_count - len(cleaned),
                "metrics": dedup_metrics
            })

            # C: Content filtering (domain allow-list)
            cleaned, content_metrics = self._filter_domains(cleaned, allowed_domains)
            lint_metadata["slice_operations"].append({
                "step": "C_content_filtering",
                "removed": original_count - len(cleaned),
                "metrics": content_metrics
            })

            # E: Error detection (malformed context)
            cleaned, error_metrics = self._detect_errors(cleaned)
            lint_metadata["slice_operations"].append({
                "step": "E_error_detection",
                "removed": original_count - len(cleaned),
                "metrics": error_metrics
            })

            # Final token limit enforcement
            cleaned = self._enforce_token_limit(cleaned, max_tokens)

            # Calculate final metrics
            cleaned_count = len(cleaned)
            cleaned_tokens = sum(m.tokens for m in cleaned)

            lint_duration = (datetime.now(timezone.utc) - lint_start).total_seconds()
            lint_metadata["duration_seconds"] = lint_duration

            result = LintedContext(
                messages=cleaned,
                original_count=original_count,
                original_tokens=original_tokens,
                cleaned_count=cleaned_count,
                cleaned_tokens=cleaned_tokens,
                lint_metadata=lint_metadata
            )

            # Log results
            logger.info(
                f"Context linted: {original_count} → {cleaned_count} messages "
                f"({result.message_reduction_percent:.1f}% reduction), "
                f"{original_tokens} → {cleaned_tokens} tokens "
                f"({result.token_reduction_percent:.1f}% reduction)"
            )

            # Metrics
            if self.enable_otel:
                lint_counter.add(1)
                token_savings = original_tokens - cleaned_tokens
                token_savings_histogram.record(token_savings)
                if span:
                    span.set_attribute("output_messages", cleaned_count)
                    span.set_attribute("token_savings", token_savings)
                    span.set_attribute("token_reduction_percent", result.token_reduction_percent)
                    span.set_status(Status(StatusCode.OK))

            return result

        except Exception as e:
            logger.error(f"Context linting failed: {e}", exc_info=True)
            if span:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
            raise
        finally:
            if span:
                span.end()

    # SLICE Component Implementations

    def _validate_sources(
        self,
        messages: List[Message],
        max_tokens_per_source: int
    ) -> Tuple[List[Message], Dict[str, Any]]:
        """
        S: Source validation - Enforce max tokens per source.

        Args:
            messages: Input messages
            max_tokens_per_source: Maximum tokens allowed per source

        Returns:
            Tuple of (cleaned messages, metrics)
        """
        source_tokens: Dict[str, int] = defaultdict(int)
        cleaned: List[Message] = []
        removed_count = 0
        truncated_count = 0

        # Try tiktoken for accurate token counting
        try:
            import tiktoken
            encoding = tiktoken.get_encoding("cl100k_base")  # GPT-4 encoding
            has_tiktoken = True
        except (ImportError, Exception):
            has_tiktoken = False

        for msg in messages:
            source = msg.source

            # Calculate accurate token count if tiktoken available
            if has_tiktoken:
                actual_tokens = len(encoding.encode(msg.content))
            else:
                actual_tokens = msg.tokens

            # Check if source exceeded limit
            if source_tokens[source] + actual_tokens > max_tokens_per_source:
                # Try truncation instead of removal
                available_tokens = max_tokens_per_source - source_tokens[source]

                if available_tokens > 50:  # Minimum viable message length
                    # Truncate message to fit
                    if has_tiktoken:
                        tokens = encoding.encode(msg.content)
                        truncated_tokens = tokens[:available_tokens]
                        truncated_content = encoding.decode(truncated_tokens)
                    else:
                        # Fallback: truncate by words
                        words = msg.content.split()
                        target_words = int(available_tokens / 1.3)  # Reverse token estimation
                        truncated_content = " ".join(words[:target_words]) + "..."

                    # Create truncated message
                    truncated_msg = Message(
                        content=truncated_content,
                        role=msg.role,
                        timestamp=msg.timestamp,
                        source=msg.source,
                        tokens=available_tokens,
                        metadata={**msg.metadata, "truncated": True}
                    )
                    cleaned.append(truncated_msg)
                    source_tokens[source] += available_tokens
                    truncated_count += 1
                else:
                    # Not enough space, remove message
                    removed_count += 1
                continue

            source_tokens[source] += actual_tokens
            cleaned.append(msg)

        metrics = {
            "total_sources": len(source_tokens),
            "removed_messages": removed_count,
            "truncated_messages": truncated_count,
            "source_distribution": dict(source_tokens),
            "tiktoken_used": has_tiktoken
        }

        return cleaned, metrics

    def _filter_by_recency(
        self,
        messages: List[Message],
        hours: int
    ) -> Tuple[List[Message], Dict[str, Any]]:
        """
        L: Latency cutoff - Filter by message recency.

        Args:
            messages: Input messages
            hours: Maximum age in hours

        Returns:
            Tuple of (cleaned messages, metrics)
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        cleaned: List[Message] = []
        removed_count = 0
        oldest_kept = None

        for msg in messages:
            if msg.timestamp >= cutoff_time:
                cleaned.append(msg)
                if oldest_kept is None or msg.timestamp < oldest_kept:
                    oldest_kept = msg.timestamp
            else:
                removed_count += 1

        metrics = {
            "cutoff_hours": hours,
            "cutoff_timestamp": cutoff_time.isoformat(),
            "removed_messages": removed_count,
            "oldest_kept": oldest_kept.isoformat() if oldest_kept else None
        }

        return cleaned, metrics

    def _deduplicate_messages(
        self,
        messages: List[Message],
        threshold: float
    ) -> Tuple[List[Message], Dict[str, Any]]:
        """
        I: Information density - Remove duplicate messages.

        Uses smart hybrid approach:
        - Exact duplicates: MD5 hash (fast path)
        - Near duplicates: Jaccard similarity on ALL messages (not just last 10)
        - Embeddings: Optional enhancement for semantic understanding

        Args:
            messages: Input messages
            threshold: Similarity threshold (0.0-1.0)

        Returns:
            Tuple of (cleaned messages, metrics)
        """
        cleaned: List[Message] = []
        seen_hashes: Set[str] = set()
        duplicate_count = 0
        near_duplicate_count = 0

        for msg in messages:
            # Exact duplicate check (fast path)
            content_hash = hashlib.sha256(msg.content.encode()).hexdigest()
            if content_hash in seen_hashes:
                duplicate_count += 1
                continue

            # Near-duplicate check using Jaccard similarity - CHECK ALL MESSAGES
            is_duplicate = False
            for prev_msg in cleaned:  # Changed from cleaned[-10:] to cleaned (ALL messages)
                similarity = self._jaccard_similarity(msg.content, prev_msg.content)
                if similarity >= threshold:
                    near_duplicate_count += 1
                    is_duplicate = True
                    break

            if not is_duplicate:
                cleaned.append(msg)
                seen_hashes.add(content_hash)

        metrics = {
            "threshold": threshold,
            "exact_duplicates": duplicate_count,
            "near_duplicates": near_duplicate_count,
            "total_removed": duplicate_count + near_duplicate_count,
            "method": "jaccard"
        }

        return cleaned, metrics

    def _filter_domains(
        self,
        messages: List[Message],
        allowed_domains: Optional[Set[str]]
    ) -> Tuple[List[Message], Dict[str, Any]]:
        """
        C: Content filtering - Filter by allowed domains.

        Args:
            messages: Input messages
            allowed_domains: Set of allowed domains (None = allow all)

        Returns:
            Tuple of (cleaned messages, metrics)
        """
        if allowed_domains is None:
            # No filtering
            return messages, {"filtering_enabled": False}

        cleaned: List[Message] = []
        removed_count = 0
        domain_violations: Dict[str, int] = defaultdict(int)

        for msg in messages:
            # Extract URLs from message content
            urls = re.findall(r'https?://[^\s]+', msg.content)

            # Check if any URL violates domain policy
            violates_policy = False
            for url in urls:
                try:
                    domain = urlparse(url).netloc
                    if domain and domain not in allowed_domains:
                        domain_violations[domain] += 1
                        violates_policy = True
                        break
                except Exception:
                    # Invalid URL, skip
                    continue

            if violates_policy:
                removed_count += 1
            else:
                cleaned.append(msg)

        metrics = {
            "filtering_enabled": True,
            "allowed_domains": list(allowed_domains),
            "removed_messages": removed_count,
            "domain_violations": dict(domain_violations)
        }

        return cleaned, metrics

    def _detect_errors(
        self,
        messages: List[Message]
    ) -> Tuple[List[Message], Dict[str, Any]]:
        """
        E: Error detection - Remove messages with error indicators.

        Args:
            messages: Input messages

        Returns:
            Tuple of (cleaned messages, metrics)
        """
        cleaned: List[Message] = []
        removed_count = 0
        error_patterns_found: Dict[str, int] = defaultdict(int)

        for msg in messages:
            has_error = False

            for pattern, regex in zip(self.ERROR_PATTERNS, self.error_regexes):
                if regex.search(msg.content):
                    error_patterns_found[pattern] += 1
                    has_error = True
                    break

            if has_error:
                removed_count += 1
            else:
                cleaned.append(msg)

        metrics = {
            "removed_messages": removed_count,
            "error_patterns_found": dict(error_patterns_found)
        }

        return cleaned, metrics

    # Helper methods

    def _enforce_token_limit(
        self,
        messages: List[Message],
        max_tokens: int
    ) -> List[Message]:
        """
        Enforce final token limit by removing oldest messages.

        Args:
            messages: Input messages
            max_tokens: Maximum total tokens

        Returns:
            Cleaned messages within token limit
        """
        total_tokens = sum(m.tokens for m in messages)

        if total_tokens <= max_tokens:
            return messages

        # Remove oldest messages until under limit
        cleaned = messages.copy()
        while total_tokens > max_tokens and cleaned:
            removed = cleaned.pop(0)  # Remove oldest
            total_tokens -= removed.tokens

        logger.debug(
            f"Enforced token limit: {len(messages)} → {len(cleaned)} messages, "
            f"{sum(m.tokens for m in messages)} → {total_tokens} tokens"
        )

        return cleaned

    def _jaccard_similarity(self, text1: str, text2: str) -> float:
        """
        Calculate Jaccard similarity between two texts.

        Args:
            text1: First text
            text2: Second text

        Returns:
            Similarity score (0.0-1.0)
        """
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())

        if not words1 or not words2:
            return 0.0

        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))

        return intersection / union if union > 0 else 0.0


# Singleton instance
_context_linter_instance: Optional[ContextLinter] = None


def get_context_linter(reset: bool = False, **kwargs) -> ContextLinter:
    """
    Get global ContextLinter singleton instance.

    Args:
        reset: If True, create new instance (for testing)
        **kwargs: Configuration overrides

    Returns:
        ContextLinter instance
    """
    global _context_linter_instance

    if reset or _context_linter_instance is None:
        _context_linter_instance = ContextLinter(**kwargs)

    return _context_linter_instance
