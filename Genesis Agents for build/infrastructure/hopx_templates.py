"""
HopX Environment Templates
==========================

This module defines the canonical HopX environment templates that can be
requested by Genesis agents.  Templates guarantee deterministic toolchains
so agents know exactly what is available inside each sandbox.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class HopXTemplate:
    """Description of an ephemeral HopX environment."""

    name: str
    description: str
    packages: List[str]
    default_shell: str = "/bin/bash"
    working_dir: str = "/workspace"


TEMPLATE_REGISTRY: Dict[str, HopXTemplate] = {
    "nodejs_environment": HopXTemplate(
        name="nodejs_environment",
        description="Node.js + npm + git toolchain for frontend builds",
        packages=["nodejs", "npm", "git"],
    ),
    "python_environment": HopXTemplate(
        name="python_environment",
        description="Python 3.11 runtime with pip and git for research agents",
        packages=["python3.11", "pip", "git"],
    ),
    "fullstack_environment": HopXTemplate(
        name="fullstack_environment",
        description="Node.js + Python + Docker for deployment rehearsals",
        packages=["nodejs", "npm", "python3.11", "pip", "docker", "git"],
    ),
    "test_environment": HopXTemplate(
        name="test_environment",
        description="Playwright/Cypress/Jest bundle for QA validation",
        packages=["nodejs", "npm", "python3.11", "pip", "playwright", "git"],
    ),
}


def get_template(name: str) -> HopXTemplate:
    """Return a template definition, raising if it is unknown."""

    if name not in TEMPLATE_REGISTRY:
        raise KeyError(
            f"Unknown HopX template '{name}'. Known templates: {', '.join(TEMPLATE_REGISTRY)}"
        )
    return TEMPLATE_REGISTRY[name]


def list_templates() -> List[HopXTemplate]:
    """Convenience helper used by the dashboard + docs."""

    return list(TEMPLATE_REGISTRY.values())

