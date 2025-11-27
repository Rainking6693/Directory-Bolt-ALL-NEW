"""
Product Templates - Business Type Templates with Pricing & Features
===================================================================

Provides pre-configured templates for 10 business types with:
- Default pricing tiers (Free, Standard, Premium, Enterprise)
- Feature matrices (which features in which tier)
- Tech stack recommendations
- Monetization strategies
- Target audience profiles

Used by ProductGenerator for consistent product creation.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set


class PricingTier(Enum):
    """Standard pricing tiers for all business types."""
    FREE = "free"
    STANDARD = "standard"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"


@dataclass
class PricingStrategy:
    """Pricing configuration for a specific tier."""
    tier: PricingTier
    price_monthly: float  # USD per month
    price_annually: float  # USD per year (discounted)
    features: List[str]  # Features included in this tier
    limits: Dict[str, int]  # Usage limits (users, API calls, storage, etc.)
    stripe_product_id: Optional[str] = None  # Populated after Stripe creation


@dataclass
class ProductTemplate:
    """Complete template for a business type."""
    business_type: str
    display_name: str
    description: str
    target_audience: str
    monetization_model: str
    
    # Pricing tiers
    pricing_tiers: List[PricingStrategy]
    
    # Feature matrix (all features across all tiers)
    all_features: List[str]
    
    # Tech stack
    tech_stack: Dict[str, str]  # component -> technology
    
    # Required integrations
    required_integrations: List[str]
    
    # Optional features (can be enabled per business)
    optional_features: List[str] = field(default_factory=list)
    
    # Complexity estimate (1-10)
    complexity_score: int = 5
    
    # Estimated time to build (hours)
    estimated_hours: float = 40.0


# ============================================================================
# 10 BUSINESS TYPE TEMPLATES
# ============================================================================

# 1. SAAS PRODUCT
SAAS_TEMPLATE = ProductTemplate(
    business_type="saas",
    display_name="SaaS Application",
    description="Software-as-a-Service web application with subscriptions",
    target_audience="B2B and B2C software users",
    monetization_model="Monthly/Annual subscriptions",
    
    pricing_tiers=[
        PricingStrategy(
            tier=PricingTier.FREE,
            price_monthly=0.0,
            price_annually=0.0,
            features=[
                "Basic dashboard access",
                "Up to 5 projects",
                "Community support",
                "7-day data retention"
            ],
            limits={
                "users": 1,
                "projects": 5,
                "api_calls_per_day": 100,
                "storage_gb": 1
            }
        ),
        PricingStrategy(
            tier=PricingTier.STANDARD,
            price_monthly=29.0,
            price_annually=290.0,  # 2 months free
            features=[
                "All Free features",
                "Up to 50 projects",
                "Email support",
                "30-day data retention",
                "API access",
                "Export data"
            ],
            limits={
                "users": 5,
                "projects": 50,
                "api_calls_per_day": 10000,
                "storage_gb": 10
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=99.0,
            price_annually=990.0,
            features=[
                "All Standard features",
                "Unlimited projects",
                "Priority support",
                "Unlimited data retention",
                "Advanced analytics",
                "Custom integrations",
                "White-label options"
            ],
            limits={
                "users": 25,
                "projects": -1,  # Unlimited
                "api_calls_per_day": 100000,
                "storage_gb": 100
            }
        ),
        PricingStrategy(
            tier=PricingTier.ENTERPRISE,
            price_monthly=499.0,
            price_annually=4990.0,
            features=[
                "All Premium features",
                "Unlimited users",
                "24/7 phone support",
                "Dedicated account manager",
                "SLA guarantee (99.9%)",
                "SSO integration",
                "Custom contracts"
            ],
            limits={
                "users": -1,  # Unlimited
                "projects": -1,
                "api_calls_per_day": -1,
                "storage_gb": -1
            }
        ),
    ],
    
    all_features=[
        "User authentication",
        "Dashboard analytics",
        "API access",
        "Data export",
        "Team collaboration",
        "Project management",
        "Real-time updates",
        "Email notifications",
        "Advanced analytics",
        "Custom integrations",
        "White-label branding",
        "SSO integration"
    ],
    
    tech_stack={
        "frontend": "Next.js 14 + React 18 + TypeScript",
        "styling": "Tailwind CSS",
        "backend": "Supabase (PostgreSQL + Auth)",
        "auth": "Supabase Auth",
        "api": "Next.js API Routes",
        "deployment": "Vercel",
        "monitoring": "Vercel Analytics"
    },
    
    required_integrations=["Supabase", "Stripe"],
    optional_features=["Slack notifications", "Zapier integration", "Mobile app"],
    complexity_score=7,
    estimated_hours=60.0
)


# 2. CONTENT WEBSITE
CONTENT_TEMPLATE = ProductTemplate(
    business_type="content",
    display_name="Content Website",
    description="Blog, news site, or content platform with MDX support",
    target_audience="Content creators, bloggers, publishers",
    monetization_model="Advertising, sponsorships, memberships",
    
    pricing_tiers=[
        PricingStrategy(
            tier=PricingTier.FREE,
            price_monthly=0.0,
            price_annually=0.0,
            features=[
                "All public articles",
                "Email newsletter signup",
                "Basic search",
                "RSS feed"
            ],
            limits={
                "articles_per_month": -1,  # Unlimited reading
                "downloads": 0,
                "premium_content": 0
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=9.0,
            price_annually=90.0,
            features=[
                "All Free features",
                "Premium articles",
                "Ad-free experience",
                "Download articles (PDF)",
                "Early access to new content",
                "Member-only discussions"
            ],
            limits={
                "articles_per_month": -1,
                "downloads": -1,
                "premium_content": -1
            }
        ),
    ],
    
    all_features=[
        "Blog posts with MDX",
        "Author profiles",
        "Categories and tags",
        "Search functionality",
        "RSS feed",
        "SEO optimization",
        "Social sharing",
        "Comments system",
        "Email newsletter",
        "Premium content",
        "Ad integration"
    ],
    
    tech_stack={
        "frontend": "Next.js 14 + React 18 + TypeScript",
        "content": "MDX + Contentlayer",
        "styling": "Tailwind CSS",
        "seo": "next-seo",
        "analytics": "Vercel Analytics",
        "deployment": "Vercel"
    },
    
    required_integrations=["Contentlayer"],
    optional_features=["Comments (Disqus/Giscus)", "Newsletter (Mailchimp)", "Analytics (Google Analytics)"],
    complexity_score=4,
    estimated_hours=30.0
)


# 3. E-COMMERCE STORE
ECOMMERCE_TEMPLATE = ProductTemplate(
    business_type="ecommerce",
    display_name="E-Commerce Store",
    description="Online store with product catalog, cart, and payments",
    target_audience="Online shoppers",
    monetization_model="Product sales + transaction fees",
    
    pricing_tiers=[
        # No user tiers - pricing is per product sold
        PricingStrategy(
            tier=PricingTier.STANDARD,
            price_monthly=29.0,  # Platform fee for store owner
            price_annually=290.0,
            features=[
                "Product catalog (up to 100 products)",
                "Stripe checkout",
                "Order management",
                "Customer dashboard",
                "Email receipts",
                "Basic analytics"
            ],
            limits={
                "products": 100,
                "orders_per_month": 1000,
                "storage_gb": 5
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=99.0,
            price_annually=990.0,
            features=[
                "All Standard features",
                "Unlimited products",
                "Unlimited orders",
                "Advanced analytics",
                "Inventory management",
                "Abandoned cart recovery",
                "Discount codes"
            ],
            limits={
                "products": -1,
                "orders_per_month": -1,
                "storage_gb": 50
            }
        ),
    ],
    
    all_features=[
        "Product catalog",
        "Shopping cart",
        "Stripe checkout",
        "Order management",
        "Admin dashboard",
        "Inventory tracking",
        "Customer accounts",
        "Email notifications",
        "Discount codes",
        "Analytics dashboard",
        "Abandoned cart recovery"
    ],
    
    tech_stack={
        "frontend": "Next.js 14 + React 18 + TypeScript",
        "styling": "Tailwind CSS",
        "database": "PostgreSQL",
        "orm": "Prisma",
        "payments": "Stripe",
        "auth": "NextAuth.js",
        "deployment": "Vercel + Vercel Postgres"
    },
    
    required_integrations=["Stripe", "PostgreSQL"],
    optional_features=["Shipping integration", "Tax calculation", "Multi-currency"],
    complexity_score=8,
    estimated_hours=80.0
)


# 4. MARKETPLACE PLATFORM
MARKETPLACE_TEMPLATE = ProductTemplate(
    business_type="marketplace",
    display_name="Marketplace Platform",
    description="Two-sided marketplace connecting buyers and sellers",
    target_audience="Buyers and sellers in specific niche",
    monetization_model="Transaction fees (10-15% per sale)",
    
    pricing_tiers=[
        PricingStrategy(
            tier=PricingTier.FREE,
            price_monthly=0.0,
            price_annually=0.0,
            features=[
                "Seller account",
                "List up to 5 products",
                "Basic storefront",
                "Standard transaction fee (15%)"
            ],
            limits={
                "products": 5,
                "monthly_sales": 500  # USD
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=49.0,
            price_annually=490.0,
            features=[
                "All Free features",
                "Unlimited products",
                "Reduced fee (10%)",
                "Featured listings",
                "Analytics dashboard",
                "Priority support"
            ],
            limits={
                "products": -1,
                "monthly_sales": -1
            }
        ),
    ],
    
    all_features=[
        "Seller registration",
        "Product listings",
        "Buyer accounts",
        "Search and filters",
        "Ratings and reviews",
        "Transaction processing",
        "Escrow system",
        "Dispute resolution",
        "Seller analytics",
        "Commission management"
    ],
    
    tech_stack={
        "frontend": "Next.js 14 + React 18 + TypeScript",
        "styling": "Tailwind CSS",
        "database": "PostgreSQL",
        "orm": "Prisma",
        "payments": "Stripe Connect",
        "auth": "NextAuth.js",
        "deployment": "Vercel"
    },
    
    required_integrations=["Stripe Connect", "PostgreSQL"],
    optional_features=["Escrow", "Instant messaging", "Video calls"],
    complexity_score=9,
    estimated_hours=100.0
)


# 5. API SERVICE
API_SERVICE_TEMPLATE = ProductTemplate(
    business_type="api_service",
    display_name="API Service",
    description="RESTful API or GraphQL service with API key management",
    target_audience="Developers and businesses needing API access",
    monetization_model="API usage-based pricing",
    
    pricing_tiers=[
        PricingStrategy(
            tier=PricingTier.FREE,
            price_monthly=0.0,
            price_annually=0.0,
            features=[
                "1,000 API calls/month",
                "Basic endpoints",
                "Community support",
                "Rate limiting (10 req/min)"
            ],
            limits={
                "api_calls_per_month": 1000,
                "rate_limit_per_minute": 10,
                "concurrent_requests": 5
            }
        ),
        PricingStrategy(
            tier=PricingTier.STANDARD,
            price_monthly=49.0,
            price_annually=490.0,
            features=[
                "50,000 API calls/month",
                "All endpoints",
                "Email support",
                "Higher rate limits (100 req/min)",
                "Webhook support"
            ],
            limits={
                "api_calls_per_month": 50000,
                "rate_limit_per_minute": 100,
                "concurrent_requests": 50
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=199.0,
            price_annually=1990.0,
            features=[
                "500,000 API calls/month",
                "Priority support",
                "SLA guarantee (99.9%)",
                "Dedicated infrastructure",
                "Custom rate limits"
            ],
            limits={
                "api_calls_per_month": 500000,
                "rate_limit_per_minute": 1000,
                "concurrent_requests": 500
            }
        ),
    ],
    
    all_features=[
        "RESTful API endpoints",
        "API key management",
        "Rate limiting",
        "Usage analytics",
        "Webhook support",
        "API documentation",
        "SDK generation",
        "Authentication (OAuth2, JWT)",
        "Caching layer",
        "Monitoring and logging"
    ],
    
    tech_stack={
        "backend": "FastAPI + Python 3.11",
        "database": "PostgreSQL",
        "cache": "Redis",
        "api_docs": "OpenAPI (Swagger)",
        "auth": "JWT + OAuth2",
        "deployment": "Docker + Kubernetes",
        "monitoring": "Prometheus + Grafana"
    },
    
    required_integrations=["PostgreSQL", "Redis"],
    optional_features=["GraphQL endpoint", "WebSocket support", "Multi-region"],
    complexity_score=6,
    estimated_hours=50.0
)


# 6. MOBILE APP (Backend + PWA)
MOBILE_APP_TEMPLATE = ProductTemplate(
    business_type="mobile_app",
    display_name="Mobile App (PWA)",
    description="Progressive Web App that works like native mobile app",
    target_audience="Mobile users (iOS, Android, Web)",
    monetization_model="In-app purchases, subscriptions, ads",
    
    pricing_tiers=[
        PricingStrategy(
            tier=PricingTier.FREE,
            price_monthly=0.0,
            price_annually=0.0,
            features=[
                "Basic features",
                "Ads supported",
                "Limited offline access",
                "Community features"
            ],
            limits={
                "offline_storage_mb": 50,
                "push_notifications_per_day": 3
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=4.99,
            price_annually=49.90,
            features=[
                "All Free features",
                "Ad-free experience",
                "Full offline access",
                "Unlimited storage",
                "Unlimited push notifications",
                "Premium features"
            ],
            limits={
                "offline_storage_mb": -1,
                "push_notifications_per_day": -1
            }
        ),
    ],
    
    all_features=[
        "PWA installable",
        "Offline functionality",
        "Push notifications",
        "Camera access",
        "Geolocation",
        "Touch gestures",
        "App-like navigation",
        "Background sync",
        "Share API",
        "Payment integration"
    ],
    
    tech_stack={
        "frontend": "Next.js 14 + React 18 + TypeScript",
        "pwa": "next-pwa",
        "styling": "Tailwind CSS",
        "backend": "Next.js API Routes",
        "database": "Supabase",
        "push": "Web Push API",
        "deployment": "Vercel"
    },
    
    required_integrations=["Supabase", "Web Push"],
    optional_features=["Biometric auth", "AR features", "Offline-first sync"],
    complexity_score=7,
    estimated_hours=70.0
)


# 7. ANALYTICS DASHBOARD
ANALYTICS_DASHBOARD_TEMPLATE = ProductTemplate(
    business_type="analytics_dashboard",
    display_name="Analytics Dashboard",
    description="Data visualization and business intelligence dashboard",
    target_audience="Business analysts, data teams, executives",
    monetization_model="Per-user subscriptions",
    
    pricing_tiers=[
        PricingStrategy(
            tier=PricingTier.STANDARD,
            price_monthly=49.0,
            price_annually=490.0,
            features=[
                "Up to 10 dashboards",
                "Basic charts and graphs",
                "CSV export",
                "Email reports",
                "5 data sources"
            ],
            limits={
                "dashboards": 10,
                "data_rows": 100000,
                "users": 5,
                "data_sources": 5
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=149.0,
            price_annually=1490.0,
            features=[
                "Unlimited dashboards",
                "Advanced visualizations",
                "API access",
                "Scheduled reports",
                "Unlimited data sources",
                "Custom SQL queries"
            ],
            limits={
                "dashboards": -1,
                "data_rows": 10000000,
                "users": 25,
                "data_sources": -1
            }
        ),
        PricingStrategy(
            tier=PricingTier.ENTERPRISE,
            price_monthly=499.0,
            price_annually=4990.0,
            features=[
                "All Premium features",
                "White-label branding",
                "Embedded dashboards",
                "Advanced permissions",
                "SSO integration",
                "Dedicated support"
            ],
            limits={
                "dashboards": -1,
                "data_rows": -1,
                "users": -1,
                "data_sources": -1
            }
        ),
    ],
    
    all_features=[
        "Interactive charts",
        "Real-time data updates",
        "Custom dashboards",
        "Data filtering",
        "Export functionality",
        "Scheduled reports",
        "Alert system",
        "Multi-source integration",
        "SQL query builder",
        "Sharing and collaboration"
    ],
    
    tech_stack={
        "frontend": "Next.js 14 + React 18 + TypeScript",
        "charts": "Recharts + D3.js",
        "styling": "Tailwind CSS",
        "backend": "Next.js API Routes",
        "database": "PostgreSQL + TimescaleDB",
        "auth": "NextAuth.js",
        "deployment": "Vercel"
    },
    
    required_integrations=["PostgreSQL", "TimescaleDB"],
    optional_features=["Machine learning predictions", "Anomaly detection", "Data warehousing"],
    complexity_score=8,
    estimated_hours=75.0
)


# 8. BOOKING/SCHEDULING APP
BOOKING_TEMPLATE = ProductTemplate(
    business_type="booking",
    display_name="Booking & Scheduling",
    description="Appointment scheduling and booking platform",
    target_audience="Service providers (salons, consultants, coaches)",
    monetization_model="Monthly subscription per provider",
    
    pricing_tiers=[
        PricingStrategy(
            tier=PricingTier.FREE,
            price_monthly=0.0,
            price_annually=0.0,
            features=[
                "Up to 10 bookings/month",
                "Basic calendar",
                "Email reminders",
                "1 service type"
            ],
            limits={
                "bookings_per_month": 10,
                "service_types": 1,
                "staff_members": 1
            }
        ),
        PricingStrategy(
            tier=PricingTier.STANDARD,
            price_monthly=19.0,
            price_annually=190.0,
            features=[
                "Unlimited bookings",
                "Multiple services",
                "SMS reminders",
                "Payment processing",
                "3 staff members",
                "Custom branding"
            ],
            limits={
                "bookings_per_month": -1,
                "service_types": -1,
                "staff_members": 3
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=49.0,
            price_annually=490.0,
            features=[
                "All Standard features",
                "Unlimited staff",
                "Multi-location support",
                "Advanced analytics",
                "API access",
                "Waitlist management",
                "Group bookings"
            ],
            limits={
                "bookings_per_month": -1,
                "service_types": -1,
                "staff_members": -1
            }
        ),
    ],
    
    all_features=[
        "Online booking widget",
        "Calendar management",
        "Email/SMS reminders",
        "Payment processing",
        "Staff scheduling",
        "Service management",
        "Customer database",
        "Booking analytics",
        "Cancellation policy",
        "Waitlist management"
    ],
    
    tech_stack={
        "frontend": "Next.js 14 + React 18 + TypeScript",
        "calendar": "react-big-calendar",
        "styling": "Tailwind CSS",
        "database": "PostgreSQL",
        "orm": "Prisma",
        "payments": "Stripe",
        "notifications": "Twilio (SMS) + SendGrid (Email)",
        "deployment": "Vercel"
    },
    
    required_integrations=["Stripe", "Calendar API"],
    optional_features=["Google Calendar sync", "Zoom integration", "Payment plans"],
    complexity_score=7,
    estimated_hours=65.0
)


# 9. COMMUNITY/FORUM
COMMUNITY_TEMPLATE = ProductTemplate(
    business_type="community",
    display_name="Community Platform",
    description="Forum, discussion board, or community platform",
    target_audience="Community members, moderators, admins",
    monetization_model="Memberships, premium features, advertising",
    
    pricing_tiers=[
        PricingStrategy(
            tier=PricingTier.FREE,
            price_monthly=0.0,
            price_annually=0.0,
            features=[
                "Create discussions",
                "Reply to threads",
                "Basic profile",
                "Search posts"
            ],
            limits={
                "posts_per_day": 10,
                "attachments_per_post": 1
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=9.0,
            price_annually=90.0,
            features=[
                "All Free features",
                "Ad-free experience",
                "Custom profile theme",
                "Unlimited posts",
                "Private messaging",
                "Advanced search",
                "Member badge"
            ],
            limits={
                "posts_per_day": -1,
                "attachments_per_post": 10
            }
        ),
    ],
    
    all_features=[
        "Discussion threads",
        "User profiles",
        "Voting system",
        "Moderation tools",
        "Private messaging",
        "Notifications",
        "Search functionality",
        "User reputation",
        "Categories and tags",
        "Rich text editor"
    ],
    
    tech_stack={
        "frontend": "Next.js 14 + React 18 + TypeScript",
        "editor": "Tiptap or Lexical",
        "styling": "Tailwind CSS",
        "database": "PostgreSQL",
        "orm": "Prisma",
        "auth": "NextAuth.js",
        "realtime": "Supabase Realtime",
        "deployment": "Vercel"
    },
    
    required_integrations=["PostgreSQL"],
    optional_features=["Gamification", "Badges", "Live chat", "Events"],
    complexity_score=6,
    estimated_hours=55.0
)


# 10. DIRECTORY/LISTING
DIRECTORY_TEMPLATE = ProductTemplate(
    business_type="directory",
    display_name="Directory/Listing",
    description="Business directory or listing platform with search",
    target_audience="Service seekers and providers",
    monetization_model="Listing fees, featured placements",
    
    pricing_tiers=[
        PricingStrategy(
            tier=PricingTier.FREE,
            price_monthly=0.0,
            price_annually=0.0,
            features=[
                "Basic listing",
                "Contact information",
                "Business description",
                "Search visibility"
            ],
            limits={
                "listings": 1,
                "photos": 3,
                "categories": 1
            }
        ),
        PricingStrategy(
            tier=PricingTier.STANDARD,
            price_monthly=19.0,
            price_annually=190.0,
            features=[
                "All Free features",
                "Enhanced listing",
                "Unlimited photos",
                "Video support",
                "Multiple categories",
                "Analytics"
            ],
            limits={
                "listings": 3,
                "photos": -1,
                "categories": 5
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=49.0,
            price_annually=490.0,
            features=[
                "All Standard features",
                "Featured placement",
                "Priority in search",
                "Verified badge",
                "Lead generation tools",
                "Custom branding"
            ],
            limits={
                "listings": 10,
                "photos": -1,
                "categories": -1
            }
        ),
    ],
    
    all_features=[
        "Business listings",
        "Search and filters",
        "Category browsing",
        "Map integration",
        "Reviews and ratings",
        "Photo galleries",
        "Contact forms",
        "Claim listing",
        "Featured placements",
        "Analytics dashboard"
    ],
    
    tech_stack={
        "frontend": "Next.js 14 + React 18 + TypeScript",
        "styling": "Tailwind CSS",
        "database": "PostgreSQL",
        "orm": "Prisma",
        "search": "Algolia or Meilisearch",
        "maps": "Google Maps API",
        "deployment": "Vercel"
    },
    
    required_integrations=["PostgreSQL", "Maps API"],
    optional_features=["Paid advertising", "Lead generation", "Booking integration"],
    complexity_score=5,
    estimated_hours=45.0
)


# 7. COURSE/EDUCATION PLATFORM
EDUCATION_TEMPLATE = ProductTemplate(
    business_type="education",
    display_name="Education Platform",
    description="Online course platform with video lessons and quizzes",
    target_audience="Students and course creators",
    monetization_model="Course sales, subscriptions, platform fees",
    
    pricing_tiers=[
        PricingStrategy(
            tier=PricingTier.FREE,
            price_monthly=0.0,
            price_annually=0.0,
            features=[
                "Access to free courses",
                "Basic progress tracking",
                "Community forums",
                "Completion certificates"
            ],
            limits={
                "courses_enrolled": 3,
                "premium_courses": 0
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=29.0,
            price_annually=290.0,
            features=[
                "All Free features",
                "Access to all courses",
                "Download videos",
                "Priority support",
                "Advanced quizzes",
                "Personal progress analytics"
            ],
            limits={
                "courses_enrolled": -1,
                "premium_courses": -1
            }
        ),
    ],
    
    all_features=[
        "Video player",
        "Course structure",
        "Quiz system",
        "Progress tracking",
        "Certificates",
        "Discussion forums",
        "Instructor dashboard",
        "Student analytics",
        "Payment processing",
        "Content DRM"
    ],
    
    tech_stack={
        "frontend": "Next.js 14 + React 18 + TypeScript",
        "video": "Mux or Vimeo API",
        "styling": "Tailwind CSS",
        "database": "PostgreSQL",
        "orm": "Prisma",
        "payments": "Stripe",
        "auth": "NextAuth.js",
        "deployment": "Vercel"
    },
    
    required_integrations=["Video platform", "Stripe"],
    optional_features=["Live streaming", "Interactive coding", "Certifications"],
    complexity_score=8,
    estimated_hours=85.0
)


# 8. CRM SYSTEM
CRM_TEMPLATE = ProductTemplate(
    business_type="crm",
    display_name="CRM System",
    description="Customer relationship management and sales pipeline",
    target_audience="Sales teams, customer success teams",
    monetization_model="Per-user subscriptions",
    
    pricing_tiers=[
        PricingStrategy(
            tier=PricingTier.STANDARD,
            price_monthly=25.0,
            price_annually=250.0,
            features=[
                "Contact management",
                "Deal pipeline",
                "Task management",
                "Email integration",
                "Basic reporting",
                "Up to 5 users"
            ],
            limits={
                "contacts": 1000,
                "deals": 100,
                "users": 5,
                "email_tracking": 500
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=75.0,
            price_annually=750.0,
            features=[
                "All Standard features",
                "Unlimited contacts",
                "Advanced automation",
                "Custom fields",
                "API access",
                "25 users",
                "Advanced analytics"
            ],
            limits={
                "contacts": -1,
                "deals": -1,
                "users": 25,
                "email_tracking": -1
            }
        ),
    ],
    
    all_features=[
        "Contact management",
        "Deal pipeline",
        "Task automation",
        "Email tracking",
        "Calendar integration",
        "Reporting dashboard",
        "Activity timeline",
        "Custom fields",
        "Team collaboration",
        "Mobile app"
    ],
    
    tech_stack={
        "frontend": "Next.js 14 + React 18 + TypeScript",
        "styling": "Tailwind CSS",
        "database": "PostgreSQL",
        "orm": "Prisma",
        "email": "SendGrid API",
        "auth": "NextAuth.js",
        "deployment": "Vercel"
    },
    
    required_integrations=["PostgreSQL", "Email API"],
    optional_features=["Zapier integration", "Phone integration", "AI insights"],
    complexity_score=7,
    estimated_hours=70.0
)


# 9. SOCIAL NETWORK
SOCIAL_NETWORK_TEMPLATE = ProductTemplate(
    business_type="social_network",
    display_name="Social Network",
    description="Social networking platform with feeds, profiles, and connections",
    target_audience="General users, niche communities",
    monetization_model="Advertising, premium features, virtual goods",
    
    pricing_tiers=[
        PricingStrategy(
            tier=PricingTier.FREE,
            price_monthly=0.0,
            price_annually=0.0,
            features=[
                "Create profile",
                "Post updates",
                "Follow users",
                "Like and comment",
                "Basic messaging"
            ],
            limits={
                "posts_per_day": 50,
                "connections": 500,
                "messages_per_day": 100
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=9.99,
            price_annually=99.90,
            features=[
                "All Free features",
                "Ad-free experience",
                "Unlimited posts",
                "Unlimited connections",
                "Advanced privacy",
                "Profile customization",
                "Premium badge"
            ],
            limits={
                "posts_per_day": -1,
                "connections": -1,
                "messages_per_day": -1
            }
        ),
    ],
    
    all_features=[
        "User profiles",
        "News feed",
        "Posts (text, images, videos)",
        "Like and comment",
        "Follow/unfollow",
        "Direct messaging",
        "Notifications",
        "Privacy settings",
        "Content moderation",
        "Search users"
    ],
    
    tech_stack={
        "frontend": "Next.js 14 + React 18 + TypeScript",
        "styling": "Tailwind CSS",
        "database": "PostgreSQL",
        "orm": "Prisma",
        "realtime": "Supabase Realtime or Pusher",
        "storage": "Supabase Storage or S3",
        "auth": "NextAuth.js",
        "deployment": "Vercel"
    },
    
    required_integrations=["PostgreSQL", "Realtime service", "File storage"],
    optional_features=["Stories", "Live streaming", "Groups", "Events"],
    complexity_score=9,
    estimated_hours=95.0
)


# 10. PROJECT MANAGEMENT
PROJECT_MANAGEMENT_TEMPLATE = ProductTemplate(
    business_type="project_management",
    display_name="Project Management",
    description="Task and project management platform for teams",
    target_audience="Teams, project managers, freelancers",
    monetization_model="Per-user subscriptions",
    
    pricing_tiers=[
        PricingStrategy(
            tier=PricingTier.FREE,
            price_monthly=0.0,
            price_annually=0.0,
            features=[
                "Up to 3 projects",
                "Basic task management",
                "Up to 5 team members",
                "File attachments (100MB)"
            ],
            limits={
                "projects": 3,
                "users": 5,
                "tasks_per_project": 50,
                "storage_mb": 100
            }
        ),
        PricingStrategy(
            tier=PricingTier.STANDARD,
            price_monthly=12.0,
            price_annually=120.0,
            features=[
                "Unlimited projects",
                "Advanced task management",
                "Up to 50 team members",
                "Gantt charts",
                "Time tracking",
                "File storage (10GB)"
            ],
            limits={
                "projects": -1,
                "users": 50,
                "tasks_per_project": -1,
                "storage_mb": 10240
            }
        ),
        PricingStrategy(
            tier=PricingTier.PREMIUM,
            price_monthly=24.0,
            price_annually=240.0,
            features=[
                "All Standard features",
                "Unlimited users",
                "Resource management",
                "Advanced reporting",
                "API access",
                "Priority support",
                "File storage (100GB)"
            ],
            limits={
                "projects": -1,
                "users": -1,
                "tasks_per_project": -1,
                "storage_mb": 102400
            }
        ),
    ],
    
    all_features=[
        "Task management",
        "Project boards (Kanban)",
        "Gantt charts",
        "Time tracking",
        "Team collaboration",
        "File sharing",
        "Comments and mentions",
        "Due dates and reminders",
        "Progress tracking",
        "Reporting dashboard"
    ],
    
    tech_stack={
        "frontend": "Next.js 14 + React 18 + TypeScript",
        "kanban": "react-beautiful-dnd",
        "styling": "Tailwind CSS",
        "database": "PostgreSQL",
        "orm": "Prisma",
        "auth": "NextAuth.js",
        "realtime": "Supabase Realtime",
        "deployment": "Vercel"
    },
    
    required_integrations=["PostgreSQL"],
    optional_features=["Slack integration", "GitHub integration", "Calendar sync"],
    complexity_score=7,
    estimated_hours=70.0
)


# ============================================================================
# TEMPLATE REGISTRY
# ============================================================================

BUSINESS_TEMPLATES: Dict[str, ProductTemplate] = {
    "saas": SAAS_TEMPLATE,
    "content": CONTENT_TEMPLATE,
    "ecommerce": ECOMMERCE_TEMPLATE,
    "marketplace": MARKETPLACE_TEMPLATE,
    "api_service": API_SERVICE_TEMPLATE,
    "mobile_app": MOBILE_APP_TEMPLATE,
    "analytics_dashboard": ANALYTICS_DASHBOARD_TEMPLATE,
    "booking": BOOKING_TEMPLATE,
    "community": COMMUNITY_TEMPLATE,
    "project_management": PROJECT_MANAGEMENT_TEMPLATE,
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_template(business_type: str) -> Optional[ProductTemplate]:
    """
    Get template for a specific business type.
    
    Args:
        business_type: Type of business (e.g., "saas", "ecommerce")
    
    Returns:
        ProductTemplate or None if not found
    """
    return BUSINESS_TEMPLATES.get(business_type.lower())


def list_business_types() -> List[str]:
    """
    List all available business types.
    
    Returns:
        List of business type keys
    """
    return list(BUSINESS_TEMPLATES.keys())


def get_pricing_for_tier(template: ProductTemplate, tier: PricingTier) -> Optional[PricingStrategy]:
    """
    Get pricing strategy for a specific tier.
    
    Args:
        template: Product template
        tier: Pricing tier
    
    Returns:
        PricingStrategy or None if tier not available
    """
    for pricing in template.pricing_tiers:
        if pricing.tier == tier:
            return pricing
    return None


def estimate_revenue(
    template: ProductTemplate,
    expected_users_by_tier: Dict[PricingTier, int],
    use_annual: bool = False
) -> float:
    """
    Estimate monthly or annual revenue based on user distribution.
    
    Args:
        template: Product template
        expected_users_by_tier: Expected number of users per tier
        use_annual: Use annual pricing instead of monthly
    
    Returns:
        Estimated revenue in USD
    """
    revenue = 0.0
    
    for tier, user_count in expected_users_by_tier.items():
        pricing = get_pricing_for_tier(template, tier)
        if pricing:
            price = pricing.price_annually if use_annual else pricing.price_monthly
            revenue += price * user_count
    
    return revenue


def get_feature_matrix(template: ProductTemplate) -> Dict[PricingTier, List[str]]:
    """
    Get feature matrix showing which features are in which tier.
    
    Args:
        template: Product template
    
    Returns:
        Dict mapping tier to list of features
    """
    matrix = {}
    for pricing in template.pricing_tiers:
        matrix[pricing.tier] = pricing.features
    return matrix

