/**
 * 📝 AI DESCRIPTION CUSTOMIZER
 * 
 * Customizes business descriptions and content for specific directories using AI analysis.
 * Features:
 * - Directory-specific content optimization
 * - Keyword optimization based on directory preferences
 * - Tone and style adaptation
 * - Length and format customization
 * - Multi-language support preparation
 * - A/B testing content variations
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

class DescriptionCustomizer {
  constructor(config = {}) {
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY
    });
    
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.config = {
      maxDescriptionLength: config.maxDescriptionLength || 2000,
      minDescriptionLength: config.minDescriptionLength || 50,
      cacheTimeout: config.cacheTimeout || 24 * 60 * 60 * 1000, // 24 hours
      generateVariations: config.generateVariations || true,
      variationCount: config.variationCount || 3,
      ...config
    };
    
    // Customization cache
    this.customizationCache = new Map();
    this.directoryProfiles = new Map();
    this.successfulCustomizations = new Map();
    
    // Style templates
    this.styleTemplates = {
      professional: {
        tone: 'Professional and authoritative',
        keywords: ['expertise', 'professional', 'qualified', 'experienced', 'reliable'],
        structure: 'Formal business introduction with credentials'
      },
      friendly: {
        tone: 'Warm and approachable',
        keywords: ['friendly', 'welcoming', 'helpful', 'personalized', 'caring'],
        structure: 'Conversational and personal'
      },
      technical: {
        tone: 'Technical and detailed',
        keywords: ['innovative', 'technology', 'advanced', 'cutting-edge', 'solutions'],
        structure: 'Technical capabilities focus'
      },
      local: {
        tone: 'Community-focused and local',
        keywords: ['local', 'community', 'neighborhood', 'nearby', 'serving'],
        structure: 'Geographic and community emphasis'
      },
      modern: {
        tone: 'Contemporary and dynamic',
        keywords: ['modern', 'innovative', 'fresh', 'contemporary', 'dynamic'],
        structure: 'Forward-looking and trend-focused'
      }
    };
    
    this.initializeCustomizer();
  }
  
  async initializeCustomizer() {
    console.log('📝 Initializing AI Description Customizer...');
    
    try {
      await this.loadDirectoryProfiles();
      await this.loadSuccessPatterns();
      console.log('✅ Description Customizer initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize customizer:', error);
      throw error;
    }
  }
  
  /**
   * Customize business description for specific directory
   */
  async customizeDescription(customizationRequest) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      console.log(`📝 [${requestId}] Customizing description for directory: ${customizationRequest.directoryId}`);
      
      // Validate input
      this.validateCustomizationRequest(customizationRequest);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(customizationRequest);
      const cached = this.getCachedCustomization(cacheKey);
      if (cached) {
        console.log(`💾 [${requestId}] Using cached customization`);
        return { ...cached, fromCache: true };
      }
      
      // Get directory profile and requirements
      const directoryProfile = await this.getDirectoryProfile(customizationRequest.directoryId);
      
      // Analyze original content
      const contentAnalysis = await this.analyzeOriginalContent(customizationRequest.originalDescription);
      
      // Generate customized versions
      const customizations = await this.generateCustomizations(
        customizationRequest,
        directoryProfile,
        contentAnalysis
      );
      
      // Validate and optimize customizations
      const optimizedCustomizations = await this.optimizeCustomizations(
        customizations,
        directoryProfile
      );
      
      const result = {
        requestId,
        directoryId: customizationRequest.directoryId,
        primaryCustomization: optimizedCustomizations[0],
        variations: optimizedCustomizations.slice(1),
        originalAnalysis: contentAnalysis,
        directoryProfile: directoryProfile,
        customizationStrategy: this.generateStrategy(directoryProfile, contentAnalysis),
        processingTime: Date.now() - startTime,
        generatedAt: new Date().toISOString()
      };
      
      // Cache the result
      this.cacheCustomization(cacheKey, result);
      
      console.log(`✅ [${requestId}] Generated ${optimizedCustomizations.length} customizations`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ [${requestId}] Customization failed:`, error);
      throw error;
    }
  }
  
  /**
   * Generate multiple customization variations
   */
  async generateCustomizations(request, directoryProfile, contentAnalysis) {
    const customizations = [];
    
    // Determine optimal styles for this directory
    const recommendedStyles = this.determineOptimalStyles(directoryProfile);
    
    for (let i = 0; i < Math.min(this.config.variationCount, recommendedStyles.length); i++) {
      const style = recommendedStyles[i];
      
      try {
        const customization = await this.generateSingleCustomization(
          request,
          directoryProfile,
          contentAnalysis,
          style
        );
        
        if (customization) {
          customizations.push({
            ...customization,
            style: style.name,
            variation: i + 1
          });
        }
      } catch (error) {
        console.warn(`Failed to generate customization with style ${style.name}:`, error);
      }
    }
    
    return customizations;
  }
  
  /**
   * Generate a single customized description
   */
  async generateSingleCustomization(request, directoryProfile, contentAnalysis, style) {
    try {
      const prompt = this.buildCustomizationPrompt(
        request,
        directoryProfile,
        contentAnalysis,
        style
      );
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      });
      
      const aiResponse = response.content[0].text;
      
      // Parse and validate the response
      return this.parseCustomizationResponse(aiResponse, request, style);
      
    } catch (error) {
      console.error('AI customization generation failed:', error);
      return this.generateFallbackCustomization(request, style);
    }
  }
  
  /**
   * Build comprehensive customization prompt
   */
  buildCustomizationPrompt(request, directoryProfile, contentAnalysis, style) {
    const { businessData, originalDescription, requirements } = request;
    
    return `Customize this business description for a specific directory submission:

ORIGINAL DESCRIPTION:
"${originalDescription}"

BUSINESS INFORMATION:
- Name: ${businessData.name}
- Industry: ${businessData.industry || 'Not specified'}
- Location: ${businessData.location || 'Not specified'}
- Website: ${businessData.website || 'Not provided'}
- Key Services: ${businessData.services?.join(', ') || 'Not specified'}

DIRECTORY PROFILE:
- Directory: ${directoryProfile.name}
- Target Audience: ${directoryProfile.targetAudience || 'General business'}
- Preferred Categories: ${directoryProfile.preferredCategories?.join(', ') || 'All categories'}
- Content Style: ${directoryProfile.contentStyle || style.tone}
- Key Requirements: ${directoryProfile.requirements?.join(', ') || 'Standard submission'}

CUSTOMIZATION REQUIREMENTS:
- Style: ${style.tone}
- Target Length: ${requirements?.targetLength || '150-300 words'}
- Include Keywords: ${requirements?.keywords?.join(', ') || 'Industry-relevant terms'}
- Emphasize: ${requirements?.emphasis?.join(', ') || 'Unique value proposition'}

ORIGINAL CONTENT ANALYSIS:
- Tone: ${contentAnalysis.tone}
- Key Themes: ${contentAnalysis.themes?.join(', ')}
- Strengths: ${contentAnalysis.strengths?.join(', ')}
- Improvement Areas: ${contentAnalysis.improvements?.join(', ')}

Please create a customized description that:
1. Matches the directory's preferred style and audience
2. Incorporates relevant keywords naturally
3. Highlights the business's unique value proposition
4. Meets the specified length requirements
5. Maintains accuracy while improving appeal

Format your response as JSON:
{
  "customizedDescription": "The rewritten description...",
  "keyChanges": ["List of main changes made"],
  "keywordsIncluded": ["Keywords successfully incorporated"],
  "styleNotes": "Brief explanation of style adaptation",
  "confidence": 0.85
}

Focus on creating compelling, authentic content that will resonate with the directory's audience while maintaining the business's core message.`;
  }
  
  /**
   * Parse AI customization response
   */
  parseCustomizationResponse(aiResponse, request, style) {
    try {
      const parsed = JSON.parse(aiResponse.trim());
      
      // Validate required fields
      if (!parsed.customizedDescription || parsed.customizedDescription.length < this.config.minDescriptionLength) {
        throw new Error('Generated description too short or missing');
      }
      
      if (parsed.customizedDescription.length > this.config.maxDescriptionLength) {
        parsed.customizedDescription = parsed.customizedDescription.substring(0, this.config.maxDescriptionLength) + '...';
      }
      
      return {
        description: parsed.customizedDescription,
        keyChanges: parsed.keyChanges || [],
        keywordsIncluded: parsed.keywordsIncluded || [],
        styleNotes: parsed.styleNotes || '',
        confidence: parsed.confidence || 0.7,
        wordCount: parsed.customizedDescription.split(' ').length,
        characterCount: parsed.customizedDescription.length
      };
      
    } catch (error) {
      console.warn('Failed to parse AI response:', error);
      return this.generateFallbackCustomization(request, style);
    }
  }
  
  /**
   * Analyze original content to understand baseline
   */
  async analyzeOriginalContent(originalDescription) {
    try {
      if (!originalDescription || originalDescription.length < 10) {
        return this.getDefaultContentAnalysis();
      }
      
      const prompt = `Analyze this business description for key characteristics:

"${originalDescription}"

Provide analysis in JSON format:
{
  "tone": "professional/casual/technical/friendly",
  "themes": ["main topics covered"],
  "strengths": ["what works well"],
  "improvements": ["areas that could be enhanced"],
  "keywords": ["key terms and phrases"],
  "wordCount": ${originalDescription.split(' ').length},
  "readabilityLevel": "elementary/intermediate/advanced"
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      });
      
      return JSON.parse(response.content[0].text);
      
    } catch (error) {
      console.warn('Content analysis failed, using defaults:', error);
      return this.getDefaultContentAnalysis(originalDescription);
    }
  }
  
  /**
   * Get directory profile with preferences and requirements
   */
  async getDirectoryProfile(directoryId) {
    // Check cache first
    const cached = this.directoryProfiles.get(directoryId);
    if (cached && this.isCacheValid(cached.updatedAt)) {
      return cached.profile;
    }
    
    try {
      // Query directory information
      const { data: directory, error } = await this.supabase
        .from('directories')
        .select(`
          id,
          name,
          description,
          categories,
          submission_requirements,
          content_preferences,
          target_audience,
          successful_examples
        `)
        .eq('id', directoryId)
        .single();
      
      if (error || !directory) {
        console.warn(`Directory ${directoryId} not found, using default profile`);
        return this.getDefaultDirectoryProfile();
      }
      
      // Analyze successful submissions for this directory
      const successPatterns = await this.analyzeSuccessfulSubmissions(directoryId);
      
      const profile = {
        id: directory.id,
        name: directory.name,
        description: directory.description,
        preferredCategories: directory.categories || [],
        requirements: directory.submission_requirements || [],
        contentStyle: directory.content_preferences?.style || 'professional',
        targetAudience: directory.target_audience || 'business owners',
        preferredLength: directory.content_preferences?.length || '150-300',
        keywordPreferences: directory.content_preferences?.keywords || [],
        successPatterns: successPatterns,
        lastAnalyzed: new Date().toISOString()
      };
      
      // Cache the profile
      this.directoryProfiles.set(directoryId, {
        profile,
        updatedAt: Date.now()
      });
      
      return profile;
      
    } catch (error) {
      console.error(`Failed to load directory profile for ${directoryId}:`, error);
      return this.getDefaultDirectoryProfile();
    }
  }
  
  /**
   * Analyze successful submissions to identify patterns
   */
  async analyzeSuccessfulSubmissions(directoryId) {
    try {
      const { data: successfulSubmissions, error } = await this.supabase
        .from('user_submissions')
        .select(`
          business_description,
          business_category,
          submission_data,
          approved_at
        `)
        .eq('directory_id', directoryId)
        .eq('submission_status', 'approved')
        .order('approved_at', { ascending: false })
        .limit(20);
      
      if (error || !successfulSubmissions || successfulSubmissions.length === 0) {
        return this.getDefaultSuccessPatterns();
      }
      
      // Extract common patterns
      const descriptions = successfulSubmissions
        .map(s => s.business_description)
        .filter(desc => desc && desc.length > 20);
      
      if (descriptions.length < 3) {
        return this.getDefaultSuccessPatterns();
      }
      
      // Simple pattern analysis
      const avgLength = descriptions.reduce((sum, desc) => sum + desc.length, 0) / descriptions.length;
      const commonWords = this.extractCommonWords(descriptions);
      
      return {
        averageLength: Math.round(avgLength),
        commonKeywords: commonWords.slice(0, 10),
        successCount: successfulSubmissions.length,
        sampleSize: descriptions.length,
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.warn('Failed to analyze successful submissions:', error);
      return this.getDefaultSuccessPatterns();
    }
  }
  
  /**
   * Determine optimal styles for directory
   */
  determineOptimalStyles(directoryProfile) {
    const styles = [];
    
    // Base style from directory preference
    const preferredStyle = directoryProfile.contentStyle || 'professional';
    if (this.styleTemplates[preferredStyle]) {
      styles.push({
        name: preferredStyle,
        ...this.styleTemplates[preferredStyle],
        priority: 1
      });
    }
    
    // Add complementary styles based on success patterns
    if (directoryProfile.successPatterns) {
      const keywords = directoryProfile.successPatterns.commonKeywords || [];
      
      if (keywords.some(word => ['local', 'community', 'area'].includes(word.toLowerCase()))) {
        styles.push({
          name: 'local',
          ...this.styleTemplates.local,
          priority: 2
        });
      }
      
      if (keywords.some(word => ['tech', 'innovation', 'digital'].includes(word.toLowerCase()))) {
        styles.push({
          name: 'technical',
          ...this.styleTemplates.technical,
          priority: 2
        });
      }
    }
    
    // Add default professional style if not already included
    if (!styles.some(s => s.name === 'professional')) {
      styles.push({
        name: 'professional',
        ...this.styleTemplates.professional,
        priority: 3
      });
    }
    
    // Add friendly variation for broader appeal
    if (!styles.some(s => s.name === 'friendly')) {
      styles.push({
        name: 'friendly',
        ...this.styleTemplates.friendly,
        priority: 3
      });
    }
    
    return styles.sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Optimize customizations for best performance
   */
  async optimizeCustomizations(customizations, directoryProfile) {
    return customizations
      .filter(customization => customization && customization.description)
      .map(customization => ({
        ...customization,
        score: this.calculateCustomizationScore(customization, directoryProfile)
      }))
      .sort((a, b) => b.score - a.score);
  }
  
  /**
   * Calculate quality score for customization
   */
  calculateCustomizationScore(customization, directoryProfile) {
    let score = customization.confidence || 0.5;
    
    // Length appropriateness
    const targetLength = directoryProfile.preferredLength || '150-300';
    const [minLen, maxLen] = this.parseTargetLength(targetLength);
    const actualLength = customization.wordCount || 0;
    
    if (actualLength >= minLen && actualLength <= maxLen) {
      score += 0.2;
    } else if (actualLength >= minLen * 0.8 && actualLength <= maxLen * 1.2) {
      score += 0.1;
    }
    
    // Keyword inclusion bonus
    if (customization.keywordsIncluded && customization.keywordsIncluded.length > 0) {
      score += Math.min(0.2, customization.keywordsIncluded.length * 0.05);
    }
    
    // Success pattern matching
    if (directoryProfile.successPatterns && directoryProfile.successPatterns.commonKeywords) {
      const matchingKeywords = customization.keywordsIncluded?.filter(keyword =>
        directoryProfile.successPatterns.commonKeywords.some(common =>
          common.toLowerCase().includes(keyword.toLowerCase())
        )
      ) || [];
      
      score += Math.min(0.15, matchingKeywords.length * 0.03);
    }
    
    return Math.min(1, score);
  }
  
  /**
   * Generate strategic approach explanation
   */
  generateStrategy(directoryProfile, contentAnalysis) {
    const strategies = [];
    
    if (directoryProfile.contentStyle === 'professional') {
      strategies.push('Adopt professional tone to match directory standards');
    }
    
    if (directoryProfile.successPatterns && directoryProfile.successPatterns.averageLength) {
      const targetLength = directoryProfile.successPatterns.averageLength;
      strategies.push(`Target ${targetLength} words based on successful submissions`);
    }
    
    if (contentAnalysis.improvements && contentAnalysis.improvements.length > 0) {
      strategies.push(`Address: ${contentAnalysis.improvements.slice(0, 2).join(', ')}`);
    }
    
    if (directoryProfile.keywordPreferences && directoryProfile.keywordPreferences.length > 0) {
      strategies.push(`Incorporate directory-preferred keywords: ${directoryProfile.keywordPreferences.slice(0, 3).join(', ')}`);
    }
    
    return strategies.length > 0 ? strategies : ['Standard optimization approach'];
  }
  
  // Helper methods
  extractCommonWords(descriptions) {
    const allWords = descriptions
      .join(' ')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !this.isStopWord(word));
    
    const wordCount = {};
    allWords.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    return Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word);
  }
  
  isStopWord(word) {
    const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'are', 'that', 'this', 'with', 'have', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were'];
    return stopWords.includes(word);
  }
  
  parseTargetLength(targetLength) {
    try {
      const match = targetLength.match(/(\d+)-(\d+)/);
      if (match) {
        return [parseInt(match[1]), parseInt(match[2])];
      }
      const single = parseInt(targetLength);
      return [single * 0.8, single * 1.2];
    } catch (error) {
      return [150, 300]; // Default
    }
  }
  
  generateFallbackCustomization(request, style) {
    const originalLength = request.originalDescription?.length || 0;
    
    return {
      description: request.originalDescription || 'Professional business description needed.',
      keyChanges: ['Fallback customization applied'],
      keywordsIncluded: [],
      styleNotes: `Applied ${style.name} style template`,
      confidence: 0.3,
      wordCount: Math.floor(originalLength / 5),
      characterCount: originalLength,
      isFallback: true
    };
  }
  
  getDefaultContentAnalysis(originalDescription = '') {
    return {
      tone: 'neutral',
      themes: ['business services'],
      strengths: ['basic information provided'],
      improvements: ['add more specific details', 'enhance value proposition'],
      keywords: [],
      wordCount: originalDescription.split(' ').length,
      readabilityLevel: 'intermediate'
    };
  }
  
  getDefaultDirectoryProfile() {
    return {
      id: 'default',
      name: 'General Directory',
      contentStyle: 'professional',
      targetAudience: 'business owners',
      preferredLength: '150-300',
      keywordPreferences: [],
      successPatterns: this.getDefaultSuccessPatterns()
    };
  }
  
  getDefaultSuccessPatterns() {
    return {
      averageLength: 200,
      commonKeywords: ['professional', 'quality', 'service', 'experienced', 'reliable'],
      successCount: 0,
      sampleSize: 0,
      lastUpdated: new Date().toISOString()
    };
  }
  
  // Cache management
  generateCacheKey(request) {
    const key = `${request.directoryId}_${request.businessData.name}_${request.originalDescription?.substring(0, 50)}`;
    return require('crypto').createHash('md5').update(key).digest('hex');
  }
  
  getCachedCustomization(cacheKey) {
    const cached = this.customizationCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.result;
    }
    return null;
  }
  
  cacheCustomization(cacheKey, result) {
    this.customizationCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }
  
  isCacheValid(timestamp) {
    return timestamp && (Date.now() - timestamp) < this.config.cacheTimeout;
  }
  
  validateCustomizationRequest(request) {
    if (!request.directoryId) {
      throw new Error('Directory ID is required');
    }
    
    if (!request.businessData || !request.businessData.name) {
      throw new Error('Business data with name is required');
    }
    
    if (!request.originalDescription || request.originalDescription.length < 10) {
      throw new Error('Original description must be at least 10 characters');
    }
  }
  
  generateRequestId() {
    return `desc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  async loadDirectoryProfiles() {
    console.log('📊 Loading directory profiles...');
    // Could load common patterns from database
  }
  
  async loadSuccessPatterns() {
    console.log('🎯 Loading successful customization patterns...');
    // Could load proven successful customizations
  }
  
  getStats() {
    return {
      cachedCustomizations: this.customizationCache.size,
      cachedDirectoryProfiles: this.directoryProfiles.size,
      availableStyles: Object.keys(this.styleTemplates),
      cacheTimeout: this.config.cacheTimeout
    };
  }
}

module.exports = DescriptionCustomizer;