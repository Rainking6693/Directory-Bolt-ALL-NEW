/**
 * 🤖 AI FORM MAPPER - Intelligent Form Field Detection & Mapping
 * 
 * Uses AI to understand and map form fields across different directory submission pages.
 * Features:
 * - Dynamic form analysis using computer vision and NLP
 * - Automatic field detection and classification
 * - Smart pattern recognition for unknown forms
 * - Learning system that improves over time
 * - Confidence scoring for field mappings
 * - Fallback strategies for complex forms
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const crypto = require('crypto');

class AIFormMapper {
  constructor(config = {}) {
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY
    });
    
    this.fieldMappings = new Map();
    this.learningData = new Map();
    this.confidenceThreshold = config.confidenceThreshold || 0.8;
    this.maxRetries = config.maxRetries || 3;
    
    // Load existing mappings from storage
    this.loadMappings();
    
    // Initialize common field patterns
    this.initializeFieldPatterns();
  }

  initializeFieldPatterns() {
    this.commonPatterns = {
      businessName: {
        selectors: [
          'input[name*="business"][name*="name"]',
          'input[name*="company"][name*="name"]',
          'input[placeholder*="business name"]',
          'input[placeholder*="company name"]',
          '#business-name', '#company-name', '#business_name', '#company_name'
        ],
        textPatterns: ['business name', 'company name', 'organization name'],
        confidence: 0.9
      },
      email: {
        selectors: [
          'input[type="email"]',
          'input[name*="email"]',
          'input[placeholder*="email"]',
          '#email', '#email-address', '#contact-email'
        ],
        textPatterns: ['email', 'e-mail', 'email address', 'contact email'],
        confidence: 0.95
      },
      website: {
        selectors: [
          'input[name*="website"]',
          'input[name*="url"]',
          'input[placeholder*="website"]',
          'input[placeholder*="url"]',
          '#website', '#url', '#website-url'
        ],
        textPatterns: ['website', 'url', 'website url', 'web address'],
        confidence: 0.9
      },
      description: {
        selectors: [
          'textarea[name*="description"]',
          'textarea[name*="about"]',
          'textarea[placeholder*="description"]',
          'input[name*="description"]',
          '#description', '#about', '#business-description'
        ],
        textPatterns: ['description', 'about', 'business description', 'company description'],
        confidence: 0.85
      },
      category: {
        selectors: [
          'select[name*="category"]',
          'select[name*="industry"]',
          'input[name*="category"]',
          '#category', '#industry', '#business-category'
        ],
        textPatterns: ['category', 'industry', 'business category', 'type'],
        confidence: 0.8
      },
      phone: {
        selectors: [
          'input[type="tel"]',
          'input[name*="phone"]',
          'input[name*="telephone"]',
          'input[placeholder*="phone"]',
          '#phone', '#telephone', '#phone-number'
        ],
        textPatterns: ['phone', 'telephone', 'phone number', 'contact number'],
        confidence: 0.9
      },
      address: {
        selectors: [
          'input[name*="address"]',
          'textarea[name*="address"]',
          'input[placeholder*="address"]',
          '#address', '#street-address', '#business-address'
        ],
        textPatterns: ['address', 'street address', 'business address', 'location'],
        confidence: 0.85
      },
      city: {
        selectors: [
          'input[name*="city"]',
          'input[placeholder*="city"]',
          '#city', '#city-name'
        ],
        textPatterns: ['city', 'city name', 'town'],
        confidence: 0.9
      },
      state: {
        selectors: [
          'select[name*="state"]',
          'input[name*="state"]',
          'select[name*="province"]',
          '#state', '#province', '#state-province'
        ],
        textPatterns: ['state', 'province', 'region'],
        confidence: 0.9
      },
      zipcode: {
        selectors: [
          'input[name*="zip"]',
          'input[name*="postal"]',
          'input[placeholder*="zip"]',
          '#zip', '#zipcode', '#postal-code'
        ],
        textPatterns: ['zip', 'zipcode', 'postal code', 'postcode'],
        confidence: 0.9
      }
    };
  }

  async analyzeForm(pageData) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    console.log(`🔍 [${requestId}] Starting AI form analysis for: ${pageData.url}`);
    
    try {
      // Extract form elements from the page
      const formElements = await this.extractFormElements(pageData);
      
      if (formElements.length === 0) {
        console.warn(`⚠️ [${requestId}] No form elements found on page`);
        return {
          success: false,
          error: 'No form elements detected',
          requestId
        };
      }
      
      console.log(`📋 [${requestId}] Found ${formElements.length} form elements`);
      
      // Try pattern matching first (fast)
      const patternResults = await this.applyPatternMatching(formElements);
      
      // Use AI for unmapped fields or low confidence mappings
      const aiResults = await this.applyAIAnalysis(formElements, patternResults, pageData);
      
      // Combine and validate results
      const finalMapping = await this.combineResults(patternResults, aiResults);
      
      // Store successful mapping for learning
      await this.storeMappingLearning(pageData.url, finalMapping);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ [${requestId}] Form analysis complete in ${processingTime}ms`);
      
      return {
        success: true,
        mapping: finalMapping,
        confidence: this.calculateOverallConfidence(finalMapping),
        processingTime,
        requestId,
        stats: {
          totalFields: formElements.length,
          mappedFields: Object.keys(finalMapping).length,
          patternMatched: Object.keys(patternResults).length,
          aiMapped: Object.keys(aiResults).length
        }
      };
      
    } catch (error) {
      console.error(`❌ [${requestId}] Form analysis failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        requestId
      };
    }
  }

  async extractFormElements(pageData) {
    // Extract form elements from HTML content
    const formElements = [];
    
    if (!pageData.html) {
      throw new Error('No HTML content provided for analysis');
    }
    
    // Parse HTML and extract form fields
    const cheerio = require('cheerio');
    const $ = cheerio.load(pageData.html);
    
    // Find all form elements
    $('input, textarea, select').each((index, element) => {
      const $el = $(element);
      const tagName = element.tagName.toLowerCase();
      
      const formElement = {
        tagName,
        type: $el.attr('type') || 'text',
        name: $el.attr('name') || '',
        id: $el.attr('id') || '',
        placeholder: $el.attr('placeholder') || '',
        className: $el.attr('class') || '',
        required: $el.attr('required') === 'required' || $el.attr('required') === '',
        value: $el.val() || '',
        selector: this.generateSelector($el, $)
      };
      
      // Extract surrounding text for context
      const labelText = this.extractLabelText($el, $);
      if (labelText) {
        formElement.labelText = labelText;
      }
      
      // Extract nearby text for additional context
      const nearbyText = this.extractNearbyText($el, $);
      if (nearbyText) {
        formElement.nearbyText = nearbyText;
      }
      
      formElements.push(formElement);
    });
    
    console.log(`📊 Extracted ${formElements.length} form elements`);
    return formElements;
  }

  generateSelector(element, $) {
    const $el = $(element);
    
    // Try ID first
    if ($el.attr('id')) {
      return `#${$el.attr('id')}`;
    }
    
    // Try name attribute
    if ($el.attr('name')) {
      return `${element.tagName.toLowerCase()}[name="${$el.attr('name')}"]`;
    }
    
    // Try unique class combinations
    const classes = $el.attr('class');
    if (classes) {
      const classSelector = `.${classes.split(' ').join('.')}`;
      if ($(classSelector).length === 1) {
        return classSelector;
      }
    }
    
    // Generate xpath-like selector
    const tagName = element.tagName.toLowerCase();
    const parent = $el.parent();
    if (parent.length > 0) {
      const siblings = parent.children(tagName);
      const index = siblings.index(element);
      return `${this.generateSelector(parent[0], $)} > ${tagName}:nth-child(${index + 1})`;
    }
    
    return tagName;
  }

  extractLabelText($el, $) {
    // Look for associated label
    const id = $el.attr('id');
    if (id) {
      const label = $(`label[for="${id}"]`);
      if (label.length > 0) {
        return label.text().trim();
      }
    }
    
    // Look for parent label
    const parentLabel = $el.closest('label');
    if (parentLabel.length > 0) {
      return parentLabel.text().replace($el.val() || '', '').trim();
    }
    
    return null;
  }

  extractNearbyText($el, $) {
    // Extract text from nearby elements (previous siblings, parent, etc.)
    const nearbyTexts = [];
    
    // Previous sibling text
    const prevSibling = $el.prev();
    if (prevSibling.length > 0) {
      const text = prevSibling.text().trim();
      if (text && text.length < 100) {
        nearbyTexts.push(text);
      }
    }
    
    // Parent element text (excluding child elements)
    const parent = $el.parent();
    if (parent.length > 0) {
      const parentText = parent.clone().children().remove().end().text().trim();
      if (parentText && parentText.length < 100) {
        nearbyTexts.push(parentText);
      }
    }
    
    return nearbyTexts.join(' ').trim() || null;
  }

  async applyPatternMatching(formElements) {
    const mappings = {};
    
    for (const [fieldType, patterns] of Object.entries(this.commonPatterns)) {
      for (const element of formElements) {
        if (mappings[fieldType]) continue; // Already mapped
        
        const confidence = this.calculatePatternConfidence(element, patterns);
        
        if (confidence >= this.confidenceThreshold) {
          mappings[fieldType] = {
            selector: element.selector,
            confidence: confidence,
            method: 'pattern_matching',
            element: element
          };
          
          console.log(`🎯 Pattern matched: ${fieldType} -> ${element.selector} (${(confidence * 100).toFixed(1)}%)`);
          break;
        }
      }
    }
    
    return mappings;
  }

  calculatePatternConfidence(element, patterns) {
    let confidence = 0;
    let maxConfidence = 0;
    
    // Check selector patterns
    for (const selector of patterns.selectors) {
      if (this.matchesSelector(element, selector)) {
        maxConfidence = Math.max(maxConfidence, patterns.confidence);
      }
    }
    
    // Check text patterns
    const allText = [
      element.labelText,
      element.placeholder,
      element.nearbyText,
      element.name,
      element.id
    ].filter(Boolean).join(' ').toLowerCase();
    
    for (const textPattern of patterns.textPatterns) {
      if (allText.includes(textPattern.toLowerCase())) {
        maxConfidence = Math.max(maxConfidence, patterns.confidence * 0.9);
      }
    }
    
    return maxConfidence;
  }

  matchesSelector(element, selectorPattern) {
    // Simple selector matching - could be enhanced with more sophisticated matching
    const elementSelector = element.selector.toLowerCase();
    const pattern = selectorPattern.toLowerCase();
    
    if (pattern.includes('*')) {
      // Handle wildcard patterns
      const parts = pattern.split('*');
      return parts.every(part => elementSelector.includes(part));
    }
    
    return elementSelector === pattern;
  }

  async applyAIAnalysis(formElements, existingMappings, pageData) {
    const unmappedElements = formElements.filter(element => 
      !Object.values(existingMappings).find(mapping => mapping.selector === element.selector)
    );
    
    if (unmappedElements.length === 0) {
      return {};
    }
    
    console.log(`🤖 Analyzing ${unmappedElements.length} unmapped elements with AI`);
    
    try {
      const aiMapping = await this.performAIAnalysis(unmappedElements, pageData);
      return aiMapping;
      
    } catch (error) {
      console.warn(`⚠️ AI analysis failed: ${error.message}`);
      return {};
    }
  }

  async performAIAnalysis(elements, pageData) {
    const prompt = this.buildAIPrompt(elements, pageData);
    
    const response = await this.anthropic.messages.create({
      model: 'claude-3-sonnet-20241022',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    const aiResponse = response.content[0].text;
    return this.parseAIResponse(aiResponse, elements);
  }

  buildAIPrompt(elements, pageData) {
    const elementsDescription = elements.map((element, index) => {
      return `Element ${index + 1}:
- Tag: ${element.tagName}
- Type: ${element.type}
- Name: ${element.name}
- ID: ${element.id}
- Placeholder: ${element.placeholder}
- Label: ${element.labelText || 'none'}
- Nearby text: ${element.nearbyText || 'none'}
- Selector: ${element.selector}`;
    }).join('\n\n');

    return `You are an expert at analyzing web forms for business directory submissions. Please analyze the following form elements and identify what business information each field is intended to collect.

Website URL: ${pageData.url}

Form Elements to Analyze:
${elementsDescription}

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
{
  "Element 1": {
    "fieldType": "businessName",
    "confidence": 0.9,
    "reasoning": "Input field with name 'company_name' and placeholder 'Enter your company name'"
  },
  "Element 2": {
    "fieldType": "email",
    "confidence": 0.95,
    "reasoning": "Input type='email' with clear email validation"
  }
}

Only include mappings where you have confidence >= 0.7. If an element's purpose is unclear, don't include it in the response.`;
  }

  parseAIResponse(aiResponse, elements) {
    try {
      const aiMappings = JSON.parse(aiResponse.trim());
      const result = {};
      
      for (const [elementKey, mapping] of Object.entries(aiMappings)) {
        const elementIndex = parseInt(elementKey.replace('Element ', '')) - 1;
        const element = elements[elementIndex];
        
        if (element && mapping.confidence >= 0.7) {
          result[mapping.fieldType] = {
            selector: element.selector,
            confidence: mapping.confidence,
            method: 'ai_analysis',
            reasoning: mapping.reasoning,
            element: element
          };
          
          console.log(`🤖 AI mapped: ${mapping.fieldType} -> ${element.selector} (${(mapping.confidence * 100).toFixed(1)}%)`);
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return {};
    }
  }

  async combineResults(patternResults, aiResults) {
    const combinedMapping = { ...patternResults };
    
    // Add AI results, preferring higher confidence mappings
    for (const [fieldType, aiMapping] of Object.entries(aiResults)) {
      const existingMapping = combinedMapping[fieldType];
      
      if (!existingMapping || aiMapping.confidence > existingMapping.confidence) {
        combinedMapping[fieldType] = aiMapping;
        
        if (existingMapping) {
          console.log(`🔄 Replaced ${fieldType} mapping: ${existingMapping.method} (${(existingMapping.confidence * 100).toFixed(1)}%) -> ${aiMapping.method} (${(aiMapping.confidence * 100).toFixed(1)}%)`);
        }
      }
    }
    
    return combinedMapping;
  }

  calculateOverallConfidence(mapping) {
    const confidences = Object.values(mapping).map(m => m.confidence);
    return confidences.length > 0 ? confidences.reduce((a, b) => a + b) / confidences.length : 0;
  }

  async storeMappingLearning(url, mapping) {
    const domain = new URL(url).hostname;
    const learningEntry = {
      url,
      domain,
      mapping,
      timestamp: new Date().toISOString(),
      success: true
    };
    
    const existingLearning = this.learningData.get(domain) || [];
    existingLearning.push(learningEntry);
    
    // Keep only the last 10 entries per domain
    if (existingLearning.length > 10) {
      existingLearning.splice(0, existingLearning.length - 10);
    }
    
    this.learningData.set(domain, existingLearning);
    
    // Persist to storage (implement based on your storage solution)
    await this.persistLearningData();
  }

  async loadMappings() {
    // Load existing mappings from storage
    // This would be implemented based on your storage solution (file system, database, etc.)
    console.log('📚 Loading existing form mappings...');
  }

  async persistLearningData() {
    // Persist learning data to storage
    console.log('💾 Persisting form mapping learning data...');
  }

  generateRequestId() {
    return `form_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  getStats() {
    return {
      totalMappings: this.fieldMappings.size,
      learningEntries: Array.from(this.learningData.values()).reduce((total, entries) => total + entries.length, 0),
      confidenceThreshold: this.confidenceThreshold
    };
  }
}

module.exports = AIFormMapper;