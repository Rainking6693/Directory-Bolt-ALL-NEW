# Complete AI Files Migration Plan

## 📊 Total Files Found: 79 AI-Related Files

### 🔴 Priority 1: Core AI Services (lib/ai-services/)
1. `ABTestingFramework.js` - AI-powered A/B testing
2. `AIEnhancedQueueManager.js` / `.ts` - AI queue management
3. `AIFormMapper.js` - Form field detection
4. `AISubmissionOrchestrator.js` - Submission orchestration
5. `DescriptionCustomizer.js` - Content customization
6. `IntelligentRetryAnalyzer.js` - Retry analysis
7. `PerformanceFeedbackLoop.js` - Performance feedback
8. `SubmissionTimingOptimizer.js` - Timing optimization
9. `SuccessProbabilityCalculator.js` - Success probability

### 🟠 Priority 2: Main AI Services (lib/services/)
10. `ai-analysis-cache.ts` - Analysis caching
11. `ai-business-analyzer.ts` - Business analyzer
12. `ai-business-intelligence-engine.ts` - BI engine
13. `ai-development-assistant.ts` - Dev assistant
14. `ai-service.ts` - Core AI service
15. `analysis-cost-tracker.ts` - Cost tracking
16. `analysis-tier-manager.ts` - Tier management
17. `business-intelligence.ts` - Business intelligence
18. `content-gap-analyzer.ts` - Content gap analysis
19. `enhanced-ai-business-analyzer.ts` - Enhanced analyzer
20. `enhanced-ai-integration.ts` - AI integration
21. `enhanced-website-analyzer.ts` - Website analyzer
22. `integrated-seo-ai-service.ts` - SEO + AI service
23. `website-analyzer.ts` - Basic analyzer

### 🟡 Priority 3: SEO Services (lib/seo/)
24. `enhanced-schema.js` / `.ts` - Schema markup
25. `faq-schema.ts` - FAQ schema
26. `metaTagGenerator.ts` - Meta tag generator
27. `performance-tracking.ts` - Performance tracking
28. `sitemapGenerator.ts` - Sitemap generator

### 🟢 Priority 4: Competitive & Discovery (lib/competitive-features/, lib/discovery/)
29. `ai-reputation-manager.ts` - Reputation management
30. `brand-consistency-engine.ts` - Brand consistency
31. `competitive-intelligence-engine.ts` - Competitive intel
32. `DirectoryDiscoveryEngine.js` - Directory discovery

### 🔵 Priority 5: Supporting Services
33. `seo-performance-optimizer.ts` - SEO optimization
34. `seo-tier-access-control.ts` - SEO access control
35. `dynamic-form-mapper.ts` - Dynamic form mapping
36. `competitive-benchmarking.ts` - Competitive benchmarking
37. `directory-matcher.ts` - Directory matching
38. `advanced-analytics-orchestrator.ts` - Analytics orchestration
39. `edge-functions.ts` - Edge functions

### 🟣 Priority 6: Types & Examples
40. `types/ai.types.ts` - AI types
41. `types/business-intelligence.ts` - BI types
42. `types/content-gap-analysis.ts` - Content gap types
43. `examples/ai-analysis-example.ts` - Example code

### ⚪ Priority 7: Utilities & Supporting
44. `wasm/directory-analyzer.ts` - WASM analyzer
45. `form-mapping/AIFormMapper.js` - Form mapper
46. `monitoring/comprehensive-monitoring.ts` - Monitoring
47. `monitoring/customer-profile-monitor.js` - Profile monitor
48. `optimization/performance-optimizer.js` - Performance optimizer
49. `utils/enhanced-export-utils.ts` - Export utils
50. `utils/pdf-generator.ts` - PDF generator
51. `utils/export-utils.ts` - Export utils
52. `utils/enhanced-rate-limit.ts` - Rate limiting
53. `utils/api-response.ts` - API responses
54. `validation/enhanced-validation-schemas.ts` - Validation
55. `server/autoboltJobs.ts` - Autobolt jobs
56. `integration/directory-onboarding-pipeline.js` - Onboarding
57. `config/pricing.ts` - Pricing config
58. `config/development-velocity-config.ts` - Dev config
59. `config/directoryBoltProducts.js` - Products config
60. `database/directory-seed.ts` - Directory seed
61. `database/tier-schema.ts` - Tier schema
62. `middleware/tier-validation.ts` - Tier validation
63. `middleware/production-rate-limit.ts` - Rate limiting
64. `monitoring/compliance-monitor.js` - Compliance
65. `monitoring/webhook-performance-dashboard.js` - Dashboard
66. `performance/optimization.ts` - Performance
67. `production/performance.ts` - Production perf
68. `security/security-monitoring.ts` - Security monitoring
69. `pwa/advanced-offline-manager.ts` - Offline manager
70. `advanced-performance/edge-rum-collector.ts` - RUM collector
71. `hooks/useApiCall.ts` - API hook
72. `queue-manager.js` - Queue manager
73. `middleware/rate-limiter.js` - Rate limiter
74. `utils/rate-limit.ts` - Rate limit utils
75. `utils/url-validator.ts` - URL validator
76. `utils/customer-migration.ts` - Customer migration
77. `testing/quality-gates.ts` - Quality gates
78. `services/event-driven-analytics.ts` - Event analytics
79. `services/enhanced-supabase-optimizer.ts` - Supabase optimizer

## Migration Strategy

### Phase 1: Core AI Services (Now)
- Copy all files from `lib/ai-services/` (9 files)
- Update to use Anthropic instead of OpenAI
- Ensure TypeScript compatibility

### Phase 2: Main Services (Next)
- Copy `lib/services/` AI files (14 files)
- Update AI provider references
- Fix imports and dependencies

### Phase 3: SEO & Competitive (Then)
- Copy SEO services (5 files)
- Copy competitive features (3 files)
- Copy discovery engine (1 file)

### Phase 4: Supporting Files (Finally)
- Copy types, utilities, examples
- Update all references
- Test integration

## Updates Required
1. Replace OpenAI with Anthropic for "harder jobs"
2. Replace OpenAI with Gemini for "easy AI jobs"
3. Update import paths for new codebase structure
4. Ensure all dependencies are in package.json
5. Update environment variable references

