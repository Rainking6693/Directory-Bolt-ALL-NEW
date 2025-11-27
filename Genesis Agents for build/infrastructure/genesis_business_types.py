"""
Business Archetypes for Genesis Meta-Agent

10 validated business types with templates, requirements, and success metrics.
Each archetype is optimized for AI-autonomous creation with realistic timelines.

Version: 1.0
Date: November 3, 2025
Author: Cora (Agent Orchestration Specialist)
"""

from dataclasses import dataclass
from typing import Dict, List, Any, Optional
from enum import Enum


class DifficultyLevel(Enum):
    """Business creation difficulty levels"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


@dataclass
class BusinessArchetype:
    """
    Template for a business type.

    Attributes:
        type: Unique business type identifier
        name: Human-readable business name
        description: Business description (2-3 sentences)
        typical_features: List of standard features for this business type
        tech_stack: Recommended technology stack
        required_agents: List of agent types needed (from Genesis 15-agent ensemble)
        success_metrics: Expected success metrics with targets
        time_to_deploy: Estimated deployment time
        difficulty: Creation difficulty (easy/medium/hard)
        monetization_model: Default revenue model
        target_market: Primary target audience
    """
    type: str
    name: str
    description: str
    typical_features: List[str]
    tech_stack: List[str]
    required_agents: List[str]
    success_metrics: Dict[str, str]
    time_to_deploy: str
    difficulty: DifficultyLevel
    monetization_model: str
    target_market: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation"""
        return {
            "type": self.type,
            "name": self.name,
            "description": self.description,
            "typical_features": self.typical_features,
            "tech_stack": self.tech_stack,
            "required_agents": self.required_agents,
            "success_metrics": self.success_metrics,
            "time_to_deploy": self.time_to_deploy,
            "difficulty": self.difficulty.value,
            "monetization_model": self.monetization_model,
            "target_market": self.target_market
        }


# Define 10 business archetypes
BUSINESS_ARCHETYPES: Dict[str, BusinessArchetype] = {
    "saas_tool": BusinessArchetype(
        type="saas_tool",
        name="Simple SaaS Tool",
        description="Focused single-purpose web tool (e.g., text improver, image resizer, "
                    "grammar checker). Provides immediate value through a clean web interface. "
                    "Monetizes via freemium model with premium tier.",
        typical_features=[
            "User input form (text, file upload, or URL)",
            "Processing logic (API integration or local compute)",
            "Result display with download/copy functionality",
            "Free tier with rate limiting",
            "Premium tier with enhanced features",
            "User accounts for premium users (optional)",
            "Simple dashboard for usage tracking"
        ],
        tech_stack=[
            "Next.js 14",
            "TypeScript",
            "Tailwind CSS",
            "OpenAI API or similar",
            "Vercel (deployment)",
            "Stripe (payments)",
            "Supabase or MongoDB (user data)"
        ],
        required_agents=[
            "builder_agent",
            "qa_agent",
            "deploy_agent",
            "content_agent",
            "billing_agent"
        ],
        success_metrics={
            "time_to_first_user": "< 48 hours",
            "conversion_rate": "> 2%",
            "deployment_success": "100%",
            "page_load_time": "< 2 seconds"
        },
        time_to_deploy="< 4 hours",
        difficulty=DifficultyLevel.EASY,
        monetization_model="Freemium (Free tier + $9-29/month premium)",
        target_market="Professionals, content creators, students"
    ),

    "content_website": BusinessArchetype(
        type="content_website",
        name="AI-Generated Content Website",
        description="Blog, news, or educational content site with AI-written articles optimized "
                    "for SEO. Automatically generates and publishes content on schedule. "
                    "Monetizes via ads, affiliate links, or newsletter subscriptions.",
        typical_features=[
            "Article listing page with categories",
            "Individual article pages with rich formatting",
            "AI content generation pipeline (scheduled or on-demand)",
            "SEO optimization (meta tags, sitemap, structured data)",
            "Newsletter signup with automated emails",
            "Ad placements (Google AdSense or similar)",
            "RSS feed for syndication",
            "Related articles sidebar"
        ],
        tech_stack=[
            "Next.js 14 with App Router",
            "MDX or Markdown for content",
            "OpenAI API (GPT-4o) for content generation",
            "Vercel (deployment)",
            "Mailchimp or SendGrid (newsletter)",
            "Google AdSense or similar (ads)"
        ],
        required_agents=[
            "builder_agent",
            "content_agent",
            "seo_agent",
            "deploy_agent",
            "email_agent"
        ],
        success_metrics={
            "articles_published": "> 10 in first week",
            "organic_traffic": "> 100 visitors/month",
            "newsletter_signups": "> 20 in first month",
            "seo_score": "> 85/100 (Lighthouse)"
        },
        time_to_deploy="< 5 hours",
        difficulty=DifficultyLevel.EASY,
        monetization_model="Ads + affiliate links + newsletter sponsorships",
        target_market="Niche audiences (tech, finance, health, education)"
    ),

    "ecommerce_store": BusinessArchetype(
        type="ecommerce_store",
        name="Digital Product E-Commerce",
        description="Store selling digital products (templates, ebooks, courses, stock media, "
                    "design assets). Automated delivery via email. Stripe integration for payments. "
                    "Customer dashboard for purchase history and downloads.",
        typical_features=[
            "Product catalog with search and filtering",
            "Product detail pages with preview/demo",
            "Shopping cart with real-time updates",
            "Stripe checkout integration",
            "Automated digital download delivery via email",
            "Customer dashboard (purchase history, downloads)",
            "Product reviews and ratings",
            "Discount code system"
        ],
        tech_stack=[
            "Next.js 14",
            "Stripe for payments",
            "Vercel (deployment)",
            "Supabase (database + storage)",
            "SendGrid (transactional emails)",
            "Tailwind CSS"
        ],
        required_agents=[
            "builder_agent",
            "qa_agent",
            "deploy_agent",
            "billing_agent",
            "content_agent"
        ],
        success_metrics={
            "products_listed": "> 5",
            "first_sale": "< 7 days",
            "checkout_conversion": "> 3%",
            "download_success_rate": "> 99%"
        },
        time_to_deploy="< 6 hours",
        difficulty=DifficultyLevel.MEDIUM,
        monetization_model="Direct sales (one-time or subscription)",
        target_market="Creators, designers, developers, educators"
    ),

    "landing_page_waitlist": BusinessArchetype(
        type="landing_page_waitlist",
        name="Product Landing Page + Waitlist",
        description="High-converting landing page for pre-launch product with email waitlist. "
                    "Captures early adopters before launch. Simple analytics to track conversion. "
                    "Perfect for validating product ideas.",
        typical_features=[
            "Hero section with compelling headline + CTA",
            "Features section with icons/images",
            "Benefits/value proposition section",
            "Pricing table (optional)",
            "Email signup form (waitlist)",
            "Social proof (testimonials, logos, stats)",
            "FAQ section",
            "Analytics tracking (conversions, sources)"
        ],
        tech_stack=[
            "Next.js 14",
            "Tailwind CSS",
            "Vercel (deployment)",
            "Mailchimp or ConvertKit (email list)",
            "Google Analytics",
            "Stripe (for pre-orders, optional)"
        ],
        required_agents=[
            "builder_agent",
            "content_agent",
            "marketing_agent",
            "deploy_agent",
            "analyst_agent"
        ],
        success_metrics={
            "page_load_time": "< 1.5 seconds",
            "mobile_responsive": "100%",
            "signup_conversion": "> 5%",
            "time_to_deploy": "< 2 hours"
        },
        time_to_deploy="< 2 hours",
        difficulty=DifficultyLevel.EASY,
        monetization_model="Future product sales (validation phase)",
        target_market="Early adopters, product enthusiasts"
    ),

    "saas_dashboard": BusinessArchetype(
        type="saas_dashboard",
        name="Data Dashboard SaaS",
        description="Analytics dashboard that aggregates data from multiple sources (APIs, "
                    "databases, spreadsheets). Provides insights via charts, tables, and reports. "
                    "Multi-user support with role-based access control.",
        typical_features=[
            "User authentication (email/password + OAuth)",
            "Dashboard with customizable widgets",
            "Data source integrations (API connectors)",
            "Real-time charts and graphs",
            "Report generation (PDF export)",
            "Team collaboration features",
            "Role-based access control",
            "Scheduled email reports"
        ],
        tech_stack=[
            "Next.js 14",
            "TypeScript",
            "Chart.js or Recharts",
            "NextAuth.js (authentication)",
            "PostgreSQL or MongoDB",
            "Vercel (deployment)",
            "Stripe (subscriptions)"
        ],
        required_agents=[
            "builder_agent",
            "qa_agent",
            "analyst_agent",
            "security_agent",
            "deploy_agent",
            "billing_agent"
        ],
        success_metrics={
            "data_refresh_time": "< 30 seconds",
            "concurrent_users": "> 100",
            "uptime": "> 99.5%",
            "user_retention": "> 60% (30 days)"
        },
        time_to_deploy="< 8 hours",
        difficulty=DifficultyLevel.MEDIUM,
        monetization_model="Subscription ($29-99/month per user)",
        target_market="Business teams, analysts, managers"
    ),

    "marketplace": BusinessArchetype(
        type="marketplace",
        name="Digital Marketplace Platform",
        description="Two-sided marketplace connecting buyers and sellers (e.g., freelance services, "
                    "digital goods, rentals). Handles transactions, messaging, reviews, and escrow. "
                    "Takes commission on each sale.",
        typical_features=[
            "Seller onboarding and profiles",
            "Buyer browsing and search",
            "Listing creation with media uploads",
            "In-app messaging system",
            "Transaction handling with escrow",
            "Review and rating system",
            "Admin dashboard for moderation",
            "Commission calculation and payout"
        ],
        tech_stack=[
            "Next.js 14",
            "PostgreSQL",
            "Stripe Connect (marketplace payments)",
            "Supabase Storage (media)",
            "Vercel (deployment)",
            "SendGrid (notifications)"
        ],
        required_agents=[
            "builder_agent",
            "qa_agent",
            "security_agent",
            "billing_agent",
            "legal_agent",
            "support_agent",
            "deploy_agent"
        ],
        success_metrics={
            "first_transaction": "< 14 days",
            "buyer_seller_ratio": "3:1",
            "transaction_success_rate": "> 95%",
            "dispute_rate": "< 5%"
        },
        time_to_deploy="< 12 hours",
        difficulty=DifficultyLevel.HARD,
        monetization_model="Commission (10-20% per transaction)",
        target_market="Buyers and sellers in specific niche"
    ),

    "ai_chatbot_service": BusinessArchetype(
        type="ai_chatbot_service",
        name="AI Chatbot as a Service",
        description="White-label AI chatbot that businesses can embed on their websites. "
                    "Customizable personality, knowledge base integration, and analytics. "
                    "Handles customer support, lead qualification, and FAQ automation.",
        typical_features=[
            "Embeddable chat widget (JavaScript snippet)",
            "Admin dashboard for configuration",
            "Knowledge base upload (docs, FAQs, URLs)",
            "Conversation analytics and logs",
            "Multi-language support",
            "Handoff to human support",
            "Custom branding (colors, logo, tone)",
            "API for programmatic access"
        ],
        tech_stack=[
            "Next.js 14 (admin dashboard)",
            "React (chat widget)",
            "OpenAI API or Claude API",
            "Vector database (Pinecone or Supabase pgvector)",
            "Vercel (deployment)",
            "WebSocket or SSE (real-time chat)"
        ],
        required_agents=[
            "builder_agent",
            "qa_agent",
            "analyst_agent",
            "support_agent",
            "deploy_agent",
            "billing_agent"
        ],
        success_metrics={
            "response_time": "< 2 seconds",
            "accuracy_rate": "> 85%",
            "customer_satisfaction": "> 4/5 stars",
            "conversations_handled": "> 100/month"
        },
        time_to_deploy="< 7 hours",
        difficulty=DifficultyLevel.MEDIUM,
        monetization_model="Subscription ($49-299/month based on usage)",
        target_market="Small businesses, e-commerce, SaaS companies"
    ),

    "api_service": BusinessArchetype(
        type="api_service",
        name="API-as-a-Service",
        description="RESTful API providing specific functionality (e.g., PDF generation, "
                    "image optimization, data enrichment). Includes API key management, "
                    "rate limiting, and usage-based billing.",
        typical_features=[
            "RESTful API endpoints",
            "API key generation and management",
            "Rate limiting per tier",
            "Usage tracking and analytics",
            "Developer documentation (interactive)",
            "SDKs for popular languages (optional)",
            "Webhook support for async operations",
            "Status page and uptime monitoring"
        ],
        tech_stack=[
            "Python FastAPI or Node.js Express",
            "PostgreSQL (usage logs)",
            "Redis (rate limiting cache)",
            "Vercel or Railway (deployment)",
            "Stripe (usage-based billing)",
            "Swagger/OpenAPI (docs)"
        ],
        required_agents=[
            "builder_agent",
            "qa_agent",
            "security_agent",
            "deploy_agent",
            "billing_agent",
            "maintenance_agent"
        ],
        success_metrics={
            "api_latency": "< 200ms (p95)",
            "uptime": "> 99.9%",
            "successful_requests": "> 95%",
            "documentation_completeness": "100%"
        },
        time_to_deploy="< 6 hours",
        difficulty=DifficultyLevel.MEDIUM,
        monetization_model="Usage-based ($0.01-0.10 per API call or credit system)",
        target_market="Developers, agencies, SaaS companies"
    ),

    "newsletter_automation": BusinessArchetype(
        type="newsletter_automation",
        name="Automated Newsletter Service",
        description="AI-curated newsletter that automatically finds, summarizes, and sends "
                    "content on a schedule. Subscribers receive weekly/daily digests on "
                    "specific topics (e.g., tech news, AI updates, market trends).",
        typical_features=[
            "Content scraping and curation (RSS, APIs, web scraping)",
            "AI summarization of articles",
            "Email template builder",
            "Scheduling and automation",
            "Subscriber management (signup, unsubscribe)",
            "Analytics (open rate, click rate)",
            "Sponsorship ad slots",
            "Archive website for past newsletters"
        ],
        tech_stack=[
            "Python (content scraping + summarization)",
            "OpenAI API (summarization)",
            "SendGrid or Mailchimp (email delivery)",
            "Next.js (archive website)",
            "MongoDB (content + subscribers)",
            "Vercel or Railway (deployment)"
        ],
        required_agents=[
            "builder_agent",
            "content_agent",
            "email_agent",
            "analyst_agent",
            "deploy_agent"
        ],
        success_metrics={
            "subscribers": "> 100 in first month",
            "open_rate": "> 25%",
            "click_rate": "> 5%",
            "content_quality_score": "> 4/5"
        },
        time_to_deploy="< 5 hours",
        difficulty=DifficultyLevel.EASY,
        monetization_model="Sponsorships ($50-500 per newsletter) + premium tier",
        target_market="Niche communities (tech, finance, health, marketing)"
    ),

    "no_code_tool": BusinessArchetype(
        type="no_code_tool",
        name="No-Code Tool Builder",
        description="Visual builder for creating forms, landing pages, or simple apps without "
                    "coding. Drag-and-drop interface with templates and integrations. "
                    "Targets non-technical users (marketers, entrepreneurs).",
        typical_features=[
            "Drag-and-drop visual editor",
            "Pre-built templates (forms, landing pages, surveys)",
            "Form builder with validation rules",
            "Integration marketplace (Zapier-style)",
            "Custom domain support",
            "Responsive preview (mobile/desktop)",
            "Export to HTML/CSS",
            "Collaboration features (team workspaces)"
        ],
        tech_stack=[
            "React (editor interface)",
            "Next.js (hosting + backend)",
            "Draft.js or Slate.js (visual editor)",
            "PostgreSQL (user projects)",
            "Vercel (deployment)",
            "Stripe (subscriptions)"
        ],
        required_agents=[
            "builder_agent",
            "qa_agent",
            "analyst_agent",
            "security_agent",
            "support_agent",
            "deploy_agent",
            "billing_agent"
        ],
        success_metrics={
            "user_activation_rate": "> 40%",
            "projects_created": "> 50 in first month",
            "editor_performance": "< 100ms interaction latency",
            "user_retention": "> 50% (30 days)"
        },
        time_to_deploy="< 10 hours",
        difficulty=DifficultyLevel.HARD,
        monetization_model="Freemium (Free tier + $19-79/month premium)",
        target_market="Non-technical users (marketers, small business owners)"
    )
}


def get_business_archetype(business_type: str) -> Optional[BusinessArchetype]:
    """
    Get business archetype by type.

    Args:
        business_type: Type of business to retrieve

    Returns:
        BusinessArchetype if found, None otherwise
    """
    return BUSINESS_ARCHETYPES.get(business_type)


def get_all_archetypes() -> List[BusinessArchetype]:
    """
    Get all available business archetypes.

    Returns:
        List of all BusinessArchetype instances
    """
    return list(BUSINESS_ARCHETYPES.values())


def get_archetypes_by_difficulty(difficulty: DifficultyLevel) -> List[BusinessArchetype]:
    """
    Get business archetypes filtered by difficulty level.

    Args:
        difficulty: Difficulty level to filter by

    Returns:
        List of BusinessArchetype instances matching difficulty
    """
    return [
        archetype
        for archetype in BUSINESS_ARCHETYPES.values()
        if archetype.difficulty == difficulty
    ]


def get_archetype_types() -> List[str]:
    """
    Get list of all business type identifiers.

    Returns:
        List of business type strings
    """
    return list(BUSINESS_ARCHETYPES.keys())


def validate_business_type(business_type: str) -> bool:
    """
    Validate if a business type is supported.

    Args:
        business_type: Business type to validate

    Returns:
        True if valid, False otherwise
    """
    return business_type in BUSINESS_ARCHETYPES


# Summary statistics
def get_archetype_statistics() -> Dict[str, Any]:
    """
    Get statistics about available business archetypes.

    Returns:
        Dict with archetype statistics
    """
    archetypes = list(BUSINESS_ARCHETYPES.values())

    return {
        "total_archetypes": len(archetypes),
        "by_difficulty": {
            "easy": len(get_archetypes_by_difficulty(DifficultyLevel.EASY)),
            "medium": len(get_archetypes_by_difficulty(DifficultyLevel.MEDIUM)),
            "hard": len(get_archetypes_by_difficulty(DifficultyLevel.HARD))
        },
        "average_deployment_time": "< 6 hours",  # Approximate average
        "most_common_agents": [
            "builder_agent",
            "qa_agent",
            "deploy_agent",
            "billing_agent",
            "content_agent"
        ]
    }
