"""
Scenario Loader - YAML/JSON Scenario Parser for Rogue Testing

This module handles loading, parsing, and validating test scenarios
from YAML files. Supports filtering by priority (P0/P1/P2), category,
and tags.

Usage:
    loader = ScenarioLoader()
    scenarios = loader.load_from_yaml("tests/rogue/scenarios/qa_agent_scenarios.yaml")
    p0_scenarios = loader.filter_by_priority(scenarios, "P0")
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

logger = logging.getLogger(__name__)


class ScenarioValidationError(Exception):
    """Raised when scenario validation fails."""
    pass


class ScenarioLoader:
    """
    Load and validate test scenarios from YAML/JSON files.

    Supports:
    - YAML and JSON file formats
    - Scenario validation against schema
    - Filtering by priority, category, tags
    - Batch loading from directories
    """

    REQUIRED_FIELDS = ["id", "priority", "category", "description", "input", "expected_output"]
    VALID_PRIORITIES = ["P0", "P1", "P2"]
    # Core categories for standard validation
    STANDARD_CATEGORIES = ["success", "edge_case", "failure", "security", "performance"]
    # Map custom categories to standard ones for analysis (if needed)
    CATEGORY_MAPPING = {
        "integration": "edge_case",
        "cross_component": "edge_case",
        "api": "success",
        "database": "failure",
        "deployment": "success",
        "advanced": "edge_case",
        "ocr": "success",
        "escalation": "failure",
        "knowledge_base": "success",
        # Add more mappings as needed - all unmapped categories will pass through as-is
    }

    def __init__(self, strict: bool = True):
        """
        Initialize scenario loader.

        Args:
            strict: If True, raise errors on validation failures. If False, log warnings.
        """
        self.strict = strict
        self.loaded_scenarios: List[Dict[str, Any]] = []
        self.validation_errors: List[str] = []

    def load_from_yaml(self, yaml_path: str) -> List[Dict[str, Any]]:
        """
        Load scenarios from YAML file.

        Args:
            yaml_path: Path to YAML file (relative or absolute)

        Returns:
            List of scenario dictionaries

        Raises:
            FileNotFoundError: If YAML file doesn't exist
            ScenarioValidationError: If validation fails (strict mode)
        """
        path = Path(yaml_path)
        if not path.exists():
            raise FileNotFoundError(f"Scenario file not found: {yaml_path}")

        logger.info(f"Loading scenarios from {yaml_path}")

        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        # Handle both single-file and multi-agent YAML formats
        if "scenarios" in data:
            scenarios = data["scenarios"]
        elif isinstance(data, list):
            scenarios = data
        else:
            raise ScenarioValidationError(f"Invalid YAML structure in {yaml_path}")

        # Validate each scenario
        validated_scenarios = []
        for idx, scenario in enumerate(scenarios):
            try:
                self._validate_scenario(scenario, source=f"{yaml_path}:scenario[{idx}]")
                validated_scenarios.append(scenario)
            except ScenarioValidationError as e:
                self.validation_errors.append(str(e))
                if self.strict:
                    raise
                else:
                    logger.warning(f"Skipping invalid scenario: {e}")

        self.loaded_scenarios.extend(validated_scenarios)
        logger.info(f"Loaded {len(validated_scenarios)} scenarios from {yaml_path}")

        return validated_scenarios

    def load_from_json(self, json_path: str) -> List[Dict[str, Any]]:
        """
        Load scenarios from JSON file.

        Args:
            json_path: Path to JSON file

        Returns:
            List of scenario dictionaries
        """
        path = Path(json_path)
        if not path.exists():
            raise FileNotFoundError(f"Scenario file not found: {json_path}")

        logger.info(f"Loading scenarios from {json_path}")

        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Same structure handling as YAML
        if "scenarios" in data:
            scenarios = data["scenarios"]
        elif isinstance(data, list):
            scenarios = data
        else:
            raise ScenarioValidationError(f"Invalid JSON structure in {json_path}")

        # Validate each scenario
        validated_scenarios = []
        for idx, scenario in enumerate(scenarios):
            try:
                self._validate_scenario(scenario, source=f"{json_path}:scenario[{idx}]")
                validated_scenarios.append(scenario)
            except ScenarioValidationError as e:
                self.validation_errors.append(str(e))
                if self.strict:
                    raise
                else:
                    logger.warning(f"Skipping invalid scenario: {e}")

        self.loaded_scenarios.extend(validated_scenarios)
        logger.info(f"Loaded {len(validated_scenarios)} scenarios from {json_path}")

        return validated_scenarios

    def load_from_directory(self, directory: str, pattern: str = "*.yaml") -> List[Dict[str, Any]]:
        """
        Load all scenarios from directory matching pattern.

        Args:
            directory: Path to scenario directory
            pattern: Glob pattern (default: "*.yaml")

        Returns:
            List of all loaded scenarios
        """
        dir_path = Path(directory)
        if not dir_path.is_dir():
            raise NotADirectoryError(f"Not a directory: {directory}")

        all_scenarios = []
        scenario_files = list(dir_path.glob(pattern))

        if not scenario_files:
            logger.warning(f"No scenario files found in {directory} matching {pattern}")
            return []

        logger.info(f"Loading scenarios from {len(scenario_files)} files in {directory}")

        for file_path in scenario_files:
            try:
                if file_path.suffix in ['.yaml', '.yml']:
                    scenarios = self.load_from_yaml(str(file_path))
                elif file_path.suffix == '.json':
                    scenarios = self.load_from_json(str(file_path))
                else:
                    logger.warning(f"Skipping unsupported file: {file_path}")
                    continue

                all_scenarios.extend(scenarios)
            except Exception as e:
                logger.error(f"Failed to load {file_path}: {e}")
                if self.strict:
                    raise

        logger.info(f"Total scenarios loaded from directory: {len(all_scenarios)}")
        return all_scenarios

    def _validate_scenario(self, scenario: Dict[str, Any], source: str = "unknown") -> None:
        """
        Validate scenario structure and fields.

        Args:
            scenario: Scenario dictionary to validate
            source: Source identifier for error messages

        Raises:
            ScenarioValidationError: If validation fails
        """
        # Check required fields
        missing_fields = [field for field in self.REQUIRED_FIELDS if field not in scenario]
        if missing_fields:
            raise ScenarioValidationError(
                f"{source}: Missing required fields: {', '.join(missing_fields)}"
            )

        # Validate priority
        priority = scenario.get("priority")
        if priority not in self.VALID_PRIORITIES:
            raise ScenarioValidationError(
                f"{source}: Invalid priority '{priority}'. Must be one of: {self.VALID_PRIORITIES}"
            )

        # Validate category (allow custom categories, not just standard ones)
        category = scenario.get("category")
        if not category or not isinstance(category, str):
            raise ScenarioValidationError(
                f"{source}: 'category' must be a non-empty string"
            )
        # Log custom categories for tracking but don't fail validation
        if category not in self.STANDARD_CATEGORIES:
            logger.debug(f"{source}: Using custom category '{category}' (not in {self.STANDARD_CATEGORIES})")

        # Validate input is dict
        if not isinstance(scenario.get("input"), dict):
            raise ScenarioValidationError(
                f"{source}: 'input' must be a dictionary"
            )

        # Validate expected_output is dict
        if not isinstance(scenario.get("expected_output"), dict):
            raise ScenarioValidationError(
                f"{source}: 'expected_output' must be a dictionary"
            )

        # Validate scenario ID is unique (within loaded scenarios)
        scenario_id = scenario.get("id")
        if any(s.get("id") == scenario_id for s in self.loaded_scenarios):
            raise ScenarioValidationError(
                f"{source}: Duplicate scenario ID '{scenario_id}'"
            )

    def filter_by_priority(self, scenarios: List[Dict[str, Any]], priority: str) -> List[Dict[str, Any]]:
        """
        Filter scenarios by priority level.

        Args:
            scenarios: List of scenarios
            priority: Priority level (P0, P1, or P2)

        Returns:
            Filtered list of scenarios
        """
        if priority not in self.VALID_PRIORITIES:
            raise ValueError(f"Invalid priority: {priority}")

        filtered = [s for s in scenarios if s.get("priority") == priority]
        logger.info(f"Filtered {len(filtered)}/{len(scenarios)} scenarios with priority {priority}")
        return filtered

    def filter_by_category(self, scenarios: List[Dict[str, Any]], category: str) -> List[Dict[str, Any]]:
        """
        Filter scenarios by category.

        Args:
            scenarios: List of scenarios
            category: Category name (success, edge_case, failure, security, performance, or custom)

        Returns:
            Filtered list of scenarios
        """
        # Allow any non-empty category string (including custom categories)
        if not category or not isinstance(category, str):
            raise ValueError(f"Invalid category: {category} (must be a non-empty string)")

        filtered = [s for s in scenarios if s.get("category") == category]
        logger.info(f"Filtered {len(filtered)}/{len(scenarios)} scenarios with category {category}")
        return filtered

    def filter_by_tags(self, scenarios: List[Dict[str, Any]], tags: List[str]) -> List[Dict[str, Any]]:
        """
        Filter scenarios by tags (any match).

        Args:
            scenarios: List of scenarios
            tags: List of tags to match

        Returns:
            Filtered list of scenarios
        """
        filtered = [
            s for s in scenarios
            if any(tag in s.get("tags", []) for tag in tags)
        ]
        logger.info(f"Filtered {len(filtered)}/{len(scenarios)} scenarios matching tags {tags}")
        return filtered

    def get_statistics(self, scenarios: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Get statistics about loaded scenarios.

        Args:
            scenarios: List of scenarios (default: all loaded scenarios)

        Returns:
            Dictionary with statistics
        """
        if scenarios is None:
            scenarios = self.loaded_scenarios

        if not scenarios:
            return {"total": 0}

        # Count by priority
        priority_counts = {p: 0 for p in self.VALID_PRIORITIES}
        for scenario in scenarios:
            priority = scenario.get("priority")
            if priority in priority_counts:
                priority_counts[priority] += 1

        # Count by category (support both standard and custom categories)
        category_counts = {}
        for scenario in scenarios:
            category = scenario.get("category", "unknown")
            if category not in category_counts:
                category_counts[category] = 0
            category_counts[category] += 1

        return {
            "total": len(scenarios),
            "by_priority": priority_counts,
            "by_category": category_counts,
            "validation_errors": len(self.validation_errors)
        }
