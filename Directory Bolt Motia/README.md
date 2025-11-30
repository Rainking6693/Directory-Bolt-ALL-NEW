# DirectoryBolt - Motia Implementation

This is the Motia backend implementation for DirectoryBolt, a directory listing service that helps businesses get listed in online directories.

## Overview

This implementation replaces the existing 4 Render apps with a single Motia application that provides all the necessary backend functionality:

1. **Brain Service** - AI-powered field mapping for directory submissions
2. **Subscriber Service** - Processes job queue messages
3. **Worker Service** - Executes directory submissions
4. **Monitor Service** - Monitors for stale jobs

## Architecture

The system uses Motia's Step-based architecture where each backend function is implemented as a Step:

- **API Steps** - Handle HTTP requests
- **Event Steps** - Process asynchronous events
- **Cron Steps** - Run scheduled tasks

## Features

### AI-Powered Directory Submissions
- Uses Anthropic Claude or Google Gemini for intelligent field mapping
- Fallback to rule-based mapping when AI is unavailable
- Supports various directory website structures

### Customer Portal
- Job submission and tracking
- Performance analytics and reporting
- Directory success rate monitoring

### Staff Dashboard
- Real-time job monitoring
- Progress tracking
- Activity history and statistics

### Queue Management
- Job queuing and processing
- Idempotency protection
- Error handling and retries

## Directory Structure

```
steps/
├── ai/                 # AI service implementations
├── api/                # API endpoints
├── cron/               # Scheduled tasks
├── events/             # Event processors
└── utils/              # Utility functions
```

## Key Components

### AI Services
- `anthropicService.ts` - Anthropic Claude API integration
- `geminiService.ts` - Google Gemini API integration

### API Endpoints
- `brain.step.ts` - Field mapping service
- `health.step.ts` - Health check endpoint
- `customerPortal.step.ts` - Customer-facing APIs
- `staffDashboard.step.ts` - Staff dashboard APIs
- `realtime.step.ts` - Real-time updates configuration

### Event Processors
- `jobProcessor.step.ts` - Directory submission processor
- `sqsProcessor.step.ts` - Queue message processor

### Scheduled Tasks
- `staleJobMonitor.step.ts` - Stale job detection

### Utilities
- `database.ts` - Database access layer
- `directorySubmission.ts` - Directory submission management
- `customerAnalytics.ts` - Customer analytics and reporting

## Environment Variables

The application requires the following environment variables:

```bash
# AI Service Keys
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key

# Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# AWS Configuration (if using SQS)
AWS_DEFAULT_ACCESS_KEY_ID=your_aws_access_key
AWS_DEFAULT_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_DEFAULT_REGION=us-east-1
SQS_QUEUE_URL=your_sqs_queue_url
```

## Development

To run the application locally:

```bash
cd directory-bolt-motia
npm install
npx motia dev
```

The application will be available at `http://localhost:3000`

## Deployment

The application can be deployed to:

1. **Motia Cloud** (recommended)
2. **Container platforms** (Docker)
3. **Traditional hosting** with Node.js

## Migration from Render

This implementation replaces 4 separate Render services with a single cohesive application:

1. **Brain Service** → `brain.step.ts` API Step
2. **Subscriber Service** → `sqsProcessor.step.ts` Event Step
3. **Worker Service** → `jobProcessor.step.ts` Event Step
4. **Monitor Service** → `staleJobMonitor.step.ts` Cron Step

## Benefits

1. **Simplified Operations** - Single deployment instead of managing 4 services
2. **Unified Architecture** - All backend functionality in one codebase
3. **Built-in Observability** - Native tracing and debugging capabilities
4. **Event-Driven Architecture** - More efficient processing with Motia's event system
5. **Reduced Complexity** - Eliminate inter-service communication issues