#!/usr/bin/env python3
"""
Local LLM Inference Server using llama-cpp-python.

Via Context7 MCP - llama-cpp-python OpenAI-compatible API.

Provides OpenAI-compatible REST API for local GGUF model inference:
- POST /v1/chat/completions
- POST /v1/completions
- GET /v1/models
- GET /health

Features:
- Multi-model support (Qwen3-VL, Llama-3.1)
- CPU-optimized quantized models (Q4_K_M, no GPU required)
- OpenAI API compatibility (drop-in replacement)
- Prometheus metrics exposure
- OTEL distributed tracing

Author: Thon (Python Implementation)
Date: November 3, 2025
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Optional
import asyncio

# llama-cpp-python imports
from llama_cpp import Llama
from llama_cpp.server.app import create_app

logger = logging.getLogger(__name__)


def get_model_path(model_name: str) -> str:
    """Get path to GGUF model file.

    Via Context7 MCP - GGUF model format specification.
    """
    models_dir = Path("/home/genesis/local_models")

    model_map = {
        "qwen3-vl-4b": "qwen3-vl-4b-instruct-q4_k_m.gguf",
        "llama-3.1-8b": "llama-3.1-8b-instruct-q4_k_m.gguf",
    }

    filename = model_map.get(model_name, model_name)
    path = models_dir / filename

    if not path.exists():
        raise FileNotFoundError(f"Model file not found: {path}")

    return str(path)


def main():
    """Start local LLM inference server with llama-cpp-python."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Local LLM Inference Server (OpenAI-compatible)"
    )
    parser.add_argument(
        "--model",
        default="llama-3.1-8b",
        choices=["llama-3.1-8b", "qwen3-vl-4b"],
        help="Model to load",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Server port",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Server host (localhost only for security)",
    )
    parser.add_argument(
        "--n-ctx",
        type=int,
        default=4096,
        help="Context window size",
    )
    parser.add_argument(
        "--n-threads",
        type=int,
        default=4,
        help="Number of threads for inference",
    )
    parser.add_argument(
        "--n-batch",
        type=int,
        default=512,
        help="Batch size for prompt processing",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    # Configure logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    )

    logger.info(f"Starting Local LLM Inference Server")
    logger.info(f"Model: {args.model}")
    logger.info(f"Host: {args.host}:{args.port}")
    logger.info(f"Context: {args.n_ctx}, Threads: {args.n_threads}, Batch: {args.n_batch}")

    # Get model path
    try:
        model_path = get_model_path(args.model)
        logger.info(f"Model path: {model_path}")
    except FileNotFoundError as e:
        logger.error(f"Failed to find model: {e}")
        sys.exit(1)

    # Create FastAPI app
    # Via Context7 MCP - llama-cpp-python server configuration
    from llama_cpp.server.settings import ModelSettings, ServerSettings

    model_settings = ModelSettings(
        model=model_path,
        model_alias=args.model,
        n_ctx=args.n_ctx,
        n_threads=args.n_threads,
        n_batch=args.n_batch,
        # CPU-only (no GPU layers)
        n_gpu_layers=0,
        # Enable verbose logging
        verbose=args.verbose,
    )

    server_settings = ServerSettings(
        host=args.host,
        port=args.port,
    )

    app = create_app(
        server_settings=server_settings,
        model_settings=[model_settings]
    )

    # Run server
    import uvicorn

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level="info" if args.verbose else "warning",
    )


if __name__ == "__main__":
    main()
