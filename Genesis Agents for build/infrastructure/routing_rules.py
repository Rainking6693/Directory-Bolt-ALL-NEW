"""
Routing Rules Configuration for Genesis 15-Agent Ensemble
Separates routing logic from HALORouter implementation for easier maintenance
"""
from typing import Dict, List
from infrastructure.halo_router import RoutingRule, AgentCapability


def get_genesis_15_agents() -> Dict[str, AgentCapability]:
    """
    Genesis 15-agent registry with capabilities

    Agent Categories:
    1. Design & Planning (2 agents): spec_agent, architect_agent
    2. Implementation (3 agents): builder_agent, frontend_agent, backend_agent
    3. Testing & QA (2 agents): qa_agent, security_agent
    4. Infrastructure (2 agents): deploy_agent, monitoring_agent
    5. Go-to-Market (2 agents): marketing_agent, sales_agent
    6. Customer Success (1 agent): support_agent
    7. Analytics (1 agent): analytics_agent
    8. Research (1 agent): research_agent
    9. Finance (1 agent): finance_agent

    Total: 15 agents covering full business lifecycle
    """
    return {
        # ===== DESIGN & PLANNING (Cheap, Fast) =====
        "spec_agent": AgentCapability(
            agent_name="spec_agent",
            supported_task_types=["design", "requirements", "architecture", "planning", "specification"],
            skills=["specification", "planning", "requirements_analysis", "documentation"],
            cost_tier="cheap",  # Gemini Flash
            success_rate=0.85,
            max_concurrent_tasks=10
        ),
        "architect_agent": AgentCapability(
            agent_name="architect_agent",
            supported_task_types=["architecture", "system_design", "technical_spec", "infrastructure_design"],
            skills=["system_design", "architecture", "scalability", "patterns", "best_practices"],
            cost_tier="medium",  # GPT-4o for complex reasoning
            success_rate=0.88,
            max_concurrent_tasks=8
        ),

        # ===== IMPLEMENTATION (Medium Cost, Claude for Code) =====
        "builder_agent": AgentCapability(
            agent_name="builder_agent",
            supported_task_types=["implement", "code", "build", "develop", "refactor", "generic", "api_call", "file_write"],
            skills=["coding", "debugging", "refactoring", "algorithm_design"],
            cost_tier="medium",  # Claude Sonnet for 72.7% SWE-bench accuracy
            success_rate=0.82,
            max_concurrent_tasks=6
        ),
        "frontend_agent": AgentCapability(
            agent_name="frontend_agent",
            supported_task_types=["frontend", "ui", "design_implementation", "web"],
            skills=["react", "vue", "css", "javascript", "typescript", "responsive_design"],
            cost_tier="medium",  # Claude Sonnet
            success_rate=0.80,
            max_concurrent_tasks=6
        ),
        "backend_agent": AgentCapability(
            agent_name="backend_agent",
            supported_task_types=["backend", "api", "database", "server"],
            skills=["python", "node", "sql", "api_design", "rest", "graphql"],
            cost_tier="medium",  # Claude Sonnet
            success_rate=0.83,
            max_concurrent_tasks=6
        ),

        # ===== TESTING & QA (Cheap, High Volume) =====
        "qa_agent": AgentCapability(
            agent_name="qa_agent",
            supported_task_types=["test", "validation", "qa", "quality_assurance", "verify", "test_run"],
            skills=["testing", "test_automation", "quality_assurance", "regression", "integration_testing"],
            cost_tier="cheap",  # Gemini Flash for fast execution
            success_rate=0.87,
            max_concurrent_tasks=15
        ),
        "security_agent": AgentCapability(
            agent_name="security_agent",
            supported_task_types=["security", "vulnerability_scan", "penetration_test", "audit"],
            skills=["security", "vulnerability_analysis", "compliance", "penetration_testing", "owasp"],
            cost_tier="medium",  # GPT-4o for security reasoning
            success_rate=0.90,
            max_concurrent_tasks=8
        ),

        # ===== INFRASTRUCTURE & DEPLOYMENT (Medium Cost) =====
        "deploy_agent": AgentCapability(
            agent_name="deploy_agent",
            supported_task_types=["deploy", "infrastructure", "devops", "cicd"],
            skills=["devops", "cloud", "kubernetes", "ci_cd", "docker", "aws", "azure"],
            cost_tier="medium",  # GPT-4o for orchestration
            success_rate=0.84,
            max_concurrent_tasks=8
        ),
        "monitoring_agent": AgentCapability(
            agent_name="monitoring_agent",
            supported_task_types=["monitor", "observability", "metrics", "logging", "alerting"],
            skills=["monitoring", "alerting", "performance_analysis", "prometheus", "grafana"],
            cost_tier="cheap",  # Gemini Flash for monitoring
            success_rate=0.86,
            max_concurrent_tasks=12
        ),

        # ===== GO-TO-MARKET (Cheap, Content Generation) =====
        "marketing_agent": AgentCapability(
            agent_name="marketing_agent",
            supported_task_types=["marketing", "promotion", "content", "advertising", "seo"],
            skills=["marketing", "advertising", "content_creation", "copywriting", "seo"],
            cost_tier="cheap",  # Gemini Flash for content
            success_rate=0.78,
            max_concurrent_tasks=12
        ),
        "sales_agent": AgentCapability(
            agent_name="sales_agent",
            supported_task_types=["sales", "outreach", "lead_generation", "prospecting"],
            skills=["sales", "outreach", "prospecting", "cold_email", "crm"],
            cost_tier="cheap",  # Gemini Flash
            success_rate=0.75,
            max_concurrent_tasks=15
        ),

        # ===== CUSTOMER SUCCESS (Cheap, Conversational) =====
        "support_agent": AgentCapability(
            agent_name="support_agent",
            supported_task_types=["support", "customer_service", "help", "troubleshooting"],
            skills=["customer_support", "troubleshooting", "documentation", "ticket_resolution"],
            cost_tier="cheap",  # Gemini Flash for conversational
            success_rate=0.82,
            max_concurrent_tasks=20  # High volume
        ),

        # ===== ANALYTICS & OPTIMIZATION (Medium Cost, Data Analysis) =====
        "analytics_agent": AgentCapability(
            agent_name="analytics_agent",
            supported_task_types=["analytics", "reporting", "data_analysis", "metrics"],
            skills=["data_analysis", "reporting", "visualization", "sql", "statistics"],
            cost_tier="medium",  # GPT-4o for data reasoning
            success_rate=0.85,
            max_concurrent_tasks=8
        ),

        # ===== RESEARCH & DISCOVERY (Medium Cost, Deep Reasoning) =====
        "research_agent": AgentCapability(
            agent_name="research_agent",
            supported_task_types=["research", "discovery", "investigation", "competitive_analysis"],
            skills=["research", "analysis", "competitive_intelligence", "market_research"],
            cost_tier="medium",  # GPT-4o for research
            success_rate=0.81,
            max_concurrent_tasks=8
        ),

        # ===== FINANCIAL OPERATIONS (Medium Cost, Precision Required) =====
        "finance_agent": AgentCapability(
            agent_name="finance_agent",
            supported_task_types=["finance", "accounting", "budgeting", "pricing", "revenue"],
            skills=["finance", "accounting", "budgeting", "pricing", "forecasting"],
            cost_tier="medium",  # GPT-4o for precision
            success_rate=0.88,
            max_concurrent_tasks=8
        ),
    }


def get_routing_rules() -> List[RoutingRule]:
    """
    Declarative routing rules for Genesis orchestration

    Rules are organized by priority:
    - Priority 20: Specialized rules (with metadata matching)
    - Priority 15: Type-specific rules (e.g., frontend vs backend)
    - Priority 10: General rules (task_type only)

    Higher priority rules are checked first.
    """
    return [
        # ===== SPECIALIZED RULES (Priority 20) =====
        RoutingRule(
            rule_id="ml_research",
            condition={"task_type": "implement", "domain": "ml"},
            target_agent="research_agent",
            priority=20,
            explanation="ML implementation routes to Research Agent (specialized ML knowledge)"
        ),
        RoutingRule(
            rule_id="cloud_deploy",
            condition={"task_type": "deploy", "platform": "cloud"},
            target_agent="deploy_agent",
            priority=20,
            explanation="Cloud deployment routes to Deploy Agent (cloud expertise)"
        ),

        # ===== TYPE-SPECIFIC RULES (Priority 15) =====
        RoutingRule(
            rule_id="frontend_impl",
            condition={"task_type": "frontend"},
            target_agent="frontend_agent",
            priority=15,
            explanation="Frontend tasks route to Frontend Agent (UI/UX specialization)"
        ),
        RoutingRule(
            rule_id="backend_impl",
            condition={"task_type": "backend"},
            target_agent="backend_agent",
            priority=15,
            explanation="Backend tasks route to Backend Agent (API/DB specialization)"
        ),

        # ===== GENERAL RULES (Priority 10) =====

        # Design & Planning
        RoutingRule(
            rule_id="design_task",
            condition={"task_type": "design"},
            target_agent="spec_agent",
            priority=10,
            explanation="Design tasks route to Spec Agent (requirements, planning)"
        ),
        RoutingRule(
            rule_id="architecture_task",
            condition={"task_type": "architecture"},
            target_agent="architect_agent",
            priority=10,
            explanation="Architecture tasks route to Architect Agent (system design)"
        ),
        RoutingRule(
            rule_id="requirements_task",
            condition={"task_type": "requirements"},
            target_agent="spec_agent",
            priority=10,
            explanation="Requirements gathering routes to Spec Agent"
        ),
        RoutingRule(
            rule_id="planning_task",
            condition={"task_type": "planning"},
            target_agent="spec_agent",
            priority=10,
            explanation="Planning tasks route to Spec Agent"
        ),

        # Implementation
        RoutingRule(
            rule_id="implement_task",
            condition={"task_type": "implement"},
            target_agent="builder_agent",
            priority=10,
            explanation="Implementation tasks route to Builder Agent (general coding)"
        ),
        RoutingRule(
            rule_id="code_task",
            condition={"task_type": "code"},
            target_agent="builder_agent",
            priority=10,
            explanation="Code tasks route to Builder Agent"
        ),
        RoutingRule(
            rule_id="build_task",
            condition={"task_type": "build"},
            target_agent="builder_agent",
            priority=10,
            explanation="Build tasks route to Builder Agent"
        ),

        # Testing & QA
        RoutingRule(
            rule_id="test_task",
            condition={"task_type": "test"},
            target_agent="qa_agent",
            priority=10,
            explanation="Testing tasks route to QA Agent (validation)"
        ),
        RoutingRule(
            rule_id="qa_task",
            condition={"task_type": "qa"},
            target_agent="qa_agent",
            priority=10,
            explanation="QA tasks route to QA Agent"
        ),
        RoutingRule(
            rule_id="security_task",
            condition={"task_type": "security"},
            target_agent="security_agent",
            priority=10,
            explanation="Security tasks route to Security Agent (vulnerability scanning)"
        ),

        # Infrastructure
        RoutingRule(
            rule_id="deploy_task",
            condition={"task_type": "deploy"},
            target_agent="deploy_agent",
            priority=10,
            explanation="Deployment tasks route to Deploy Agent (infrastructure)"
        ),
        RoutingRule(
            rule_id="infrastructure_task",
            condition={"task_type": "infrastructure"},
            target_agent="deploy_agent",
            priority=10,
            explanation="Infrastructure tasks route to Deploy Agent (DevOps)"
        ),
        RoutingRule(
            rule_id="devops_task",
            condition={"task_type": "devops"},
            target_agent="deploy_agent",
            priority=10,
            explanation="DevOps tasks route to Deploy Agent"
        ),
        RoutingRule(
            rule_id="monitor_task",
            condition={"task_type": "monitor"},
            target_agent="monitoring_agent",
            priority=10,
            explanation="Monitoring tasks route to Monitoring Agent (observability)"
        ),

        # Marketing & Sales
        RoutingRule(
            rule_id="marketing_task",
            condition={"task_type": "marketing"},
            target_agent="marketing_agent",
            priority=10,
            explanation="Marketing tasks route to Marketing Agent (promotion)"
        ),
        RoutingRule(
            rule_id="sales_task",
            condition={"task_type": "sales"},
            target_agent="sales_agent",
            priority=10,
            explanation="Sales tasks route to Sales Agent (lead generation)"
        ),

        # Support
        RoutingRule(
            rule_id="support_task",
            condition={"task_type": "support"},
            target_agent="support_agent",
            priority=10,
            explanation="Support tasks route to Support Agent (customer service)"
        ),

        # Analytics
        RoutingRule(
            rule_id="analytics_task",
            condition={"task_type": "analytics"},
            target_agent="analytics_agent",
            priority=10,
            explanation="Analytics tasks route to Analytics Agent (reporting)"
        ),

        # Research
        RoutingRule(
            rule_id="research_task",
            condition={"task_type": "research"},
            target_agent="research_agent",
            priority=10,
            explanation="Research tasks route to Research Agent (discovery)"
        ),

        # Finance
        RoutingRule(
            rule_id="finance_task",
            condition={"task_type": "finance"},
            target_agent="finance_agent",
            priority=10,
            explanation="Finance tasks route to Finance Agent (accounting)"
        ),

        # ===== ATOMIC TASK TYPES (Priority 15) =====
        RoutingRule(
            rule_id="api_call_task",
            condition={"task_type": "api_call"},
            target_agent="builder_agent",
            priority=15,
            explanation="API call tasks route to Builder Agent (execution)"
        ),
        RoutingRule(
            rule_id="file_write_task",
            condition={"task_type": "file_write"},
            target_agent="builder_agent",
            priority=15,
            explanation="File write tasks route to Builder Agent (file operations)"
        ),
        RoutingRule(
            rule_id="test_run_task",
            condition={"task_type": "test_run"},
            target_agent="qa_agent",
            priority=15,
            explanation="Test execution routes to QA Agent (testing)"
        ),

        # ===== GENERIC/FALLBACK RULES (Priority 5) =====
        RoutingRule(
            rule_id="generic_task_fallback",
            condition={"task_type": "generic"},
            target_agent="builder_agent",
            priority=5,
            explanation="Generic tasks route to Builder Agent as default handler"
        ),
    ]


# Example: Custom rules for specific domains
def get_custom_saas_rules() -> List[RoutingRule]:
    """
    Custom routing rules for SaaS business generation

    Add domain-specific rules for SaaS-specific tasks
    """
    return [
        RoutingRule(
            rule_id="subscription_pricing",
            condition={"task_type": "pricing", "model": "subscription"},
            target_agent="finance_agent",
            priority=25,
            explanation="Subscription pricing routes to Finance Agent (SaaS pricing strategy)"
        ),
        RoutingRule(
            rule_id="api_monetization",
            condition={"task_type": "design", "monetization": "api"},
            target_agent="architect_agent",
            priority=25,
            explanation="API monetization design routes to Architect Agent (API strategy)"
        ),
    ]
