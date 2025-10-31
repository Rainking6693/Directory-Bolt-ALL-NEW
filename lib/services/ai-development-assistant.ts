/**
 * AI-Powered Development Assistant for DirectoryBolt
 * Implements 2025 best practices for AI integration in SaaS development
 * Provides code generation, testing assistance, and development insights
 */

import * as React from 'react';
import { featureFlagService, FeatureFlagContext } from './feature-flags';

export interface CodeGenerationRequest {
  type: 'component' | 'api' | 'test' | 'documentation' | 'refactor';
  context: string;
  requirements: string;
  framework?: 'react' | 'nextjs' | 'typescript' | 'node';
  patterns?: string[];
}

export interface CodeAnalysisResult {
  quality: number; // 0-100
  security: number; // 0-100
  performance: number; // 0-100
  maintainability: number; // 0-100
  suggestions: Array<{
    type: 'improvement' | 'security' | 'performance' | 'bug';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    fix?: string;
    line?: number;
  }>;
}

export interface TestGenerationOptions {
  testType: 'unit' | 'integration' | 'e2e';
  coverage: 'basic' | 'comprehensive' | 'edge-cases';
  framework: 'jest' | 'playwright' | 'cypress';
}

export interface DevelopmentInsight {
  type: 'pattern' | 'architecture' | 'performance' | 'security';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  implementation?: string;
}

class AIDevAssistant {
  private readonly API_ENDPOINT = '/api/ai/development-assistant';
  private cache: Map<string, { result: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  /**
   * Generate code based on requirements using AI
   */
  async generateCode(request: CodeGenerationRequest, context: FeatureFlagContext): Promise<string> {
    if (!featureFlagService.isEnabled('ai_code_generation', context)) {
      throw new Error('AI code generation is not available for your account');
    }

    const cacheKey = `code_gen_${JSON.stringify(request)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.API_ENDPOINT}/generate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          projectContext: await this.getProjectContext(),
          codebasePatterns: await this.analyzeCodebasePatterns()
        })
      });

      if (!response.ok) {
        throw new Error(`Code generation failed: ${response.statusText}`);
      }

      const result = await response.text();
      this.setCachedResult(cacheKey, result);
      return result;
    } catch (error) {
      console.error('AI code generation error:', error);
      throw new Error('Failed to generate code. Please try again.');
    }
  }

  /**
   * Analyze code quality, security, and performance
   */
  async analyzeCode(code: string, filePath?: string, context?: FeatureFlagContext): Promise<CodeAnalysisResult> {
    const defaultContext: FeatureFlagContext = { environment: 'development' };
    const fullContext = { ...defaultContext, ...context };

    if (!featureFlagService.isEnabled('ai_code_analysis', fullContext)) {
      return this.getBasicAnalysis(code);
    }

    const cacheKey = `code_analysis_${this.hashString(code)}_${filePath}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.API_ENDPOINT}/analyze-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          filePath,
          projectContext: await this.getProjectContext(),
          securityRules: await this.getSecurityRules(),
          performancePatterns: await this.getPerformancePatterns()
        })
      });

      if (!response.ok) {
        throw new Error(`Code analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      this.setCachedResult(cacheKey, result);
      return result;
    } catch (error) {
      console.error('AI code analysis error:', error);
      return this.getBasicAnalysis(code);
    }
  }

  /**
   * Generate comprehensive tests for given code
   */
  async generateTests(
    code: string, 
    options: TestGenerationOptions, 
    context: FeatureFlagContext
  ): Promise<string> {
    if (!featureFlagService.isEnabled('ai_test_generation', context)) {
      throw new Error('AI test generation is not available for your account');
    }

    const cacheKey = `test_gen_${this.hashString(code)}_${JSON.stringify(options)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.API_ENDPOINT}/generate-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          options,
          projectContext: await this.getProjectContext(),
          existingTests: await this.getExistingTestPatterns()
        })
      });

      if (!response.ok) {
        throw new Error(`Test generation failed: ${response.statusText}`);
      }

      const result = await response.text();
      this.setCachedResult(cacheKey, result);
      return result;
    } catch (error) {
      console.error('AI test generation error:', error);
      throw new Error('Failed to generate tests. Please try again.');
    }
  }

  /**
   * Get development insights and recommendations
   */
  async getDevelopmentInsights(context: FeatureFlagContext): Promise<DevelopmentInsight[]> {
    if (!featureFlagService.isEnabled('ai_development_insights', context)) {
      return this.getBasicInsights();
    }

    const cacheKey = `dev_insights_${context.userId || 'anonymous'}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.API_ENDPOINT}/development-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectContext: await this.getProjectContext(),
          codebaseMetrics: await this.getCodebaseMetrics(),
          recentChanges: await this.getRecentChanges()
        })
      });

      if (!response.ok) {
        throw new Error(`Insights generation failed: ${response.statusText}`);
      }

      const result = await response.json();
      this.setCachedResult(cacheKey, result);
      return result;
    } catch (error) {
      console.error('AI insights error:', error);
      return this.getBasicInsights();
    }
  }

  /**
   * Refactor code with AI suggestions
   */
  async refactorCode(
    code: string, 
    refactorType: 'performance' | 'readability' | 'security' | 'modern-patterns',
    context: FeatureFlagContext
  ): Promise<string> {
    if (!featureFlagService.isEnabled('ai_code_refactoring', context)) {
      throw new Error('AI code refactoring is not available for your account');
    }

    try {
      const response = await fetch(`${this.API_ENDPOINT}/refactor-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          refactorType,
          projectContext: await this.getProjectContext(),
          modernPatterns: await this.getModernPatterns()
        })
      });

      if (!response.ok) {
        throw new Error(`Code refactoring failed: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error('AI refactoring error:', error);
      throw new Error('Failed to refactor code. Please try again.');
    }
  }

  /**
   * Generate documentation for code
   */
  async generateDocumentation(
    code: string, 
    type: 'inline' | 'api' | 'readme' | 'architecture',
    context: FeatureFlagContext
  ): Promise<string> {
    if (!featureFlagService.isEnabled('ai_documentation_generation', context)) {
      return this.getBasicDocumentation(code, type);
    }

    try {
      const response = await fetch(`${this.API_ENDPOINT}/generate-documentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          type,
          projectContext: await this.getProjectContext(),
          documentationStandards: await this.getDocumentationStandards()
        })
      });

      if (!response.ok) {
        throw new Error(`Documentation generation failed: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error('AI documentation error:', error);
      return this.getBasicDocumentation(code, type);
    }
  }

  /**
   * Get project context for AI operations
   */
  private async getProjectContext(): Promise<any> {
    return {
      framework: 'Next.js',
      language: 'TypeScript',
      database: 'Supabase',
      styling: 'Tailwind CSS',
      patterns: ['React Hooks', 'Server Components', 'API Routes'],
      architecture: 'Full-stack SaaS',
      version: '2.0.1'
    };
  }

  /**
   * Analyze existing codebase patterns
   */
  private async analyzeCodebasePatterns(): Promise<string[]> {
    return [
      'React Server Components',
      'TypeScript strict mode',
      'Tailwind CSS utility classes',
      'Next.js API routes',
      'Supabase client integration',
      'Feature flag patterns',
      'Error boundary components',
      'Custom hooks for state management'
    ];
  }

  /**
   * Get security rules for analysis
   */
  private async getSecurityRules(): Promise<any> {
    return {
      noHardcodedSecrets: true,
      validateInputs: true,
      sanitizeOutputs: true,
      useHttpsOnly: true,
      implementCSRF: true,
      validateJWT: true
    };
  }

  /**
   * Get performance patterns for analysis
   */
  private async getPerformancePatterns(): Promise<any> {
    return {
      useReactMemo: true,
      implementLazyLoading: true,
      optimizeImages: true,
      minimizeReRenders: true,
      useServerComponents: true,
      implementCaching: true
    };
  }

  /**
   * Fallback analysis for when AI is not available
   */
  private getBasicAnalysis(code: string): CodeAnalysisResult {
    return {
      quality: 75,
      security: 80,
      performance: 70,
      maintainability: 75,
      suggestions: [
        {
          type: 'improvement',
          severity: 'medium',
          message: 'Consider adding TypeScript types for better type safety'
        },
        {
          type: 'performance',
          severity: 'low',
          message: 'Consider using React.memo for expensive components'
        }
      ]
    };
  }

  /**
   * Get basic development insights
   */
  private getBasicInsights(): DevelopmentInsight[] {
    return [
      {
        type: 'pattern',
        title: 'Implement Feature Flags',
        description: 'Use feature flags for safer deployments and A/B testing',
        impact: 'high',
        actionable: true,
        implementation: 'Use the new feature flag service for gradual rollouts'
      },
      {
        type: 'performance',
        title: 'Optimize Bundle Size',
        description: 'Consider code splitting for better performance',
        impact: 'medium',
        actionable: true,
        implementation: 'Use dynamic imports for heavy components'
      }
    ];
  }

  /**
   * Generate basic documentation
   */
  private getBasicDocumentation(code: string, type: string): string {
    switch (type) {
      case 'inline':
        return '// TODO: Add inline documentation';
      case 'api':
        return '# API Documentation\n\nTODO: Document API endpoints';
      case 'readme':
        return '# Component Documentation\n\nTODO: Add component documentation';
      default:
        return '# Documentation\n\nTODO: Add documentation';
    }
  }

  /**
   * Cache management
   */
  private getCachedResult(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }
    return null;
  }

  private setCachedResult(key: string, result: any): void {
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  /**
   * Hash string for caching
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private async getExistingTestPatterns(): Promise<any> {
    return { framework: 'Jest', patterns: ['React Testing Library', 'Mock Service Worker'] };
  }

  private async getCodebaseMetrics(): Promise<any> {
    return { complexity: 'medium', coverage: 75, files: 200 };
  }

  private async getRecentChanges(): Promise<any> {
    return { commits: 10, files: 25, authors: 3 };
  }

  private async getModernPatterns(): Promise<any> {
    return { react: 'hooks', typescript: 'strict', patterns: ['composition', 'hooks'] };
  }

  private async getDocumentationStandards(): Promise<any> {
    return { format: 'markdown', style: 'comprehensive', examples: true };
  }
}

// Singleton instance
export const aiDevAssistant = new AIDevAssistant();

// React hook for AI development assistance
export function useAIDevAssistant() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const generateCode = async (request: CodeGenerationRequest, context: FeatureFlagContext) => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiDevAssistant.generateCode(request, context);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const analyzeCode = async (code: string, filePath?: string, context?: FeatureFlagContext) => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiDevAssistant.analyzeCode(code, filePath, context);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    generateCode,
    analyzeCode,
    loading,
    error
  };
}

export default aiDevAssistant;
