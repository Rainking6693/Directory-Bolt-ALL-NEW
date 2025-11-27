"""
Component Library for Genesis Autonomous Business Generation

This library defines all 60+ available business components with metadata:
- Category classification
- Dependencies
- Complexity scores
- Build time estimates
- Required capabilities
- Business type compatibility

Used by IntelligentComponentSelector to choose optimal components for each business.
"""

from typing import Dict, List, Any

# Full component library with 60+ components
COMPONENT_LIBRARY: Dict[str, Dict[str, Any]] = {
    # ========================================
    # CORE COMMERCE (10 components)
    # ========================================
    "product_catalog": {
        "category": "commerce",
        "description": "Product listing with search, filter, and pagination",
        "required_for": ["ecommerce", "marketplace"],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 15,
        "capabilities_required": ["frontend", "react", "typescript"],
        "revenue_impact": "critical"
    },
    
    "shopping_cart": {
        "category": "commerce",
        "description": "Shopping cart with localStorage persistence and quantity management",
        "required_for": ["ecommerce"],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 12,
        "capabilities_required": ["frontend", "react", "state_management"],
        "revenue_impact": "critical"
    },
    
    "stripe_checkout": {
        "category": "payment",
        "description": "Stripe payment integration with checkout flow",
        "required_for": ["ecommerce", "saas"],
        "dependencies": ["shopping_cart"],
        "complexity": "high",
        "build_time_minutes": 20,
        "capabilities_required": ["frontend", "backend", "stripe_api"],
        "revenue_impact": "critical"
    },
    
    "inventory_tracking": {
        "category": "commerce",
        "description": "Real-time inventory management with stock alerts",
        "required_for": [],
        "dependencies": ["product_catalog"],
        "complexity": "high",
        "build_time_minutes": 25,
        "capabilities_required": ["backend", "database", "real_time"],
        "revenue_impact": "high"
    },
    
    "order_fulfillment": {
        "category": "commerce",
        "description": "Order processing, tracking, and fulfillment workflow",
        "required_for": [],
        "dependencies": ["stripe_checkout"],
        "complexity": "high",
        "build_time_minutes": 30,
        "capabilities_required": ["backend", "workflow", "notifications"],
        "revenue_impact": "high"
    },
    
    "customer_reviews": {
        "category": "commerce",
        "description": "Product review system with ratings and moderation",
        "required_for": [],
        "dependencies": ["product_catalog"],
        "complexity": "medium",
        "build_time_minutes": 18,
        "capabilities_required": ["frontend", "backend", "user_content"],
        "revenue_impact": "medium"
    },
    
    "wishlist": {
        "category": "commerce",
        "description": "User wishlist with sharing and notifications",
        "required_for": [],
        "dependencies": ["product_catalog"],
        "complexity": "low",
        "build_time_minutes": 10,
        "capabilities_required": ["frontend", "state_management"],
        "revenue_impact": "low"
    },
    
    "product_recommendations": {
        "category": "commerce",
        "description": "AI-powered product recommendations",
        "required_for": [],
        "dependencies": ["product_catalog"],
        "complexity": "high",
        "build_time_minutes": 22,
        "capabilities_required": ["ai", "backend", "analytics"],
        "revenue_impact": "high"
    },
    
    "abandoned_cart_recovery": {
        "category": "commerce",
        "description": "Email automation for abandoned cart recovery",
        "required_for": [],
        "dependencies": ["shopping_cart", "email_marketing"],
        "complexity": "medium",
        "build_time_minutes": 15,
        "capabilities_required": ["backend", "email", "automation"],
        "revenue_impact": "high"
    },
    
    "multi_currency": {
        "category": "commerce",
        "description": "Multi-currency support with auto-conversion",
        "required_for": [],
        "dependencies": ["stripe_checkout"],
        "complexity": "medium",
        "build_time_minutes": 16,
        "capabilities_required": ["backend", "api_integration"],
        "revenue_impact": "medium"
    },
    
    # ========================================
    # ADVANCED COMMERCE (8 components)
    # ========================================
    "tax_calculator": {
        "category": "commerce",
        "description": "Automated tax calculation by region",
        "required_for": [],
        "dependencies": ["stripe_checkout"],
        "complexity": "high",
        "build_time_minutes": 20,
        "capabilities_required": ["backend", "compliance"],
        "revenue_impact": "medium"
    },
    
    "shipping_calculator": {
        "category": "commerce",
        "description": "Real-time shipping rate calculator",
        "required_for": [],
        "dependencies": ["shopping_cart"],
        "complexity": "medium",
        "build_time_minutes": 18,
        "capabilities_required": ["backend", "api_integration"],
        "revenue_impact": "medium"
    },
    
    "loyalty_rewards": {
        "category": "commerce",
        "description": "Points-based loyalty program",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 25,
        "capabilities_required": ["backend", "gamification"],
        "revenue_impact": "high"
    },
    
    "referral_system": {
        "category": "commerce",
        "description": "Referral program with tracking and rewards",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 20,
        "capabilities_required": ["backend", "tracking"],
        "revenue_impact": "high"
    },
    
    "affiliate_program": {
        "category": "commerce",
        "description": "Affiliate marketing program with commission tracking",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 28,
        "capabilities_required": ["backend", "analytics", "payments"],
        "revenue_impact": "medium"
    },
    
    "subscription_management": {
        "category": "commerce",
        "description": "Subscription billing and management",
        "required_for": [],
        "dependencies": ["stripe_checkout"],
        "complexity": "high",
        "build_time_minutes": 24,
        "capabilities_required": ["backend", "stripe_api", "recurring"],
        "revenue_impact": "critical"
    },
    
    "coupon_system": {
        "category": "commerce",
        "description": "Discount codes and promotion management",
        "required_for": [],
        "dependencies": ["shopping_cart"],
        "complexity": "medium",
        "build_time_minutes": 14,
        "capabilities_required": ["backend", "validation"],
        "revenue_impact": "medium"
    },
    
    "gift_cards": {
        "category": "commerce",
        "description": "Digital gift card purchase and redemption",
        "required_for": [],
        "dependencies": ["stripe_checkout"],
        "complexity": "medium",
        "build_time_minutes": 18,
        "capabilities_required": ["backend", "payments"],
        "revenue_impact": "low"
    },
    
    # ========================================
    # SAAS CORE (10 components)
    # ========================================
    "dashboard_ui": {
        "category": "saas",
        "description": "Admin dashboard with charts and metrics",
        "required_for": ["saas"],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 20,
        "capabilities_required": ["frontend", "data_viz"],
        "revenue_impact": "high"
    },
    
    "rest_api": {
        "category": "saas",
        "description": "RESTful API with authentication",
        "required_for": ["saas"],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 25,
        "capabilities_required": ["backend", "api_design"],
        "revenue_impact": "critical"
    },
    
    "user_auth": {
        "category": "saas",
        "description": "User authentication with email/password and OAuth",
        "required_for": ["saas"],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 22,
        "capabilities_required": ["backend", "security", "auth"],
        "revenue_impact": "critical"
    },
    
    "stripe_billing": {
        "category": "saas",
        "description": "SaaS subscription billing with Stripe",
        "required_for": ["saas"],
        "dependencies": ["user_auth"],
        "complexity": "high",
        "build_time_minutes": 26,
        "capabilities_required": ["backend", "stripe_api", "recurring"],
        "revenue_impact": "critical"
    },
    
    "analytics_dashboard": {
        "category": "saas",
        "description": "User analytics and behavior tracking",
        "required_for": [],
        "dependencies": ["dashboard_ui"],
        "complexity": "high",
        "build_time_minutes": 24,
        "capabilities_required": ["backend", "analytics", "data_viz"],
        "revenue_impact": "high"
    },
    
    "usage_analytics": {
        "category": "saas",
        "description": "Track feature usage and user engagement",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 18,
        "capabilities_required": ["backend", "analytics"],
        "revenue_impact": "medium"
    },
    
    "api_keys": {
        "category": "saas",
        "description": "API key generation and management",
        "required_for": [],
        "dependencies": ["rest_api"],
        "complexity": "medium",
        "build_time_minutes": 16,
        "capabilities_required": ["backend", "security"],
        "revenue_impact": "medium"
    },
    
    "webhooks": {
        "category": "saas",
        "description": "Webhook system for event notifications",
        "required_for": [],
        "dependencies": ["rest_api"],
        "complexity": "medium",
        "build_time_minutes": 18,
        "capabilities_required": ["backend", "async"],
        "revenue_impact": "medium"
    },
    
    "notification_system": {
        "category": "saas",
        "description": "In-app and email notifications",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 20,
        "capabilities_required": ["backend", "email", "real_time"],
        "revenue_impact": "low"
    },
    
    "team_collaboration": {
        "category": "saas",
        "description": "Team workspaces and collaboration features",
        "required_for": [],
        "dependencies": ["user_auth"],
        "complexity": "high",
        "build_time_minutes": 28,
        "capabilities_required": ["backend", "real_time", "permissions"],
        "revenue_impact": "high"
    },
    
    # ========================================
    # CONTENT (8 components)
    # ========================================
    "blog_system": {
        "category": "content",
        "description": "Blog with MDX support and CMS",
        "required_for": ["content"],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 18,
        "capabilities_required": ["frontend", "cms"],
        "revenue_impact": "medium"
    },
    
    "newsletter": {
        "category": "content",
        "description": "Email newsletter with signup and sending",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 16,
        "capabilities_required": ["backend", "email"],
        "revenue_impact": "medium"
    },
    
    "seo_optimization": {
        "category": "content",
        "description": "SEO meta tags and sitemap generation",
        "required_for": [],
        "dependencies": [],
        "complexity": "low",
        "build_time_minutes": 10,
        "capabilities_required": ["frontend", "seo"],
        "revenue_impact": "high"
    },
    
    "social_media": {
        "category": "content",
        "description": "Social media sharing and integration",
        "required_for": [],
        "dependencies": [],
        "complexity": "low",
        "build_time_minutes": 12,
        "capabilities_required": ["frontend", "api_integration"],
        "revenue_impact": "low"
    },
    
    "content_calendar": {
        "category": "content",
        "description": "Editorial calendar and scheduling",
        "required_for": [],
        "dependencies": ["blog_system"],
        "complexity": "medium",
        "build_time_minutes": 20,
        "capabilities_required": ["frontend", "backend", "scheduling"],
        "revenue_impact": "low"
    },
    
    "comment_system": {
        "category": "content",
        "description": "Comments with threading and moderation",
        "required_for": [],
        "dependencies": ["blog_system"],
        "complexity": "medium",
        "build_time_minutes": 18,
        "capabilities_required": ["backend", "user_content"],
        "revenue_impact": "low"
    },
    
    "video_platform": {
        "category": "content",
        "description": "Video hosting and streaming",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 30,
        "capabilities_required": ["backend", "video", "cdn"],
        "revenue_impact": "high"
    },
    
    "podcast_hosting": {
        "category": "content",
        "description": "Podcast RSS feed and player",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 20,
        "capabilities_required": ["backend", "audio"],
        "revenue_impact": "medium"
    },
    
    # ========================================
    # SUPPORT & COMMUNICATION (8 components)
    # ========================================
    "customer_support_bot": {
        "category": "support",
        "description": "AI chatbot for customer support",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 24,
        "capabilities_required": ["ai", "nlp", "chat"],
        "revenue_impact": "medium"
    },
    
    "live_chat": {
        "category": "support",
        "description": "Real-time customer chat",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 22,
        "capabilities_required": ["frontend", "backend", "websocket"],
        "revenue_impact": "medium"
    },
    
    "help_desk": {
        "category": "support",
        "description": "Ticket-based support system",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 26,
        "capabilities_required": ["backend", "workflow"],
        "revenue_impact": "low"
    },
    
    "knowledge_base": {
        "category": "support",
        "description": "Self-service documentation and FAQs",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 16,
        "capabilities_required": ["frontend", "search"],
        "revenue_impact": "low"
    },
    
    "email_marketing": {
        "category": "support",
        "description": "Email campaign management",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 18,
        "capabilities_required": ["backend", "email", "automation"],
        "revenue_impact": "high"
    },
    
    "docs": {
        "category": "support",
        "description": "API documentation with interactive examples",
        "required_for": [],
        "dependencies": ["rest_api"],
        "complexity": "medium",
        "build_time_minutes": 20,
        "capabilities_required": ["frontend", "documentation"],
        "revenue_impact": "low"
    },
    
    "community_forum": {
        "category": "support",
        "description": "Community discussion forum",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 28,
        "capabilities_required": ["backend", "user_content", "moderation"],
        "revenue_impact": "low"
    },
    
    "feedback_system": {
        "category": "support",
        "description": "User feedback collection and voting",
        "required_for": [],
        "dependencies": [],
        "complexity": "low",
        "build_time_minutes": 12,
        "capabilities_required": ["backend", "frontend"],
        "revenue_impact": "low"
    },
    
    # ========================================
    # ADVANCED FEATURES (10 components)
    # ========================================
    "a/b_testing": {
        "category": "advanced",
        "description": "A/B testing framework for features",
        "required_for": [],
        "dependencies": ["analytics_dashboard"],
        "complexity": "high",
        "build_time_minutes": 24,
        "capabilities_required": ["backend", "analytics", "statistics"],
        "revenue_impact": "high"
    },
    
    "feature_flags": {
        "category": "advanced",
        "description": "Feature flag system for gradual rollouts",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 14,
        "capabilities_required": ["backend", "config"],
        "revenue_impact": "low"
    },
    
    "role_permissions": {
        "category": "advanced",
        "description": "Role-based access control (RBAC)",
        "required_for": [],
        "dependencies": ["user_auth"],
        "complexity": "high",
        "build_time_minutes": 22,
        "capabilities_required": ["backend", "security", "permissions"],
        "revenue_impact": "medium"
    },
    
    "audit_logs": {
        "category": "advanced",
        "description": "Audit trail for all system actions",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 16,
        "capabilities_required": ["backend", "logging"],
        "revenue_impact": "low"
    },
    
    "backup_system": {
        "category": "advanced",
        "description": "Automated database backups",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 20,
        "capabilities_required": ["backend", "infrastructure"],
        "revenue_impact": "low"
    },
    
    "rate_limiting": {
        "category": "advanced",
        "description": "API rate limiting and throttling",
        "required_for": [],
        "dependencies": ["rest_api"],
        "complexity": "medium",
        "build_time_minutes": 14,
        "capabilities_required": ["backend", "security"],
        "revenue_impact": "low"
    },
    
    "error_tracking": {
        "category": "advanced",
        "description": "Error monitoring and alerting",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 16,
        "capabilities_required": ["backend", "monitoring"],
        "revenue_impact": "low"
    },
    
    "search_engine": {
        "category": "advanced",
        "description": "Full-text search with filters",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 26,
        "capabilities_required": ["backend", "search", "indexing"],
        "revenue_impact": "medium"
    },
    
    "file_upload": {
        "category": "advanced",
        "description": "File upload with cloud storage (S3)",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 18,
        "capabilities_required": ["backend", "storage"],
        "revenue_impact": "low"
    },
    
    "reporting_engine": {
        "category": "advanced",
        "description": "Custom report generation and export",
        "required_for": [],
        "dependencies": ["analytics_dashboard"],
        "complexity": "high",
        "build_time_minutes": 28,
        "capabilities_required": ["backend", "data_processing", "export"],
        "revenue_impact": "medium"
    },
    
    # ========================================
    # AGENT INFRASTRUCTURE (11 components)
    # ========================================
    "agentscope_alias": {
        "category": "agent_infrastructure",
        "description": "AgentScope alias system for agent communication and coordination",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 25,
        "capabilities_required": ["backend", "agents", "communication"],
        "revenue_impact": "low"
    },
    
    "data_juicer": {
        "category": "agent_infrastructure",
        "description": "Data Juicer agent for data preprocessing and quality enhancement",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 22,
        "capabilities_required": ["backend", "data_processing", "ml"],
        "revenue_impact": "medium"
    },
    
    "react_training": {
        "category": "agent_infrastructure",
        "description": "ReAct (Reasoning + Acting) training system for agent learning",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 30,
        "capabilities_required": ["backend", "ml", "reasoning"],
        "revenue_impact": "low"
    },
    
    "agentscope_runtime": {
        "category": "agent_infrastructure",
        "description": "AgentScope runtime environment for executing agent workflows",
        "required_for": [],
        "dependencies": ["agentscope_alias"],
        "complexity": "high",
        "build_time_minutes": 28,
        "capabilities_required": ["backend", "agents", "orchestration"],
        "revenue_impact": "low"
    },
    
    "llm_judge_rl": {
        "category": "agent_infrastructure",
        "description": "LLM Judge for reinforcement learning feedback and quality assessment",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 26,
        "capabilities_required": ["backend", "ml", "evaluation"],
        "revenue_impact": "low"
    },
    
    "agentgit": {
        "category": "agent_infrastructure",
        "description": "AgentGit - Git operations and version control for agent-generated code",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 18,
        "capabilities_required": ["backend", "git", "automation"],
        "revenue_impact": "low"
    },
    
    "mdp_document_ingester": {
        "category": "agent_infrastructure",
        "description": "MDP Document Ingester for processing and indexing documentation",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 20,
        "capabilities_required": ["backend", "data_processing", "indexing"],
        "revenue_impact": "low"
    },
    
    "mape_k_loop": {
        "category": "agent_infrastructure",
        "description": "MAPE-K (Monitor, Analyze, Plan, Execute, Knowledge) control loop",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 30,
        "capabilities_required": ["backend", "orchestration", "monitoring"],
        "revenue_impact": "low"
    },
    
    "toolrm_scoring": {
        "category": "agent_infrastructure",
        "description": "ToolRM scoring system for tool selection and ranking",
        "required_for": [],
        "dependencies": [],
        "complexity": "medium",
        "build_time_minutes": 22,
        "capabilities_required": ["backend", "ml", "ranking"],
        "revenue_impact": "low"
    },
    
    "flowmesh_routing": {
        "category": "agent_infrastructure",
        "description": "FlowMesh intelligent routing for multi-agent task distribution",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 28,
        "capabilities_required": ["backend", "routing", "orchestration"],
        "revenue_impact": "medium"
    },
    
    "cpu_offload": {
        "category": "agent_infrastructure",
        "description": "CPU offload system for optimizing model inference performance",
        "required_for": [],
        "dependencies": [],
        "complexity": "high",
        "build_time_minutes": 24,
        "capabilities_required": ["backend", "optimization", "hardware"],
        "revenue_impact": "low"
    },
}


def get_component_library() -> Dict[str, Dict[str, Any]]:
    """Get the full component library."""
    return COMPONENT_LIBRARY


def get_components_by_category(category: str) -> Dict[str, Dict[str, Any]]:
    """Get all components in a category."""
    return {
        name: info 
        for name, info in COMPONENT_LIBRARY.items() 
        if info["category"] == category
    }


def get_required_components(business_type: str) -> List[str]:
    """Get components required for a business type."""
    return [
        name
        for name, info in COMPONENT_LIBRARY.items()
        if business_type in info.get("required_for", [])
    ]


def resolve_dependencies(components: List[str]) -> List[str]:
    """Resolve all dependencies for a list of components."""
    result = set(components)
    
    for comp in list(result):
        if comp in COMPONENT_LIBRARY:
            deps = COMPONENT_LIBRARY[comp].get("dependencies", [])
            result.update(deps)
    
    return sorted(list(result))


def get_component_count() -> int:
    """Get total number of components in library."""
    return len(COMPONENT_LIBRARY)


# Stats for verification
if __name__ == "__main__":
    print(f"\n📦 Component Library Stats")
    print(f"="*60)
    print(f"Total Components: {get_component_count()}")
    print(f"\nBy Category:")
    
    categories = {}
    for name, info in COMPONENT_LIBRARY.items():
        cat = info["category"]
        categories[cat] = categories.get(cat, 0) + 1
    
    for cat, count in sorted(categories.items()):
        print(f"  {cat:15s}: {count:2d} components")
    
    print(f"\nRequired Components:")
    for biz_type in ["ecommerce", "saas", "content"]:
        required = get_required_components(biz_type)
        print(f"  {biz_type:10s}: {', '.join(required)}")
    
    print(f"\nComplexity Distribution:")
    complexity = {}
    for info in COMPONENT_LIBRARY.values():
        c = info["complexity"]
        complexity[c] = complexity.get(c, 0) + 1
    
    for level, count in sorted(complexity.items()):
        print(f"  {level:8s}: {count:2d} components")

