"""
Genesis Agents - Microsoft Agent Framework Version
Day 2 Migration: All 15 agents converted to Microsoft Agent Framework

Agent List:
1. Marketing Agent - Growth and marketing campaigns
2. Builder Agent - Code generation and development
3. Content Agent - Blog posts and documentation
4. Deploy Agent - Deployment and infrastructure
5. Support Agent - Customer support automation
6. QA Agent - Quality assurance and testing
7. SEO Agent - Search engine optimization
8. Email Agent - Email campaigns and automation
9. Legal Agent - Legal documents and compliance
10. Security Agent - Security audits and monitoring
11. Billing Agent - Payment processing and subscriptions
12. Analyst Agent - Analytics and insights
13. Maintenance Agent - System health and monitoring
14. Onboarding Agent - User activation and onboarding
15. Spec Agent - Requirements and specifications
"""

from .marketing_agent import MarketingAgent, get_marketing_agent
from .builder_agent import BuilderAgent, get_builder_agent
from .content_agent import ContentAgent, get_content_agent
from .deploy_agent import DeployAgent, get_deploy_agent
from .support_agent import SupportAgent, get_support_agent
from .qa_agent import QAAgent, get_qa_agent
from .seo_agent import SEOAgent, get_seo_agent
from .email_agent import EmailAgent, get_email_agent
from .legal_agent import LegalAgent, get_legal_agent
from .security_agent import EnhancedSecurityAgent as SecurityAgent, get_security_agent
from .billing_agent import BillingAgent, get_billing_agent
from .analyst_agent import AnalystAgent, get_analyst_agent
from .maintenance_agent import MaintenanceAgent, get_maintenance_agent
from .onboarding_agent import OnboardingAgent, get_onboarding_agent
from .spec_agent import SpecAgent, get_spec_agent
from .pricing_agent import PricingAgent
from .finance_agent import FinanceAgent
from .commerce_agent import CommerceAgent

__all__ = [
    # Agent Classes
    "MarketingAgent",
    "BuilderAgent",
    "ContentAgent",
    "DeployAgent",
    "SupportAgent",
    "QAAgent",
    "SEOAgent",
    "EmailAgent",
    "LegalAgent",
    "SecurityAgent",
    "BillingAgent",
    "AnalystAgent",
    "MaintenanceAgent",
    "OnboardingAgent",
    "SpecAgent",
    "PricingAgent",
    "FinanceAgent",
    "CommerceAgent",
    # Factory Functions
    "get_marketing_agent",
    "get_builder_agent",
    "get_content_agent",
    "get_deploy_agent",
    "get_support_agent",
    "get_qa_agent",
    "get_seo_agent",
    "get_email_agent",
    "get_legal_agent",
    "get_security_agent",
    "get_billing_agent",
    "get_analyst_agent",
    "get_maintenance_agent",
    "get_onboarding_agent",
    "get_spec_agent",
]
