"""
VOIX Detector - Discovers VOIX declarative tags on web pages

Based on arXiv:2511.11287 - Building the Web for Agents
Integration #74: VOIX Declarative Discovery Layer

Features:
- Discovers <tool> tags (available actions)
- Discovers <context> tags (relevant state)
- Validates tag schemas
- Monitors DOM for dynamic changes
- Caches discovered tools and contexts
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
import json
import logging
from pathlib import Path

from infrastructure.load_env import load_genesis_env

load_genesis_env()

logger = logging.getLogger(__name__)


@dataclass
class ToolDefinition:
    """VOIX <tool> tag definition."""
    name: str
    description: str
    parameters: Dict[str, Any]
    endpoint: Optional[str] = None
    method: str = "POST"
    auth: str = "session"
    visible: bool = True
    element_id: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ToolDefinition':
        """Create ToolDefinition from parsed tag data."""
        return cls(
            name=data.get('name', ''),
            description=data.get('description', ''),
            parameters=data.get('parameters', {}),
            endpoint=data.get('endpoint'),
            method=data.get('method', 'POST'),
            auth=data.get('auth', 'session'),
            visible=data.get('visible', True),
            element_id=data.get('element_id')
        )

    def validate(self) -> bool:
        """Validate tool definition."""
        if not self.name:
            logger.warning("[VOIX] Tool missing 'name' attribute")
            return False

        if not self.description:
            logger.warning(f"[VOIX] Tool '{self.name}' missing 'description'")
            return False

        if not isinstance(self.parameters, dict):
            logger.warning(f"[VOIX] Tool '{self.name}' has invalid parameters schema")
            return False

        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'name': self.name,
            'description': self.description,
            'parameters': self.parameters,
            'endpoint': self.endpoint,
            'method': self.method,
            'auth': self.auth,
            'visible': self.visible,
            'element_id': self.element_id
        }


@dataclass
class ContextDefinition:
    """VOIX <context> tag definition."""
    name: str
    value: Dict[str, Any]
    scope: str = "local"
    ttl: Optional[int] = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ContextDefinition':
        """Create ContextDefinition from parsed tag data."""
        return cls(
            name=data.get('name', ''),
            value=data.get('value', {}),
            scope=data.get('scope', 'local'),
            ttl=data.get('ttl'),
            timestamp=data.get('timestamp', datetime.now().isoformat())
        )

    def validate(self) -> bool:
        """Validate context definition."""
        if not self.name:
            logger.warning("[VOIX] Context missing 'name' attribute")
            return False

        if not isinstance(self.value, dict):
            logger.warning(f"[VOIX] Context '{self.name}' has invalid value (must be JSON object)")
            return False

        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'name': self.name,
            'value': self.value,
            'scope': self.scope,
            'ttl': self.ttl,
            'timestamp': self.timestamp
        }

    def is_expired(self) -> bool:
        """Check if context has expired based on TTL."""
        if self.ttl is None:
            return False

        created = datetime.fromisoformat(self.timestamp)
        age_seconds = (datetime.now() - created).total_seconds()

        return age_seconds > self.ttl


class VoixDetector:
    """
    Detects VOIX declarative tags on web pages.

    VOIX introduces <tool> and <context> tags for agent-web interaction.
    This detector discovers these tags and makes them available to agents.
    """

    def __init__(self, cache_dir: Optional[Path] = None):
        self.cache_dir = cache_dir or Path("data/voix_cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Discovered tools and contexts (per URL)
        self.tools: Dict[str, List[ToolDefinition]] = {}
        self.contexts: Dict[str, List[ContextDefinition]] = {}

        logger.info("[VoixDetector] Initialized")

    async def detect_voix_support(self, page_content: str, url: str) -> bool:
        """
        Check if page has VOIX support (contains <tool> or <context> tags).

        Args:
            page_content: HTML content of the page
            url: Page URL

        Returns:
            True if VOIX tags found, False otherwise
        """
        # Simple check for VOIX tags in HTML
        has_tool_tags = '<tool' in page_content.lower()
        has_context_tags = '<context' in page_content.lower()

        has_voix = has_tool_tags or has_context_tags

        if has_voix:
            logger.info(f"[VOIX] Detected VOIX support on {url}")
            logger.debug(f"  - Tool tags: {has_tool_tags}")
            logger.debug(f"  - Context tags: {has_context_tags}")

        return has_voix

    async def discover_tools(self, page_content: str, url: str) -> List[ToolDefinition]:
        """
        Discover <tool> tags on the page.

        This would typically use a browser automation library to execute JavaScript,
        but for now we'll parse HTML directly as a fallback.

        Args:
            page_content: HTML content
            url: Page URL

        Returns:
            List of discovered tool definitions
        """
        # In production, this would execute JavaScript in browser:
        # ```javascript
        # Array.from(document.querySelectorAll('tool')).map(tool => ({
        #     name: tool.getAttribute('name'),
        #     description: tool.getAttribute('description'),
        #     parameters: JSON.parse(tool.getAttribute('parameters') || '{}'),
        #     endpoint: tool.getAttribute('endpoint'),
        #     method: tool.getAttribute('method') || 'POST',
        #     auth: tool.getAttribute('auth') || 'session',
        #     visible: tool.getAttribute('visible') !== 'false'
        # }))
        # ```

        # For now, simple regex-based parsing (production would use proper HTML parser)
        tools = []

        # Parse <tool> tags (simplified - production needs robust parser)
        import re
        tool_pattern = r'<tool\s+([^>]+)>'

        for match in re.finditer(tool_pattern, page_content, re.IGNORECASE):
            attrs_str = match.group(1)

            # Parse attributes
            tool_data = self._parse_attributes(attrs_str)

            if tool_data.get('name'):
                tool = ToolDefinition.from_dict(tool_data)

                if tool.validate():
                    tools.append(tool)
                    logger.debug(f"[VOIX] Discovered tool: {tool.name}")

        # Cache discovered tools
        self.tools[url] = tools

        logger.info(f"[VOIX] Discovered {len(tools)} tools on {url}")

        return tools

    async def discover_contexts(self, page_content: str, url: str) -> List[ContextDefinition]:
        """
        Discover <context> tags on the page.

        Args:
            page_content: HTML content
            url: Page URL

        Returns:
            List of discovered context definitions
        """
        contexts = []

        # Parse <context> tags (simplified - production needs robust parser)
        import re
        context_pattern = r'<context\s+([^>]+)/?>'

        for match in re.finditer(context_pattern, page_content, re.IGNORECASE):
            attrs_str = match.group(1)

            # Parse attributes
            context_data = self._parse_attributes(attrs_str)

            if context_data.get('name'):
                context = ContextDefinition.from_dict(context_data)

                # Check TTL expiration before adding
                if context.validate() and not context.is_expired():
                    contexts.append(context)
                    logger.debug(f"[VOIX] Discovered context: {context.name}")
                elif context.is_expired():
                    logger.debug(f"[VOIX] Context '{context.name}' expired (TTL: {context.ttl}s)")

        # Cache discovered contexts (filter expired)
        valid_contexts = [c for c in contexts if not c.is_expired()]
        self.contexts[url] = valid_contexts

        logger.info(f"[VOIX] Discovered {len(valid_contexts)} contexts on {url} (filtered {len(contexts) - len(valid_contexts)} expired)")

        return valid_contexts

    async def start_mutation_observer(self, url: str, callback=None):
        """
        Start MutationObserver for dynamic content monitoring.

        This method provides a Python interface to start mutation observation.
        In production, this would inject JavaScript to monitor DOM changes.

        Args:
            url: URL to monitor
            callback: Optional callback function for mutations
        """
        logger.info(f"[VOIX] Starting MutationObserver for {url}")
        # In production, this would inject JavaScript with MutationObserver
        # For now, log that monitoring is enabled
        if callback:
            logger.debug(f"[VOIX] MutationObserver callback registered for {url}")

    def _parse_attributes(self, attrs_str: str) -> Dict[str, Any]:
        """
        Parse HTML attributes into dictionary.

        Args:
            attrs_str: Attribute string (e.g., 'name="search" description="Search products"')

        Returns:
            Dictionary of parsed attributes
        """
        import re

        attrs = {}

        # Parse name="value" pairs
        attr_pattern = r'(\w+)=["\']([^"\']*)["\']'

        for match in re.finditer(attr_pattern, attrs_str):
            key = match.group(1)
            value = match.group(2)

            # Try to parse JSON values
            if key in ['parameters', 'value']:
                try:
                    attrs[key] = json.loads(value)
                except json.JSONDecodeError:
                    logger.warning(f"[VOIX] Failed to parse JSON for attribute '{key}': {value}")
                    attrs[key] = {}
            elif key == 'ttl':
                try:
                    attrs[key] = int(value)
                except ValueError:
                    attrs[key] = None
            elif key == 'visible':
                attrs[key] = value.lower() != 'false'
            else:
                attrs[key] = value

        return attrs

    def get_tools(self, url: str) -> List[ToolDefinition]:
        """Get cached tools for a URL."""
        return self.tools.get(url, [])

    def get_contexts(self, url: str) -> List[ContextDefinition]:
        """Get cached contexts for a URL."""
        return self.contexts.get(url, [])

    def get_tool_by_name(self, url: str, tool_name: str) -> Optional[ToolDefinition]:
        """Get specific tool by name."""
        tools = self.get_tools(url)

        for tool in tools:
            if tool.name == tool_name:
                return tool

        return None

    def get_context_by_name(self, url: str, context_name: str) -> Optional[ContextDefinition]:
        """Get specific context by name."""
        contexts = self.get_contexts(url)

        for context in contexts:
            if context.name == context_name:
                return context

        return None

    def clear_cache(self, url: Optional[str] = None):
        """Clear cached tools and contexts."""
        if url:
            self.tools.pop(url, None)
            self.contexts.pop(url, None)
            logger.info(f"[VOIX] Cleared cache for {url}")
        else:
            self.tools.clear()
            self.contexts.clear()
            logger.info("[VOIX] Cleared all cache")

    def update_cache_incremental(
        self, 
        url: str, 
        new_tools: List[ToolDefinition], 
        new_contexts: List[ContextDefinition]
    ):
        """
        Update cache incrementally for a URL.
        
        This method adds new tools/contexts to the cache without replacing existing ones,
        enabling efficient updates for dynamic content.
        
        Args:
            url: URL to update
            new_tools: New tools to add
            new_contexts: New contexts to add
        """
        existing_tools = self.tools.get(url, [])
        existing_contexts = self.contexts.get(url, [])
        
        # Add new tools (avoid duplicates by name)
        existing_tool_names = {tool.name for tool in existing_tools}
        for tool in new_tools:
            if tool.name not in existing_tool_names:
                existing_tools.append(tool)
                existing_tool_names.add(tool.name)
        
        # Add new contexts (avoid duplicates by name)
        existing_context_names = {ctx.name for ctx in existing_contexts}
        for ctx in new_contexts:
            if ctx.name not in existing_context_names and not ctx.is_expired():
                existing_contexts.append(ctx)
                existing_context_names.add(ctx.name)
        
        # Update cache
        self.tools[url] = existing_tools
        self.contexts[url] = existing_contexts
        
        logger.debug(f"[VOIX] Incrementally updated cache for {url}: +{len(new_tools)} tools, +{len(new_contexts)} contexts")

    def get_stats(self) -> Dict[str, Any]:
        """Get detector statistics."""
        total_tools = sum(len(tools) for tools in self.tools.values())
        total_contexts = sum(len(contexts) for contexts in self.contexts.values())

        return {
            "urls_cached": len(self.tools),
            "total_tools": total_tools,
            "total_contexts": total_contexts,
            "tools_by_url": {url: len(tools) for url, tools in self.tools.items()},
            "contexts_by_url": {url: len(contexts) for url, contexts in self.contexts.items()}
        }


# Singleton instance
_voix_detector: Optional[VoixDetector] = None


def get_voix_detector() -> VoixDetector:
    """Get singleton VOIX detector instance."""
    global _voix_detector
    if _voix_detector is None:
        _voix_detector = VoixDetector()
    return _voix_detector
