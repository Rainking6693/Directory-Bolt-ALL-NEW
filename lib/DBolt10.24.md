\# DirectoryBolt AI Worker - Agents \& Architecture Guide



\## 📋 Overview



DirectoryBolt is an enterprise AI-powered business directory automation platform ($149-799 pricing tier). The AI Worker backend handles intelligent directory submissions using coordinated AI services (Claude + Gemini), form mapping, success probability prediction, and intelligent retry strategies. This guide maps the complete system architecture for agent-based development workflows.



---



\## 🎯 What This Repository Does



DirectoryBolt solves the complexity of multi-directory business submissions by automating them with AI intelligence



\- AIFormMapper Intelligently analyzes directory submission forms and maps business data to form fields

\- AI Submission Orchestrator Coordinates all AI services to optimize submission success

\- Success Probability Calculator Predicts submission success rates before execution

\- Timing Optimizer Optimizes when submissions happen for best results

\- Description Customizer Tailors business descriptions per directory platform

\- Intelligent Retry Analyzer Smart failure recovery with AI-driven retry decisions

\- Queue Management Respects pauseresume states with real-time sync to Supabase

\- Health Monitoring Regular heartbeats and worker status tracking



\### Key Responsibilities



\- Real-time form analysis and intelligent field mapping

\- Multi-AI service orchestration (Anthropic Claude, Google Gemini)

\- Success prediction and optimization

\- Queue-based job processing with pauseresume capability

\- Playwright-based browser automation

\- CAPTCHA solving integration

\- Real-time worker health monitoring

\- Comprehensive error handling and intelligent retry logic



---



\## 🗃️ Architecture Overview



\### System Context



```

\\\[Job Queue (Supabase)] → \\\[AI Worker]

\&nbsp;        ↓                    ↓

\\\[PauseResume Control] → \\\[Form Analysis \\\& Mapping]

\&nbsp;        ↓                    ↓

\\\[Playwright Automation] → \\\[AI Services (Claude + Gemini)]

\&nbsp;        ↓                    ↓

\\\[Success Prediction] → \\\[CAPTCHA Service]

\&nbsp;        ↓                    ↓

\\\[Timing Optimizer] → \\\[Directory Submission]

\&nbsp;        ↓                    ↓

\\\[Worker Heartbeat] → \\\[Health Monitoring]

```



\### Key Components



 Component  Purpose  AI Service

---

 AIFormMapper  Analyzes directory forms, identifies fields, maps business data intelligently  Claude

 AI Orchestrator  Coordinates all AI services, handles errors, manages retries  Orchestrates multiple

 Success Calculator  Predicts submission success based on form complexity and data quality  Claude

 Timing Optimizer  Calculates optimal submission timing to avoid detectionblocking  Claude

 Description Customizer  Generates directory-specific business descriptions  Gemini

 Retry Analyzer  Analyzes failures, determines retry strategy (backoff, remap, manual)  Claude

 Playwright Worker  Browser automation, form filling, submission execution  NA

 Health Monitor  Tracks worker status, sends heartbeats, monitors AI service health  NA



---



\## 📁 Project Structure \[Complete Directory Tree]



```

DirectoryBolt

├── workers

│   └── playwright-worker                     # AI-Enhanced Playwright Worker

│       ├── src

│       │   ├── services                      # Core AI services

│       │   │   ├── ai-form-mapper.ts          # Form analysis \\\& field mapping

│       │   │   ├── ai-submission-orchestrator.ts # AI service coordination

│       │   │   ├── success-calculator.ts      # Success probability prediction

│       │   │   ├── timing-optimizer.ts        # Submission timing optimization

│       │   │   ├── description-customizer.ts  # Directory-specific descriptions

│       │   │   ├── retry-analyzer.ts          # Intelligent retry strategy

│       │   │   ├── captcha-solver.ts          # CAPTCHA handling (2Captcha)

│       │   │   └── queue-manager.ts           # Job queue \\\& pauseresume

│       │   │

│       │   ├── integration                   # External integrations

│       │   │   ├── anthropic-client.ts        # Claude API integration

│       │   │   ├── gemini-client.ts           # Google Gemini integration

│       │   │   ├── supabase-client.ts         # Supabase DB \\\& heartbeat

│       │   │   ├── playwright-client.ts       # Playwright browser automation

│       │   │   └── two-captcha-client.ts      # CAPTCHA service integration

│       │   │

│       │   ├── models                        # Data models

│       │   │   ├── Job.ts                     # Job queue schema

│       │   │   ├── FormField.ts               # Form field analysis

│       │   │   ├── SubmissionResult.ts        # Submission outcomes

│       │   │   ├── WorkerHeartbeat.ts         # Worker status tracking

│       │   │   └── AIAnalysis.ts              # AI analysis results

│       │   │

│       │   ├── middleware                    # Processing middleware

│       │   │   ├── job-validator.ts           # Job input validation

│       │   │   ├── rate-limiter.ts            # API rate limiting

│       │   │   ├── error-handler.ts           # Global error handling

│       │   │   └── auth-validator.ts          # API key validation

│       │   │

│       │   ├── utils                         # Utility functions

│       │   │   ├── logger.ts                  # Structured logging

│       │   │   ├── retry-strategy.ts          # Exponential backoff

│       │   │   ├── form-parser.ts             # HTML form parsing

│       │   │   ├── data-mapper.ts             # Business data → form mapping

│       │   │   ├── timing-calculator.ts       # Optimal timing logic

│       │   │   └── health-checker.ts          # Service health checks

│       │   │

│       │   ├── jobs                          # Background job processors

│       │   │   ├── job-processor.ts           # Main job processing loop

│       │   │   ├── heartbeat-sender.ts        # Periodic heartbeat

│       │   │   ├── queue-poller.ts            # Poll for new jobs

│       │   │   └── cleanup-job.ts             # Periodic cleanup

│       │   │

│       │   ├── handlers                      # Request handlers

│       │   │   ├── health-handler.ts          # Health check endpoint

│       │   │   ├── job-handler.ts             # Job submission handling

│       │   │   └── status-handler.ts          # Status reporting

│       │   │

│       │   ├── types                         # TypeScript type definitions

│       │   │   ├── job.types.ts               # Job schemas

│       │   │   ├── ai.types.ts                # AI service types

│       │   │   ├── submission.types.ts        # Submission result types

│       │   │   └── error.types.ts             # Error definitions

│       │   │

│       │   ├── config                        # Configuration

│       │   │   ├── environment.ts             # Env variable setup

│       │   │   ├── ai-config.ts               # AI service configuration

│       │   │   └── retry-config.ts            # Retry strategy config

│       │   │

│       │   ├── worker.ts                      # Worker entry point

│       │   └── index.ts                       # Application bootstrap

│       │

│       ├── Dockerfile                         # Docker container setup

│       ├── package.json                       # Dependencies \\\& scripts

│       └── tsconfig.json                      # TypeScript configuration

│

├── lib

│   └── ai-services                           # Shared AI service utilities

│       ├── form-mapper                       # Form mapping logic

│       ├── submission-orchestrator           # Orchestration utilities

│       ├── success-calculator                # Success prediction logic

│       └── retry-analyzer                    # Retry analysis utilities

│

├── database

│   └── migrations                            # Supabase schema migrations

│       ├── system\\\_settings\\\_table.sql          # Queue pauseresume config

│       └── worker\\\_heartbeats\\\_table.sql        # Worker status tracking

│

└── docs

\&nbsp;   ├── AI-WORKER-DEPLOYMENT-GUIDE.md          # Deployment to Render

\&nbsp;   └── AI-SERVICES-REFERENCE.md               # AI service documentation

```



---



\## 🔧 Technology Stack



\### Core Technologies



\- Language TypeScript 5.2+ - Full type safety across worker services

\- Runtime Node.js 20 - Server runtime for job processing

\- Browser Automation Playwright - Form filling and submission

\- Database Supabase (PostgreSQL) - Job queue and worker heartbeats

\- AI Services Anthropic Claude + Google Gemini - Intelligent form analysis



\### Key Libraries



 Library  Purpose

---

 `@anthropic-aisdk`  Claude API for form analysis and intelligence

 `@googlegenerative-ai`  Google Gemini for description customization

 `playwright`  Browser automation for form submission

 `@supabasesupabase-js`  Database and real-time updates

 `dotenv`  Environment variable management

 `axios`  HTTP client for 2Captcha integration

 `winston`  Structured logging

 `joi`  Schema validation



\### Development Tools



\- Testing Jest - Unit and integration tests

\- Linting ESLint - Code quality enforcement

\- Type Checking TypeScript strict mode

\- Container Docker - Render.com deployment

\- Process Manager PM2 (optional local development)



---



\## 🌐 External Dependencies



\### Required Services



 Service  Purpose  Environment Variable

---

 Anthropic Claude  Form analysis, success prediction, retry logic  `ANTHROPIC\\\_API\\\_KEY`

 Google Gemini  Business description customization  `GEMINI\\\_API\\\_KEY`

 Supabase  Job queue, worker heartbeats, system settings  `SUPABASE\\\_URL`, `SUPABASE\\\_SERVICE\\\_ROLE\\\_KEY`

 2Captcha  CAPTCHA solving service  `TWO\\\_CAPTCHA\\\_API\\\_KEY`

 Netlify Functions  Job polling endpoint  `NETLIFY\\\_FUNCTIONS\\\_URL`, `AUTOBOLT\\\_API\\\_KEY`



\### Environment Variables



```bash

\\# Basic Configuration

NODE\\\_ENV=production

PORT=3000

POLL\\\_INTERVAL=5000                    # Poll every 5 seconds

WORKER\\\_ID=ai-enhanced-worker-1        # Unique worker identifier



\\# API Configuration - REQUIRED

AUTOBOLT\\\_API\\\_KEY=api\\\_key            # Netlify API authentication

AUTOBOLT\\\_API\\\_BASE=httpsdirectorybolt.netlify.app

NETLIFY\\\_FUNCTIONS\\\_URL=httpsdirectorybolt.netlify.app

WORKER\\\_AUTH\\\_TOKEN=token             # Worker authentication



\\# Playwright Configuration

PLAYWRIGHT\\\_HEADLESS=true              # Headless browser mode

PLAYWRIGHT\\\_TIMEOUT=30000              # 30 second timeout

HEADLESS=true



\\# AI Services - REQUIRED for full functionality

ANTHROPIC\\\_API\\\_KEY=claude\\\_api\\\_key    # Anthropic Claude API key

GEMINI\\\_API\\\_KEY=gemini\\\_api\\\_key       # Google Gemini API key



\\# CAPTCHA Service

TWO\\\_CAPTCHA\\\_API\\\_KEY=captcha\\\_key    # 2Captcha service API key



\\# Database Configuration - REQUIRED

SUPABASE\\\_URL=your\\\_supabase\\\_url

SUPABASE\\\_SERVICE\\\_ROLE\\\_KEY=service\\\_role\\\_key  # NOT the anon key!



\\# Logging

LOG\\\_LEVEL=info                         # info, debug, error, warn

```



---



\## 📊 Common Workflows



\### AI Form Analysis Workflow



1\. Job received from queue

2\. AIFormMapper analyzes directory form HTML with Claude

3\. Form fields identified and mapped to business data

4\. Confidence scores calculated for each mapping

5\. Form filling strategy determined (field order, special handling)

6\. Success probability estimated

7\. Optimal timing calculated

8\. Business description customized for directory platform



Code path `workersplaywright-workersrcjobsjob-processor.ts` → `servicesai-form-mapper.ts` → `integrationanthropic-client.ts` → `servicesai-submission-orchestrator.ts`



\### Directory Submission Workflow



1\. Queue manager checks if queue is paused (Supabase)

2\. Poll Netlify API for next job

3\. AIFormMapper analyzes the directory form

4\. Success probability calculated

5\. If success probability  threshold

   - Timing optimizer calculates delay

   - Playwright navigates to directory

   - Forms filled intelligently using AI analysis

   - CAPTCHA solved if encountered

   - Submission executed

6\. Result captured and logged

7\. Worker status updated in heartbeat

8\. On failure, retry analyzer determines strategy



Code path `workersplaywright-workersrcjobsqueue-poller.ts` → `servicesai-submission-orchestrator.ts` → `integrationplaywright-client.ts` → `servicesretry-analyzer.ts`



\### Queue PauseResume Workflow



1\. Staff updates `system\\\_settings` table in Supabase

2\. Worker checks pause state on each polling cycle

3\. If paused Worker sleeps and retries at interval

4\. If resumed Worker continues processing

5\. Pause state logged for audit trail

6\. Staff dashboard shows real-time pause status



Code path `servicesqueue-manager.ts` → `integrationsupabase-client.ts` → `jobsqueue-poller.ts`



\### Intelligent Retry Workflow



1\. Submission fails with specific error

2\. Retry Analyzer examines failure type

   - Temporary (timeout, rate limit) Exponential backoff

   - Form Issue (unmapped fields) Re-analyze with Claude

   - CAPTCHA Fail (multiple attempts) Try 2Captcha again

   - Permanent (invalid data, duplicate) Mark as failed

3\. Retry strategy determined and logged

4\. Job re-queued or escalated for manual review

5\. Staff notified of failed submissions



Code path `servicesretry-analyzer.ts` → `integrationanthropic-client.ts` → `servicesai-submission-orchestrator.ts`



\### Worker Health Monitoring



1\. Worker starts and initializes AI services

2\. Periodic heartbeat job runs every 60 seconds

3\. Heartbeat includes

   - Worker ID and status

   - Last job processed

   - AI services health status

   - Jobs processed count

   - Memory usage

4\. Heartbeat sent to Supabase `worker\\\_heartbeats` table

5\. Dashboard queries heartbeats to show worker status

6\. Missing heartbeat triggers alert (worker down)



Code path `jobsheartbeat-sender.ts` → `integrationsupabase-client.ts` → Dashboard queries



---



\## 📄 File Navigation Guide



 File  Purpose  When You'd Touch It

---

 `servicesai-form-mapper.ts`  Form analysis \& field mapping  Improving form recognition accuracy

 `servicesai-submission-orchestrator.ts`  AI service coordination  Adding new AI services or workflows

 `servicessuccess-calculator.ts`  Success probability  Adjusting success thresholds

 `servicestiming-optimizer.ts`  Submission timing  Optimizing timing strategy

 `servicesdescription-customizer.ts`  Directory-specific descriptions  Improving descriptions per platform

 `servicesretry-analyzer.ts`  Intelligent retry logic  Changing retry strategies

 `servicesqueue-manager.ts`  Queue pauseresume control  Queue management changes

 `integrationanthropic-client.ts`  Claude API integration  Claude service updates

 `integrationplaywright-client.ts`  Browser automation  Form filling logic changes

 `jobsjob-processor.ts`  Main processing loop  Workflow changes

 `jobsqueue-poller.ts`  Job polling from Netlify  Polling strategy changes

 `modelsJob.ts`  Job queue schema  Job data structure changes

 `typesai.types.ts`  AI service type definitions  API contract changes

 `worker.ts`  Worker entry point  Bootstrap configuration



---



\## 🚀 Development Workflows (ACE-FCA)



\### Stage-Based Development System



The AI Worker uses ACE-FCA (Agentic Code Exploration - Form Code Audit) with stages



\#### Stage 1 Form Analysis Enhancement

\- Improve AIFormMapper accuracy

\- Add new form type detection

\- Enhance field mapping logic



\#### Stage 2 AI Service Integration

\- Add new AI services (Ollama, local models)

\- Optimize prompt engineering

\- Enhance context window usage



\#### Stage 3 Retry \& Recovery

\- Improve retry analyzer logic

\- Add fallback strategies

\- Enhance error classification



\#### Stage 4 Performance \& Optimization

\- Optimize playwright speed

\- Reduce API latency

\- Improve success rates



\### Using Agents for Development



```json

{

\&nbsp; function stage2AIServiceIntegration,

\&nbsp; arguments {

\&nbsp;   services \\\[anthropic-client.ts, gemini-client.ts],

\&nbsp;   focus \\\[prompt optimization, error handling, cost management]

\&nbsp; }

}

```



Use Sam (Project Planner) to

\- Break down feature development

\- Identify dependencies

\- Plan integration phases

\- Estimate timelines



Use Shane (Backend Developer) to

\- Design API contracts

\- Optimize database queries

\- Implement retry logic

\- Handle error scenarios



Use Hudson (Code Reviewer) to

\- Review AI service integrations

\- Audit error handling

\- Validate type safety

\- Check security compliance



---



\## 🔒 Security Considerations



\### API Security

\- API Key Validation All requests require `AUTOBOLT\\\_API\\\_KEY` or `WORKER\\\_AUTH\\\_TOKEN`

\- Rate Limiting Prevent abuse of AnthropicGemini APIs

\- Error Messages No sensitive data in error responses



\### Data Protection

\- Form Data Never log sensitive user information

\- AI Service Keys Stored in environment variables only

\- Supabase Auth Use `SERVICE\\\_ROLE\\\_KEY` for worker access (not anon key)



\### CAPTCHA Handling

\- Safe Service 2Captcha integrated for human verification

\- Fallback Manual review if CAPTCHA fails multiple times

\- Rate Limiting Throttle CAPTCHA attempts to prevent abuse



\### Webhook Validation

\- Netlify Webhooks Validate webhook signatures

\- Supabase Realtime Validate connection tokens

\- Error Escalation Manual review for suspicious patterns



---



\## 📊 Data Integrations



\### Supabase Integration



```sql

-- Job Queue Table

CREATE TABLE IF NOT EXISTS jobs (

\&nbsp; id UUID PRIMARY KEY DEFAULT uuid\\\_generate\\\_v4(),

\&nbsp; customer\\\_id TEXT NOT NULL,

\&nbsp; directory\\\_name TEXT NOT NULL,

\&nbsp; form\\\_data JSONB NOT NULL,

\&nbsp; status TEXT DEFAULT 'pending',

\&nbsp; ai\\\_analysis JSONB,

\&nbsp; success\\\_probability FLOAT,

\&nbsp; created\\\_at TIMESTAMPTZ DEFAULT NOW(),

\&nbsp; updated\\\_at TIMESTAMPTZ DEFAULT NOW()

);



-- System Settings (Queue Pause)

CREATE TABLE IF NOT EXISTS system\\\_settings (

\&nbsp; key TEXT PRIMARY KEY,

\&nbsp; value JSONB,

\&nbsp; updated\\\_at TIMESTAMPTZ DEFAULT NOW()

);



-- Worker Heartbeats

CREATE TABLE IF NOT EXISTS worker\\\_heartbeats (

\&nbsp; worker\\\_id TEXT PRIMARY KEY,

\&nbsp; status TEXT NOT NULL,

\&nbsp; ai\\\_services\\\_enabled BOOLEAN,

\&nbsp; jobs\\\_processed INTEGER,

\&nbsp; last\\\_seen TIMESTAMPTZ,

\&nbsp; updated\\\_at TIMESTAMPTZ DEFAULT NOW()

);

```



\### Netlify API Integration



```bash

\\# Endpoint GET apiautoboltjobsnext

\\# Fetches next job from queue

\\# Headers Authorization Bearer AUTOBOLT\\\_API\\\_KEY



\\# Response

{

\&nbsp; job\\\_id uuid,

\&nbsp; customer\\\_id DIR-2025-XXXXXX,

\&nbsp; directory google\\\_business\\\_profile,

\&nbsp; form\\\_data { ... },

\&nbsp; priority 1

}

```



---



\## 🎯 Success Metrics



\### Key Performance Indicators



 Metric  Target  Notes

---

 Form Mapping Accuracy  95%  AI Form Mapper success rate

 Submission Success Rate  80%  Successful directory submissions

 Average Processing Time  5 min  Per directory submission

 Worker Uptime  99.5%  System availability

 AI Service Latency  2 sec  Claude + Gemini response time

 Queue Processing Time  1 min  Job pickup to completion

 CAPTCHA Success Rate  90%  2Captcha solving accuracy



\### Monitoring \& Alerts



\- Worker Health Heartbeat missing 2 minutes → Alert

\- Form Mapping Success rate 90% → Alert

\- AI Service Errors 5 consecutive failures → Alert

\- Queue Backlog 100 pending jobs → Alert

\- Submission Failures 10 consecutive failures → Escalate to manual review



---



\## 🛠️ Deployment \& Operations



\### Local Development



```bash

\\# Install dependencies

npm install



\\# Set environment variables

cp .env.example .env

\\# Edit .env with your API keys



\\# Run locally with monitoring

npm run dev



\\# Run tests

npm run test



\\# Type checking

npm run typecheck



\\# Linting

npm run lint

```



\### Deployment to Render.com



```bash

\\# 1. Create new Web Service on Render

\\# 2. Connect GitHub repo Rainking6693DirectoryBolt

\\# 3. Configure

\\#    - Environment Docker

\\#    - Dockerfile Path .workersplaywright-workerDockerfile

\\#    - Branch main



\\# 4. Set environment variables in Render dashboard

\\# 5. Deploy



\\# Verify deployment

curl httpsyour-render-url.onrender.comhealth

```



\### Health Check Response



```json

{

\&nbsp; status healthy,

\&nbsp; service ai-enhanced-playwright-worker,

\&nbsp; timestamp 2025-10-21T143000Z,

\&nbsp; aiServices enabled,

\&nbsp; jobsProcessed 42,

\&nbsp; workerUptime 3600

}

```



---



\## 🚨 Things to Be Careful About



\### ⚠️ AI Service Costs

\- Claude API Monitor token usage, implement caching for repeated forms

\- Gemini API Set quota limits to prevent runaway costs

\- Rate Limits Implement exponential backoff for API rate limits



\### 🎯 Form Mapping Accuracy

\- Field Confidence Only fill fields with 80% confidence

\- Validation Pre-validate data before submission

\- Error Handling Log ambiguous field mappings for manual review

\- Platform Variations Different directories have different form structures



\### 🔄 Retry Strategy

\- Backoff Logic Exponential backoff prevents API throttling

\- Max Retries Cap retries at 3 to avoid infinite loops

\- Manual Review Escalate after auto-retry fails

\- Timing Optimizer Space out retries to avoid detection



\### 📊 Queue Management

\- Pause State Check frequently; update heartbeat timestamp

\- Job Ordering Respect priority field

\- Stale Jobs Remove jobs older than 7 days

\- Dead Letter Queue Failed jobs go to manual review



\### 🔐 Security Best Practices

\- Never log API keys in error messages

\- Validate all inputs before AI processing

\- Sanitize HTML from form analysis

\- Rotate API keys every 90 days

\- Monitor for suspicious patterns (too many failures)



---



\## ✅ Deployment Checklist



\- \[ ] All environment variables configured

\- \[ ] Supabase tables created (jobs, system\_settings, worker\_heartbeats)

\- \[ ] Anthropic and Gemini API keys validated

\- \[ ] 2Captcha account funded and configured

\- \[ ] Netlify functions endpoint accessible

\- \[ ] Docker build succeeds without errors

\- \[ ] Health check endpoint returns 200 OK

\- \[ ] Worker heartbeat visible in Supabase

\- \[ ] Queue pauseresume working

\- \[ ] Test job processes successfully

\- \[ ] AI services logs show form analysis

\- \[ ] No errors in Render deployment logs

\- \[ ] Production API keys set correctly

\- \[ ] Database backups configured

\- \[ ] Monitoring and alerts enabled



---



\## 📚 Related Documentation



\- \[AI Worker Deployment Guide](.AI-WORKER-DEPLOYMENT-GUIDE.md) - Complete Render deployment instructions

\- \[AI Services Reference](.AI-SERVICES-REFERENCE.md) - Detailed AI integration docs

\- \[DirectoryBolt Architecture](.TECHNICAL\_ARCHITECTURE.md) - System design documentation



---



Version 2.0.0 AI-Enhanced

Last Updated 2025-10-21

Status Production Ready ✅

Deployment Render.com Docker Container

