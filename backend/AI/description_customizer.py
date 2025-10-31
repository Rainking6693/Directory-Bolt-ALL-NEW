"""
AI Description Customizer - Directory-Specific Content Optimization

Customizes business descriptions for specific directories using AI analysis.
Features:
- Directory-specific content optimization
- Keyword optimization based on directory preferences
- Tone and style adaptation
- Length and format customization
- A/B testing content variations
"""

import os
import time
import hashlib
import secrets
from typing import Dict, List, Any, Optional
from anthropic import Anthropic
from supabase import create_client
from utils.logging import setup_logger

logger = setup_logger(__name__)


class DescriptionCustomizer:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize AI Description Customizer."""
        config = config or {}
        
        self.anthropic = Anthropic(
            api_key=config.get('anthropic_api_key') or os.getenv('ANTHROPIC_API_KEY')
        )
        
        supabase_url = config.get('supabase_url') or os.getenv('SUPABASE_URL')
        supabase_key = config.get('supabase_key') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if supabase_url and supabase_key:
            self.supabase = create_client(supabase_url, supabase_key)
        else:
            self.supabase = None
            logger.warning("Supabase client not initialized - directory profiles unavailable")
        
        self.config = {
            'max_description_length': config.get('max_description_length', 2000),
            'min_description_length': config.get('min_description_length', 50),
            'cache_timeout': config.get('cache_timeout', 24 * 60 * 60 * 1000),  # 24 hours
            'generate_variations': config.get('generate_variations', True),
            'variation_count': config.get('variation_count', 3),
            **config
        }
        
        # Customization cache
        self.customization_cache = {}
        self.directory_profiles = {}
        
        # Style templates
        self.style_templates = {
            'professional': {
                'tone': 'Professional and authoritative',
                'keywords': ['expertise', 'professional', 'qualified', 'experienced', 'reliable'],
                'structure': 'Formal business introduction with credentials'
            },
            'friendly': {
                'tone': 'Warm and approachable',
                'keywords': ['friendly', 'welcoming', 'helpful', 'personalized', 'caring'],
                'structure': 'Conversational and personal'
            },
            'technical': {
                'tone': 'Technical and detailed',
                'keywords': ['innovative', 'technology', 'advanced', 'cutting-edge', 'solutions'],
                'structure': 'Technical capabilities focus'
            },
            'local': {
                'tone': 'Community-focused and local',
                'keywords': ['local', 'community', 'neighborhood', 'nearby', 'serving'],
                'structure': 'Geographic and community emphasis'
            },
            'modern': {
                'tone': 'Contemporary and dynamic',
                'keywords': ['modern', 'innovative', 'fresh', 'contemporary', 'dynamic'],
                'structure': 'Forward-looking and trend-focused'
            }
        }
    
    async def customize_description(self, customization_request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Customize business description for specific directory.
        
        Args:
            customization_request: Dict containing:
                - directory_id: UUID of directory
                - business_data: Dict with business info
                - original_description: Original description text
        
        Returns:
            Dict with customized description and variations
        """
        start_time = time.time()
        request_id = self.generate_request_id()
        
        try:
            logger.info(f"📝 [{request_id}] Customizing description for directory: {customization_request['directory_id']}")
            
            # Validate input
            self.validate_customization_request(customization_request)
            
            # Check cache first
            cache_key = self.generate_cache_key(customization_request)
            cached = self.get_cached_customization(cache_key)
            if cached:
                logger.info(f"💾 [{request_id}] Using cached customization")
                return {**cached, 'from_cache': True}
            
            # Get directory profile and requirements
            directory_profile = await self.get_directory_profile(customization_request['directory_id'])
            
            # Analyze original content
            content_analysis = await self.analyze_original_content(customization_request['original_description'])
            
            # Generate customized versions
            customizations = await self.generate_customizations(
                customization_request,
                directory_profile,
                content_analysis
            )
            
            # Validate and optimize customizations
            optimized_customizations = self.optimize_customizations(
                customizations,
                directory_profile
            )
            
            result = {
                'request_id': request_id,
                'directory_id': customization_request['directory_id'],
                'primary_customization': optimized_customizations[0] if optimized_customizations else None,
                'variations': optimized_customizations[1:] if len(optimized_customizations) > 1 else [],
                'original_analysis': content_analysis,
                'directory_profile': directory_profile,
                'customization_strategy': self.generate_strategy(directory_profile, content_analysis),
                'processing_time': int((time.time() - start_time) * 1000),
                'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }
            
            # Cache the result
            self.cache_customization(cache_key, result)
            
            logger.info(f"✅ [{request_id}] Generated {len(optimized_customizations)} customizations")
            
            return result
            
        except Exception as error:
            logger.error(f"❌ [{request_id}] Customization failed: {str(error)}")
            raise
    
    async def generate_customizations(self, request: Dict[str, Any], 
                                     directory_profile: Dict[str, Any],
                                     content_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate multiple customization variations."""
        customizations = []
        
        # Determine optimal styles for this directory
        recommended_styles = self.determine_optimal_styles(directory_profile)
        
        for i, style in enumerate(recommended_styles[:self.config['variation_count']]):
            try:
                customization = await self.generate_single_customization(
                    request,
                    directory_profile,
                    content_analysis,
                    style
                )
                
                if customization:
                    customizations.append({
                        **customization,
                        'style': style['name'],
                        'variation': i + 1
                    })
            except Exception as error:
                logger.warning(f"Failed to generate customization with style {style['name']}: {str(error)}")
        
        return customizations
    
    async def generate_single_customization(self, request: Dict[str, Any],
                                           directory_profile: Dict[str, Any],
                                           content_analysis: Dict[str, Any],
                                           style: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Generate a single customized description."""
        try:
            prompt = self.build_customization_prompt(request, directory_profile, content_analysis, style)
            
            response = self.anthropic.messages.create(
                model='claude-3-sonnet-20241022',
                max_tokens=1000,
                temperature=0.7,
                messages=[{
                    'role': 'user',
                    'content': prompt
                }]
            )
            
            ai_response = response.content[0].text
            return self.parse_customization_response(ai_response, request, style)
            
        except Exception as error:
            logger.error(f'AI customization generation failed: {str(error)}')
            return self.generate_fallback_customization(request, style)
    
    def build_customization_prompt(self, request: Dict[str, Any],
                                   directory_profile: Dict[str, Any],
                                   content_analysis: Dict[str, Any],
                                   style: Dict[str, Any]) -> str:
        """Build comprehensive customization prompt."""
        business_data = request.get('business_data', {})
        
        return f"""Customize this business description for a specific directory submission:

ORIGINAL DESCRIPTION:
"{request['original_description']}"

BUSINESS INFORMATION:
- Name: {business_data.get('name', 'Not specified')}
- Industry: {business_data.get('industry', 'Not specified')}
- Location: {business_data.get('location', 'Not specified')}
- Website: {business_data.get('website', 'Not provided')}
- Key Services: {', '.join(business_data.get('services', [])) or 'Not specified'}

DIRECTORY PROFILE:
- Directory: {directory_profile.get('name', 'General Directory')}
- Target Audience: {directory_profile.get('target_audience', 'General business')}
- Preferred Categories: {', '.join(directory_profile.get('preferred_categories', [])) or 'All categories'}
- Content Style: {directory_profile.get('content_style', style['tone'])}
- Key Requirements: {', '.join(directory_profile.get('requirements', [])) or 'Standard submission'}

CUSTOMIZATION REQUIREMENTS:
- Style: {style['tone']}
- Target Length: {request.get('requirements', {}).get('target_length', '150-300 words')}
- Include Keywords: {', '.join(request.get('requirements', {}).get('keywords', [])) or 'Industry-relevant terms'}
- Emphasize: {', '.join(request.get('requirements', {}).get('emphasis', [])) or 'Unique value proposition'}

ORIGINAL CONTENT ANALYSIS:
- Tone: {content_analysis.get('tone', 'neutral')}
- Key Themes: {', '.join(content_analysis.get('themes', []))}
- Strengths: {', '.join(content_analysis.get('strengths', []))}
- Improvement Areas: {', '.join(content_analysis.get('improvements', []))}

Please create a customized description that:
1. Matches the directory's preferred style and audience
2. Incorporates relevant keywords naturally
3. Highlights the business's unique value proposition
4. Meets the specified length requirements
5. Maintains accuracy while improving appeal

Format your response as JSON:
{{
  "customizedDescription": "The rewritten description...",
  "keyChanges": ["List of main changes made"],
  "keywordsIncluded": ["Keywords successfully incorporated"],
  "styleNotes": "Brief explanation of style adaptation",
  "confidence": 0.85
}}

Focus on creating compelling, authentic content that will resonate with the directory's audience while maintaining the business's core message."""
    
    def parse_customization_response(self, ai_response: str, 
                                    request: Dict[str, Any],
                                    style: Dict[str, Any]) -> Dict[str, Any]:
        """Parse AI customization response."""
        import json
        import re
        
        try:
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
            else:
                parsed = json.loads(ai_response.strip())
            
            # Validate required fields
            if not parsed.get('customizedDescription') or \
               len(parsed['customizedDescription']) < self.config['min_description_length']:
                raise ValueError('Generated description too short or missing')
            
            # Truncate if too long
            description = parsed['customizedDescription']
            if len(description) > self.config['max_description_length']:
                description = description[:self.config['max_description_length']] + '...'
            
            return {
                'description': description,
                'key_changes': parsed.get('keyChanges', []),
                'keywords_included': parsed.get('keywordsIncluded', []),
                'style_notes': parsed.get('styleNotes', ''),
                'confidence': parsed.get('confidence', 0.7),
                'word_count': len(description.split()),
                'character_count': len(description)
            }
            
        except Exception as error:
            logger.warning(f'Failed to parse AI response: {str(error)}')
            return self.generate_fallback_customization(request, style)
    
    async def analyze_original_content(self, original_description: str) -> Dict[str, Any]:
        """Analyze original content to understand baseline."""
        try:
            if not original_description or len(original_description) < 10:
                return self.get_default_content_analysis()
            
            prompt = f"""Analyze this business description for key characteristics:

"{original_description}"

Provide analysis in JSON format:
{{
  "tone": "professional/casual/technical/friendly",
  "themes": ["main topics covered"],
  "strengths": ["what works well"],
  "improvements": ["areas that could be enhanced"],
  "keywords": ["key terms and phrases"],
  "wordCount": {len(original_description.split())},
  "readabilityLevel": "elementary/intermediate/advanced"
}}"""

            response = self.anthropic.messages.create(
                model='claude-3-haiku-20240307',
                max_tokens=500,
                messages=[{'role': 'user', 'content': prompt}]
            )
            
            import json
            return json.loads(response.content[0].text)
            
        except Exception as error:
            logger.warning(f'Content analysis failed, using defaults: {str(error)}')
            return self.get_default_content_analysis(original_description)
    
    async def get_directory_profile(self, directory_id: str) -> Dict[str, Any]:
        """Get directory profile with preferences and requirements."""
        # Check cache first
        if directory_id in self.directory_profiles:
            cached = self.directory_profiles[directory_id]
            if time.time() - cached['updated_at'] < 3600:  # 1 hour cache
                return cached['profile']
        
        try:
            if not self.supabase:
                return self.get_default_directory_profile()
            
            # Query directory information
            response = self.supabase.table('directories').select(
                'id, name, description, category, field_selectors, '
                'selectors_updated_at, selector_discovery_log'
            ).eq('id', directory_id).single().execute()
            
            if not response.data:
                logger.warning(f"Directory {directory_id} not found, using default profile")
                return self.get_default_directory_profile()
            
            directory = response.data
            
            # Analyze successful submissions for this directory
            success_patterns = await self.analyze_successful_submissions(directory_id)
            
            profile = {
                'id': directory['id'],
                'name': directory.get('name', 'Unknown Directory'),
                'description': directory.get('description', ''),
                'preferred_categories': [directory.get('category')] if directory.get('category') else [],
                'requirements': [],
                'content_style': 'professional',
                'target_audience': 'business owners',
                'preferred_length': '150-300',
                'keyword_preferences': [],
                'success_patterns': success_patterns,
                'last_analyzed': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }
            
            # Cache the profile
            self.directory_profiles[directory_id] = {
                'profile': profile,
                'updated_at': time.time()
            }
            
            return profile
            
        except Exception as error:
            logger.error(f"Failed to load directory profile for {directory_id}: {str(error)}")
            return self.get_default_directory_profile()
    
    async def analyze_successful_submissions(self, directory_id: str) -> Dict[str, Any]:
        """Analyze successful submissions to identify patterns."""
        try:
            if not self.supabase:
                return self.get_default_success_patterns()
            
            # Query successful submissions
            response = self.supabase.table('job_results').select(
                'directory_name, status, created_at'
            ).eq('status', 'submitted').order('created_at', desc=True).limit(20).execute()
            
            if not response.data or len(response.data) < 3:
                return self.get_default_success_patterns()
            
            # Simple pattern analysis
            success_count = len(response.data)
            
            return {
                'average_length': 200,  # Would analyze actual descriptions if available
                'common_keywords': ['professional', 'quality', 'service', 'experienced', 'reliable'],
                'success_count': success_count,
                'sample_size': success_count,
                'last_updated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }
            
        except Exception as error:
            logger.warning(f'Failed to analyze successful submissions: {str(error)}')
            return self.get_default_success_patterns()
    
    def determine_optimal_styles(self, directory_profile: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Determine optimal styles for directory."""
        styles = []
        
        # Base style from directory preference
        preferred_style = directory_profile.get('content_style', 'professional')
        if preferred_style in self.style_templates:
            styles.append({
                'name': preferred_style,
                **self.style_templates[preferred_style],
                'priority': 1
            })
        
        # Add default professional style if not included
        if not any(s['name'] == 'professional' for s in styles):
            styles.append({
                'name': 'professional',
                **self.style_templates['professional'],
                'priority': 2
            })
        
        # Add friendly variation for broader appeal
        if not any(s['name'] == 'friendly' for s in styles):
            styles.append({
                'name': 'friendly',
                **self.style_templates['friendly'],
                'priority': 3
            })
        
        return sorted(styles, key=lambda x: x['priority'])
    
    def optimize_customizations(self, customizations: List[Dict[str, Any]],
                               directory_profile: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Optimize customizations for best performance."""
        return sorted(
            [c for c in customizations if c and c.get('description')],
            key=lambda c: self.calculate_customization_score(c, directory_profile),
            reverse=True
        )
    
    def calculate_customization_score(self, customization: Dict[str, Any],
                                     directory_profile: Dict[str, Any]) -> float:
        """Calculate quality score for customization."""
        score = customization.get('confidence', 0.5)
        
        # Length appropriateness
        target_length = directory_profile.get('preferred_length', '150-300')
        min_len, max_len = self.parse_target_length(target_length)
        actual_length = customization.get('word_count', 0)
        
        if min_len <= actual_length <= max_len:
            score += 0.2
        elif min_len * 0.8 <= actual_length <= max_len * 1.2:
            score += 0.1
        
        # Keyword inclusion bonus
        if customization.get('keywords_included'):
            score += min(0.2, len(customization['keywords_included']) * 0.05)
        
        return min(1.0, score)
    
    def generate_strategy(self, directory_profile: Dict[str, Any],
                          content_analysis: Dict[str, Any]) -> List[str]:
        """Generate strategic approach explanation."""
        strategies = []
        
        if directory_profile.get('content_style') == 'professional':
            strategies.append('Adopt professional tone to match directory standards')
        
        if content_analysis.get('improvements'):
            strategies.append(f"Address: {', '.join(content_analysis['improvements'][:2])}")
        
        return strategies if strategies else ['Standard optimization approach']
    
    def parse_target_length(self, target_length: str) -> tuple:
        """Parse target length string to min/max tuple."""
        import re
        match = re.match(r'(\d+)-(\d+)', target_length)
        if match:
            return (int(match.group(1)), int(match.group(2)))
        
        single = int(target_length) if target_length.isdigit() else 200
        return (int(single * 0.8), int(single * 1.2))
    
    def generate_fallback_customization(self, request: Dict[str, Any],
                                       style: Dict[str, Any]) -> Dict[str, Any]:
        """Generate fallback customization if AI fails."""
        original = request.get('original_description', 'Professional business description needed.')
        return {
            'description': original,
            'key_changes': ['Fallback customization applied'],
            'keywords_included': [],
            'style_notes': f"Applied {style['name']} style template",
            'confidence': 0.3,
            'word_count': len(original.split()),
            'character_count': len(original),
            'is_fallback': True
        }
    
    def get_default_content_analysis(self, original_description: str = '') -> Dict[str, Any]:
        """Get default content analysis."""
        return {
            'tone': 'neutral',
            'themes': ['business services'],
            'strengths': ['basic information provided'],
            'improvements': ['add more specific details', 'enhance value proposition'],
            'keywords': [],
            'word_count': len(original_description.split()),
            'readability_level': 'intermediate'
        }
    
    def get_default_directory_profile(self) -> Dict[str, Any]:
        """Get default directory profile."""
        return {
            'id': 'default',
            'name': 'General Directory',
            'content_style': 'professional',
            'target_audience': 'business owners',
            'preferred_length': '150-300',
            'keyword_preferences': [],
            'success_patterns': self.get_default_success_patterns()
        }
    
    def get_default_success_patterns(self) -> Dict[str, Any]:
        """Get default success patterns."""
        return {
            'average_length': 200,
            'common_keywords': ['professional', 'quality', 'service', 'experienced', 'reliable'],
            'success_count': 0,
            'sample_size': 0,
            'last_updated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        }
    
    def generate_cache_key(self, request: Dict[str, Any]) -> str:
        """Generate cache key for customization request."""
        key_string = f"{request['directory_id']}_{request.get('business_data', {}).get('name', '')}_{request['original_description'][:50]}"
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def get_cached_customization(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached customization if valid."""
        cached = self.customization_cache.get(cache_key)
        if cached and time.time() - cached['timestamp'] < (self.config['cache_timeout'] / 1000):
            return cached['result']
        return None
    
    def cache_customization(self, cache_key: str, result: Dict[str, Any]):
        """Cache customization result."""
        self.customization_cache[cache_key] = {
            'result': result,
            'timestamp': time.time()
        }
    
    def validate_customization_request(self, request: Dict[str, Any]):
        """Validate customization request."""
        if not request.get('directory_id'):
            raise ValueError('Directory ID is required')
        
        if not request.get('business_data') or not request['business_data'].get('name'):
            raise ValueError('Business data with name is required')
        
        if not request.get('original_description') or len(request['original_description']) < 10:
            raise ValueError('Original description must be at least 10 characters')
    
    def generate_request_id(self) -> str:
        """Generate unique request ID."""
        timestamp = int(time.time() * 1000)
        random_part = secrets.token_hex(4)
        return f"desc_{timestamp}_{random_part}"
    
    def get_stats(self) -> Dict[str, Any]:
        """Get customizer statistics."""
        return {
            'cached_customizations': len(self.customization_cache),
            'cached_directory_profiles': len(self.directory_profiles),
            'available_styles': list(self.style_templates.keys()),
            'cache_timeout': self.config['cache_timeout']
        }

