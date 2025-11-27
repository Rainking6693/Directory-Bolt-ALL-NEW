"""
Intelligent Component Selector for Genesis

Uses LLM reasoning to select optimal components for each business based on:
- Business description and requirements
- Target audience needs
- Monetization model
- Feature requirements
- Dependency resolution
- Value/effort optimization

This replaces hardcoded templates with true autonomous selection.
"""

import logging
import json
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from infrastructure.component_library import (
    COMPONENT_LIBRARY,
    get_required_components,
    resolve_dependencies
)
from infrastructure.business_idea_generator import BusinessIdea
from infrastructure.halo_router import HALORouter

logger = logging.getLogger(__name__)


@dataclass
class ComponentSelection:
    """Result of component selection process."""
    components: List[str]
    reasoning: str
    required_count: int
    recommended_count: int
    total_build_time_minutes: int
    dependencies_added: List[str]


class IntelligentComponentSelector:
    """
    Intelligently selects optimal components for a business using LLM reasoning.
    
    Process:
    1. Analyze business requirements with LLM
    2. Identify required + recommended components
    3. Resolve dependencies
    4. Rank by value/effort ratio
    5. Limit to budget constraints
    
    This makes Genesis truly autonomous - no more hardcoded templates!
    """
    
    def __init__(self):
        """Initialize component selector."""
        self.library = COMPONENT_LIBRARY
        self.router = HALORouter.create_with_integrations()
        logger.info("IntelligentComponentSelector initialized")
    
    async def select_components_for_business(
        self,
        business_idea: BusinessIdea,
        max_components: int = 12,
        min_components: int = 6
    ) -> ComponentSelection:
        """
        Select optimal components for a business idea.
        
        Args:
            business_idea: BusinessIdea object with name, description, features, etc.
            max_components: Maximum number of components to select
            min_components: Minimum number of components required
        
        Returns:
            ComponentSelection with chosen components and reasoning
        """
        logger.info(f"Selecting components for '{business_idea.name}' ({business_idea.business_type})")
        
        # Step 1: Get required components for business type
        required = get_required_components(business_idea.business_type)
        logger.info(f"Required components for {business_idea.business_type}: {required}")
        
        # Step 2: Use LLM to analyze business and recommend additional components
        recommended = await self._llm_recommend_components(
            business_idea=business_idea,
            required_components=required,
            max_additional=max_components - len(required)
        )
        
        # Step 3: Combine required + recommended
        selected = list(set(required + recommended))
        
        # Step 4: Resolve dependencies
        original_count = len(selected)
        selected = resolve_dependencies(selected)
        dependencies_added = [c for c in selected if c not in required and c not in recommended]
        
        logger.info(f"Dependencies added: {dependencies_added}")
        
        # Step 5: If we have too many, rank and trim
        if len(selected) > max_components:
            logger.info(f"Trimming {len(selected)} components to {max_components}")
            selected = self._rank_and_trim(
                components=selected,
                required=required,
                business_idea=business_idea,
                target_count=max_components
            )
        
        # Step 6: Calculate total build time
        total_time = sum(
            self.library[comp]["build_time_minutes"]
            for comp in selected
            if comp in self.library
        )
        
        result = ComponentSelection(
            components=selected,
            reasoning=f"Selected {len(required)} required + {len(recommended)} recommended components",
            required_count=len(required),
            recommended_count=len(recommended),
            total_build_time_minutes=total_time,
            dependencies_added=dependencies_added
        )
        
        logger.info(f"✅ Selected {len(selected)} components (build time: {total_time}min)")
        logger.info(f"Components: {selected}")
        
        return result
    
    async def _llm_recommend_components(
        self,
        business_idea: BusinessIdea,
        required_components: List[str],
        max_additional: int = 8
    ) -> List[str]:
        """
        Use LLM to recommend additional components based on business needs.
        
        Args:
            business_idea: Business idea to analyze
            required_components: Components already required
            max_additional: Maximum additional components to recommend
        
        Returns:
            List of recommended component names
        """
        # Format component library for LLM
        available_components = self._format_component_library_for_llm()
        
        prompt = f"""You are an expert software architect analyzing a business to recommend components.

BUSINESS ANALYSIS:
Name: {business_idea.name}
Type: {business_idea.business_type}
Description: {business_idea.description}

Target Audience: {business_idea.target_audience}
Monetization Model: {business_idea.monetization_model}

Required Features (from business idea):
{self._format_features(business_idea.mvp_features)}

REQUIRED COMPONENTS (already included):
{', '.join(required_components)}

AVAILABLE COMPONENTS:
{available_components}

TASK: Recommend {min(max_additional, 8)} additional components that would make this business successful.

SELECTION CRITERIA:
1. Revenue Impact: Prioritize components that directly generate or protect revenue
2. User Experience: Include components that improve UX and retention
3. Differentiation: Add unique features that set this business apart
4. Feasibility: Balance complexity with build time
5. Dependencies: Components should work well together

AVOID:
- Don't recommend components already in required list
- Don't recommend more than {max_additional} components
- Don't include components unrelated to business needs

OUTPUT FORMAT (JSON only):
{{
    "recommended_components": ["component1", "component2", ...],
    "reasoning": "Brief explanation of why each component adds value"
}}

Analyze and recommend now:"""
        
        try:
            # Use HALO router to get LLM response
            response = self.router.execute_with_llm(
                agent_name="architect_agent",
                prompt=prompt,
                prefer_local=True,  # ✅ FIXED: Was fallback_to_local (wrong parameter name)
                max_tokens=1024,
                temperature=0.3
            )
            
            # Parse JSON response
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                response = response.split("```")[1].split("```")[0].strip()
            
            data = json.loads(response)
            recommended = data.get("recommended_components", [])
            reasoning = data.get("reasoning", "")
            
            # Validate recommendations
            valid_recommendations = [
                comp for comp in recommended
                if comp in self.library and comp not in required_components
            ]
            
            logger.info(f"LLM recommended {len(valid_recommendations)} components: {valid_recommendations}")
            logger.debug(f"Reasoning: {reasoning}")
            
            return valid_recommendations[:max_additional]
            
        except Exception as e:
            logger.warning(f"LLM recommendation failed: {e}, using fallback")
            return self._fallback_recommendations(business_idea, required_components)
    
    def _format_component_library_for_llm(self) -> str:
        """Format component library in a compact, LLM-friendly format."""
        lines = []
        
        for name, info in self.library.items():
            revenue_emoji = {
                "critical": "💰💰💰",
                "high": "💰💰",
                "medium": "💰",
                "low": "•"
            }.get(info["revenue_impact"], "•")
            
            complexity = info["complexity"][:3].upper()  # LOW, MED, HIG
            
            lines.append(
                f"- {name}: {info['description']} "
                f"[{complexity}, {info['build_time_minutes']}min, {revenue_emoji}]"
            )
        
        return "\n".join(lines)
    
    def _format_features(self, features: List[str]) -> str:
        """Format feature list for prompt."""
        return "\n".join(f"- {f}" for f in features)
    
    def _fallback_recommendations(
        self,
        business_idea: BusinessIdea,
        required_components: List[str]
    ) -> List[str]:
        """Fallback recommendations if LLM fails."""
        recommendations = []
        
        # High-value components for all business types
        universal_high_value = [
            "analytics_dashboard",
            "email_marketing",
            "seo_optimization"
        ]
        
        # Type-specific recommendations
        type_specific = {
            "ecommerce": [
                "customer_reviews",
                "abandoned_cart_recovery",
                "product_recommendations",
                "coupon_system"
            ],
            "saas": [
                "usage_analytics",
                "api_keys",
                "webhooks",
                "notification_system"
            ],
            "content": [
                "newsletter",
                "comment_system",
                "social_media",
                "search_engine"
            ]
        }
        
        # Add universal components
        for comp in universal_high_value:
            if comp not in required_components and comp in self.library:
                recommendations.append(comp)
        
        # Add type-specific
        specific = type_specific.get(business_idea.business_type, [])
        for comp in specific:
            if comp not in required_components and comp in self.library:
                recommendations.append(comp)
        
        logger.info(f"Fallback recommendations: {recommendations[:5]}")
        return recommendations[:5]
    
    def _rank_and_trim(
        self,
        components: List[str],
        required: List[str],
        business_idea: BusinessIdea,
        target_count: int
    ) -> List[str]:
        """
        Rank components by value and trim to target count.
        
        Always keeps required components.
        """
        # Required components are never trimmed
        result = list(required)
        
        # Rank optional components
        optional = [c for c in components if c not in required]
        
        scores = {}
        for comp in optional:
            if comp not in self.library:
                continue
            
            info = self.library[comp]
            
            # Value score (0-100)
            value = self._calculate_component_value(info, business_idea)
            
            # Effort score (0-100, lower is better)
            effort = info["build_time_minutes"] / 30 * 100
            
            # Value/effort ratio
            scores[comp] = value / (effort + 1)
        
        # Sort by score (highest first)
        ranked = sorted(optional, key=lambda c: scores.get(c, 0), reverse=True)
        
        # Add top-ranked until we hit target
        remaining_slots = target_count - len(result)
        result.extend(ranked[:remaining_slots])
        
        return result
    
    def _calculate_component_value(
        self,
        component_info: Dict[str, Any],
        business_idea: BusinessIdea
    ) -> float:
        """Calculate value score for a component (0-100)."""
        value = 50  # Base value
        
        # Revenue impact boost
        revenue_boost = {
            "critical": 30,
            "high": 20,
            "medium": 10,
            "low": 0
        }
        value += revenue_boost.get(component_info["revenue_impact"], 0)
        
        # Monetization alignment
        if "subscription" in business_idea.monetization_model.lower():
            if "billing" in component_info["description"].lower():
                value += 15
            if "subscription" in component_info["description"].lower():
                value += 15
        
        if "marketplace" in business_idea.monetization_model.lower():
            if "commission" in component_info["description"].lower():
                value += 15
        
        # Feature alignment (check if component matches any required features)
        features_text = " ".join(business_idea.mvp_features).lower()
        comp_desc = component_info["description"].lower()
        
        # Simple keyword matching
        if any(word in comp_desc for word in features_text.split()):
            value += 10
        
        return min(value, 100)


# Singleton
_selector: Optional[IntelligentComponentSelector] = None


def get_component_selector() -> IntelligentComponentSelector:
    """Get or create the global component selector."""
    global _selector
    if _selector is None:
        _selector = IntelligentComponentSelector()
    return _selector


if __name__ == "__main__":
    # Test the selector
    import asyncio
    from infrastructure.business_idea_generator import BusinessIdea
    
    async def test():
        selector = IntelligentComponentSelector()
        
        # Create a test business idea
        idea = BusinessIdea(
            name="TaskFlow Pro",
            business_type="saas",
            description="SaaS automation tool for small businesses. Saves 10+ hours/week on repetitive tasks.",
            target_audience="Small business owners (10-50 employees) with manual workflows",
            monetization_model="Subscription: Free tier (basic), Pro $29/mo, Enterprise $99/mo",
            mvp_features=[
                "Automated workflow builder",
                "Integration with 5+ popular tools",
                "Team collaboration features",
                "Analytics dashboard",
                "API access for power users"
            ],
            tech_stack=["Next.js 14", "TypeScript", "Stripe", "Vercel", "PostgreSQL"],
            success_metrics={
                "target_revenue_month_1": "$1,000 MRR",
                "target_users_month_1": "50 signups",
                "target_conversion_rate": "10% free-to-paid"
            },
            revenue_score=85.0,
            market_trend_score=80.0,
            differentiation_score=75.0,
            overall_score=81.0,
            generated_at="2025-11-06T00:00:00"
        )
        
        print("\n" + "="*80)
        print(" "*25 + "Testing Component Selector" + " "*28)
        print("="*80 + "\n")
        
        print(f"Business: {idea.name}")
        print(f"Type: {idea.business_type}")
        print(f"Description: {idea.description}\n")
        
        # Select components
        selection = await selector.select_components_for_business(
            business_idea=idea,
            max_components=12,
            min_components=6
        )
        
        print(f"✅ Component Selection Complete\n")
        print(f"Total Components: {len(selection.components)}")
        print(f"  Required: {selection.required_count}")
        print(f"  Recommended: {selection.recommended_count}")
        print(f"  Dependencies Added: {len(selection.dependencies_added)}")
        print(f"Total Build Time: {selection.total_build_time_minutes} minutes")
        print(f"\nSelected Components:")
        for i, comp in enumerate(selection.components, 1):
            info = COMPONENT_LIBRARY.get(comp, {})
            desc = info.get("description", "Unknown")
            time = info.get("build_time_minutes", 0)
            print(f"  {i:2d}. {comp:30s} ({time:2d}min) - {desc[:60]}...")
        
        print(f"\nReasoning:")
        print(f"  {selection.reasoning}")
    
    asyncio.run(test())

