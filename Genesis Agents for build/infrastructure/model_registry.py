"""
Model Registry for Fine-Tuned Mistral Models

Central registry for all 5 fine-tuned models with fallback to baseline.
Integrates with HALO router and Genesis orchestrator.
"""

import logging
import os
from typing import Dict, Optional, List, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Try to import Mistral client
try:
    from mistralai import Mistral
    MISTRAL_AVAILABLE = True
except ImportError:
    MISTRAL_AVAILABLE = False
    logger.warning("mistralai package not installed. Install with: pip install mistralai")


@dataclass
class ModelConfig:
    """Configuration for a fine-tuned model"""
    fine_tuned_id: str
    fallback_id: str = "open-mistral-7b"
    max_tokens: int = 4096
    temperature: float = 0.7


class ModelRegistry:
    """
    Central registry for all fine-tuned models.
    
    Provides:
    - Model ID lookup for each agent
    - Chat interface to fine-tuned models
    - Fallback to baseline on failure
    - Model configuration management
    """
    
    # Fine-tuned model IDs (from EXECUTION_COMPLETE_SUMMARY.md)
    MODELS: Dict[str, ModelConfig] = {
        "qa_agent": ModelConfig(
            fine_tuned_id="ft:open-mistral-7b:5010731d:20251031:ecc3829c",
            fallback_id="open-mistral-7b",
            max_tokens=4096,
            temperature=0.7
        ),
        "content_agent": ModelConfig(
            fine_tuned_id="ft:open-mistral-7b:5010731d:20251031:547960f9",
            fallback_id="open-mistral-7b",
            max_tokens=4096,
            temperature=0.8
        ),
        "legal_agent": ModelConfig(
            fine_tuned_id="ft:open-mistral-7b:5010731d:20251031:eb2da6b7",
            fallback_id="open-mistral-7b",
            max_tokens=4096,
            temperature=0.6
        ),
        "support_agent": ModelConfig(
            fine_tuned_id="ft:open-mistral-7b:5010731d:20251031:f997bebc",
            fallback_id="open-mistral-7b",
            max_tokens=4096,
            temperature=0.7
        ),
        "analyst_agent": ModelConfig(
            fine_tuned_id="ft:open-mistral-7b:5010731d:20251031:9ae05c7c",
            fallback_id="open-mistral-7b",
            max_tokens=4096,
            temperature=0.7
        ),
    }
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize ModelRegistry
        
        Args:
            api_key: Mistral API key (defaults to MISTRAL_API_KEY env var)
        """
        if not MISTRAL_AVAILABLE:
            raise ImportError("mistralai package not installed. Install with: pip install mistralai")
        
        self.api_key = api_key or os.getenv("MISTRAL_API_KEY")
        if not self.api_key:
            raise ValueError("MISTRAL_API_KEY not set. Set environment variable or pass api_key")
        
        self.client = Mistral(api_key=self.api_key)
        logger.info("ModelRegistry initialized with Mistral client")
    
    def get_model(self, agent_name: str, use_finetuned: bool = True) -> str:
        """
        Get model ID for given agent
        
        Args:
            agent_name: Name of the agent (qa_agent, content_agent, etc.)
            use_finetuned: If True, return fine-tuned model; else return fallback
        
        Returns:
            Model ID string
        """
        config = self.MODELS.get(agent_name)
        if not config:
            logger.warning(f"Unknown agent '{agent_name}', using baseline model")
            return "open-mistral-7b"
        
        return config.fine_tuned_id if use_finetuned else config.fallback_id
    
    def get_config(self, agent_name: str) -> Optional[ModelConfig]:
        """Get model configuration for agent"""
        return self.MODELS.get(agent_name)
    
    def chat(
        self,
        agent_name: str,
        messages: List[Dict[str, str]],
        use_finetuned: bool = True,
        use_fallback: bool = True
    ) -> str:
        """
        Send chat request to fine-tuned model with fallback
        
        Args:
            agent_name: Name of the agent
            messages: List of message dicts with 'role' and 'content'
            use_finetuned: If True, try fine-tuned model first
            use_fallback: If True, fall back to baseline on failure
        
        Returns:
            Assistant response content
        
        Raises:
            Exception: If both fine-tuned and fallback models fail
        """
        config = self.MODELS.get(agent_name)
        if not config:
            raise ValueError(f"Unknown agent: {agent_name}")
        
        # Try fine-tuned model first if requested
        if use_finetuned:
            try:
                model_id = config.fine_tuned_id
                logger.debug(f"Using fine-tuned model for {agent_name}: {model_id}")
                
                response = self.client.chat.complete(
                    model=model_id,
                    messages=messages,
                    max_tokens=config.max_tokens,
                    temperature=config.temperature
                )
                return response.choices[0].message.content
            except Exception as e:
                logger.warning(
                    f"Fine-tuned model failed for {agent_name}, "
                    f"falling back to baseline: {e}"
                )
                if not use_fallback:
                    raise
        
        # Fallback to baseline
        if use_fallback:
            try:
                model_id = config.fallback_id
                logger.debug(f"Using fallback model for {agent_name}: {model_id}")
                
                response = self.client.chat.complete(
                    model=model_id,
                    messages=messages,
                    max_tokens=config.max_tokens,
                    temperature=config.temperature
                )
                return response.choices[0].message.content
            except Exception as e:
                logger.error(f"Both fine-tuned and fallback models failed for {agent_name}: {e}")
                raise
        
        raise RuntimeError(f"No model available for {agent_name}")
    
    async def chat_async(
        self,
        agent_name: str,
        messages: List[Dict[str, str]],
        use_finetuned: bool = True,
        use_fallback: bool = True
    ) -> str:
        """
        Async version of chat method
        
        Args:
            agent_name: Name of the agent
            messages: List of message dicts with 'role' and 'content'
            use_finetuned: If True, try fine-tuned model first
            use_fallback: If True, fall back to baseline on failure
        
        Returns:
            Assistant response content
        """
        # Mistral SDK supports async, but for now we'll use sync with run_in_executor
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self.chat,
            agent_name,
            messages,
            use_finetuned,
            use_fallback
        )
    
    def list_agents(self) -> List[str]:
        """List all registered agent names"""
        return list(self.MODELS.keys())
    
    def is_finetuned_available(self, agent_name: str) -> bool:
        """Check if fine-tuned model is available for agent"""
        return agent_name in self.MODELS
    
    # PRIORITY 3: GAP Planner Integration
    async def execute_with_planning(self, query: str, use_gap: bool = True) -> str:
        """
        Execute query with GAP planning for complex queries.
        
        Args:
            query: User query string
            use_gap: If True, use GAP planner for complex queries
        
        Returns:
            Response string
        """
        if use_gap and self._is_complex_query(query):
            try:
                from infrastructure.orchestration.gap_planner import GAPPlanner
                gap_planner = GAPPlanner(
                    llm_client=self.client if hasattr(self.client, 'chat') else None,
                    model_registry=self
                )
                result = await gap_planner.execute_plan(query)
                return result.get("answer", str(result))
            except Exception as e:
                logger.warning(f"GAP planning failed: {e}, falling back to direct execution")
                # Fallback to direct execution
                return self.chat("qa_agent", [{"role": "user", "content": query}])
        else:
            # Simple query, execute directly
            return self.chat("qa_agent", [{"role": "user", "content": query}])
    
    def _is_complex_query(self, query: str) -> bool:
        """
        Determine if query is complex enough to benefit from GAP planning.
        
        Args:
            query: User query string
        
        Returns:
            True if query is complex (multi-step, requires planning)
        """
        keywords = ["and", "also", "then", "after", "plus", "first", "next", "finally"]
        word_count = len(query.split())
        
        # Complex if: long query OR contains coordination keywords OR multiple sentences
        return (
            word_count > 50 or
            any(kw in query.lower() for kw in keywords) or
            query.count('.') + query.count('?') + query.count('!') > 1
        )

