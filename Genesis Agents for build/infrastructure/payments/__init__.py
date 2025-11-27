"""
Payments Infrastructure
=======================

Autonomous payment processing system for Genesis businesses.

Components:
- stripe_manager: Stripe Connect API, payment processing, webhooks
- pricing_optimizer: Dynamic pricing, A/B testing, revenue optimization
"""

from .stripe_manager import (
    StripeManager,
    StripeAccount,
    StripeProduct,
    StripeCheckoutSession,
    WebhookEvent,
    PaymentStatus,
)
from .pricing_optimizer import (
    PricingOptimizer,
    PricingStrategy,
    ABTestResult,
    RevenueOptimization,
)

__all__ = [
    # Stripe Manager
    "StripeManager",
    "StripeAccount",
    "StripeProduct",
    "StripeCheckoutSession",
    "WebhookEvent",
    "PaymentStatus",
    # Pricing Optimizer
    "PricingOptimizer",
    "PricingStrategy",
    "ABTestResult",
    "RevenueOptimization",
]

