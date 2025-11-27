"""
SAE PII Detector - Sparse Autoencoder-based PII Detection
Version: 1.0
Date: October 30, 2025
Owner: Sentinel (Security Agent)
Status: Week 1 Stub Implementation

Based on PrivacyScalpel (arXiv:2503.11232) and Rakuten's production deployment.

Performance Targets:
- F1 Score: ≥96% (vs 51% black-box baseline)
- Latency: <100ms per request
- Cost: 10-500x cheaper than GPT-4 Mini/Claude Opus
- Languages: 5 (English, Japanese, Spanish, French, German)

Architecture:
- SAE Encoder: 32,768 latent features (8x expansion) from Layer 12
- Classifiers: Logistic Regression / Random Forest / XGBoost
- Categories: personal_name, address, phone, email, none
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

logger = logging.getLogger(__name__)


@dataclass
class PIISpan:
    """
    Detected PII span in text.

    Attributes:
        category: PII category (personal_name, address, phone, email, none)
        start_char: Start character index in original text
        end_char: End character index in original text
        confidence: Detection confidence (0.0-1.0)
        text: Actual PII text content
        metadata: Additional detection metadata
    """
    category: str
    start_char: int
    end_char: int
    confidence: float
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary for JSON responses."""
        return {
            "category": self.category,
            "start_char": self.start_char,
            "end_char": self.end_char,
            "confidence": self.confidence,
            "text": self.text,
            "metadata": self.metadata
        }


@dataclass
class SAEEncoderConfig:
    """
    Configuration for SAE encoder.

    Attributes:
        model_name: Base model name (e.g., "meta-llama/Llama-3.2-8B")
        target_layer: Layer to extract activations (default: 12)
        expansion_factor: SAE expansion factor (default: 8)
        hidden_dim: Base model hidden dimension (default: 4096)
        latent_dim: SAE latent dimension (expansion_factor × hidden_dim)
        sparsity_k: k-sparse constraint (top-k active features)
    """
    model_name: str = "meta-llama/Llama-3.2-8B"
    target_layer: int = 12
    expansion_factor: int = 8
    hidden_dim: int = 4096
    latent_dim: int = 32768  # 8 × 4096
    sparsity_k: int = 64


class SAEPIIDetector:
    """
    SAE-based PII detector with 96% F1 score.

    Uses Sparse Autoencoder (SAE) latent features from transformer internals
    to detect PII with higher accuracy and lower cost than black-box LLM judges.

    Architecture:
    1. Tokenize & Chunk: Split text into overlapping 128-token chunks
    2. SAE Encoding: Extract 32,768-dim latent features from Layer 12
    3. Classification: Predict PII category per token using lightweight classifiers
    4. Span Merging: Merge consecutive tokens into PII spans
    5. Redaction: Replace detected PII with [REDACTED] tokens

    Performance:
    - F1 Score: 96% (vs 51% black-box LLM baseline)
    - Latency: <100ms per request
    - Cost: 10-500x cheaper than GPT-4 Mini/Claude Opus

    Example:
        >>> detector = SAEPIIDetector(
        ...     model_path="models/llama-3.2-8b",
        ...     sae_encoder_path="models/sae_layer12_8x.pt",
        ...     classifiers_path="models/pii_classifiers.pkl"
        ... )
        >>> pii_spans = detector.detect_pii("Contact John Smith at john@example.com")
        >>> print(pii_spans)
        [
            PIISpan(category="personal_name", start_char=8, end_char=18, confidence=0.98, text="John Smith"),
            PIISpan(category="email", start_char=22, end_char=40, confidence=0.99, text="john@example.com")
        ]
    """

    # PII category definitions
    PII_CATEGORIES = [
        "personal_name",  # e.g., "John Smith", "Dr. Jane Doe"
        "address",        # e.g., "123 Main St, New York, NY 10001"
        "phone",          # e.g., "+1-555-123-4567", "(555) 123-4567"
        "email",          # e.g., "user@example.com"
        "none"            # Safe content (no PII)
    ]

    def __init__(
        self,
        model_path: Optional[str] = None,
        sae_encoder_path: Optional[str] = None,
        classifiers_path: Optional[str] = None,
        port: int = 8003,
        device: str = "cpu",
        config: Optional[SAEEncoderConfig] = None
    ):
        """
        Initialize SAE PII Detector.

        Args:
            model_path: Path to base model (Llama 3.2 8B or Gemma 2B)
            sae_encoder_path: Path to trained SAE weights (32K latents, Layer 12)
            classifiers_path: Path to trained PII classifiers (sklearn/xgboost)
            port: API service port for sidecar deployment (default: 8003)
            device: Inference device ("cpu" or "cuda")
            config: SAE encoder configuration (optional)

        Raises:
            FileNotFoundError: If model paths don't exist
            ValueError: If configuration is invalid

        Note:
            This is a Week 1 stub. Actual model loading will be implemented in Week 2.
        """
        self.model_path = model_path
        self.sae_encoder_path = sae_encoder_path
        self.classifiers_path = classifiers_path
        self.port = port
        self.device = device
        self.config = config or SAEEncoderConfig()

        # Model components (to be loaded in Week 2)
        self.base_model = None
        self.tokenizer = None
        self.sae_encoder = None
        self.classifiers = {}  # Dict[str, classifier] for each language

        # Performance metrics
        self.total_requests = 0
        self.total_pii_detected = 0
        self.avg_latency_ms = 0.0

        logger.info(
            f"SAEPIIDetector initialized "
            f"(model={model_path}, sae={sae_encoder_path}, "
            f"port={port}, device={device})"
        )

    def load_sae_encoder(self) -> None:
        """
        Load Sparse Autoencoder (SAE) weights from disk.

        SAE Architecture:
        - Input: Layer 12 activations from base model (4096 dims)
        - Encoder: Linear(4096 → 32768) + ReLU + k-sparse constraint
        - Decoder: Linear(32768 → 4096)
        - Loss: L_recon + β × L_sparsity

        Training Details:
        - Dataset: LMSYS-Chat-1M (diverse chat interactions)
        - Sparsity: k-sparse constraint (top-k=64 features active)
        - Expansion: 8x (4096 → 32768)
        - Layer: 12 (middle layer encodes semantic features)

        Implementation (Week 2):
        ```python
        import torch
        self.sae_encoder = torch.load(self.sae_encoder_path, map_location=self.device)
        self.sae_encoder.eval()
        logger.info(f"SAE encoder loaded: {self.sae_encoder_path}")
        ```

        Raises:
            FileNotFoundError: If SAE weights file doesn't exist
            RuntimeError: If weights are incompatible with config

        Note:
            This is a Week 1 stub. Actual loading will be implemented in Week 2.
        """
        if self.sae_encoder_path is None:
            logger.warning("SAE encoder path not specified, using mock encoder")
            return

        # Week 2 TODO: Load actual SAE weights
        # self.sae_encoder = torch.load(...)
        logger.info(f"[STUB] SAE encoder would be loaded from: {self.sae_encoder_path}")

    def load_classifiers(self) -> None:
        """
        Load trained PII classifiers for token-level classification.

        Classifier Architecture:
        - Input: 32,768-dim SAE latent per token
        - Output: 5-class probabilities (personal_name, address, phone, email, none)

        Classifier Types:
        1. Logistic Regression: Fast, interpretable (sklearn)
        2. Random Forest: Better generalization (n_estimators=100)
        3. XGBoost: Best accuracy (n_estimators=100, learning_rate=0.1)

        Ensemble Strategy:
        - Use weighted voting or stacking for final prediction
        - XGBoost gets highest weight (0.5), RF (0.3), LR (0.2)

        Training Data (Week 2):
        - 10,000+ synthetic examples per category (GPT-4 generated)
        - 1,000+ real examples (manually annotated)
        - Train/val/test split: 70/15/15

        Implementation (Week 2):
        ```python
        import joblib
        self.classifiers = {
            'en': {
                'logistic': joblib.load(f"{self.classifiers_path}/lr_en.pkl"),
                'random_forest': joblib.load(f"{self.classifiers_path}/rf_en.pkl"),
                'xgboost': joblib.load(f"{self.classifiers_path}/xgb_en.pkl")
            },
            'ja': {...},  # Japanese classifiers
            'es': {...},  # Spanish classifiers
            # ... other languages
        }
        ```

        Raises:
            FileNotFoundError: If classifier files don't exist
            ValueError: If classifier format is invalid

        Note:
            This is a Week 1 stub. Actual loading will be implemented in Week 2.
        """
        if self.classifiers_path is None:
            logger.warning("Classifiers path not specified, using mock classifiers")
            return

        # Week 2 TODO: Load actual trained classifiers
        # self.classifiers = joblib.load(...)
        logger.info(f"[STUB] Classifiers would be loaded from: {self.classifiers_path}")

    def tokenize_and_chunk(
        self,
        text: str,
        max_tokens: int = 128,
        overlap: int = 32
    ) -> List[Tuple[List[int], int, int]]:
        """
        Split text into overlapping chunks for context-aware PII detection.

        Chunking Strategy:
        - Max chunk size: 128 tokens (fits in transformer context)
        - Overlap: 32 tokens (preserve context at boundaries)
        - Sliding window approach

        Why Chunking?
        - Long texts exceed transformer max length (2048+ tokens)
        - Overlapping chunks ensure PII at boundaries is detected
        - 128 tokens ≈ 100 words ≈ 2-3 sentences (sufficient context)

        Example:
            Input: "My name is John Smith and I live at 123 Main Street, New York..."
            Chunks (with overlap):
            1. "My name is John Smith and I live at 123 Main..." (tokens 0-127)
            2. "...John Smith and I live at 123 Main Street, New..." (tokens 96-223)
            3. "...I live at 123 Main Street, New York, NY..." (tokens 192-319)

        Args:
            text: Input text to chunk
            max_tokens: Maximum tokens per chunk (default: 128)
            overlap: Overlapping tokens between chunks (default: 32)

        Returns:
            List of (token_ids, start_char, end_char) tuples
            - token_ids: List of token IDs for the chunk
            - start_char: Start character index in original text
            - end_char: End character index in original text

        Implementation (Week 2):
        ```python
        tokens = self.tokenizer.encode(text, return_offsets_mapping=True)
        chunks = []
        for i in range(0, len(tokens), max_tokens - overlap):
            chunk_tokens = tokens[i:i + max_tokens]
            start_char = tokens[i]['offset'][0]
            end_char = tokens[min(i + max_tokens, len(tokens)) - 1]['offset'][1]
            chunks.append((chunk_tokens, start_char, end_char))
        return chunks
        ```

        Note:
            This is a Week 1 stub. Actual tokenization will be implemented in Week 2.
        """
        if not text or not text.strip():
            return []

        # Week 2 TODO: Implement actual tokenization with sliding window
        # For now, return mock chunks
        logger.debug(f"[STUB] Would tokenize text into {max_tokens}-token chunks with {overlap} overlap")
        return []

    def classify_chunk(
        self,
        token_ids: List[int],
        language: str = "en"
    ) -> List[Tuple[str, int, int, float]]:
        """
        Classify PII in a single text chunk.

        Process:
        1. Forward pass through base model to Layer 12
        2. Extract activations: h_L12 ∈ R^(seq_len × 4096)
        3. Encode with SAE: z = SAE(h_L12) ∈ R^(seq_len × 32768)
        4. Classify each token: y_i = Classifier(z_i) → (category, confidence)
        5. Merge consecutive tokens into spans

        Token-level Classification:
        - Each token gets 5-class probability distribution
        - Threshold: confidence ≥ 0.8 for PII detection
        - IOB tagging: B-category (begin), I-category (inside), O (outside)

        Span Merging:
        - Consecutive "I-category" tokens → single PII span
        - Handle partial overlaps at chunk boundaries
        - Prefer higher-confidence predictions

        Args:
            token_ids: List of token IDs for the chunk
            language: Language code for classifier selection (default: "en")

        Returns:
            List of (category, start_token_idx, end_token_idx, confidence) tuples

        Example:
            Input: [128, 1577, 318, 1757, 4176, 379, ...]
                   # "My name is John Smith at john@example.com"
            Output: [
                ("personal_name", 3, 5, 0.98),    # "John Smith"
                ("email", 6, 7, 0.99)              # "john@example.com"
            ]

        Implementation (Week 2):
        ```python
        # 1. Forward pass to Layer 12
        with torch.no_grad():
            outputs = self.base_model(
                input_ids=token_ids,
                output_hidden_states=True
            )
            h_l12 = outputs.hidden_states[self.config.target_layer]

        # 2. SAE encoding
        z = self.sae_encoder.encode(h_l12)  # (seq_len, 32768)

        # 3. Token-level classification
        classifiers = self.classifiers[language]
        predictions = []
        for i, z_i in enumerate(z):
            probs = classifiers['xgboost'].predict_proba(z_i.unsqueeze(0))
            category_idx = probs.argmax()
            confidence = probs[0, category_idx]
            if confidence >= 0.8 and category_idx < 4:  # Not "none"
                category = self.PII_CATEGORIES[category_idx]
                predictions.append((category, i, confidence))

        # 4. Merge into spans
        spans = self._merge_tokens_into_spans(predictions)
        return spans
        ```

        Note:
            This is a Week 1 stub. Actual classification will be implemented in Week 2.
        """
        if not token_ids:
            return []

        # Week 2 TODO: Implement actual SAE encoding + classification
        logger.debug(f"[STUB] Would classify {len(token_ids)} tokens for language '{language}'")
        return []

    def detect_pii(
        self,
        text: str,
        language: str = "en",
        confidence_threshold: float = 0.8
    ) -> List[PIISpan]:
        """
        Detect all PII in text using SAE probes.

        High-level Process:
        1. Validate input (max 10K characters)
        2. Detect language (if not specified)
        3. Tokenize & chunk (128 tokens, 32 overlap)
        4. Classify each chunk (SAE encoding + lightweight classifiers)
        5. Merge overlapping detections from chunks
        6. Filter by confidence threshold
        7. Return final PII spans

        Performance:
        - F1 Score: 96% (validated by Rakuten)
        - Latency: <100ms per request (target)
        - Cost: 10-500x cheaper than GPT-4 Mini/Claude Opus

        Args:
            text: Input text to scan for PII
            language: Language code ("en", "ja", "es", "fr", "de")
            confidence_threshold: Minimum confidence for PII detection (default: 0.8)

        Returns:
            List of PIISpan objects with detected PII

        Raises:
            ValueError: If text is empty or exceeds max length
            RuntimeError: If SAE encoder or classifiers are not loaded

        Example:
            >>> text = "Contact John Smith at john@example.com or call 555-1234"
            >>> pii_spans = detector.detect_pii(text)
            >>> for span in pii_spans:
            ...     print(f"{span.category}: {span.text} (confidence: {span.confidence:.2f})")
            personal_name: John Smith (confidence: 0.98)
            email: john@example.com (confidence: 0.99)
            phone: 555-1234 (confidence: 0.95)

        Implementation (Week 2):
        ```python
        start_time = time.time()

        # 1. Validate input
        if len(text) > 10_000:
            raise ValueError("Text too long (max 10K characters)")

        # 2. Detect language (if auto)
        if language == "auto":
            language = self._detect_language(text)

        # 3. Tokenize & chunk
        chunks = self.tokenize_and_chunk(text, max_tokens=128, overlap=32)

        # 4. Classify each chunk
        all_detections = []
        for chunk_tokens, start_char, end_char in chunks:
            chunk_detections = self.classify_chunk(chunk_tokens, language)
            # Convert token indices to character indices
            for category, start_tok, end_tok, conf in chunk_detections:
                actual_start = start_char + start_tok  # Simplified
                actual_end = start_char + end_tok
                all_detections.append((category, actual_start, actual_end, conf))

        # 5. Merge overlapping detections
        merged_detections = self._merge_overlapping_spans(all_detections)

        # 6. Filter by confidence
        filtered_detections = [
            d for d in merged_detections if d[3] >= confidence_threshold
        ]

        # 7. Create PIISpan objects
        pii_spans = [
            PIISpan(
                category=category,
                start_char=start,
                end_char=end,
                confidence=conf,
                text=text[start:end],
                metadata={
                    "language": language,
                    "processing_time_ms": (time.time() - start_time) * 1000
                }
            )
            for category, start, end, conf in filtered_detections
        ]

        # Update metrics
        self.total_requests += 1
        self.total_pii_detected += len(pii_spans)
        latency_ms = (time.time() - start_time) * 1000
        self.avg_latency_ms = (
            (self.avg_latency_ms * (self.total_requests - 1) + latency_ms)
            / self.total_requests
        )

        logger.info(
            f"PII detection complete: {len(pii_spans)} spans found "
            f"(latency: {latency_ms:.1f}ms, language: {language})"
        )

        return pii_spans
        ```

        Note:
            This is a Week 1 stub. Actual detection will be implemented in Week 2.
        """
        start_time = time.time()

        # Validate input
        if not text or not text.strip():
            return []

        if len(text) > 10_000:
            raise ValueError("Text too long (max 10,000 characters)")

        # Week 2 TODO: Implement actual PII detection pipeline
        logger.info(f"[STUB] Would detect PII in {len(text)} chars (language: {language})")

        # Return empty list for now
        return []

    def redact_pii(
        self,
        text: str,
        pii_spans: Optional[List[PIISpan]] = None,
        replacement: str = "[REDACTED]",
        language: str = "en"
    ) -> str:
        """
        Redact detected PII from text.

        Redaction Strategy:
        - Replace each PII span with replacement token
        - Preserve text structure (length may change)
        - Process spans from end to start (preserve earlier indices)

        Category-Specific Redaction (Optional):
        - personal_name → "[NAME_REDACTED]"
        - email → "[EMAIL_REDACTED]"
        - phone → "[PHONE_REDACTED]"
        - address → "[ADDRESS_REDACTED]"

        Args:
            text: Original text with PII
            pii_spans: List of detected PII spans (if None, detect automatically)
            replacement: Replacement string (default: "[REDACTED]")
            language: Language for detection if pii_spans not provided

        Returns:
            Redacted text with PII replaced

        Example:
            >>> text = "Contact John Smith at john@example.com or 555-1234"
            >>> redacted = detector.redact_pii(text)
            >>> print(redacted)
            "Contact [REDACTED] at [REDACTED] or [REDACTED]"

        Implementation (Week 2):
        ```python
        # Auto-detect if spans not provided
        if pii_spans is None:
            pii_spans = self.detect_pii(text, language=language)

        if not pii_spans:
            return text

        # Sort spans by start position (reverse order for safe replacement)
        sorted_spans = sorted(pii_spans, key=lambda s: s.start_char, reverse=True)

        redacted_text = text
        for span in sorted_spans:
            # Replace from end to start (preserves earlier indices)
            redacted_text = (
                redacted_text[:span.start_char] +
                replacement +
                redacted_text[span.end_char:]
            )

        logger.info(f"Redacted {len(pii_spans)} PII spans from text")
        return redacted_text
        ```

        Note:
            This is a Week 1 stub. Actual redaction will be implemented in Week 2.
        """
        if pii_spans is None:
            pii_spans = self.detect_pii(text, language=language)

        if not pii_spans:
            return text

        # Week 2 TODO: Implement actual redaction
        logger.info(f"[STUB] Would redact {len(pii_spans)} PII spans from text")
        return text

    def _detect_language(self, text: str) -> str:
        """
        Detect language of input text.

        Uses: langdetect or FastText language identification

        Supported Languages:
        - en: English
        - ja: Japanese
        - es: Spanish
        - fr: French
        - de: German

        Implementation (Week 2):
        ```python
        import langdetect
        try:
            lang = langdetect.detect(text)
            if lang in ['en', 'ja', 'es', 'fr', 'de']:
                return lang
            return 'en'  # Default to English
        except Exception:
            return 'en'
        ```

        Note:
            This is a Week 1 stub.
        """
        logger.debug("[STUB] Language detection would run here")
        return "en"

    def _merge_overlapping_spans(
        self,
        detections: List[Tuple[str, int, int, float]]
    ) -> List[Tuple[str, int, int, float]]:
        """
        Merge overlapping PII detections from multiple chunks.

        Merging Strategy:
        - If two spans overlap by >50%, merge them
        - Keep higher confidence prediction
        - Extend span boundaries to cover both

        Implementation (Week 2):
        ```python
        if not detections:
            return []

        sorted_detections = sorted(detections, key=lambda x: x[1])  # Sort by start
        merged = [sorted_detections[0]]

        for current in sorted_detections[1:]:
            last = merged[-1]
            overlap = min(last[2], current[2]) - max(last[1], current[1])
            overlap_ratio = overlap / (current[2] - current[1])

            if overlap_ratio > 0.5 and last[0] == current[0]:
                # Merge: extend span, keep higher confidence
                new_start = min(last[1], current[1])
                new_end = max(last[2], current[2])
                new_conf = max(last[3], current[3])
                merged[-1] = (last[0], new_start, new_end, new_conf)
            else:
                merged.append(current)

        return merged
        ```

        Note:
            This is a Week 1 stub.
        """
        logger.debug(f"[STUB] Would merge {len(detections)} overlapping detections")
        return detections

    def get_metrics(self) -> Dict[str, Any]:
        """
        Get performance metrics for monitoring.

        Metrics:
        - total_requests: Total PII detection requests processed
        - total_pii_detected: Total PII spans detected across all requests
        - avg_latency_ms: Average latency per request (milliseconds)
        - model_version: Current model version

        Returns:
            Dictionary of performance metrics
        """
        return {
            "total_requests": self.total_requests,
            "total_pii_detected": self.total_pii_detected,
            "avg_latency_ms": self.avg_latency_ms,
            "model_version": "1.0-stub",
            "device": self.device,
            "port": self.port
        }


# Factory function
def get_sae_pii_detector(
    model_path: Optional[str] = None,
    sae_encoder_path: Optional[str] = None,
    classifiers_path: Optional[str] = None,
    port: int = 8003,
    device: str = "cpu"
) -> SAEPIIDetector:
    """
    Factory function to create SAE PII Detector.

    Args:
        model_path: Path to base model
        sae_encoder_path: Path to SAE weights
        classifiers_path: Path to classifiers
        port: API port (default: 8003)
        device: Inference device (default: "cpu")

    Returns:
        Configured SAEPIIDetector instance
    """
    detector = SAEPIIDetector(
        model_path=model_path,
        sae_encoder_path=sae_encoder_path,
        classifiers_path=classifiers_path,
        port=port,
        device=device
    )
    return detector


__all__ = [
    "SAEPIIDetector",
    "PIISpan",
    "SAEEncoderConfig",
    "get_sae_pii_detector"
]
