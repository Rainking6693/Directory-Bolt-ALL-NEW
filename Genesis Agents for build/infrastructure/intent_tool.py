"""
Intent Abstraction Tool for Microsoft Agent Framework
Wraps the 97% cost reduction layer as a Framework tool

This tool extracts structured intent from natural language commands,
avoiding expensive LLM calls for deterministic operations.
"""

import json
from typing import Dict, Any
from .intent_abstraction import IntentExtractor, Intent


class IntentAbstractionTool:
    """
    Framework tool for Intent Abstraction

    Converts natural language commands to structured intents:
    - Actions: create, kill, scale, optimize, analyze, deploy
    - Motives: revenue, learning, testing, scaling, optimization
    - Business types: saas, ecommerce, content, marketplace, api_service
    - Priority: low, medium, high, critical

    Example:
        Input: "Create a profitable SaaS business"
        Output: {
            "action": "create",
            "motive": "revenue",
            "business_type": "saas",
            "priority": "medium",
            "confidence": 0.95
        }
    """

    def __init__(self):
        self.extractor = IntentExtractor()

    def extract_intent(self, command: str) -> str:
        """
        Extract structured intent from natural language command.

        Args:
            command: Natural language command (e.g., "Build a marketplace for learning")

        Returns:
            JSON string with extracted intent structure
        """
        intent = self.extractor.extract(command)

        result = {
            "action": intent.action.value,
            "motive": intent.motive.value if intent.motive else None,
            "business_type": intent.business_type.value if intent.business_type else None,
            "priority": intent.priority.value,
            "parameters": intent.parameters,
            "confidence": intent.confidence,
            "original_command": command
        }

        return json.dumps(result, indent=2)

    def validate_intent(self, intent_json: str) -> str:
        """
        Validate a structured intent and provide routing recommendations.

        Args:
            intent_json: JSON string with intent structure

        Returns:
            JSON string with validation results and recommended agent routing
        """
        try:
            intent_data = json.loads(intent_json)

            # Determine which agents should handle this intent
            recommended_agents = []

            action = intent_data.get("action")
            if action == "create":
                recommended_agents = ["spec", "builder", "deploy"]
            elif action == "kill":
                recommended_agents = ["maintenance", "deploy"]
            elif action == "scale":
                recommended_agents = ["analyst", "deploy", "maintenance"]
            elif action == "optimize":
                recommended_agents = ["analyst", "qa", "security"]
            elif action == "analyze":
                recommended_agents = ["analyst"]
            elif action == "deploy":
                recommended_agents = ["deploy", "qa"]

            # Add supporting agents based on business type
            business_type = intent_data.get("business_type")
            if business_type == "saas":
                recommended_agents.extend(["marketing", "support", "billing"])
            elif business_type == "ecommerce":
                recommended_agents.extend(["marketing", "billing", "legal"])
            elif business_type == "content":
                recommended_agents.extend(["content", "seo", "marketing"])
            elif business_type == "marketplace":
                recommended_agents.extend(["billing", "legal", "support"])

            result = {
                "valid": True,
                "confidence": intent_data.get("confidence", 0),
                "recommended_agents": list(set(recommended_agents)),  # Remove duplicates
                "priority": intent_data.get("priority", "medium"),
                "estimated_cost": self._estimate_cost(action, len(recommended_agents)),
                "estimated_time": self._estimate_time(action, len(recommended_agents))
            }

            return json.dumps(result, indent=2)

        except Exception as e:
            return json.dumps({
                "valid": False,
                "error": str(e)
            }, indent=2)

    def _estimate_cost(self, action: str, num_agents: int) -> float:
        """Estimate API cost for this operation"""
        base_costs = {
            "create": 0.15,  # Full business creation
            "kill": 0.01,    # Simple termination
            "scale": 0.05,   # Resource adjustment
            "optimize": 0.08,  # Analysis + changes
            "analyze": 0.03,   # Just analysis
            "deploy": 0.10     # Deployment operations
        }

        base = base_costs.get(action, 0.05)
        # Each additional agent adds cost
        return round(base + (num_agents * 0.02), 3)

    def _estimate_time(self, action: str, num_agents: int) -> str:
        """Estimate time for this operation"""
        base_times = {
            "create": 240,  # 4 minutes
            "kill": 10,     # 10 seconds
            "scale": 60,    # 1 minute
            "optimize": 120,  # 2 minutes
            "analyze": 30,    # 30 seconds
            "deploy": 180     # 3 minutes
        }

        seconds = base_times.get(action, 60) + (num_agents * 10)

        if seconds < 60:
            return f"{seconds}s"
        elif seconds < 3600:
            return f"{seconds // 60}m {seconds % 60}s"
        else:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            return f"{hours}h {minutes}m"


# Singleton instance for tool registration
intent_tool = IntentAbstractionTool()


# Framework-compatible tool functions
def extract_intent(command: str) -> str:
    """Extract structured intent from natural language command (Framework tool)"""
    return intent_tool.extract_intent(command)


def validate_intent(intent_json: str) -> str:
    """Validate intent and provide routing recommendations (Framework tool)"""
    return intent_tool.validate_intent(intent_json)
