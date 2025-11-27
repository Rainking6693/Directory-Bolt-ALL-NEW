"""
Pricing Optimizer - Dynamic Pricing & Revenue Optimization
===========================================================

Optimizes pricing for autonomous businesses using:
- Cost-plus pricing (cover costs + target margin)
- Value-based pricing (customer willingness to pay)
- Competitive pricing (market analysis)
- A/B testing for pricing tiers
- Revenue optimization suggestions

Integrates with:
- Product templates for baseline pricing
- Stripe for payment data
- MongoDB for historical tracking
- SE-Darwin for pricing evolution
"""

import logging
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# MongoDB (optional)
try:
    from pymongo import MongoClient
    HAS_MONGODB = True
except ImportError:
    HAS_MONGODB = False


class PricingStrategy(Enum):
    """Pricing strategy types."""
    COST_PLUS = "cost_plus"  # Cost + fixed margin
    VALUE_BASED = "value_based"  # Based on customer value
    COMPETITIVE = "competitive"  # Based on competitors
    PENETRATION = "penetration"  # Low price for market entry
    PREMIUM = "premium"  # High price for premium positioning


@dataclass
class PricingRecommendation:
    """Pricing recommendation for a business."""
    business_id: str
    recommended_price: float
    current_price: float
    strategy: PricingStrategy
    confidence: float  # 0-1
    expected_revenue_increase: float  # Percentage
    reasoning: str
    supporting_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ABTestResult:
    """A/B test result for pricing."""
    test_id: str
    business_id: str
    variant_a_price: float
    variant_b_price: float
    variant_a_conversions: int
    variant_b_conversions: int
    variant_a_revenue: float
    variant_b_revenue: float
    winner: str  # "a", "b", or "tie"
    statistical_significance: float  # p-value
    recommendation: str


@dataclass
class RevenueOptimization:
    """Revenue optimization analysis."""
    business_id: str
    current_monthly_revenue: float
    optimized_monthly_revenue: float
    revenue_increase_percentage: float
    recommendations: List[str]
    pricing_adjustments: Dict[str, float]  # tier -> new_price


class PricingOptimizer:
    """
    Optimizes pricing for autonomous businesses.
    
    Features:
    - Cost-plus pricing calculation
    - Value-based pricing estimation
    - Competitive pricing analysis
    - A/B testing framework
    - Revenue optimization suggestions
    
    Usage:
        optimizer = PricingOptimizer()
        recommendation = await optimizer.recommend_pricing(business_id, costs, competitor_prices)
        ab_test = await optimizer.run_ab_test(business_id, price_a, price_b)
    """
    
    def __init__(
        self,
        mongodb_uri: Optional[str] = None,
        default_margin: float = 0.30,  # 30% margin
        ab_test_duration_days: int = 14
    ):
        """
        Initialize pricing optimizer.
        
        Args:
            mongodb_uri: MongoDB URI for historical data
            default_margin: Default profit margin for cost-plus pricing
            ab_test_duration_days: Duration for A/B tests
        """
        self.default_margin = default_margin
        self.ab_test_duration_days = ab_test_duration_days
        
        # MongoDB for historical data
        self.mongo_client = None
        self.db = None
        if HAS_MONGODB and mongodb_uri:
            try:
                self.mongo_client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
                self.db = self.mongo_client.genesis_pricing
                self.mongo_client.admin.command('ping')
                logger.info("MongoDB connected for pricing optimization")
            except Exception as e:
                logger.warning(f"MongoDB connection failed: {e}")
        
        # In-memory storage
        self._active_ab_tests: Dict[str, Dict] = {}
        self._pricing_history: Dict[str, List[float]] = {}
    
    # ========================================================================
    # PRICING STRATEGIES
    # ========================================================================
    
    async def recommend_pricing(
        self,
        business_id: str,
        costs: Dict[str, float],
        competitor_prices: Optional[List[float]] = None,
        customer_value_estimate: Optional[float] = None,
        current_price: Optional[float] = None
    ) -> PricingRecommendation:
        """
        Recommend optimal pricing based on multiple strategies.
        
        Args:
            business_id: Genesis business ID
            costs: Cost breakdown (llm_costs, infrastructure, etc.)
            competitor_prices: Optional list of competitor prices
            customer_value_estimate: Optional estimated customer value
            current_price: Current price (if changing)
        
        Returns:
            PricingRecommendation
        """
        logger.info(f"Calculating pricing recommendation for {business_id}")
        
        total_cost = sum(costs.values())
        
        # Calculate prices using different strategies
        cost_plus_price = self._calculate_cost_plus_pricing(total_cost, self.default_margin)
        value_based_price = self._calculate_value_based_pricing(customer_value_estimate)
        competitive_price = self._calculate_competitive_pricing(competitor_prices)
        
        # Choose best strategy
        if competitor_prices and len(competitor_prices) >= 3:
            # Use competitive pricing if we have market data
            recommended_price = competitive_price
            strategy = PricingStrategy.COMPETITIVE
            confidence = 0.85
            reasoning = f"Based on {len(competitor_prices)} competitor prices (median: ${competitive_price:.2f})"
        elif customer_value_estimate and customer_value_estimate > cost_plus_price * 2:
            # Use value-based if high customer value
            recommended_price = value_based_price
            strategy = PricingStrategy.VALUE_BASED
            confidence = 0.75
            reasoning = f"Customer value (${customer_value_estimate:.2f}) supports premium pricing"
        else:
            # Default to cost-plus
            recommended_price = cost_plus_price
            strategy = PricingStrategy.COST_PLUS
            confidence = 0.90
            reasoning = f"Cost-plus with {self.default_margin*100:.0f}% margin (total cost: ${total_cost:.2f})"
        
        # Calculate expected revenue increase
        if current_price:
            price_change_pct = ((recommended_price - current_price) / current_price) * 100
            # Simple elasticity model: -1.5 price elasticity
            demand_change_pct = price_change_pct * -1.5
            revenue_change_pct = price_change_pct + demand_change_pct
        else:
            revenue_change_pct = 0.0
        
        recommendation = PricingRecommendation(
            business_id=business_id,
            recommended_price=recommended_price,
            current_price=current_price or 0.0,
            strategy=strategy,
            confidence=confidence,
            expected_revenue_increase=revenue_change_pct,
            reasoning=reasoning,
            supporting_data={
                "costs": costs,
                "cost_plus_price": cost_plus_price,
                "competitive_price": competitive_price,
                "value_based_price": value_based_price,
                "competitor_prices": competitor_prices or []
            }
        )
        
        # Store recommendation
        if self.db:
            self.db.pricing_recommendations.insert_one({
                **vars(recommendation),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        return recommendation
    
    def _calculate_cost_plus_pricing(self, total_cost: float, margin: float) -> float:
        """Calculate cost-plus pricing."""
        return total_cost / (1 - margin)
    
    def _calculate_value_based_pricing(self, customer_value: Optional[float]) -> float:
        """Calculate value-based pricing."""
        if not customer_value:
            return 0.0
        # Capture 30% of customer value
        return customer_value * 0.30
    
    def _calculate_competitive_pricing(self, competitor_prices: Optional[List[float]]) -> float:
        """Calculate competitive pricing."""
        if not competitor_prices or len(competitor_prices) == 0:
            return 0.0
        
        # Use median competitor price
        sorted_prices = sorted(competitor_prices)
        median_idx = len(sorted_prices) // 2
        return sorted_prices[median_idx]
    
    # ========================================================================
    # A/B TESTING
    # ========================================================================
    
    async def start_ab_test(
        self,
        business_id: str,
        variant_a_price: float,
        variant_b_price: float,
        traffic_split: float = 0.5
    ) -> str:
        """
        Start A/B test for pricing.
        
        Args:
            business_id: Genesis business ID
            variant_a_price: Price for variant A
            variant_b_price: Price for variant B
            traffic_split: Percentage of traffic to variant A (0-1)
        
        Returns:
            Test ID
        """
        test_id = f"abtest_{business_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        
        test_data = {
            "test_id": test_id,
            "business_id": business_id,
            "variant_a_price": variant_a_price,
            "variant_b_price": variant_b_price,
            "traffic_split": traffic_split,
            "variant_a_conversions": 0,
            "variant_b_conversions": 0,
            "variant_a_revenue": 0.0,
            "variant_b_revenue": 0.0,
            "variant_a_views": 0,
            "variant_b_views": 0,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "status": "active"
        }
        
        self._active_ab_tests[test_id] = test_data
        
        if self.db:
            self.db.ab_tests.insert_one(test_data)
        
        logger.info(f"Started A/B test {test_id}: ${variant_a_price} vs ${variant_b_price}")
        
        return test_id
    
    async def record_ab_test_event(
        self,
        test_id: str,
        variant: str,  # "a" or "b"
        event_type: str,  # "view", "conversion"
        amount: float = 0.0
    ):
        """
        Record A/B test event.
        
        Args:
            test_id: Test ID
            variant: Variant ("a" or "b")
            event_type: Event type ("view" or "conversion")
            amount: Amount (for conversions)
        """
        test_data = self._active_ab_tests.get(test_id)
        if not test_data:
            logger.warning(f"A/B test {test_id} not found")
            return
        
        # Update counters
        if event_type == "view":
            test_data[f"variant_{variant}_views"] += 1
        elif event_type == "conversion":
            test_data[f"variant_{variant}_conversions"] += 1
            test_data[f"variant_{variant}_revenue"] += amount
        
        # Update in MongoDB
        if self.db:
            self.db.ab_tests.update_one(
                {"test_id": test_id},
                {"$set": test_data}
            )
    
    async def analyze_ab_test(self, test_id: str) -> ABTestResult:
        """
        Analyze A/B test results and determine winner.
        
        Args:
            test_id: Test ID
        
        Returns:
            ABTestResult with winner and recommendations
        """
        test_data = self._active_ab_tests.get(test_id)
        if not test_data:
            raise ValueError(f"A/B test {test_id} not found")
        
        # Extract data
        a_conv = test_data['variant_a_conversions']
        b_conv = test_data['variant_b_conversions']
        a_rev = test_data['variant_a_revenue']
        b_rev = test_data['variant_b_revenue']
        a_views = test_data['variant_a_views']
        b_views = test_data['variant_b_views']
        
        # Calculate conversion rates
        a_cvr = a_conv / a_views if a_views > 0 else 0.0
        b_cvr = b_conv / b_views if b_views > 0 else 0.0
        
        # Calculate revenue per view
        a_rpv = a_rev / a_views if a_views > 0 else 0.0
        b_rpv = b_rev / b_views if b_views > 0 else 0.0
        
        # Determine winner based on revenue per view (best metric)
        if a_rpv > b_rpv * 1.1:  # 10% improvement threshold
            winner = "a"
            recommendation = f"Use Variant A (${test_data['variant_a_price']:.2f}) - {((a_rpv - b_rpv) / b_rpv * 100):.1f}% higher revenue per view"
        elif b_rpv > a_rpv * 1.1:
            winner = "b"
            recommendation = f"Use Variant B (${test_data['variant_b_price']:.2f}) - {((b_rpv - a_rpv) / a_rpv * 100):.1f}% higher revenue per view"
        else:
            winner = "tie"
            recommendation = f"No clear winner - continue test or use lower price (${min(test_data['variant_a_price'], test_data['variant_b_price']):.2f})"
        
        # Calculate statistical significance (simplified chi-square test)
        total_conv = a_conv + b_conv
        total_views = a_views + b_views
        if total_views > 0:
            expected_a_conv = (a_views / total_views) * total_conv
            expected_b_conv = (b_views / total_views) * total_conv
            chi_square = 0.0
            if expected_a_conv > 0:
                chi_square += ((a_conv - expected_a_conv) ** 2) / expected_a_conv
            if expected_b_conv > 0:
                chi_square += ((b_conv - expected_b_conv) ** 2) / expected_b_conv
            # Rough p-value estimation (chi-square distribution with 1 df)
            p_value = 1.0 / (1.0 + chi_square) if chi_square > 0 else 1.0
        else:
            p_value = 1.0
        
        result = ABTestResult(
            test_id=test_id,
            business_id=test_data['business_id'],
            variant_a_price=test_data['variant_a_price'],
            variant_b_price=test_data['variant_b_price'],
            variant_a_conversions=a_conv,
            variant_b_conversions=b_conv,
            variant_a_revenue=a_rev,
            variant_b_revenue=b_rev,
            winner=winner,
            statistical_significance=p_value,
            recommendation=recommendation
        )
        
        logger.info(f"A/B test {test_id} analysis: winner={winner}, p={p_value:.3f}")
        
        return result
    
    # ========================================================================
    # REVENUE OPTIMIZATION
    # ========================================================================
    
    async def optimize_revenue(
        self,
        business_id: str,
        current_prices_by_tier: Dict[str, float],
        current_users_by_tier: Dict[str, int],
        costs: Dict[str, float]
    ) -> RevenueOptimization:
        """
        Optimize revenue through pricing adjustments.
        
        Args:
            business_id: Genesis business ID
            current_prices_by_tier: Current pricing (tier -> price)
            current_users_by_tier: Current users (tier -> count)
            costs: Cost breakdown
        
        Returns:
            RevenueOptimization with recommendations
        """
        logger.info(f"Optimizing revenue for business {business_id}")
        
        # Calculate current revenue
        current_revenue = sum(
            current_prices_by_tier.get(tier, 0.0) * count
            for tier, count in current_users_by_tier.items()
        )
        
        # Optimization strategy: Increase prices for high-value tiers
        pricing_adjustments = {}
        recommendations = []
        
        total_cost = sum(costs.values())
        min_price = total_cost / (1 - self.default_margin)  # Minimum viable price
        
        for tier, current_price in current_prices_by_tier.items():
            user_count = current_users_by_tier.get(tier, 0)
            
            if tier == "free":
                # Free tier stays free
                pricing_adjustments[tier] = 0.0
                continue
            
            # Check if price covers costs
            if current_price < min_price:
                # Price too low - increase to cover costs
                new_price = min_price * 1.1  # 10% above minimum
                pricing_adjustments[tier] = new_price
                recommendations.append(
                    f"{tier.title()} tier: Increase from ${current_price:.2f} to ${new_price:.2f} "
                    f"(current price doesn't cover costs)"
                )
            elif user_count > 100:
                # High volume tier - test small increase
                new_price = current_price * 1.05  # 5% increase
                pricing_adjustments[tier] = new_price
                recommendations.append(
                    f"{tier.title()} tier: Test ${new_price:.2f} (5% increase) with {user_count} users"
                )
            else:
                # Keep current price
                pricing_adjustments[tier] = current_price
        
        # Calculate optimized revenue
        optimized_revenue = sum(
            pricing_adjustments.get(tier, current_prices_by_tier.get(tier, 0.0)) * count
            for tier, count in current_users_by_tier.items()
        )
        
        # Adjust for elasticity (assume -1.2 price elasticity)
        avg_price_increase = (
            sum(pricing_adjustments.values()) / len(pricing_adjustments) - 
            sum(current_prices_by_tier.values()) / len(current_prices_by_tier)
        ) / (sum(current_prices_by_tier.values()) / len(current_prices_by_tier))
        
        demand_decrease = avg_price_increase * 1.2
        optimized_revenue = optimized_revenue * (1 - demand_decrease)
        
        revenue_increase_pct = ((optimized_revenue - current_revenue) / current_revenue * 100) if current_revenue > 0 else 0.0
        
        # Add general recommendations
        if revenue_increase_pct < 5:
            recommendations.append("Consider adding new premium tier for power users")
        if len(current_prices_by_tier) < 3:
            recommendations.append("Consider adding more pricing tiers for better segmentation")
        
        optimization = RevenueOptimization(
            business_id=business_id,
            current_monthly_revenue=current_revenue,
            optimized_monthly_revenue=optimized_revenue,
            revenue_increase_percentage=revenue_increase_pct,
            recommendations=recommendations,
            pricing_adjustments=pricing_adjustments
        )
        
        logger.info(
            f"Revenue optimization for {business_id}: "
            f"${current_revenue:.2f} -> ${optimized_revenue:.2f} "
            f"({revenue_increase_pct:+.1f}%)"
        )
        
        return optimization
    
    # ========================================================================
    # PRICING ANALYSIS
    # ========================================================================
    
    def analyze_price_sensitivity(
        self,
        business_id: str,
        price_history: List[Tuple[float, int]],  # (price, conversions)
    ) -> Dict[str, Any]:
        """
        Analyze price sensitivity from historical data.
        
        Args:
            business_id: Genesis business ID
            price_history: List of (price, conversion_count) tuples
        
        Returns:
            Analysis results
        """
        if len(price_history) < 3:
            return {
                "elasticity": -1.2,  # Default assumption
                "optimal_price": 0.0,
                "confidence": "low",
                "note": "Insufficient data for analysis"
            }
        
        # Extract prices and conversions
        prices = np.array([p for p, c in price_history])
        conversions = np.array([c for p, c in price_history])
        
        # Calculate price elasticity (simple linear regression)
        if len(prices) > 1 and np.std(prices) > 0:
            price_changes = np.diff(prices) / prices[:-1]
            demand_changes = np.diff(conversions) / conversions[:-1]
            
            # Elasticity = % change in demand / % change in price
            valid_indices = (price_changes != 0) & (demand_changes != 0)
            if np.sum(valid_indices) > 0:
                elasticity = np.mean(demand_changes[valid_indices] / price_changes[valid_indices])
            else:
                elasticity = -1.2  # Default
        else:
            elasticity = -1.2
        
        # Find optimal price (maximize revenue = price × demand)
        revenues = prices * conversions
        optimal_idx = np.argmax(revenues)
        optimal_price = prices[optimal_idx]
        
        return {
            "elasticity": float(elasticity),
            "optimal_price": float(optimal_price),
            "confidence": "medium" if len(price_history) >= 5 else "low",
            "max_revenue_achieved": float(revenues[optimal_idx])
        }

