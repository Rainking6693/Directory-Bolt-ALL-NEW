# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DirectoryBolt is an AI-powered directory submission automation platform with a dual architecture:
- **Frontend**: Next.js 14 application (Pages Router) with Supabase authentication and Stripe payments
- **Backend**: Python Prefect orchestration system for automated directory submissions via Playwright

The system handles business directory submissions across multiple platforms (Yelp, Google Business, etc.) with intelligent form mapping using CrewAI and success prediction using AI models.

## Development Commands

### Frontend Development
```bash
# Install dependencies
npm install

# Development server (includes sanitization on Windows)
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Start production server
npm start
```

### Testing
```bash
# Run all tests (TypeScript check + Jest)
npm test

# Watch mode for tests
npm run test:watch

# Test coverage report
npm run test:coverage

# Enterprise tests
npm run test:enterprise

# Playwright E2E tests
npm run test:e2e

# Run specific test suites
npm run test:ai              # AI services tests
npm run test:stripe          # Stripe integration tests
npm run test:critical        # Critical revenue flow tests
```

### Backend/Orchestration (Python)
```bash
# Setup Python environment
cd backend
pip install -r requirements.txt
playwright install chromium

# Start local infrastructure (Prefect server, PostgreSQL, Brain service)
cd infra
docker-compose up -d

# Deploy Prefect flows
cd ../orchestration
python -m prefect deployment build flows.py:process_job -n production
prefect deployment apply process_job-deployment.yaml

# Start SQS subscriber
python subscriber.py

# Run Python tests
pytest tests/
```

### Database
```bash
# Generate Supabase types from schema
npm run supabase:gen-types
```

## Architecture

### Frontend Structure (Next.js Pages Router)
```
pages/
├── api/                    # API routes (serverless functions)
│   ├── admin/             # Admin dashboard APIs
│   ├── ai/                # AI service endpoints
│   ├── auth/              # Authentication endpoints
│   ├── autobolt/          # Directory submission job APIs
│   └── checkout/          # Stripe payment APIs
├── admin/                 # Admin dashboard pages
├── dashboard/             # Customer dashboard
└── *.tsx                  # Public pages (landing, pricing, etc.)

components/
├── admin/                 # Admin UI components
├── ai-portal/            # AI service UI
├── dashboard/            # Customer dashboard components
├── checkout/             # Payment/checkout flows
└── *.tsx                 # Shared components

lib/
├── auth.ts               # Authentication utilities
├── supabaseServer.ts     # Server-side Supabase client
└── various utilities     # Stripe, validation, etc.
```

### Backend Structure (Python Prefect)
```
backend/
├── orchestration/        # Prefect flows and tasks
│   ├── flows.py         # Main process_job flow
│   ├── tasks.py         # Individual submission tasks
│   └── subscriber.py    # SQS → Prefect trigger
├── workers/             # Playwright browser automation
├── brain/               # CrewAI form mapping service
├── db/                  # Supabase DAO and migrations
├── AI/                  # AI services (probability, timing, retry)
└── utils/               # Logging, retry logic, idempotency
```

### Key Architectural Patterns

1. **Idempotency**: All directory submissions use SHA256 keys (`job_id + directory + business_data`) to prevent duplicates. The `job_results` table has unique constraints on `idempotency_key`.

2. **Retry with Backoff**: Exponential backoff (1s → 2s → 4s → 8s, max 60s) with jitter. Max 3 attempts per task. Failed jobs go to Dead Letter Queue (DLQ).

3. **Work Queue**: AWS SQS queue receives job requests from the Next.js API. The Python subscriber triggers Prefect flows which execute directory submissions via Playwright.

4. **AI Integration**:
   - CrewAI Brain service maps business data to directory-specific form fields
   - Success probability calculator predicts submission outcomes
   - Timing optimizer schedules submissions for best success rates
   - Intelligent retry analyzer determines if retries are worth attempting

5. **Authentication**: Server-side Supabase authentication with JWT tokens. Admin routes check `is_admin` flag.

6. **Payments**: Stripe integration for subscriptions (Starter, Pro, Enterprise tiers) and one-time purchases.

## Important Technical Details

### Environment Variables
Key environment variables are required in `.env` (see `.env.example` in backend folder):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Database access
- `PREFECT_API_URL` - Orchestration server
- `SQS_QUEUE_URL`, `SQS_DLQ_URL` - AWS queue endpoints
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` - AI services
- `STRIPE_SECRET_KEY` - Payment processing
- `TWO_CAPTCHA_API_KEY` - Captcha solving

### TypeScript Configuration
- Path aliases: `@/` maps to root, `@/components/*`, `@/lib/*`, `@/styles/*`
- Strict mode enabled with full type checking
- Target: ES2022 with DOM libs

### Database (Supabase/PostgreSQL)
Main tables:
- `customers` - User accounts with subscription tiers
- `jobs` - Directory submission job records
- `job_results` - Individual submission outcomes (with idempotency_key)
- `directories` - Available directory platforms
- `queue_history` - Audit trail for job state transitions
- `worker_heartbeats` - Health monitoring for Playwright workers

See `supabase/migrations/` for schema migrations.

### Windows Compatibility
This codebase has special handling for Windows development:
- `sanitize-repo-light.ps1` cleans reserved Windows filenames (CON, PRN, AUX, etc.)
- Next.js watcher configured to ignore problematic paths
- PowerShell scripts for deployment automation

### Testing Strategy
- Jest for unit/integration tests (Node environment)
- Playwright for E2E testing
- Test files excluded from TypeScript compilation (see `tsconfig.json`)
- Max 1 worker for tests to avoid API rate limits

## Code Style Guidelines

### From .cursorrules
- Auto-approve all operations when working in this repository
- Complete tasks fully without asking for approval
- Only ask questions if critical information is missing

### AI Services
- AI features can be disabled via `ENABLE_AI_FEATURES=false`
- Services gracefully degrade if AI is unavailable
- All AI predictions are logged for feedback loops

### API Design
- All API routes return JSON with consistent error handling
- Use HTTP status codes correctly (200, 400, 401, 403, 404, 500)
- Admin routes must verify `is_admin` flag from session

### Database Access
- Always use idempotency keys for write operations
- Use Supabase RLS (Row Level Security) policies where applicable
- Record state transitions in `queue_history` for audit trails

## Common Workflows

### Adding a New Directory Platform
1. Add directory metadata to `directories` table in Supabase
2. Create form mapping logic in `backend/brain/` CrewAI service
3. Add Playwright automation in `backend/workers/submission_runner.py`
4. Update frontend directory selector component
5. Test with `npm run test:autobolt`

### Debugging Failed Submissions
1. Check Prefect UI at `http://localhost:4200` for flow/task logs
2. Query `queue_history` table for state transitions
3. Check `worker_heartbeats` for worker health
4. Review DLQ messages in AWS SQS console
5. Run `python backend/tests/test_critical_flows.py` for diagnosis

### Deploying to Production
1. Frontend deploys automatically via Netlify on `main` branch push
2. Backend services can deploy to Railway or Render:
   - See `RAILWAY_QUICK_DEPLOY.md` for Railway setup
   - See `DEPLOY_RAILWAY.md` for detailed instructions
3. Run database migrations manually in Supabase SQL editor
4. Verify deployment with `npm run verify:deployment`

## Key Files to Know

- `next.config.js` - Next.js configuration with Windows compatibility
- `backend/orchestration/flows.py` - Main Prefect workflow orchestration
- `backend/db/dao.py` - Database access layer with idempotency
- `pages/api/autobolt/` - Job creation and status APIs
- `components/dashboard/` - Customer-facing UI components
- `lib/supabaseServer.ts` - Server-side database client

## Security Considerations

- Never commit `.env` files or credentials
- All Stripe webhooks verify signatures
- Admin operations require `is_admin` flag verification
- Rate limiting on API routes prevents abuse
- Sanitization of user inputs before database writes
- Supabase RLS policies enforce data access boundaries

## Support Resources

- Architecture overview: `backend/ops/README.md`
- Operations guide: `backend/ops/runbook.md`
- Migration documentation: `MIGRATION_SUMMARY.md`
- Railway deployment: `RAILWAY_QUICK_DEPLOY.md`
