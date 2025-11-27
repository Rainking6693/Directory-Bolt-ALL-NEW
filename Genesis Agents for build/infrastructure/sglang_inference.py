"""
SGLang Multi-Token Prediction (MTP) Inference Engine
Implements speculative decoding with EAGLE algorithm for 2-4x throughput improvement.

Based on:
- SGLang PR #11652: DeepSeek-V3.2 EAGLE algorithm
- EAGLE speculative decoding: arXiv:2401.15077
- SGLang documentation: https://docs.sglang.ai/

Author: Genesis AI System
Date: October 28, 2025
"""

import asyncio
import logging
import subprocess
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
import requests
import signal
import os

logger = logging.getLogger(__name__)


class SpeculativeAlgorithm(Enum):
    """Supported speculative decoding algorithms."""
    EAGLE = "EAGLE"        # EAGLE-2 (standard)
    EAGLE3 = "EAGLE3"      # EAGLE-3 (latest)
    MEDUSA = "MEDUSA"      # Medusa decoding


@dataclass
class MTPConfig:
    """Configuration for Multi-Token Prediction speculative decoding."""

    # Speculative decoding algorithm
    algorithm: SpeculativeAlgorithm = SpeculativeAlgorithm.EAGLE

    # Draft model path (required for EAGLE)
    draft_model_path: Optional[str] = None

    # Number of speculative steps (depth of autoregressive drafting)
    # Higher = more speculation but higher rejection risk
    # DeepSeek-V3.2 uses 3, Llama uses 5
    num_steps: int = 3

    # Branching factor per step (EAGLE topk)
    # Higher = better diversity but more compute
    # DeepSeek-V3.2 uses 1, Llama uses 4-8
    eagle_topk: int = 1

    # Maximum parallel verification capacity
    # Higher = deeper tree evaluation but more GPU memory
    # DeepSeek-V3.2 uses 4, Llama uses 16-64
    num_draft_tokens: int = 4

    # Token frequency map for EAGLE-2 optimization (optional)
    token_map_path: Optional[str] = None

    # Accept threshold for single token
    accept_threshold_single: float = 1.0

    # Accept threshold for accumulated probability
    accept_threshold_acc: float = 1.0

    # CUDA graph optimization
    enable_cuda_graph: bool = True
    cuda_graph_max_bs: int = 32

    # Torch compile optimization
    enable_torch_compile: bool = False
    torch_compile_max_bs: int = 2

    # Memory configuration
    mem_fraction: float = 0.7

    # Data type
    dtype: str = "float16"


@dataclass
class ServerConfig:
    """Configuration for SGLang server."""

    # Model configuration
    model_path: str
    host: str = "0.0.0.0"
    port: int = 30000

    # Trust remote code for custom models
    trust_remote_code: bool = True

    # Parallelism configuration
    tp_size: int = 1  # Tensor parallelism
    dp_size: int = 1  # Data parallelism

    # Context length
    context_length: Optional[int] = None

    # Multi-Token Prediction config
    mtp_config: Optional[MTPConfig] = None

    # Additional server arguments
    extra_args: Dict[str, Any] = None


@dataclass
class InferenceResponse:
    """Response from SGLang inference."""

    # Generated text
    text: str

    # Token IDs
    token_ids: List[int]

    # Timing metrics
    latency_ms: float
    tokens_per_second: float

    # Speculative decoding metrics
    num_accepted_tokens: int = 0
    num_rejected_tokens: int = 0
    acceptance_rate: float = 0.0

    # Additional metadata
    metadata: Dict[str, Any] = None


@dataclass
class ThroughputMetrics:
    """Throughput benchmark metrics."""

    # Throughput
    tokens_per_second: float
    requests_per_second: float

    # Latency percentiles (ms)
    latency_p50: float
    latency_p95: float
    latency_p99: float
    latency_mean: float

    # Speculative decoding performance
    avg_acceptance_rate: float
    speedup_vs_baseline: float

    # Resource utilization
    gpu_memory_used_gb: float
    gpu_utilization_percent: float

    # Test configuration
    num_requests: int
    batch_size: int
    warmup_requests: int


class SGLangServer:
    """Manages SGLang server lifecycle."""

    def __init__(self, config: ServerConfig):
        self.config = config
        self.process: Optional[subprocess.Popen] = None
        self.base_url = f"http://{config.host}:{config.port}"

    def _build_launch_command(self) -> List[str]:
        """Build server launch command with all parameters."""
        cmd = [
            "python3", "-m", "sglang.launch_server",
            "--model-path", self.config.model_path,
            "--host", self.config.host,
            "--port", str(self.config.port),
        ]

        if self.config.trust_remote_code:
            cmd.append("--trust-remote-code")

        if self.config.tp_size > 1:
            cmd.extend(["--tp-size", str(self.config.tp_size)])

        if self.config.dp_size > 1:
            cmd.extend(["--dp-size", str(self.config.dp_size)])

        if self.config.context_length:
            cmd.extend(["--context-length", str(self.config.context_length)])

        # MTP/Speculative decoding configuration
        if self.config.mtp_config:
            mtp = self.config.mtp_config

            cmd.extend([
                "--speculative-algorithm", mtp.algorithm.value,
                "--speculative-num-steps", str(mtp.num_steps),
                "--speculative-eagle-topk", str(mtp.eagle_topk),
                "--speculative-num-draft-tokens", str(mtp.num_draft_tokens),
                "--mem-fraction", str(mtp.mem_fraction),
                "--dtype", mtp.dtype,
            ])

            if mtp.draft_model_path:
                cmd.extend(["--speculative-draft-model-path", mtp.draft_model_path])

            if mtp.token_map_path:
                cmd.extend(["--speculative-token-map", mtp.token_map_path])

            if mtp.accept_threshold_single != 1.0:
                cmd.extend(["--speculative-accept-threshold-single", str(mtp.accept_threshold_single)])

            if mtp.accept_threshold_acc != 1.0:
                cmd.extend(["--speculative-accept-threshold-acc", str(mtp.accept_threshold_acc)])

            if mtp.enable_cuda_graph:
                cmd.extend(["--cuda-graph-max-bs", str(mtp.cuda_graph_max_bs)])

            if mtp.enable_torch_compile:
                cmd.extend([
                    "--enable-torch-compile",
                    "--torch-compile-max-bs", str(mtp.torch_compile_max_bs)
                ])

        # Extra arguments
        if self.config.extra_args:
            for key, value in self.config.extra_args.items():
                if isinstance(value, bool):
                    if value:
                        cmd.append(f"--{key}")
                else:
                    cmd.extend([f"--{key}", str(value)])

        return cmd

    def start(self, timeout: int = 300) -> bool:
        """
        Start SGLang server.

        Args:
            timeout: Maximum seconds to wait for server readiness

        Returns:
            True if server started successfully
        """
        try:
            cmd = self._build_launch_command()
            logger.info(f"Starting SGLang server: {' '.join(cmd)}")

            # Start server process
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            # Wait for server to be ready
            start_time = time.time()
            while time.time() - start_time < timeout:
                if self.is_ready():
                    logger.info(f"SGLang server ready at {self.base_url}")
                    return True
                time.sleep(2)

            logger.error(f"SGLang server failed to start within {timeout}s")
            self.stop()
            return False

        except Exception as e:
            logger.error(f"Failed to start SGLang server: {e}")
            return False

    def is_ready(self) -> bool:
        """Check if server is ready to accept requests."""
        try:
            response = requests.get(
                f"{self.base_url}/health",
                timeout=2
            )
            return response.status_code == 200
        except:
            return False

    def stop(self):
        """Stop SGLang server."""
        if self.process:
            logger.info("Stopping SGLang server")
            self.process.send_signal(signal.SIGTERM)
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()
            self.process = None


class SGLangInference:
    """
    SGLang inference engine with Multi-Token Prediction support.

    Features:
    - EAGLE/EAGLE3 speculative decoding
    - CUDA graph optimization
    - Batch inference
    - Throughput benchmarking
    """

    def __init__(
        self,
        model_name: str,
        enable_mtp: bool = True,
        mtp_config: Optional[MTPConfig] = None,
        server_config: Optional[ServerConfig] = None
    ):
        """
        Initialize SGLang inference engine.

        Args:
            model_name: HuggingFace model path or name
            enable_mtp: Enable Multi-Token Prediction
            mtp_config: Custom MTP configuration
            server_config: Custom server configuration
        """
        self.model_name = model_name
        self.enable_mtp = enable_mtp

        # Default MTP config for DeepSeek-V3.2 (optimized from PR #11652)
        if enable_mtp and mtp_config is None:
            mtp_config = MTPConfig(
                algorithm=SpeculativeAlgorithm.EAGLE,
                num_steps=3,
                eagle_topk=1,
                num_draft_tokens=4,
                enable_cuda_graph=True,
                cuda_graph_max_bs=32
            )

        # Server configuration
        if server_config is None:
            server_config = ServerConfig(
                model_path=model_name,
                mtp_config=mtp_config if enable_mtp else None
            )

        self.server = SGLangServer(server_config)
        self.base_url = self.server.base_url

    def initialize(self, timeout: int = 300) -> bool:
        """
        Initialize and start SGLang server.

        Args:
            timeout: Maximum seconds to wait for server startup

        Returns:
            True if initialization successful
        """
        return self.server.start(timeout=timeout)

    def speculative_decode(
        self,
        prompt: str,
        max_tokens: int = 512,
        temperature: float = 0.0,
        num_steps: Optional[int] = None
    ) -> InferenceResponse:
        """
        Perform speculative decoding with EAGLE algorithm.

        Args:
            prompt: Input text prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0.0 = greedy)
            num_steps: Override speculative steps (optional)

        Returns:
            InferenceResponse with generated text and metrics
        """
        start_time = time.time()

        # Build request
        request_data = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        # Override num_steps if specified
        if num_steps is not None:
            request_data["speculative_num_steps"] = num_steps

        try:
            # Send request
            response = requests.post(
                f"{self.base_url}/v1/chat/completions",
                json=request_data,
                timeout=60
            )
            response.raise_for_status()

            result = response.json()

            # Extract response
            choice = result["choices"][0]
            text = choice["message"]["content"]

            # Calculate metrics
            latency_ms = (time.time() - start_time) * 1000

            # Extract usage if available
            usage = result.get("usage", {})
            completion_tokens = usage.get("completion_tokens", len(text.split()))
            tokens_per_second = (completion_tokens / latency_ms) * 1000 if latency_ms > 0 else 0

            # Extract speculative decoding metrics if available
            spec_metrics = result.get("speculative_metrics", {})

            return InferenceResponse(
                text=text,
                token_ids=[],  # Not available in API response
                latency_ms=latency_ms,
                tokens_per_second=tokens_per_second,
                num_accepted_tokens=spec_metrics.get("accepted_tokens", 0),
                num_rejected_tokens=spec_metrics.get("rejected_tokens", 0),
                acceptance_rate=spec_metrics.get("acceptance_rate", 0.0),
                metadata={
                    "usage": usage,
                    "finish_reason": choice.get("finish_reason"),
                }
            )

        except Exception as e:
            logger.error(f"Speculative decoding failed: {e}")
            raise

    async def batch_inference(
        self,
        prompts: List[str],
        batch_size: int = 32,
        max_tokens: int = 512,
        temperature: float = 0.0
    ) -> List[InferenceResponse]:
        """
        Perform batch inference with automatic batching.

        Args:
            prompts: List of input prompts
            batch_size: Maximum batch size
            max_tokens: Maximum tokens per generation
            temperature: Sampling temperature

        Returns:
            List of InferenceResponse objects
        """
        results = []

        # Process in batches
        for i in range(0, len(prompts), batch_size):
            batch = prompts[i:i + batch_size]

            # Create async tasks for batch
            tasks = [
                asyncio.create_task(
                    asyncio.to_thread(
                        self.speculative_decode,
                        prompt,
                        max_tokens=max_tokens,
                        temperature=temperature
                    )
                )
                for prompt in batch
            ]

            # Wait for batch completion
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)

        return results

    def benchmark_throughput(
        self,
        prompts: List[str],
        batch_size: int = 1,
        warmup: int = 10,
        max_tokens: int = 512
    ) -> ThroughputMetrics:
        """
        Benchmark throughput and latency.

        Args:
            prompts: Test prompts
            batch_size: Batch size for inference
            warmup: Number of warmup requests
            max_tokens: Maximum tokens to generate

        Returns:
            ThroughputMetrics with detailed performance data
        """
        logger.info(f"Starting throughput benchmark: {len(prompts)} prompts, batch_size={batch_size}")

        # Warmup
        logger.info(f"Warmup: {warmup} requests")
        warmup_prompts = prompts[:warmup]
        asyncio.run(self.batch_inference(warmup_prompts, batch_size=batch_size, max_tokens=max_tokens))

        # Benchmark
        start_time = time.time()
        results = asyncio.run(self.batch_inference(prompts, batch_size=batch_size, max_tokens=max_tokens))
        total_time = time.time() - start_time

        # Calculate metrics
        latencies = [r.latency_ms for r in results]
        latencies.sort()

        total_tokens = sum(len(r.text.split()) for r in results)
        tokens_per_second = total_tokens / total_time if total_time > 0 else 0
        requests_per_second = len(prompts) / total_time if total_time > 0 else 0

        # Latency percentiles
        def percentile(data, p):
            idx = int(len(data) * p / 100)
            return data[min(idx, len(data) - 1)]

        latency_p50 = percentile(latencies, 50)
        latency_p95 = percentile(latencies, 95)
        latency_p99 = percentile(latencies, 99)
        latency_mean = sum(latencies) / len(latencies)

        # Speculative decoding metrics
        acceptance_rates = [r.acceptance_rate for r in results if r.acceptance_rate > 0]
        avg_acceptance_rate = sum(acceptance_rates) / len(acceptance_rates) if acceptance_rates else 0.0

        return ThroughputMetrics(
            tokens_per_second=tokens_per_second,
            requests_per_second=requests_per_second,
            latency_p50=latency_p50,
            latency_p95=latency_p95,
            latency_p99=latency_p99,
            latency_mean=latency_mean,
            avg_acceptance_rate=avg_acceptance_rate,
            speedup_vs_baseline=0.0,  # Calculated externally
            gpu_memory_used_gb=0.0,   # Requires GPU monitoring
            gpu_utilization_percent=0.0,
            num_requests=len(prompts),
            batch_size=batch_size,
            warmup_requests=warmup
        )

    def shutdown(self):
        """Shutdown inference engine and server."""
        logger.info("Shutting down SGLang inference engine")
        self.server.stop()


# Factory functions for common configurations

def create_deepseek_v3_inference(
    model_path: str = "deepseek-ai/DeepSeek-V3-0324",
    tp_size: int = 8,
    enable_mtp: bool = True
) -> SGLangInference:
    """
    Create SGLang inference for DeepSeek-V3 with optimal MTP settings.

    Based on PR #11652 configuration.
    """
    mtp_config = MTPConfig(
        algorithm=SpeculativeAlgorithm.EAGLE,
        num_steps=1,  # DeepSeek uses 1 step
        eagle_topk=1,
        num_draft_tokens=2,
        enable_cuda_graph=True,
        cuda_graph_max_bs=32
    ) if enable_mtp else None

    server_config = ServerConfig(
        model_path=model_path,
        tp_size=tp_size,
        trust_remote_code=True,
        mtp_config=mtp_config
    )

    return SGLangInference(
        model_name=model_path,
        enable_mtp=enable_mtp,
        server_config=server_config
    )


def create_llama_inference(
    model_path: str = "meta-llama/Llama-3.1-8B-Instruct",
    draft_model_path: str = "jamesliu1/sglang-EAGLE3-Llama-3.1-Instruct-8B",
    enable_eagle3: bool = True
) -> SGLangInference:
    """
    Create SGLang inference for Llama with EAGLE3 speculative decoding.
    """
    mtp_config = MTPConfig(
        algorithm=SpeculativeAlgorithm.EAGLE3 if enable_eagle3 else SpeculativeAlgorithm.EAGLE,
        draft_model_path=draft_model_path,
        num_steps=5,
        eagle_topk=8,
        num_draft_tokens=32,
        mem_fraction=0.6,
        enable_cuda_graph=True,
        cuda_graph_max_bs=2
    )

    server_config = ServerConfig(
        model_path=model_path,
        mtp_config=mtp_config
    )

    return SGLangInference(
        model_name=model_path,
        enable_mtp=True,
        server_config=server_config
    )
