"""
Dynamic Agent Creator: Creates specialized agents on-demand
Part of AATC (Agent-Augmented Tool Creation) system

When no existing agent can handle a task, this module:
1. Analyzes task requirements
2. Generates custom tools using ToolGenerator
3. Creates new agent with those tools
4. Registers agent in HALORouter registry
"""

import logging
import uuid
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional

from infrastructure.tool_generator import ToolGenerator, ToolSpec
from infrastructure.halo_router import AgentCapability

logger = logging.getLogger(__name__)


@dataclass
class DynamicAgent:
    """
    Dynamically created agent with custom tools

    Attributes:
        agent_id: Unique identifier (e.g., "dynamic_1")
        name: Human-readable name (e.g., "CryptoScraperAgent")
        description: What the agent does
        capabilities: Task types it can handle (e.g., ["crypto_scraping"])
        tools: Custom tools generated for this agent
        cost_tier: "cheap", "medium", or "expensive"
        success_rate: Initial estimate (0.0-1.0), improves with feedback
        metadata: Additional context (creation time, parent task, etc.)
    """
    agent_id: str
    name: str
    description: str
    capabilities: List[str]
    tools: List[ToolSpec]
    cost_tier: str = "medium"
    success_rate: float = 0.5  # Initial estimate
    metadata: Dict[str, Any] = field(default_factory=dict)


class DynamicAgentCreator:
    """
    Create new agents dynamically for novel tasks

    Workflow:
    1. Receive unroutable task from HALORouter
    2. Analyze task to determine required capabilities
    3. Generate custom tools using ToolGenerator
    4. Package into new DynamicAgent
    5. Return agent for registration

    Example:
        creator = DynamicAgentCreator()
        agent = await creator.create_agent_for_task(
            task_description="Scrape cryptocurrency prices from 50 exchanges",
            context={"data_format": "json", "refresh_rate": "1min"}
        )
        # agent.tools contains generated scraping tools
    """

    def __init__(self, llm_client=None):
        """
        Initialize dynamic agent creator

        Args:
            llm_client: LLM client for tool generation (passed to ToolGenerator)
        """
        self.tool_generator = ToolGenerator(llm_client=llm_client)
        self.created_agents: Dict[str, DynamicAgent] = {}
        self.agent_counter = 0
        self.logger = logger

    async def create_agent_for_task(
        self,
        task_description: str,
        context: Optional[Dict[str, Any]] = None
    ) -> DynamicAgent:
        """
        Create a new agent with custom tools for a specific task

        Algorithm (4 steps from ORCHESTRATION_DESIGN.md):
        1. Generate agent specification (name, capabilities, tools needed)
        2. Generate custom tools using ToolGenerator
        3. Validate tools work correctly
        4. Package into DynamicAgent and register

        Args:
            task_description: What the agent should do
            context: Additional context (data formats, constraints, etc.)

        Returns:
            DynamicAgent ready for registration in HALORouter

        Raises:
            ValueError: If agent creation fails
            SecurityError: If generated tools fail safety validation
        """
        self.logger.info(f"Creating dynamic agent for task: {task_description[:100]}")

        context = context or {}

        # Step 1: Generate agent specification
        agent_spec = await self._generate_agent_spec(task_description, context)

        # Step 2: Generate custom tools
        tools = []
        for tool_requirement in agent_spec["required_tools"]:
            try:
                tool_spec = await self.tool_generator.generate_tool(
                    task_description=tool_requirement,
                    context=context
                )

                # Step 3: Validate tool works
                await self.tool_generator.validate_tool(tool_spec)

                tools.append(tool_spec)
                self.logger.info(f"Generated tool: {tool_spec.tool_name}")

            except Exception as e:
                self.logger.error(f"Tool generation failed for '{tool_requirement}': {e}")
                # Continue with other tools (partial agent better than no agent)

        if not tools:
            raise ValueError(
                f"Failed to generate any tools for task: {task_description}"
            )

        # Step 4: Package into DynamicAgent
        self.agent_counter += 1
        agent_id = f"dynamic_{self.agent_counter}"

        agent = DynamicAgent(
            agent_id=agent_id,
            name=agent_spec["name"],
            description=agent_spec["description"],
            capabilities=agent_spec["capabilities"],
            tools=tools,
            cost_tier=agent_spec.get("cost_tier", "medium"),
            success_rate=0.5,  # Initial estimate, improves with feedback
            metadata={
                "creation_task": task_description,
                "context": context,
                "tool_count": len(tools),
            }
        )

        # Register agent
        self.created_agents[agent_id] = agent

        self.logger.info(
            f"Created dynamic agent '{agent.name}' ({agent_id}) with {len(tools)} tools"
        )

        return agent

    async def _generate_agent_spec(
        self,
        task_description: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate specification for new agent

        Uses LLM to analyze task and determine:
        - Agent name (e.g., "CryptoScraperAgent")
        - Agent description
        - Capabilities (task types it can handle)
        - Required tools (list of tool descriptions)
        - Cost tier based on complexity

        Args:
            task_description: What the agent should do
            context: Additional context

        Returns:
            Dict with agent specification
        """
        # TODO: Use LLM for intelligent agent design
        # For now, use heuristic

        desc_lower = task_description.lower()

        # Detect agent type from task description
        if 'scrape' in desc_lower or 'crawl' in desc_lower:
            agent_type = "scraper"
            name = "ScraperAgent"
            description = "Specialized web scraping agent"
            capabilities = ["web_scraping", "data_extraction", "parsing"]
            required_tools = [
                "Fetch web page content from URL",
                "Parse HTML and extract structured data",
            ]
            cost_tier = "cheap"  # Simple HTTP requests

        elif 'api' in desc_lower or 'integrate' in desc_lower:
            agent_type = "api"
            name = "APIIntegrationAgent"
            description = "API integration and data transformation"
            capabilities = ["api_integration", "data_transformation", "authentication"]
            required_tools = [
                "Make authenticated API requests",
                "Transform API response data",
            ]
            cost_tier = "cheap"

        elif 'analyze' in desc_lower or 'report' in desc_lower:
            agent_type = "analytics"
            name = "AnalyticsAgent"
            description = "Data analysis and reporting"
            capabilities = ["data_analysis", "reporting", "visualization"]
            required_tools = [
                "Analyze dataset and compute statistics",
                "Generate report from analysis results",
            ]
            cost_tier = "medium"  # Data processing

        elif 'monitor' in desc_lower or 'watch' in desc_lower:
            agent_type = "monitor"
            name = "MonitoringAgent"
            description = "System monitoring and alerting"
            capabilities = ["monitoring", "alerting", "health_checks"]
            required_tools = [
                "Check endpoint health status",
                "Send alert notifications",
            ]
            cost_tier = "cheap"

        elif 'transform' in desc_lower or 'convert' in desc_lower:
            agent_type = "transformer"
            name = "DataTransformerAgent"
            description = "Data transformation and conversion"
            capabilities = ["data_transformation", "format_conversion"]
            required_tools = [
                "Transform data between formats",
                "Validate transformed data",
            ]
            cost_tier = "cheap"

        else:
            # Generic agent
            agent_type = "generic"
            name = "CustomAgent"
            description = f"Custom agent for: {task_description[:50]}"
            capabilities = ["custom_task"]
            required_tools = [task_description]
            cost_tier = "medium"

        return {
            "agent_type": agent_type,
            "name": name,
            "description": description,
            "capabilities": capabilities,
            "required_tools": required_tools,
            "cost_tier": cost_tier,
        }

    def convert_to_agent_capability(self, dynamic_agent: DynamicAgent) -> AgentCapability:
        """
        Convert DynamicAgent to AgentCapability for HALORouter registration

        Args:
            dynamic_agent: Dynamic agent to convert

        Returns:
            AgentCapability that can be added to HALORouter registry
        """
        return AgentCapability(
            agent_name=dynamic_agent.agent_id,
            supported_task_types=dynamic_agent.capabilities,
            skills=dynamic_agent.capabilities,  # Skills = capabilities for dynamic agents
            cost_tier=dynamic_agent.cost_tier,
            success_rate=dynamic_agent.success_rate,
            max_concurrent_tasks=5  # Conservative limit for dynamic agents
        )

    def get_agent(self, agent_id: str) -> Optional[DynamicAgent]:
        """
        Retrieve created agent by ID

        Args:
            agent_id: Agent identifier

        Returns:
            DynamicAgent or None if not found
        """
        return self.created_agents.get(agent_id)

    def list_agents(self) -> List[DynamicAgent]:
        """
        Get all created agents

        Returns:
            List of all dynamic agents
        """
        return list(self.created_agents.values())

    def update_agent_success_rate(
        self,
        agent_id: str,
        success_rate: float
    ) -> None:
        """
        Update agent's success rate based on execution feedback

        Called by orchestrator after agent completes tasks

        Args:
            agent_id: Agent to update
            success_rate: New success rate (0.0-1.0)
        """
        if agent_id in self.created_agents:
            old_rate = self.created_agents[agent_id].success_rate
            self.created_agents[agent_id].success_rate = success_rate

            self.logger.info(
                f"Updated {agent_id} success_rate: {old_rate:.2f} → {success_rate:.2f}"
            )
        else:
            self.logger.warning(f"Agent {agent_id} not found for update")

    def persist_agent(self, agent_id: str, filepath: str) -> None:
        """
        Persist agent specification to file for reuse

        Allows saving successful dynamic agents permanently

        Args:
            agent_id: Agent to persist
            filepath: Path to save agent spec

        TODO: Implement serialization to JSON/YAML
        """
        if agent_id not in self.created_agents:
            raise ValueError(f"Agent {agent_id} not found")

        # TODO: Implement persistence
        self.logger.info(f"Agent persistence not yet implemented: {agent_id}")

    async def clone_agent(self, agent_id: str, new_name: str) -> DynamicAgent:
        """
        Clone existing dynamic agent with new name

        Useful for creating variations of successful agents

        Args:
            agent_id: Agent to clone
            new_name: Name for cloned agent

        Returns:
            New DynamicAgent with same tools but different ID
        """
        if agent_id not in self.created_agents:
            raise ValueError(f"Agent {agent_id} not found")

        original = self.created_agents[agent_id]

        self.agent_counter += 1
        new_id = f"dynamic_{self.agent_counter}"

        cloned = DynamicAgent(
            agent_id=new_id,
            name=new_name,
            description=f"Cloned from {original.name}",
            capabilities=original.capabilities.copy(),
            tools=original.tools.copy(),  # Share tool specs
            cost_tier=original.cost_tier,
            success_rate=original.success_rate,
            metadata={
                "cloned_from": agent_id,
                "original_success_rate": original.success_rate,
            }
        )

        self.created_agents[new_id] = cloned

        self.logger.info(f"Cloned agent {agent_id} → {new_id} ('{new_name}')")

        return cloned


class AgentCreationError(Exception):
    """Raised when dynamic agent creation fails"""
    pass
