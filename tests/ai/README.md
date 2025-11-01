# AI Features Test Suite

Comprehensive test suite for all AI features in the DirectoryBolt platform.

## 📋 Test Coverage

### Core AI Services
- ✅ **Anthropic Client** (`anthropic-client.test.ts`) - AI client initialization, API calls, fallback behavior
- ✅ **AI Analysis Cache** (`ai-analysis-cache.test.ts`) - Caching, validation, storage
- ✅ **Integrated SEO AI Service** (`integrated-seo-ai-service.test.ts`) - Unified analysis pipeline
- ✅ **AI Business Analyzer** (`ai-business-analyzer.test.ts`) - Business intelligence and competitive analysis
- ✅ **AI Business Intelligence Engine** (`ai-business-intelligence-engine.test.ts`) - Advanced BI dashboard

### Analysis Services
- ✅ **Content Gap Analyzer** (`content-gap-analyzer.test.ts`) - Content strategy recommendations
- ✅ **Competitive Benchmarking** (`competitive-benchmarking.test.ts`) - Competitive intelligence
- ✅ **Enhanced Website Analyzer** (`enhanced-website-analyzer.test.ts`) - Professional analysis with screenshots
- ✅ **Analysis Cost Tracker** (`analysis-cost-tracker.test.ts`) - Cost tracking for Anthropic, Gemini, OpenAI

### Competitive Features
- ✅ **Reputation Manager** (`reputation-manager.test.ts`) - Review monitoring, auto-response generation
- ✅ **Brand Consistency Engine** (`brand-consistency-engine.test.ts`) - Brand integrity maintenance
- ✅ **Competitive Intelligence Engine** (`competitive-intelligence-engine.test.ts`) - Strategic competitive analysis

### API Endpoints
- ✅ **AI API Endpoints** (`ai-api-endpoints.test.ts`) - All `/api/ai/*` routes

## 🚀 Running Tests

### Run All AI Tests
```bash
npm run test:ai:all
```

### Run Tests with Jest
```bash
npm run test:ai:jest
```

### Run Individual Test File
```bash
npx jest tests/ai/__tests__/anthropic-client.test.ts
```

### Run Tests with Coverage
```bash
npx jest tests/ai/__tests__ --coverage
```

## 📁 Test Structure

```
tests/
├── setup.ts                          # Jest configuration and test environment
├── ai/
│   ├── __tests__/
│   │   ├── anthropic-client.test.ts
│   │   ├── ai-analysis-cache.test.ts
│   │   ├── integrated-seo-ai-service.test.ts
│   │   ├── ai-business-analyzer.test.ts
│   │   ├── ai-business-intelligence-engine.test.ts
│   │   ├── content-gap-analyzer.test.ts
│   │   ├── competitive-benchmarking.test.ts
│   │   ├── enhanced-website-analyzer.test.ts
│   │   ├── analysis-cost-tracker.test.ts
│   │   ├── reputation-manager.test.ts
│   │   ├── brand-consistency-engine.test.ts
│   │   ├── competitive-intelligence-engine.test.ts
│   │   └── ai-api-endpoints.test.ts
│   └── test-runner.ts                # Test runner utility
└── README.md                          # This file
```

## ⚙️ Configuration

Tests use:
- **Jest** - Test framework
- **ts-jest** - TypeScript support
- **Test Environment** - Node.js

Configuration is in `jest.config.js` at the project root.

## 🔧 Environment Variables

Tests use mock environment variables. For actual API testing, set:
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 📊 Test Coverage Goals

- Unit tests for all AI services
- Integration tests for API endpoints
- Mock external API calls
- Validate data structures and types
- Test error handling and edge cases

## 🐛 Troubleshooting

### Tests failing with "Cannot find module"
- Run `npm install` to ensure all dependencies are installed
- Check that TypeScript files are being compiled correctly

### API key errors
- Tests use mock keys by default
- For integration tests, set real API keys in environment

### Timeout errors
- Increase timeout in `jest.config.js` if needed
- API calls may take longer in CI environments

## 📝 Adding New Tests

1. Create test file in `tests/ai/__tests__/`
2. Follow naming convention: `feature-name.test.ts`
3. Add to `test-all-ai-features.js` script
4. Update this README

## ✅ Test Status

All 13 test suites created and ready to run!

