"""
Intelligent Retry Analyzer - AI-Powered Failure Analysis

Analyzes submission failures and determines optimal retry strategies using AI.
Features:
- Failure reason analysis and categorization
- Retry probability prediction
- Optimal retry timing calculation
- Content improvement suggestions
- Strategic retry approach recommendations
"""

import os
import time
import secrets
from typing import Dict, List, Any, Optional
from anthropic import Anthropic
from supabase import create_client
from utils.logging import setup_logger

logger = setup_logger(__name__)


class IntelligentRetryAnalyzer:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize Intelligent Retry Analyzer.
        
        Args:
            config: Optional configuration dict
        
        Raises:
            ValueError: If API key is missing
        """
        config = config or {}
        
        anthropic_api_key = config.get('anthropic_api_key') or os.getenv('ANTHROPIC_API_KEY')
        if not anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY must be set in environment or config")
        
        try:
            self.anthropic = Anthropic(api_key=anthropic_api_key)
        except Exception as e:
            logger.error(f"Failed to initialize Anthropic client: {e}")
            raise RuntimeError(f"Anthropic client initialization failed: {e}")
        
        supabase_url = config.get('supabase_url') or os.getenv('SUPABASE_URL')
        supabase_key = config.get('supabase_key') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if supabase_url and supabase_key:
            self.supabase = create_client(supabase_url, supabase_key)
        else:
            self.supabase = None
            logger.warning("Supabase client not initialized - historical data unavailable")
        
        self.config = {
            'max_retry_attempts': config.get('max_retry_attempts', 3),
            'base_retry_delay_ms': config.get('base_retry_delay_ms', 24 * 60 * 60 * 1000),  # 24 hours
            'max_retry_delay_ms': config.get('max_retry_delay_ms', 7 * 24 * 60 * 60 * 1000),  # 7 days
            'learning_window_days': config.get('learning_window_days', 30),
            'min_confidence_threshold': config.get('min_confidence_threshold', 0.3),
            **config
        }
        
        # Retry analysis cache and patterns
        self.retry_patterns = {}
        self.failure_analysis_cache = {}
        
        # Failure categories and their typical retry success rates
        self.failure_categories = {
            'CONTENT_QUALITY': {
                'name': 'Content Quality Issues',
                'retry_probability': 0.7,
                'improvement_required': True,
                'typical_delay': 1 * 24 * 60 * 60 * 1000,  # 1 day
                'strategies': ['content_improvement', 'description_rewrite', 'keyword_optimization']
            },
            'REQUIREMENTS_NOT_MET': {
                'name': 'Requirements Not Met',
                'retry_probability': 0.8,
                'improvement_required': True,
                'typical_delay': 1 * 24 * 60 * 60 * 1000,  # 1 day
                'strategies': ['requirements_compliance', 'field_completion', 'format_correction']
            },
            'TECHNICAL_ERROR': {
                'name': 'Technical Issues',
                'retry_probability': 0.9,
                'improvement_required': False,
                'typical_delay': 6 * 60 * 60 * 1000,  # 6 hours
                'strategies': ['immediate_retry', 'alternative_approach', 'technical_support']
            },
            'TEMPORARY_REJECTION': {
                'name': 'Temporary Issues',
                'retry_probability': 0.8,
                'improvement_required': False,
                'typical_delay': 3 * 24 * 60 * 60 * 1000,  # 3 days
                'strategies': ['delayed_retry', 'timing_optimization', 'queue_management']
            },
            'POLICY_VIOLATION': {
                'name': 'Policy Violations',
                'retry_probability': 0.4,
                'improvement_required': True,
                'typical_delay': 7 * 24 * 60 * 60 * 1000,  # 7 days
                'strategies': ['policy_compliance', 'content_revision', 'legal_review']
            },
            'DUPLICATE_LISTING': {
                'name': 'Duplicate/Already Listed',
                'retry_probability': 0.1,
                'improvement_required': False,
                'typical_delay': 0,
                'strategies': ['verification_check', 'listing_claim', 'alternative_directory']
            },
            'UNKNOWN_REASON': {
                'name': 'Unknown/Unclear Reason',
                'retry_probability': 0.5,
                'improvement_required': True,
                'typical_delay': 2 * 24 * 60 * 60 * 1000,  # 2 days
                'strategies': ['ai_analysis', 'content_optimization', 'manual_review']
            }
        }
    
    async def analyze_failure_and_recommend_retry(self, failure_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze failed submission and determine retry strategy.
        
        Args:
            failure_data: Dict containing:
                - submission_id: UUID of submission (required)
                - directory_id: UUID of directory (required)
                - business_name: Business name
                - rejection_reason: Reason for failure
                - error_message: Error message if any
                - attempt_number: Current attempt number
        
        Returns:
            Dict with retry recommendation, strategy, and improvements
        
        Raises:
            ValueError: If input validation fails
        """
        # Input validation
        if not failure_data or not isinstance(failure_data, dict):
            raise ValueError("failure_data must be a non-empty dict")
        
        if 'submission_id' not in failure_data:
            raise ValueError("failure_data must contain 'submission_id'")
        
        submission_id = failure_data.get('submission_id')
        if not isinstance(submission_id, str) or len(submission_id.strip()) == 0:
            raise ValueError("submission_id must be a non-empty string")
        
        start_time = time.time()
        request_id = self.generate_request_id()
        
        try:
            logger.info(f"🔍 [{request_id}] Analyzing failure for submission: {submission_id}")
            
            # Validate input (call existing validation method if it exists)
            if hasattr(self, 'validate_failure_data'):
                try:
                    self.validate_failure_data(failure_data)
                except AttributeError:
                    pass  # Method doesn't exist, already validated above
            
            # Check for cached analysis
            cache_key = self.generate_analysis_cache_key(failure_data)
            cached = self.get_cached_analysis(cache_key)
            if cached:
                logger.info(f"💾 [{request_id}] Using cached failure analysis")
                return {**cached, 'from_cache': True}
            
            # Analyze failure reason using AI
            failure_analysis = await self.analyze_failure_reason(failure_data)
            
            # Get historical retry patterns for this directory and failure type
            retry_patterns = await self.get_retry_patterns(
                failure_data.get('directory_id'),
                failure_analysis['category']
            )
            
            # Calculate retry probability
            retry_probability = self.calculate_retry_probability(
                failure_data,
                failure_analysis,
                retry_patterns
            )
            
            # Generate improvement recommendations
            improvements = await self.generate_improvement_recommendations(
                failure_data,
                failure_analysis
            )
            
            # Determine optimal retry timing
            optimal_timing = self.calculate_optimal_retry_timing(
                failure_data,
                failure_analysis,
                retry_patterns
            )
            
            # Generate retry strategy
            retry_strategy = self.generate_retry_strategy(
                failure_analysis,
                retry_probability,
                improvements,
                optimal_timing
            )
            
            result = {
                'request_id': request_id,
                'submission_id': failure_data.get('submission_id'),
                'directory_id': failure_data.get('directory_id'),
                'failure_analysis': failure_analysis,
                'retry_probability': retry_probability,
                'retry_recommendation': retry_probability.get('should_retry', False),
                'improvements': improvements,
                'optimal_timing': optimal_timing,
                'retry_strategy': retry_strategy,
                'confidence': retry_probability.get('confidence', 0.5),
                'processing_time': int((time.time() - start_time) * 1000),
                'analyzed_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }
            
            # Cache the analysis
            self.cache_analysis(cache_key, result)
            
            logger.info(f"✅ [{request_id}] Retry analysis complete. Recommend retry: {result.get('retry_recommendation', False)}")
            
            return result
            
        except ValueError as e:
            logger.error(f"❌ [{request_id}] Invalid input: {str(e)}")
            raise
        except Exception as error:
            logger.error(f"❌ [{request_id}] Retry analysis failed: {str(error)}")
            raise
    
    async def analyze_failure_reason(self, failure_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the specific failure reason using AI."""
        try:
            prompt = self.build_failure_analysis_prompt(failure_data)
            
            response = self.anthropic.messages.create(
                model='claude-3-sonnet-20241022',
                max_tokens=800,
                temperature=0.3,
                messages=[{'role': 'user', 'content': prompt}]
            )
            
            ai_analysis = response.content[0].text
            return self.parse_failure_analysis(ai_analysis, failure_data)
            
        except Exception as error:
            logger.warn(f'AI failure analysis failed, using fallback: {str(error)}')
            return self.generate_fallback_analysis(failure_data)
    
    def build_failure_analysis_prompt(self, failure_data: Dict[str, Any]) -> str:
        """Build comprehensive failure analysis prompt."""
        return f"""Analyze this directory submission failure and categorize it:

SUBMISSION DETAILS:
- Directory: {failure_data.get('directory_name', 'Unknown Directory')}
- Business: {failure_data.get('business_name', 'Unknown')}
- Category: {failure_data.get('business_category', 'Not specified')}
- Submission Date: {failure_data.get('submitted_at', 'Unknown')}

FAILURE INFORMATION:
- Rejection Reason: {failure_data.get('rejection_reason', 'Not provided')}
- Error Message: {failure_data.get('error_message', 'None')}
- Status: {failure_data.get('status', 'failed')}

SUBMISSION CONTENT:
- Description: {str(failure_data.get('business_description', ''))[:300] or 'Not provided'}

PREVIOUS ATTEMPTS:
- Attempt Number: {failure_data.get('attempt_number', 1)}

Please analyze this failure and provide:

1. Primary failure category from: CONTENT_QUALITY, REQUIREMENTS_NOT_MET, TECHNICAL_ERROR, TEMPORARY_REJECTION, POLICY_VIOLATION, DUPLICATE_LISTING, UNKNOWN_REASON

2. Specific issues identified

3. Root cause analysis

4. Confidence in the analysis (0.0 to 1.0)

5. Whether the failure appears to be fixable

Format as JSON:
{{
  "category": "CONTENT_QUALITY",
  "specificIssues": ["Issue 1", "Issue 2"],
  "rootCause": "Detailed explanation of the main cause",
  "confidence": 0.85,
  "isFixable": true,
  "reasoning": "Brief explanation of the analysis"
}}

Focus on accuracy and actionable insights."""
    
    def parse_failure_analysis(self, ai_analysis: str, failure_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse AI failure analysis response."""
        import json
        import re
        
        try:
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', ai_analysis, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
            else:
                parsed = json.loads(ai_analysis.strip())
            
            # Validate category
            category = parsed.get('category', 'UNKNOWN_REASON')
            if category not in self.failure_categories:
                category = 'UNKNOWN_REASON'
            
            category_info = self.failure_categories[category]
            
            return {
                'category': category,
                'category_name': category_info['name'],
                'specific_issues': parsed.get('specificIssues', []),
                'root_cause': parsed.get('rootCause', 'Analysis unavailable'),
                'confidence': parsed.get('confidence', 0.5),
                'is_fixable': parsed.get('isFixable', True),
                'reasoning': parsed.get('reasoning', ''),
                'category_info': category_info,
                'analyzed_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }
            
        except Exception as error:
            logger.warn(f'Failed to parse failure analysis: {str(error)}')
            return self.generate_fallback_analysis(failure_data)
    
    def calculate_retry_probability(self, failure_data: Dict[str, Any],
                                   failure_analysis: Dict[str, Any],
                                   retry_patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate probability of success if retried."""
        base_retry_probability = failure_analysis['category_info']['retry_probability']
        
        # Adjust based on attempt number (diminishing returns)
        attempt_number = failure_data.get('attempt_number', 1)
        attempt_penalty = 0.7 ** (attempt_number - 1)
        base_retry_probability *= attempt_penalty
        
        # Adjust based on historical patterns
        if retry_patterns.get('success_rate') and retry_patterns.get('sample_size', 0) >= 5:
            historical_weight = 0.3
            base_retry_probability = (base_retry_probability * (1 - historical_weight)) + \
                                   (retry_patterns['success_rate'] * historical_weight)
        
        # Adjust based on failure analysis confidence
        confidence_adjustment = failure_analysis['confidence'] * 0.2
        adjusted_probability = base_retry_probability + \
            (confidence_adjustment if failure_analysis['is_fixable'] else -confidence_adjustment)
        
        # Clamp to [0, 1]
        final_probability = max(0, min(1, adjusted_probability))
        
        should_retry = final_probability >= self.config['min_confidence_threshold'] and \
                      attempt_number <= self.config['max_retry_attempts']
        
        return {
            'probability': final_probability,
            'should_retry': should_retry,
            'confidence': min(failure_analysis['confidence'] + 0.2, 1.0),
            'factors': {
                'base_category': failure_analysis['category_info']['retry_probability'],
                'attempt_penalty': attempt_penalty,
                'historical_data': retry_patterns.get('success_rate', 'insufficient'),
                'confidence_bonus': confidence_adjustment,
            },
            'reasoning': self.generate_probability_reasoning(
                final_probability,
                should_retry,
                attempt_number,
                failure_analysis
            )
        }
    
    async def get_retry_patterns(self, directory_id: str, failure_category: str) -> Dict[str, Any]:
        """Get retry patterns for specific directory and failure type."""
        cache_key = f"{directory_id}_{failure_category}"
        cached = self.retry_patterns.get(cache_key)
        
        if cached and time.time() - cached['updated_at'] < 3600:  # 1 hour cache
            return cached['patterns']
        
        try:
            if not self.supabase:
                return self.get_default_retry_patterns()
            
            # Query retry attempts and their outcomes
            response = self.supabase.table('job_results').select(
                'id, status, directory_name, created_at'
            ).eq('directory_name', directory_id).limit(50).execute()
            
            if not response.data or len(response.data) < 5:
                return self.get_default_retry_patterns()
            
            # Simple pattern analysis
            successful = [r for r in response.data if r.get('status') == 'submitted']
            success_rate = len(successful) / len(response.data) if response.data else 0.5
            
            patterns = {
                'success_rate': success_rate,
                'sample_size': len(response.data),
                'average_retry_delay': 2,  # days (would calculate from actual data)
                'total_retries': len(response.data),
                'last_analyzed': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }
            
            # Cache the patterns
            self.retry_patterns[cache_key] = {
                'patterns': patterns,
                'updated_at': time.time()
            }
            
            return patterns
            
        except Exception as error:
            logger.warn(f"Failed to load retry patterns for {directory_id}: {str(error)}")
            return self.get_default_retry_patterns()
    
    async def generate_improvement_recommendations(self, failure_data: Dict[str, Any],
                                                   failure_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate improvement recommendations."""
        try:
            prompt = f"""Based on this submission failure analysis, provide specific improvement recommendations:

FAILURE ANALYSIS:
- Category: {failure_analysis['category']}
- Root Cause: {failure_analysis['root_cause']}
- Specific Issues: {', '.join(failure_analysis['specific_issues'])}

ORIGINAL SUBMISSION:
- Business: {failure_data.get('business_name', 'Unknown')}
- Description: {str(failure_data.get('business_description', ''))[:200] or 'Not provided'}

Provide actionable improvements in JSON format:
{{
  "critical": ["Must-fix issues for retry"],
  "recommended": ["Improvements that would help"],
  "optional": ["Nice-to-have enhancements"],
  "contentChanges": ["Specific content modifications"],
  "strategyChanges": ["Approach or timing modifications"]
}}

Focus on specific, actionable recommendations."""

            response = self.anthropic.messages.create(
                model='claude-3-haiku-20240307',
                max_tokens=600,
                messages=[{'role': 'user', 'content': prompt}]
            )
            
            import json
            recommendations = json.loads(response.content[0].text)
            
            return {
                **recommendations,
                'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'confidence': failure_analysis['confidence']
            }
            
        except Exception as error:
            logger.warn(f'Failed to generate AI recommendations: {str(error)}')
            return self.generate_fallback_recommendations(failure_analysis)
    
    def calculate_optimal_retry_timing(self, failure_data: Dict[str, Any],
                                      failure_analysis: Dict[str, Any],
                                      retry_patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate optimal retry timing."""
        base_delay = failure_analysis['category_info']['typical_delay']
        attempt_number = failure_data.get('attempt_number', 1)
        
        # Exponential backoff for multiple attempts
        backoff_multiplier = 1.5 ** (attempt_number - 1)
        recommended_delay = base_delay * backoff_multiplier
        
        # Adjust based on historical patterns
        if retry_patterns.get('average_retry_delay'):
            historical_delay = retry_patterns['average_retry_delay'] * 24 * 60 * 60 * 1000
            recommended_delay = (recommended_delay + historical_delay) / 2
        
        # Cap at maximum delay
        recommended_delay = min(recommended_delay, self.config['max_retry_delay_ms'])
        
        retry_date = time.time() * 1000 + recommended_delay
        retry_date_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(retry_date / 1000))
        
        return {
            'recommended_delay_ms': int(recommended_delay),
            'recommended_delay_hours': int(recommended_delay / (60 * 60 * 1000)),
            'retry_date': retry_date_iso,
            'reasoning': self.generate_timing_reasoning(failure_analysis, attempt_number, recommended_delay),
            'factors': {
                'base_delay': base_delay,
                'backoff_multiplier': backoff_multiplier,
                'historical_influence': retry_patterns.get('average_retry_delay'),
                'attempt_number': attempt_number
            }
        }
    
    def generate_retry_strategy(self, failure_analysis: Dict[str, Any],
                               retry_probability: Dict[str, Any],
                               improvements: Dict[str, Any],
                               timing: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive retry strategy."""
        category_strategies = failure_analysis['category_info']['strategies']
        
        return {
            'primary_approach': category_strategies[0] if category_strategies else 'standard_retry',
            'alternative_approaches': category_strategies[1:] if len(category_strategies) > 1 else [],
            'required_improvements': improvements.get('critical', []),
            'recommended_improvements': improvements.get('recommended', []),
            'timing': {
                'wait_period': timing['recommended_delay_hours'],
                'retry_date': timing['retry_date'],
                'reasoning': timing['reasoning']
            },
            'success_probability': retry_probability['probability'],
            'confidence': retry_probability['confidence']
        }
    
    def generate_probability_reasoning(self, probability: float, should_retry: bool,
                                      attempt_number: int,
                                      failure_analysis: Dict[str, Any]) -> str:
        """Generate reasoning for retry probability."""
        prob_percent = f"{probability*100:.1f}%"
        
        if not should_retry:
            if attempt_number > self.config['max_retry_attempts']:
                return f"Maximum retry attempts ({self.config['max_retry_attempts']}) reached. Success probability: {prob_percent}%"
            return f"Success probability too low ({prob_percent}%) to justify retry effort."
        
        category_name = failure_analysis['category_name']
        return f"{prob_percent}% success probability for {category_name} retry (attempt #{attempt_number}). {'Issues appear fixable.' if failure_analysis['is_fixable'] else 'May require significant changes.'}"
    
    def generate_timing_reasoning(self, failure_analysis: Dict[str, Any],
                                 attempt_number: int, delay_ms: float) -> str:
        """Generate reasoning for retry timing."""
        delay_hours = int(delay_ms / (60 * 60 * 1000))
        category_name = failure_analysis['category_name']
        
        improvement_note = 'improvements and ' if failure_analysis['category_info']['improvement_required'] else ''
        return f"{category_name} failures typically benefit from {delay_hours}-hour wait period. This allows time for {improvement_note}directory processing queue recovery. Attempt #{attempt_number} with exponential backoff applied."
    
    def generate_fallback_analysis(self, failure_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate fallback failure analysis."""
        return {
            'category': 'UNKNOWN_REASON',
            'category_name': 'Unknown/Unclear Reason',
            'specific_issues': ['Analysis failed', 'Using fallback categorization'],
            'root_cause': 'Unable to determine specific failure reason',
            'confidence': 0.3,
            'is_fixable': True,
            'reasoning': 'Fallback analysis applied due to processing error',
            'category_info': self.failure_categories['UNKNOWN_REASON'],
            'analyzed_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        }
    
    def generate_fallback_recommendations(self, failure_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate fallback improvement recommendations."""
        return {
            'critical': ['Review submission for completeness', 'Verify requirements compliance'],
            'recommended': ['Improve business description', 'Check category alignment'],
            'optional': ['Add more contact details', 'Enhance website presence'],
            'contentChanges': ['Make description more specific and detailed'],
            'strategyChanges': ['Consider different submission timing'],
            'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'confidence': 0.3
        }
    
    def get_default_retry_patterns(self) -> Dict[str, Any]:
        """Get default retry patterns."""
        return {
            'success_rate': 0.5,
            'sample_size': 0,
            'average_retry_delay': 2,
            'total_retries': 0,
            'last_analyzed': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        }
    
    def generate_analysis_cache_key(self, failure_data: Dict[str, Any]) -> str:
        """Generate cache key for failure analysis."""
        import hashlib
        key_string = f"{failure_data.get('submission_id', '')}_{failure_data.get('attempt_number', 1)}_{str(failure_data.get('rejection_reason', ''))[:50]}"
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def get_cached_analysis(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached analysis if valid."""
        cached = self.failure_analysis_cache.get(cache_key)
        if cached and time.time() - cached['timestamp'] < 7200:  # 2 hours
            return cached['analysis']
        return None
    
    def cache_analysis(self, cache_key: str, analysis: Dict[str, Any]):
        """Cache failure analysis."""
        self.failure_analysis_cache[cache_key] = {
            'analysis': analysis,
            'timestamp': time.time()
        }
    
    def validate_failure_data(self, data: Dict[str, Any]):
        """Validate failure data."""
        if not data.get('submission_id'):
            raise ValueError('Submission ID is required')
        
        if not data.get('directory_id'):
            raise ValueError('Directory ID is required')
        
        if not data.get('business_name'):
            raise ValueError('Business name is required')
    
    def generate_request_id(self) -> str:
        """Generate unique request ID."""
        timestamp = int(time.time() * 1000)
        random_part = secrets.token_hex(4)
        return f"retry_{timestamp}_{random_part}"
    
    def get_stats(self) -> Dict[str, Any]:
        """Get analyzer statistics."""
        return {
            'cached_patterns': len(self.retry_patterns),
            'cached_analyses': len(self.failure_analysis_cache),
            'failure_categories': len(self.failure_categories),
            'max_retry_attempts': self.config['max_retry_attempts']
        }

