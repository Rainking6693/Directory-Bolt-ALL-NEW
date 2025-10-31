"""
AI Form Mapper - Intelligent Form Field Detection & Mapping

Uses AI to understand and map form fields across different directory submission pages.
Features:
- Dynamic form analysis using computer vision and NLP
- Automatic field detection and classification
- Smart pattern recognition for unknown forms
- Learning system that improves over time
- Confidence scoring for field mappings
- Fallback strategies for complex forms
"""

import os
import time
import hashlib
import json
import secrets
import re
from typing import Dict, List, Any, Optional, Tuple
from anthropic import Anthropic
from bs4 import BeautifulSoup
from utils.logging import setup_logger

logger = setup_logger(__name__)


class AIFormMapper:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize AI Form Mapper."""
        config = config or {}
        
        self.anthropic = Anthropic(
            api_key=config.get('anthropic_api_key') or os.getenv('ANTHROPIC_API_KEY')
        )
        
        self.field_mappings = {}
        self.learning_data = {}
        self.confidence_threshold = config.get('confidence_threshold', 0.8)
        self.max_retries = config.get('max_retries', 3)
        
        # Load existing mappings from storage
        self.load_mappings()
        
        # Initialize common field patterns
        self.initialize_field_patterns()
    
    def initialize_field_patterns(self):
        """Initialize common field pattern recognition."""
        self.common_patterns = {
            'businessName': {
                'selectors': [
                    'input[name*="business"][name*="name"]',
                    'input[name*="company"][name*="name"]',
                    'input[placeholder*="business name"]',
                    'input[placeholder*="company name"]',
                    '#business-name', '#company-name', '#business_name', '#company_name'
                ],
                'text_patterns': ['business name', 'company name', 'organization name'],
                'confidence': 0.9
            },
            'email': {
                'selectors': [
                    'input[type="email"]',
                    'input[name*="email"]',
                    'input[placeholder*="email"]',
                    '#email', '#email-address', '#contact-email'
                ],
                'text_patterns': ['email', 'e-mail', 'email address', 'contact email'],
                'confidence': 0.95
            },
            'website': {
                'selectors': [
                    'input[name*="website"]',
                    'input[name*="url"]',
                    'input[placeholder*="website"]',
                    'input[placeholder*="url"]',
                    '#website', '#url', '#website-url'
                ],
                'text_patterns': ['website', 'url', 'website url', 'web address'],
                'confidence': 0.9
            },
            'description': {
                'selectors': [
                    'textarea[name*="description"]',
                    'textarea[name*="about"]',
                    'textarea[placeholder*="description"]',
                    'input[name*="description"]',
                    '#description', '#about', '#business-description'
                ],
                'text_patterns': ['description', 'about', 'business description', 'company description'],
                'confidence': 0.85
            },
            'category': {
                'selectors': [
                    'select[name*="category"]',
                    'select[name*="industry"]',
                    'input[name*="category"]',
                    '#category', '#industry', '#business-category'
                ],
                'text_patterns': ['category', 'industry', 'business category', 'type'],
                'confidence': 0.8
            },
            'phone': {
                'selectors': [
                    'input[type="tel"]',
                    'input[name*="phone"]',
                    'input[name*="telephone"]',
                    'input[placeholder*="phone"]',
                    '#phone', '#telephone', '#phone-number'
                ],
                'text_patterns': ['phone', 'telephone', 'phone number', 'contact number'],
                'confidence': 0.9
            },
            'address': {
                'selectors': [
                    'input[name*="address"]',
                    'textarea[name*="address"]',
                    'input[placeholder*="address"]',
                    '#address', '#street-address', '#business-address'
                ],
                'text_patterns': ['address', 'street address', 'business address', 'location'],
                'confidence': 0.85
            },
            'city': {
                'selectors': [
                    'input[name*="city"]',
                    'input[placeholder*="city"]',
                    '#city', '#city-name'
                ],
                'text_patterns': ['city', 'city name', 'town'],
                'confidence': 0.9
            },
            'state': {
                'selectors': [
                    'select[name*="state"]',
                    'input[name*="state"]',
                    'select[name*="province"]',
                    '#state', '#province', '#state-province'
                ],
                'text_patterns': ['state', 'province', 'region'],
                'confidence': 0.9
            },
            'zipcode': {
                'selectors': [
                    'input[name*="zip"]',
                    'input[name*="postal"]',
                    'input[placeholder*="zip"]',
                    '#zip', '#zipcode', '#postal-code'
                ],
                'text_patterns': ['zip', 'zipcode', 'postal code', 'postcode'],
                'confidence': 0.9
            }
        }
    
    async def analyze_form(self, page_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze form elements and generate field mappings.
        
        Args:
            page_data: Dict containing 'url' and 'html' of the submission page
        
        Returns:
            Dict with mapping results, confidence scores, and stats
        """
        start_time = time.time()
        request_id = self.generate_request_id()
        
        try:
            print(f"🔍 [{request_id}] Starting AI form analysis for: {page_data['url']}")
            
            # Extract form elements from the page
            form_elements = self.extract_form_elements(page_data)
            
            if not form_elements:
                print(f"⚠️ [{request_id}] No form elements found on page")
                return {
                    'success': False,
                    'error': 'No form elements detected',
                    'request_id': request_id
                }
            
            print(f"📋 [{request_id}] Found {len(form_elements)} form elements")
            
            # Try pattern matching first (fast)
            pattern_results = self.apply_pattern_matching(form_elements)
            
            # Use AI for unmapped fields or low confidence mappings
            ai_results = await self.apply_ai_analysis(form_elements, pattern_results, page_data)
            
            # Combine and validate results
            final_mapping = self.combine_results(pattern_results, ai_results)
            
            # Store successful mapping for learning
            await self.store_mapping_learning(page_data['url'], final_mapping)
            
            processing_time = int((time.time() - start_time) * 1000)
            
            print(f"✅ [{request_id}] Form analysis complete in {processing_time}ms")
            
            return {
                'success': True,
                'mapping': final_mapping,
                'confidence': self.calculate_overall_confidence(final_mapping),
                'processing_time': processing_time,
                'request_id': request_id,
                'stats': {
                    'total_fields': len(form_elements),
                    'mapped_fields': len(final_mapping),
                    'pattern_matched': len(pattern_results),
                    'ai_mapped': len(ai_results)
                }
            }
            
        except Exception as error:
            print(f"❌ [{request_id}] Form analysis failed: {str(error)}")
            return {
                'success': False,
                'error': str(error),
                'request_id': request_id
            }
    
    def extract_form_elements(self, page_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract form elements from HTML content."""
        form_elements = []
        
        if not page_data.get('html'):
            raise ValueError('No HTML content provided for analysis')
        
        # Parse HTML
        soup = BeautifulSoup(page_data['html'], 'html.parser')
        
        # Find all form elements
        for element in soup.find_all(['input', 'textarea', 'select']):
            tag_name = element.name
            element_data = {
                'tag_name': tag_name,
                'type': element.get('type', 'text'),
                'name': element.get('name', ''),
                'id': element.get('id', ''),
                'placeholder': element.get('placeholder', ''),
                'class': ' '.join(element.get('class', [])),
                'required': element.has_attr('required'),
                'value': element.get('value', ''),
                'selector': self.generate_selector(element)
            }
            
            # Extract surrounding text for context
            label_text = self.extract_label_text(element, soup)
            if label_text:
                element_data['label_text'] = label_text
            
            # Extract nearby text for additional context
            nearby_text = self.extract_nearby_text(element, soup)
            if nearby_text:
                element_data['nearby_text'] = nearby_text
            
            form_elements.append(element_data)
        
        print(f"📊 Extracted {len(form_elements)} form elements")
        return form_elements
    
    def generate_selector(self, element) -> str:
        """Generate CSS selector for element."""
        # Try ID first
        if element.get('id'):
            return f"#{element.get('id')}"
        
        # Try name attribute
        if element.get('name'):
            return f"{element.name}[name=\"{element.get('name')}\"]"
        
        # Try unique class combinations
        classes = element.get('class', [])
        if classes:
            class_selector = '.' + '.'.join(classes)
            # Simple check - in real implementation, would verify uniqueness
            return class_selector
        
        return element.name
    
    def extract_label_text(self, element, soup) -> Optional[str]:
        """Extract associated label text."""
        element_id = element.get('id')
        if element_id:
            label = soup.find('label', {'for': element_id})
            if label:
                return label.get_text(strip=True)
        
        # Look for parent label
        parent_label = element.find_parent('label')
        if parent_label:
            text = parent_label.get_text(strip=True)
            # Remove element value if present
            if element.get('value'):
                text = text.replace(element.get('value'), '').strip()
            return text
        
        return None
    
    def extract_nearby_text(self, element, soup) -> Optional[str]:
        """Extract text from nearby elements."""
        nearby_texts = []
        
        # Previous sibling text
        prev_sibling = element.find_previous_sibling()
        if prev_sibling:
            text = prev_sibling.get_text(strip=True)
            if text and len(text) < 100:
                nearby_texts.append(text)
        
        # Parent element text (excluding child elements)
        parent = element.find_parent()
        if parent:
            # Clone parent, remove all children, get text
            parent_copy = parent.__copy__()
            for child in parent_copy.find_all():
                child.decompose()
            parent_text = parent_copy.get_text(strip=True)
            if parent_text and len(parent_text) < 100:
                nearby_texts.append(parent_text)
        
        return ' '.join(nearby_texts) if nearby_texts else None
    
    def apply_pattern_matching(self, form_elements: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Apply pattern matching to identify known field types."""
        mappings = {}
        
        for field_type, patterns in self.common_patterns.items():
            for element in form_elements:
                if field_type in mappings:
                    continue  # Already mapped
                
                confidence = self.calculate_pattern_confidence(element, patterns)
                
                if confidence >= self.confidence_threshold:
                    mappings[field_type] = {
                        'selector': element['selector'],
                        'confidence': confidence,
                        'method': 'pattern_matching',
                        'element': element
                    }
                    
                    print(f"🎯 Pattern matched: {field_type} -> {element['selector']} ({confidence*100:.1f}%)")
                    break
        
        return mappings
    
    def calculate_pattern_confidence(self, element: Dict[str, Any], patterns: Dict[str, Any]) -> float:
        """Calculate confidence score for pattern match."""
        max_confidence = 0.0
        
        # Check selector patterns (simplified - would use actual CSS selector matching)
        element_selector = element['selector'].lower()
        for selector in patterns['selectors']:
            # Simple substring matching (would use proper CSS selector matching)
            if any(part.lower() in element_selector for part in selector.split('[')[0].split(',')):
                max_confidence = max(max_confidence, patterns['confidence'])
        
        # Check text patterns
        all_text = ' '.join([
            element.get('label_text', ''),
            element.get('placeholder', ''),
            element.get('nearby_text', ''),
            element.get('name', ''),
            element.get('id', '')
        ]).lower()
        
        for text_pattern in patterns['text_patterns']:
            if text_pattern.lower() in all_text:
                max_confidence = max(max_confidence, patterns['confidence'] * 0.9)
        
        return max_confidence
    
    async def apply_ai_analysis(self, form_elements: List[Dict[str, Any]], 
                                existing_mappings: Dict[str, Dict[str, Any]], 
                                page_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """Use AI to analyze unmapped form elements."""
        # Filter out already mapped elements
        mapped_selectors = {m['selector'] for m in existing_mappings.values()}
        unmapped_elements = [e for e in form_elements if e['selector'] not in mapped_selectors]
        
        if not unmapped_elements:
            return {}
        
        print(f"🤖 Analyzing {len(unmapped_elements)} unmapped elements with AI")
        
        try:
            ai_mapping = await self.perform_ai_analysis(unmapped_elements, page_data)
            return ai_mapping
        except Exception as error:
            print(f"⚠️ AI analysis failed: {str(error)}")
            return {}
    
    async def perform_ai_analysis(self, elements: List[Dict[str, Any]], 
                                  page_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """Perform AI analysis on form elements."""
        prompt = self.build_ai_prompt(elements, page_data)
        
        response = self.anthropic.messages.create(
            model='claude-3-sonnet-20241022',
            max_tokens=2000,
            messages=[{
                'role': 'user',
                'content': prompt
            }]
        )
        
        ai_response = response.content[0].text
        return self.parse_ai_response(ai_response, elements)
    
    def build_ai_prompt(self, elements: List[Dict[str, Any]], page_data: Dict[str, Any]) -> str:
        """Build prompt for AI form analysis."""
        elements_description = '\n\n'.join([
            f"Element {i+1}:\n"
            f"- Tag: {el['tag_name']}\n"
            f"- Type: {el['type']}\n"
            f"- Name: {el['name']}\n"
            f"- ID: {el['id']}\n"
            f"- Placeholder: {el['placeholder']}\n"
            f"- Label: {el.get('label_text', 'none')}\n"
            f"- Nearby text: {el.get('nearby_text', 'none')}\n"
            f"- Selector: {el['selector']}"
            for i, el in enumerate(elements)
        ])
        
        return f"""You are an expert at analyzing web forms for business directory submissions. Please analyze the following form elements and identify what business information each field is intended to collect.

Website URL: {page_data['url']}

Form Elements to Analyze:
{elements_description}

Please respond with a JSON object mapping each element to its most likely business field type. Use these standard field types:
- businessName: Company/business name
- email: Email address
- website: Website URL
- description: Business description
- category: Business category/industry
- phone: Phone number
- address: Street address
- city: City name
- state: State/province
- zipcode: ZIP/postal code
- firstName: First name
- lastName: Last name
- title: Job title
- other: For fields that don't match standard types

For each mapping, include:
- fieldType: The business field type
- confidence: Your confidence level (0.0 to 1.0)
- reasoning: Brief explanation of why you think this field maps to this type

Format your response as valid JSON like this:
{{
  "Element 1": {{
    "fieldType": "businessName",
    "confidence": 0.9,
    "reasoning": "Input field with name 'company_name' and placeholder 'Enter your company name'"
  }},
  "Element 2": {{
    "fieldType": "email",
    "confidence": 0.95,
    "reasoning": "Input type='email' with clear email validation"
  }}
}}

Only include mappings where you have confidence >= 0.7. If an element's purpose is unclear, don't include it in the response."""
    
    def parse_ai_response(self, ai_response: str, elements: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Parse AI response into field mappings."""
        try:
            # Extract JSON from response (may have markdown formatting)
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                ai_mappings = json.loads(json_match.group())
            else:
                ai_mappings = json.loads(ai_response.strip())
            
            result = {}
            
            for element_key, mapping in ai_mappings.items():
                # Extract element index
                match = re.search(r'Element (\d+)', element_key)
                if not match:
                    continue
                
                element_index = int(match.group(1)) - 1
                if element_index < 0 or element_index >= len(elements):
                    continue
                
                element = elements[element_index]
                
                if mapping.get('confidence', 0) >= 0.7:
                    result[mapping['fieldType']] = {
                        'selector': element['selector'],
                        'confidence': mapping['confidence'],
                        'method': 'ai_analysis',
                        'reasoning': mapping.get('reasoning', ''),
                        'element': element
                    }
                    
                    print(f"🤖 AI mapped: {mapping['fieldType']} -> {element['selector']} ({mapping['confidence']*100:.1f}%)")
            
            return result
            
        except Exception as error:
            print(f'Failed to parse AI response: {str(error)}')
            return {}
    
    def combine_results(self, pattern_results: Dict[str, Dict[str, Any]], 
                       ai_results: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Combine pattern matching and AI results."""
        combined_mapping = pattern_results.copy()
        
        # Add AI results, preferring higher confidence mappings
        for field_type, ai_mapping in ai_results.items():
            existing_mapping = combined_mapping.get(field_type)
            
            if not existing_mapping or ai_mapping['confidence'] > existing_mapping['confidence']:
                combined_mapping[field_type] = ai_mapping
                
                if existing_mapping:
                    print(f"🔄 Replaced {field_type} mapping: {existing_mapping['method']} "
                          f"({existing_mapping['confidence']*100:.1f}%) -> {ai_mapping['method']} "
                          f"({ai_mapping['confidence']*100:.1f}%)")
        
        return combined_mapping
    
    def calculate_overall_confidence(self, mapping: Dict[str, Dict[str, Any]]) -> float:
        """Calculate overall confidence score for the mapping."""
        if not mapping:
            return 0.0
        
        confidences = [m['confidence'] for m in mapping.values()]
        return sum(confidences) / len(confidences) if confidences else 0.0
    
    async def store_mapping_learning(self, url: str, mapping: Dict[str, Dict[str, Any]]):
        """Store successful mapping for learning."""
        from urllib.parse import urlparse
        domain = urlparse(url).hostname
        
        learning_entry = {
            'url': url,
            'domain': domain,
            'mapping': mapping,
            'timestamp': time.time(),
            'success': True
        }
        
        if domain not in self.learning_data:
            self.learning_data[domain] = []
        
        self.learning_data[domain].append(learning_entry)
        
        # Keep only last 10 entries per domain
        if len(self.learning_data[domain]) > 10:
            self.learning_data[domain] = self.learning_data[domain][-10:]
        
        # Persist to storage (would implement database storage)
        await self.persist_learning_data()
    
    def load_mappings(self):
        """Load existing mappings from storage."""
        print('📚 Loading existing form mappings...')
        # Would implement database loading
    
    async def persist_learning_data(self):
        """Persist learning data to storage."""
        print('💾 Persisting form mapping learning data...')
        # Would implement database persistence
    
    def generate_request_id(self) -> str:
        """Generate unique request ID."""
        timestamp = int(time.time() * 1000)
        random_part = secrets.token_hex(4)
        return f"form_{timestamp}_{random_part}"
    
    def get_stats(self) -> Dict[str, Any]:
        """Get mapper statistics."""
        return {
            'total_mappings': len(self.field_mappings),
            'learning_entries': sum(len(entries) for entries in self.learning_data.values()),
            'confidence_threshold': self.confidence_threshold
        }

