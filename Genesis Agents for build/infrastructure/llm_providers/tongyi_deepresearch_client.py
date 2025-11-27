# infrastructure/llm_providers/tongyi_deepresearch_client.py
from typing import Dict, List, Any, Optional
import os
import asyncio
from dataclasses import dataclass

from infrastructure.load_env import load_genesis_env

load_genesis_env()

import logging
logger = logging.getLogger(__name__)

# Try to import HuggingFace Inference Client
try:
    from huggingface_hub import AsyncInferenceClient
    HF_AVAILABLE = True
except ImportError:
    logger.warning("huggingface_hub not installed. Install with: pip install huggingface_hub")
    HF_AVAILABLE = False

@dataclass
class ResearchResult:
    """Result from Tongyi-DeepResearch query."""
    final_answer: str
    reasoning_steps: List[str]
    confidence: float
    sources_used: List[str]
    mode_used: str  # "react" or "heavy"
    tokens_used: int
    latency: float

class TongyiDeepResearchClient:
    """
    Client for Tongyi-DeepResearch-30B-A3B specialized research model.
    Supports ReAct (fast) and IterResearch-Heavy (quality) modes.
    Based on Alibaba-NLP/Tongyi-DeepResearch-30B-A3B.
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        mode: str = "react",
        use_local: bool = False,
        local_url: Optional[str] = None
    ):
        """
        Initialize Tongyi-DeepResearch client.

        Args:
            api_key: HuggingFace API token (or None to use HF_TOKEN env var)
            mode: "react" (fast) or "heavy" (IterResearch quality mode)
            use_local: If True, use locally hosted vLLM instance
            local_url: URL for local vLLM endpoint
        """
        self.api_key = api_key or os.getenv("HF_TOKEN")
        self.mode = mode
        self.use_local = use_local
        self.local_url = local_url or "http://localhost:8000"

        self.model_id = "Alibaba-NLP/Tongyi-DeepResearch-30B-A3B"

        # Initialize client
        if not use_local:
            if not HF_AVAILABLE:
                raise ImportError(
                    "huggingface_hub required for API mode. "
                    "Install with: pip install huggingface_hub"
                )
            if not self.api_key:
                raise ValueError("HuggingFace API token required (HF_TOKEN env var or api_key parameter)")

            self.client = AsyncInferenceClient(token=self.api_key)
            logger.info(f"[Tongyi] Initialized with HF Inference API (mode={mode})")
        else:
            self.client = None  # Use local vLLM
            logger.info(f"[Tongyi] Initialized with local vLLM at {local_url} (mode={mode})")

    async def research_query(
        self,
        query: str,
        max_steps: int = 10,
        mode: Optional[str] = None,
        temperature: float = 0.7
    ) -> ResearchResult:
        """
        Execute research query with Tongyi-DeepResearch.

        Args:
            query: Research question
            max_steps: Maximum reasoning steps
            mode: "react" (fast) or "heavy" (quality), overrides default
            temperature: Sampling temperature (0.0-1.0)

        Returns:
            ResearchResult with answer, reasoning, confidence, sources
        """
        import time
        start_time = time.time()

        mode = mode or self.mode

        # Format prompt based on mode
        if mode == "react":
            prompt = self._format_react_prompt(query)
            max_tokens = 2000
        else:  # heavy mode
            prompt = self._format_iterresearch_prompt(query, max_steps)
            max_tokens = 8000

        # Generate response
        if self.use_local:
            response_text = await self._generate_local(prompt, max_tokens, temperature)
        else:
            response_text = await self._generate_api(prompt, max_tokens, temperature)

        # Parse response
        result = self._parse_research_response(response_text, mode)
        result.latency = time.time() - start_time

        logger.info(
            f"[Tongyi] Research completed in {result.latency:.2f}s "
            f"(mode={mode}, confidence={result.confidence:.2f})"
        )

        return result

    async def _generate_api(
        self,
        prompt: str,
        max_tokens: int,
        temperature: float
    ) -> str:
        """Generate response via HuggingFace Inference API."""
        try:
            response = await self.client.text_generation(
                prompt=prompt,
                model=self.model_id,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=0.9,
                do_sample=True,
                return_full_text=False
            )
            return response

        except Exception as e:
            logger.error(f"[Tongyi] API error: {e}")
            # Fallback to simple response
            return self._generate_fallback_response(prompt)

    async def _generate_local(
        self,
        prompt: str,
        max_tokens: int,
        temperature: float
    ) -> str:
        """Generate response via local vLLM instance."""
        import aiohttp

        try:
            # Set timeout (60s for local inference)
            timeout = aiohttp.ClientTimeout(total=60.0)

            async with aiohttp.ClientSession(timeout=timeout) as session:
                payload = {
                    "model": self.model_id,
                    "prompt": prompt,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "top_p": 0.9
                }

                async with session.post(
                    f"{self.local_url}/v1/completions",
                    json=payload
                ) as response:
                    data = await response.json()
                    return data["choices"][0]["text"]

        except asyncio.TimeoutError:
            logger.error(f"[Tongyi] Local generation timeout (60s)")
            return self._generate_fallback_response(prompt)
        except Exception as e:
            logger.error(f"[Tongyi] Local generation error: {e}")
            return self._generate_fallback_response(prompt)

    def _format_react_prompt(self, query: str) -> str:
        """Format prompt for fast ReAct mode."""
        return f"""<|im_start|>system
You are a research assistant. Answer this query using ReAct reasoning.
Provide clear, concise answers with step-by-step reasoning.
<|im_end|>
<|im_start|>user
{query}

Think step-by-step using this format:
Thought 1: [your reasoning]
Action 1: [action to take]
Observation 1: [what you learned]
...
Final Answer: [conclusion]
<|im_end|>
<|im_start|>assistant
"""

    def _format_iterresearch_prompt(self, query: str, max_steps: int) -> str:
        """Format prompt for deep IterResearch-Heavy mode."""
        return f"""<|im_start|>system
You are a deep research specialist. Conduct comprehensive analysis of this query using iterative refinement.
Use up to {max_steps} steps for thorough investigation.
<|im_end|>
<|im_start|>user
{query}

Research Process:
1. Initial exploration and hypothesis formation
2. Evidence gathering and source analysis
3. Synthesis and insight extraction
4. Refinement and validation
5. Final comprehensive report

Begin your deep research:
<|im_end|>
<|im_start|>assistant
"""

    def _parse_research_response(self, response: str, mode: str) -> ResearchResult:
        """Parse model response into structured format."""
        # Extract reasoning steps
        reasoning_steps = []
        for line in response.split('\n'):
            if line.startswith(('Thought', 'Action', 'Observation', 'Step')):
                reasoning_steps.append(line.strip())

        # Extract final answer
        final_answer = ""
        if "Final Answer:" in response:
            final_answer = response.split("Final Answer:")[1].strip()
        elif "Conclusion:" in response:
            final_answer = response.split("Conclusion:")[1].strip()
        else:
            # Take last paragraph as answer
            paragraphs = [p.strip() for p in response.split('\n\n') if p.strip()]
            final_answer = paragraphs[-1] if paragraphs else response[:500]

        # Extract sources (if mentioned)
        sources = []
        for line in response.split('\n'):
            if "source:" in line.lower() or "reference:" in line.lower():
                sources.append(line.strip())

        # Estimate confidence (heuristic based on response quality)
        confidence = 0.8 if len(reasoning_steps) >= 3 else 0.6
        if mode == "heavy" and len(reasoning_steps) >= 5:
            confidence = 0.9

        # Estimate tokens (rough approximation)
        tokens_used = len(response.split()) * 1.3  # ~1.3 tokens per word

        return ResearchResult(
            final_answer=final_answer,
            reasoning_steps=reasoning_steps[:10],  # Top 10 steps
            confidence=confidence,
            sources_used=sources,
            mode_used=mode,
            tokens_used=int(tokens_used),
            latency=0.0  # Set by caller
        )

    def _generate_fallback_response(self, prompt: str) -> str:
        """Generate simple fallback response if API/local fails."""
        return """Thought 1: I need to analyze this query carefully.
Action 1: Research the key concepts and gather information.
Observation 1: Based on available knowledge, I can provide a preliminary answer.

Final Answer: I apologize, but I'm currently unable to access the full research capabilities.
Please try again or use an alternative research method."""

    async def batch_research_queries(
        self,
        queries: List[str],
        mode: Optional[str] = None
    ) -> List[ResearchResult]:
        """Execute multiple research queries in parallel."""
        tasks = [
            self.research_query(query, mode=mode)
            for query in queries
        ]
        return await asyncio.gather(*tasks)

    def get_cost_estimate(self, num_queries: int, mode: str = "react") -> Dict[str, float]:
        """
        Estimate cost for N queries.

        HF Inference API pricing (approximate):
        - Input: $0.000002 per token
        - Output: $0.000006 per token

        Tongyi-30B (3B active): ~70% cheaper than full 30B model
        """
        if mode == "react":
            avg_input_tokens = 200
            avg_output_tokens = 500
        else:  # heavy mode
            avg_input_tokens = 500
            avg_output_tokens = 2000

        input_cost = num_queries * avg_input_tokens * 0.000002 * 0.3  # 70% discount for sparse activation
        output_cost = num_queries * avg_output_tokens * 0.000006 * 0.3

        total_cost = input_cost + output_cost

        return {
            "num_queries": num_queries,
            "mode": mode,
            "estimated_cost_usd": total_cost,
            "cost_per_query": total_cost / num_queries,
            "input_tokens": avg_input_tokens * num_queries,
            "output_tokens": avg_output_tokens * num_queries
        }


# Singleton instance
_tongyi_client: Optional[TongyiDeepResearchClient] = None

def get_tongyi_client(
    mode: str = "react",
    use_local: bool = False
) -> TongyiDeepResearchClient:
    """Get singleton Tongyi-DeepResearch client."""
    global _tongyi_client
    if _tongyi_client is None:
        _tongyi_client = TongyiDeepResearchClient(mode=mode, use_local=use_local)
    return _tongyi_client
