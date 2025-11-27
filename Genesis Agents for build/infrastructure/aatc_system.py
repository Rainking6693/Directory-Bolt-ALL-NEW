"""
Agent-Augmented Tool Creation (AATC) system

Implements VoltAgent-inspired tool registry patterns with Pydantic validation.
Provides declarative tool specifications, payload validation, and helpers for
loading tool definitions from YAML/JSON sources.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union

import yaml
from pydantic import BaseModel, Field, model_validator, validator


logger = logging.getLogger(__name__)


ALLOWED_FIELD_TYPES = {
    "string": str,
    "integer": int,
    "number": (int, float),
    "boolean": bool,
    "object": dict,
    "array": list,
}


class ToolValidationError(ValueError):
    """Raised when tool registration or validation fails."""

    def __init__(self, errors: Union[str, Iterable[str]]):
        if isinstance(errors, str):
            messages = [errors]
        else:
            messages = list(errors)

        message = "; ".join(messages)
        super().__init__(message)
        self.messages = messages


class ToolField(BaseModel):
    """Definition for a single tool field."""

    type: str = Field(..., description="Primitive type (string, integer, number, boolean, object, array)")
    description: str = Field(default="", description="Human readable description")
    required: bool = Field(default=True, description="Whether the field is required")
    example: Optional[Any] = Field(default=None, description="Example payload")

    @validator("type")
    def validate_type(cls, value: str) -> str:
        """Ensure field type is supported or reference-based."""
        if value in ALLOWED_FIELD_TYPES:
            return value
        if value.startswith("ref:"):
            return value
        raise ValueError(
            f"Unsupported field type '{value}'. Supported types: {', '.join(sorted(ALLOWED_FIELD_TYPES))}"
        )


class ToolSchema(BaseModel):
    """Input or output schema for a tool."""

    fields: Dict[str, ToolField] = Field(default_factory=dict)

    @validator("fields")
    def ensure_fields(cls, value: Dict[str, ToolField]) -> Dict[str, ToolField]:
        if not value:
            raise ValueError("Schema must define at least one field")
        return value


class ToolDefinition(BaseModel):
    """Full tool definition."""

    name: str = Field(..., description="Unique tool name")
    description: str = Field(..., description="Purpose of the tool")
    version: str = Field(default="1.0", pattern=r"^[0-9]+(\.[0-9]+){0,2}$")
    input_schema: ToolSchema = Field(..., alias="input")
    output_schema: ToolSchema = Field(..., alias="output")
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True  # Pydantic V2 (was allow_population_by_field_name in V1)

    @validator("name")
    def validate_name(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Tool name cannot be empty")
        if not value.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Tool name must be alphanumeric with optional _ or -")
        return value

    @model_validator(mode="after")
    def ensure_input_output_distinct(cls, data: "ToolDefinition") -> "ToolDefinition":
        input_fields = data.input_schema.fields.keys()
        output_fields = data.output_schema.fields.keys()
        overlap = set(input_fields) & set(output_fields)
        if overlap:
            raise ValueError(f"Input and output schemas share fields: {', '.join(sorted(overlap))}")
        return data

    def to_dict(self) -> Dict[str, Any]:
        """Serialize using the public alias names."""
        return json.loads(self.json(by_alias=True))


def _coerce_tool_definition(spec: Union[ToolDefinition, Dict[str, Any]]) -> ToolDefinition:
    """Normalize dict specifications into ToolDefinition instances."""
    if isinstance(spec, ToolDefinition):
        return spec
    return ToolDefinition.parse_obj(spec)


def _matches_type(expected_type: str, value: Any) -> bool:
    """Validate that a value matches the expected schema type."""
    if expected_type.startswith("ref:"):
        # Reference types are validated by the downstream system.
        return True

    python_type = ALLOWED_FIELD_TYPES[expected_type]
    if expected_type == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected_type == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    return isinstance(value, python_type)


def _validate_payload(schema: ToolSchema, payload: Dict[str, Any], *, direction: str) -> Dict[str, Any]:
    """Validate payload against a schema and return sanitized copy."""
    errors: List[str] = []
    validated: Dict[str, Any] = {}

    for field_name, field_spec in schema.fields.items():
        if field_spec.required and field_name not in payload:
            errors.append(f"{direction} missing required field '{field_name}'")
            continue

        if field_name not in payload:
            continue

        value = payload[field_name]
        if not _matches_type(field_spec.type, value):
            errors.append(
                f"{direction} field '{field_name}' expected type '{field_spec.type}' "
                f"but received '{type(value).__name__}'"
            )
            continue

        validated[field_name] = value

    extra_fields = sorted(set(payload.keys()) - set(schema.fields.keys()))
    if extra_fields:
        errors.append(f"{direction} contains unknown fields: {', '.join(extra_fields)}")

    if errors:
        raise ToolValidationError(errors)

    return validated


@dataclass
class ToolRegistry:
    """Registry managing tool definitions and payload validation."""

    tools: Dict[str, ToolDefinition] = None

    def __post_init__(self) -> None:
        if self.tools is None:
            self.tools = {}

    # ------------------------------------------------------------------ Registration
    def register(self, spec: Union[ToolDefinition, Dict[str, Any]]) -> ToolDefinition:
        """Register a new tool definition."""
        tool = _coerce_tool_definition(spec)
        self.tools[tool.name] = tool
        return tool

    def register_many(self, specs: Iterable[Union[ToolDefinition, Dict[str, Any]]]) -> List[ToolDefinition]:
        """Register multiple tool definitions."""
        return [self.register(spec) for spec in specs]

    # ------------------------------------------------------------------ Retrieval
    def get(self, name: str) -> Optional[ToolDefinition]:
        return self.tools.get(name)

    def list(self) -> List[ToolDefinition]:
        return list(self.tools.values())

    # ------------------------------------------------------------------ Validation
    def validate_input(self, name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        tool = self._require_tool(name)
        return _validate_payload(tool.input_schema, payload, direction="input")

    def validate_output(self, name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        tool = self._require_tool(name)
        return _validate_payload(tool.output_schema, payload, direction="output")

    # ------------------------------------------------------------------ Persistence helpers
    def load_file(self, path: Union[str, Path]) -> List[ToolDefinition]:
        """Load tool definition(s) from YAML or JSON file."""
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Tool definition file not found: {path}")

        content = path.read_text()
        if path.suffix.lower() in {".yaml", ".yml"}:
            data = yaml.safe_load(content)
        else:
            data = json.loads(content)

        if isinstance(data, dict) and "tools" in data:
            return self.register_many(data["tools"])
        return [self.register(data)]

    # ------------------------------------------------------------------ Internal helpers
    def _require_tool(self, name: str) -> ToolDefinition:
        tool = self.tools.get(name)
        if not tool:
            raise ToolValidationError(f"Tool '{name}' is not registered")
        return tool


# Singleton registry helper --------------------------------------------------------
_tool_registry: Optional[ToolRegistry] = None
_tool_specs_loaded: bool = False
TOOL_SPECS_ENV = "AATC_TOOL_SPECS_PATH"
DEFAULT_TOOL_SPECS_DIR = Path(__file__).resolve().parent.parent / "workflows" / "tools"


def _load_default_tool_specs(registry: ToolRegistry) -> None:
    """Load tool specifications from the default workflows directory."""
    global _tool_specs_loaded

    if _tool_specs_loaded:
        return

    specs_path = os.getenv(TOOL_SPECS_ENV)
    if specs_path:
        base_dir = Path(specs_path)
    else:
        base_dir = DEFAULT_TOOL_SPECS_DIR

    if not base_dir.exists():
        logger.debug("Tool specs directory not found at %s", base_dir)
        _tool_specs_loaded = True
        return

    loaded_files = 0
    for pattern in ("*.yml", "*.yaml", "*.json"):
        for file_path in sorted(base_dir.glob(pattern)):
            try:
                registry.load_file(file_path)
                loaded_files += 1
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.warning("Failed to load tool spec from %s: %s", file_path, exc)

    if loaded_files:
        logger.info("Loaded %s tool spec file(s) from %s", loaded_files, base_dir)
    else:
        logger.debug("No tool specs found in %s", base_dir)

    _tool_specs_loaded = True


def get_tool_registry() -> ToolRegistry:
    global _tool_registry
    if _tool_registry is None:
        _tool_registry = ToolRegistry()
        _load_default_tool_specs(_tool_registry)
    return _tool_registry


__all__ = [
    "ToolDefinition",
    "ToolField",
    "ToolSchema",
    "ToolRegistry",
    "ToolValidationError",
    "get_tool_registry",
]
