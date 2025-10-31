"""
AI Success Probability Calculator

Calculates the probability of successful directory submission using AI analysis.
Features:
- Multi-factor success prediction
- Historical submission data analysis
- Directory-specific success patterns
- Business profile compatibility scoring
"""

import os
import time
import hashlib
import secrets
import json
from typing import Dict, List, Any, Optional
import google.generativeai as genai
from supabase import create_client
from utils.logging import setup_logger

logger = setup_logger(__name__)


class SuccessProbabilityCalculator:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize Success Probability Calculator (uses Gemini for simpler tasks)."""
        config = config or {}
        
        # Use Gemini API for easier AI tasks (probability calculation)
        gemini_api_key = config.get('gemini_api_key') or os.getenv('GEMINI_API_KEY')
        if gemini_api_key:
            genai.configure(api_key=gemini_api_key)
            self.gemini_model = genai.GenerativeModel('gemini-pro')
            self.use_gemini = True
        else:
            self.gemini_model = None
            self.use_gemini = False
            logger.warning("Gemini API key not found - probability calculation will use heuristics only")
        
        supabase_url = config.get('supabase_url') or os.getenv('SUPABASE_URL')
        supabase_key = config.get('supabase_key') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if supabase_url and supabase_key:
            self.supabase = create_client(supabase_url, supabase_key)
        else:
            self.supabase = None
            logger.warning("Supabase client not initialized - historical data unavailable")
        
        self.config = {
            'min_historical_data': config.get('min_historical_data', 5),
            'confidence_threshold': config.get('confidence_threshold', 0.7),
            'learning_rate': config.get('learning_rate', 0.1),
            'max_cache_age': config.get('max_cache_age', 3600000),  # 1 hour
            **config
        }
        
        # Cache for probability calculations
        self.probability_cache = {}
        self.directory_patterns = {}
        self.business_profiles = {}
        
        # Initialize scoring weights
        self.scoring_weights = {
            'business_match': 0.25,        # How well business matches directory
            'content_quality': 0.20,       # Quality of business description/content
            'historical_success': 0.20,    # Historical success rate patterns
            'directory_requirements': 0.15, # Meeting directory specific requirements
            'timing_factors': 0.10,        # Submission timing optimization
            'competition_level': 0.10      # Competition in directory category
        }
    
    async def calculate_success_probability(self, submission_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate success probability for a specific submission.
        
        Args:
            submission_data: Dict containing:
                - business: Business information dict
                - directory: Directory information dict
                - metadata: Additional metadata
        
        Returns:
            Dict with probability, confidence, factors, and recommendations
        """
        start_time = time.time()
        request_id = self.generate_request_id()
        
        try:
            logger.info(f"🎯 [{request_id}] Calculating success probability")
            
            # Validate input data
            self.validate_submission_data(submission_data)
            
            # Check cache first
            cache_key = self.generate_cache_key(submission_data)
            cached = self.get_cached_probability(cache_key)
            if cached:
                logger.info(f"💾 [{request_id}] Using cached probability: {cached['probability']*100:.1f}%")
                return cached
            
            # Calculate individual factor scores
            factors = await self.calculate_factor_scores(submission_data, request_id)
            
            # Combine factors into overall probability
            probability = self.calculate_overall_probability(factors)
            
            # Generate confidence interval
            confidence = self.calculate_confidence_level(factors, submission_data)
            
            # Create detailed analysis
            analysis = await self.generate_analysis(factors, submission_data)
            
            result = {
                'success': True,
                'probability': probability,
                'confidence': confidence,
                'factors': factors,
                'recommendations': analysis.get('recommendations', []),
                'risk_factors': analysis.get('risk_factors', []),
                'processing_time': int((time.time() - start_time) * 1000),
                'request_id': request_id,
                'calculated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }
            
            # Cache the result
            self.cache_probability(cache_key, result)
            
            logger.info(f"✅ [{request_id}] Success probability: {probability*100:.1f}% (confidence: {confidence*100:.1f}%)")
            
            return result
            
        except Exception as error:
            logger.error(f"❌ [{request_id}] Probability calculation failed: {str(error)}")
            return {
                'success': False,
                'error': str(error),
                'probability': 0.5,  # Default neutral
                'confidence': 0.3,
                'request_id': request_id
            }
    
    async def calculate_factor_scores(self, submission_data: Dict[str, Any],
                                     request_id: str) -> Dict[str, Any]:
        """Calculate individual factor scores."""
        business = submission_data.get('business', {})
        directory = submission_data.get('directory', {})
        
        # Business match score (how well business fits directory)
        business_match = await self.calculate_business_match_score(business, directory)
        
        # Content quality score
        content_quality = await self.calculate_content_quality_score(business)
        
        # Historical success rate
        historical_success = await self.get_historical_success_rate(directory.get('id'))
        
        # Directory requirements compliance
        requirements_compliance = await self.calculate_requirements_compliance(business, directory)
        
        # Timing factors (simplified - would use timing optimizer)
        timing_factors = 0.5  # Default neutral
        
        # Competition level (simplified - would analyze directory traffic)
        competition_level = 0.5  # Default neutral
        
        return {
            'business_match': business_match,
            'content_quality': content_quality,
            'historical_success': historical_success,
            'directory_requirements': requirements_compliance,
            'timing_factors': timing_factors,
            'competition_level': competition_level
        }
    
    async def calculate_business_match_score(self, business: Dict[str, Any],
                                           directory: Dict[str, Any]) -> float:
        """Calculate how well business matches directory category."""
        # Simple heuristic - would use AI for better matching
        business_category = business.get('category', '').lower()
        directory_category = directory.get('category', '').lower()
        
        if business_category and directory_category:
            if business_category in directory_category or directory_category in business_category:
                return 0.8
            # Check for similar categories
            common_words = set(business_category.split()) & set(directory_category.split())
            if common_words:
                return 0.6
        
        return 0.5  # Default neutral
    
    async def calculate_content_quality_score(self, business: Dict[str, Any]) -> float:
        """Calculate content quality score."""
        description = business.get('description', '')
        
        if not description:
            return 0.3
        
        # Simple heuristic - would use AI for better analysis
        word_count = len(description.split())
        
        if 50 <= word_count <= 500:
            score = 0.7
            if word_count >= 150:
                score = 0.85
        else:
            score = 0.4
        
        # Check for completeness
        required_fields = ['name', 'website', 'email']
        has_required = sum(1 for field in required_fields if business.get(field))
        score += (has_required / len(required_fields)) * 0.15
        
        return min(1.0, score)
    
    async def get_historical_success_rate(self, directory_id: Optional[str]) -> float:
        """Get historical success rate for directory."""
        if not directory_id or not self.supabase:
            return 0.5  # Default neutral
        
        try:
            # Query recent submissions for this directory
            response = self.supabase.table('job_results').select(
                'status, directory_name'
            ).eq('directory_name', directory_id).limit(50).execute()
            
            if not response.data or len(response.data) < self.config['min_historical_data']:
                return 0.5
            
            successful = sum(1 for r in response.data if r.get('status') == 'submitted')
            success_rate = successful / len(response.data)
            
            return success_rate
            
        except Exception as error:
            logger.warn(f"Failed to get historical success rate: {str(error)}")
            return 0.5
    
    async def calculate_requirements_compliance(self, business: Dict[str, Any],
                                               directory: Dict[str, Any]) -> float:
        """Calculate compliance with directory requirements."""
        # Simple heuristic - would check actual directory requirements
        required_fields = ['name', 'description', 'website', 'email']
        has_fields = sum(1 for field in required_fields if business.get(field))
        
        compliance = has_fields / len(required_fields)
        return compliance
    
    def calculate_overall_probability(self, factors: Dict[str, float]) -> float:
        """Combine factor scores into overall probability."""
        weighted_sum = sum(
            factors.get(factor, 0.5) * weight
            for factor, weight in self.scoring_weights.items()
        )
        
        return max(0.0, min(1.0, weighted_sum))
    
    def calculate_confidence_level(self, factors: Dict[str, float],
                                  submission_data: Dict[str, Any]) -> float:
        """Calculate confidence in the probability estimate."""
        # Base confidence on data quality and completeness
        has_business_data = bool(submission_data.get('business'))
        has_directory_data = bool(submission_data.get('directory'))
        has_historical_data = factors.get('historical_success', 0.5) != 0.5
        
        base_confidence = 0.5
        if has_business_data:
            base_confidence += 0.2
        if has_directory_data:
            base_confidence += 0.2
        if has_historical_data:
            base_confidence += 0.1
        
        return min(1.0, base_confidence)
    
    async def generate_analysis(self, factors: Dict[str, float],
                               submission_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate detailed analysis and recommendations using Gemini."""
        recommendations = []
        risk_factors = []
        
        # Use Gemini for AI-powered analysis if available
        if self.use_gemini and self.gemini_model:
            try:
                prompt = f"""Analyze these submission factors and provide recommendations:

Factors:
- Business Match: {factors.get('business_match', 0.5):.2f}
- Content Quality: {factors.get('content_quality', 0.5):.2f}
- Historical Success: {factors.get('historical_success', 0.5):.2f}
- Requirements Compliance: {factors.get('directory_requirements', 0.5):.2f}

Business: {submission_data.get('business', {}).get('business_name', 'Unknown')}
Directory: {submission_data.get('directory', {}).get('name', 'Unknown')}

Provide analysis in JSON format:
{{
  "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2"],
  "riskFactors": ["Risk factor 1", "Risk factor 2"]
}}"""

                response = self.gemini_model.generate_content(prompt)
                response_text = response.text if hasattr(response, 'text') else str(response)
                
                # Extract JSON from response
                import re
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group())
                    recommendations = parsed.get('recommendations', [])
                    risk_factors = parsed.get('riskFactors', [])
            except Exception as e:
                logger.warning(f"Gemini analysis failed, using heuristics: {e}")
        
        # Fallback to heuristic analysis
        if not recommendations:
            if factors.get('business_match', 0.5) < 0.6:
                recommendations.append("Consider business category alignment with directory")
                risk_factors.append("Potential category mismatch")
            
            if factors.get('content_quality', 0.5) < 0.6:
                recommendations.append("Improve business description quality and completeness")
                risk_factors.append("Low content quality")
            
            if factors.get('directory_requirements', 0.5) < 0.7:
                recommendations.append("Ensure all required fields are completed")
                risk_factors.append("Missing required information")
        
        return {
            'recommendations': recommendations,
            'risk_factors': risk_factors
        }
    
    def generate_cache_key(self, submission_data: Dict[str, Any]) -> str:
        """Generate cache key for submission data."""
        business = submission_data.get('business', {})
        directory = submission_data.get('directory', {})
        key_string = f"{business.get('name', '')}_{directory.get('id', '')}_{business.get('description', '')[:50]}"
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def get_cached_probability(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached probability if valid."""
        cached = self.probability_cache.get(cache_key)
        if cached and time.time() - cached['timestamp'] < (self.config['max_cache_age'] / 1000):
            return cached['probability']
        return None
    
    def cache_probability(self, cache_key: str, result: Dict[str, Any]):
        """Cache probability result."""
        self.probability_cache[cache_key] = {
            'probability': result,
            'timestamp': time.time()
        }
    
    def validate_submission_data(self, data: Dict[str, Any]):
        """Validate submission data."""
        if not data.get('business'):
            raise ValueError('Business data is required')
        
        if not data.get('directory'):
            raise ValueError('Directory data is required')
    
    def generate_request_id(self) -> str:
        """Generate unique request ID."""
        timestamp = int(time.time() * 1000)
        random_part = secrets.token_hex(4)
        return f"prob_{timestamp}_{random_part}"
    
    def get_stats(self) -> Dict[str, Any]:
        """Get calculator statistics."""
        return {
            'cached_probabilities': len(self.probability_cache),
            'directory_patterns': len(self.directory_patterns),
            'scoring_weights': self.scoring_weights
        }

