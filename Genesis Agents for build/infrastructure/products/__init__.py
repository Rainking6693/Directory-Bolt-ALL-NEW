"""
Product Generation Infrastructure
=================================

Provides product creation automation for autonomous businesses.

Components:
- product_generator: Main product generation engine
- product_templates: Business type templates with pricing and features
- product_validator: Quality and security validation
"""

from .product_templates import (
    BUSINESS_TEMPLATES,
    PricingTier,
    ProductTemplate,
    get_template,
    list_business_types,
)

__all__ = [
    "BUSINESS_TEMPLATES",
    "PricingTier",
    "ProductTemplate",
    "get_template",
    "list_business_types",
]

