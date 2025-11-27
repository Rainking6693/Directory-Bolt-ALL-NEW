"""
Hallucination control utilities.

Currently exposes the Binary RAR verifier that performs BM25 retrieval +
binary reward verification inspired by the rl-binary-rar research pipeline.
"""

from .binary_rar import BinaryRARVerifier

__all__ = ["BinaryRARVerifier"]
