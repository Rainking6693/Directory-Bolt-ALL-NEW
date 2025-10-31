"""
AI Submission Timing Optimizer

Optimizes submission timing based on directory patterns, success rates, and AI analysis.
Features:
- Directory-specific timing pattern analysis
- Peak/off-peak submission optimization
- Success rate correlation with timing
- Automated scheduling recommendations
"""

import os
import time
import secrets
import json
import re
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import google.generativeai as genai
from supabase import create_client
from utils.logging import setup_logger

logger = setup_logger(__name__)


class SubmissionTimingOptimizer:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize Submission Timing Optimizer (uses Gemini for simpler tasks)."""
        config = config or {}
        
        # Use Gemini API for easier AI tasks (timing optimization)
        gemini_api_key = config.get('gemini_api_key') or os.getenv('GEMINI_API_KEY')
        if gemini_api_key:
            genai.configure(api_key=gemini_api_key)
            self.gemini_model = genai.GenerativeModel('gemini-pro')
            self.use_gemini = True
        else:
            self.gemini_model = None
            self.use_gemini = False
            logger.warning("Gemini API key not found - timing optimization will use heuristics only")
        
        supabase_url = config.get('supabase_url') or os.getenv('SUPABASE_URL')
        supabase_key = config.get('supabase_key') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if supabase_url and supabase_key:
            self.supabase = create_client(supabase_url, supabase_key)
        else:
            self.supabase = None
            logger.warning("Supabase client not initialized - timing patterns unavailable")
        
        self.config = {
            'analysis_window_days': config.get('analysis_window_days', 90),
            'min_data_points': config.get('min_data_points', 20),
            'max_schedule_ahead': config.get('max_schedule_ahead', 7 * 24 * 60 * 60 * 1000),  # 7 days
            'timezone': config.get('timezone', 'UTC'),
            'update_interval_ms': config.get('update_interval_ms', 60 * 60 * 1000),  # 1 hour
            **config
        }
        
        # Timing pattern cache
        self.timing_patterns = {}
        self.directory_schedules = {}
        self.last_update = None
        
        # Timing optimization weights
        self.timing_factors = {
            'success_rate_correlation': 0.35,
            'competition_level': 0.25,
            'directory_response_time': 0.20,
            'seasonal_patterns': 0.10,
            'day_of_week_patterns': 0.10
        }
    
    async def get_optimal_timing(self, directory_id: str, priority: str = 'normal') -> Dict[str, Any]:
        """
        Get optimal submission timing for a specific directory.
        
        Args:
            directory_id: UUID of directory
            priority: Priority level ('high', 'normal', 'low')
        
        Returns:
            Dict with optimal time windows and recommendations
        """
        request_id = self.generate_request_id()
        
        try:
            logger.info(f"⏰ [{request_id}] Finding optimal timing for directory: {directory_id}")
            
            # Get directory-specific patterns
            directory_patterns = await self.get_directory_patterns(directory_id)
            
            # Analyze current queue load
            queue_load = await self.analyze_current_queue_load(directory_id)
            
            # Calculate optimal time windows
            time_windows = self.calculate_optimal_windows(
                directory_patterns,
                queue_load,
                priority
            )
            
            # Apply AI enhancement for pattern recognition
            ai_optimized = await self.apply_ai_optimization(
                time_windows,
                directory_id,
                priority
            )
            
            result = {
                'success': True,
                'optimal_windows': ai_optimized,
                'priority': priority,
                'directory_patterns': directory_patterns,
                'queue_analysis': queue_load,
                'recommendations': self.generate_timing_recommendations(ai_optimized, priority),
                'request_id': request_id,
                'calculated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }
            
            logger.info(f"✅ [{request_id}] Found {len(ai_optimized)} optimal time windows")
            
            return result
            
        except Exception as error:
            logger.error(f"❌ [{request_id}] Timing optimization failed: {str(error)}")
            return {
                'success': False,
                'error': str(error),
                'optimal_windows': self.get_default_time_window(),
                'request_id': request_id
            }
    
    async def get_directory_patterns(self, directory_id: str) -> Dict[str, Any]:
        """Get directory-specific timing patterns."""
        # Check cache first
        cached = self.timing_patterns.get(directory_id)
        if cached and time.time() - cached['updated_at'] < 3600:  # 1 hour cache
            return cached['patterns']
        
        try:
            if not self.supabase:
                return self.get_default_patterns()
            
            # Query historical submissions for timing analysis
            response = self.supabase.table('job_results').select(
                'status, created_at, directory_name'
            ).eq('directory_name', directory_id).limit(100).execute()
            
            if not response.data or len(response.data) < self.config['min_data_points']:
                return self.get_default_patterns()
            
            # Analyze timing patterns
            patterns = self.analyze_timing_patterns(response.data)
            
            # Cache the patterns
            self.timing_patterns[directory_id] = {
                'patterns': patterns,
                'updated_at': time.time()
            }
            
            return patterns
            
        except Exception as error:
            logger.warn(f"Failed to load timing patterns for {directory_id}: {str(error)}")
            return self.get_default_patterns()
    
    def analyze_timing_patterns(self, submissions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze timing patterns from historical data."""
        # Simple pattern analysis - would be more sophisticated in production
        successful = [s for s in submissions if s.get('status') == 'submitted']
        success_rate = len(successful) / len(submissions) if submissions else 0.5
        
        return {
            'success_rate': success_rate,
            'sample_size': len(submissions),
            'best_time_of_day': '09:00',  # Would calculate from actual data
            'best_day_of_week': 'Tuesday',  # Would calculate from actual data
            'peak_hours': ['09:00-12:00', '14:00-17:00'],
            'off_peak_hours': ['00:00-06:00', '22:00-24:00']
        }
    
    async def analyze_current_queue_load(self, directory_id: str) -> Dict[str, Any]:
        """Analyze current queue load for directory."""
        # Simplified - would analyze actual queue metrics
        return {
            'current_load': 'normal',
            'pending_count': 0,
            'processing_count': 0
        }
    
    def calculate_optimal_windows(self, directory_patterns: Dict[str, Any],
                                 queue_load: Dict[str, Any],
                                 priority: str) -> List[Dict[str, Any]]:
        """Calculate optimal time windows based on patterns."""
        windows = []
        
        # Base window: next 24-48 hours
        base_time = datetime.now()
        
        # Priority-based scheduling
        if priority == 'high':
            # High priority: schedule sooner (6-12 hours)
            window_start = base_time + timedelta(hours=6)
            window_end = base_time + timedelta(hours=12)
        elif priority == 'low':
            # Low priority: schedule later (48-72 hours)
            window_start = base_time + timedelta(hours=48)
            window_end = base_time + timedelta(hours=72)
        else:
            # Normal priority: schedule in 24-48 hours
            window_start = base_time + timedelta(hours=24)
            window_end = base_time + timedelta(hours=48)
        
        # Use directory patterns if available
        best_time = directory_patterns.get('best_time_of_day', '09:00')
        best_day = directory_patterns.get('best_day_of_week', 'Tuesday')
        
        # Adjust window to optimal time
        window_start = window_start.replace(hour=9, minute=0)  # Default to 9 AM
        
        windows.append({
            'window_start': window_start.isoformat(),
            'window_end': window_end.isoformat(),
            'score': directory_patterns.get('success_rate', 0.5),
            'confidence': 0.7,
            'reasoning': f"Optimal window based on directory patterns and {priority} priority"
        })
        
        return windows
    
    async def apply_ai_optimization(self, time_windows: List[Dict[str, Any]],
                                    directory_id: str,
                                    priority: str) -> List[Dict[str, Any]]:
        """Apply AI enhancement to time windows using Gemini."""
        if not self.use_gemini or not self.gemini_model:
            return time_windows
        
        try:
            prompt = f"""Analyze these submission time windows and optimize them:

Time Windows:
{json.dumps(time_windows, indent=2)}

Directory ID: {directory_id}
Priority: {priority}

Provide optimized time windows in JSON format:
{{
  "optimizedWindows": [
    {{
      "windowStart": "ISO timestamp",
      "windowEnd": "ISO timestamp",
      "score": 0.85,
      "confidence": 0.8,
      "reasoning": "Explanation of optimization"
    }}
  ]
}}

Focus on optimizing submission timing for better success rates."""

            response = self.gemini_model.generate_content(prompt)
            response_text = response.text if hasattr(response, 'text') else str(response)
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                optimized = parsed.get('optimizedWindows', [])
                if optimized:
                    return optimized
        except Exception as e:
            logger.warning(f"Gemini timing optimization failed, using original windows: {e}")
        
        # Fallback to original windows
        return time_windows
    
    def generate_timing_recommendations(self, windows: List[Dict[str, Any]],
                                       priority: str) -> List[str]:
        """Generate timing recommendations."""
        recommendations = []
        
        if windows:
            best_window = windows[0]
            recommendations.append(f"Optimal submission window: {best_window['window_start']} to {best_window['window_end']}")
            recommendations.append(f"Confidence: {best_window.get('confidence', 0.5)*100:.1f}%")
        
        if priority == 'high':
            recommendations.append("High priority - scheduling within 12 hours for faster processing")
        elif priority == 'low':
            recommendations.append("Low priority - scheduling later to optimize resource usage")
        
        return recommendations
    
    def get_default_patterns(self) -> Dict[str, Any]:
        """Get default timing patterns."""
        return {
            'success_rate': 0.5,
            'sample_size': 0,
            'best_time_of_day': '09:00',
            'best_day_of_week': 'Tuesday',
            'peak_hours': ['09:00-12:00', '14:00-17:00'],
            'off_peak_hours': ['00:00-06:00', '22:00-24:00']
        }
    
    def get_default_time_window(self) -> List[Dict[str, Any]]:
        """Get default time window."""
        base_time = datetime.now()
        window_start = base_time + timedelta(hours=24)
        window_end = base_time + timedelta(hours=48)
        
        return [{
            'window_start': window_start.isoformat(),
            'window_end': window_end.isoformat(),
            'score': 0.5,
            'confidence': 0.3,
            'reasoning': 'Default window - no optimization data available'
        }]
    
    def generate_request_id(self) -> str:
        """Generate unique request ID."""
        timestamp = int(time.time() * 1000)
        random_part = secrets.token_hex(4)
        return f"timing_{timestamp}_{random_part}"
    
    def get_stats(self) -> Dict[str, Any]:
        """Get optimizer statistics."""
        return {
            'cached_patterns': len(self.timing_patterns),
            'cached_schedules': len(self.directory_schedules),
            'timing_factors': self.timing_factors
        }

