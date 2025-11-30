# DirectoryBolt - Motia Implementation Directory Structure

## Root Directory

```
directory-bolt-motia/
├── DEPLOYMENT.md              # Deployment guide
├── DIRECTORY_STRUCTURE.md      # This file
├── README.md                  # Project overview and documentation
├── SUMMARY.md                 # Implementation summary
├── config.ts                  # TypeScript configuration
├── jest.config.ts             # Jest testing configuration
├── motia.config.ts            # Motia configuration
├── package.json               # Node.js package configuration
├── requirements.txt           # Python requirements
├── test-endpoints.js         # Simple test script
├── tsconfig.json             # TypeScript configuration
```

## Source Code Directory

```
directory-bolt-motia/steps/
├── ai/                        # AI service implementations
│   ├── anthropicService.ts    # Anthropic Claude API integration
│   └── geminiService.ts       # Google Gemini API integration
├── api/                       # API endpoints
│   ├── brain.step.ts          # Field mapping service
│   ├── customerPortal.step.ts # Customer-facing APIs
│   ├── health.step.ts         # Health check endpoint
│   ├── hello.step.ts          # Simple test endpoint
│   ├── realtime.step.ts       # Real-time updates configuration
│   └── staffDashboard.step.ts # Staff dashboard APIs
├── cron/                      # Scheduled tasks
│   └── staleJobMonitor.step.ts # Stale job detection
├── events/                    # Event processors
│   ├── jobProcessor.step.ts   # Directory submission processor
│   └── sqsProcessor.step.ts   # Queue message processor
└── utils/                     # Utility functions
    ├── customerAnalytics.ts   # Customer analytics and reporting
    ├── database.ts            # Database access layer
    └── directorySubmission.ts # Directory submission management
```

## Key Implementation Files

### AI Services
- `steps/ai/anthropicService.ts` - Anthropic Claude API integration
- `steps/ai/geminiService.ts` - Google Gemini API integration

### API Endpoints
- `steps/api/brain.step.ts` - AI-powered field mapping service
- `steps/api/health.step.ts` - Health check endpoint
- `steps/api/customerPortal.step.ts` - Customer-facing APIs
- `steps/api/staffDashboard.step.ts` - Staff dashboard APIs
- `steps/api/realtime.step.ts` - Real-time updates configuration
- `steps/api/hello.step.ts` - Simple test endpoint

### Event Processors
- `steps/events/jobProcessor.step.ts` - Directory submission processor
- `steps/events/sqsProcessor.step.ts` - Queue message processor

### Scheduled Tasks
- `steps/cron/staleJobMonitor.step.ts` - Stale job detection

### Utilities
- `steps/utils/database.ts` - Database access layer
- `steps/utils/directorySubmission.ts` - Directory submission management
- `steps/utils/customerAnalytics.ts` - Customer analytics and reporting

## Documentation Files

- `README.md` - Project overview and documentation
- `DEPLOYMENT.md` - Deployment guide
- `SUMMARY.md` - Implementation summary
- `DIRECTORY_STRUCTURE.md` - This file

## Configuration Files

- `motia.config.ts` - Motia configuration
- `package.json` - Node.js package configuration
- `tsconfig.json` - TypeScript configuration
- `jest.config.ts` - Jest testing configuration
- `requirements.txt` - Python requirements

## Test Files

- `test-endpoints.js` - Simple test script

This structure represents a clean, organized implementation of the DirectoryBolt backend using Motia's Step-based architecture, replacing the previous 4 Render apps with a single cohesive application.