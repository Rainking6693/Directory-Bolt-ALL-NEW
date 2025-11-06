# DirectoryBolt Architecture Documentation

**Last Updated**: November 6, 2025
**Version**: 2.0 (Render Deployment with Self-Hosted Prefect)

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Service Components](#service-components)
4. [Data Flow](#data-flow)
5. [Database Schema](#database-schema)
6. [Deployment Configuration](#deployment-configuration)
7. [Monitoring & Operations](#monitoring--operations)
8. [Troubleshooting](#troubleshooting)

---

## System Overview

DirectoryBolt is an AI-powered directory submission automation platform with a distributed microservices architecture:

### Frontend
- **Platform**: Next.js 14 (Pages Router)
- **Hosting**: Netlify
- **Repository**: https://github.com/Rainking6693/Directory-Bolt-ALL-NEW
- **URL**: https://directorybolt.com (via Netlify)

### Backend Services (Render)
- **Brain Service**: CrewAI-powered form mapping
- **Subscriber Service**: AWS SQS → Prefect job trigger
- **Worker Service**: Playwright-based directory submission automation
- **Prefect Server**: Self-hosted workflow orchestration

### Database
- **Platform**: Supabase (PostgreSQL)
- **URL**: https://kolgqfjgncdwddziqloz.supabase.co

### Message Queue
- **Platform**: AWS SQS
- **Region**: us-east-2
- **Queue**: DirectoryBolt
- **DLQ**: DirectoryBolt-dlq

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER INTERACTION                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NETLIFY (Next.js Frontend)                        │
│  • Customer Dashboard                                                │
│  • Stripe Checkout                                                   │
│  • API Routes (/api/*)                                              │
└─────────────────────────────────────────────────────────────────────┘
                    │                               │
                    │ Stripe Webhook                │ Job Creation API
                    ▼                               ▼
┌──────────────────────────┐        ┌──────────────────────────────┐
│   STRIPE PAYMENT         │        │   SUPABASE DATABASE          │
│   • Subscription Created │        │   • jobs table               │
│   • Payment Success      │        │   • customers table          │
└──────────────────────────┘        │   • job_results table        │
                                     │   • queue_history table      │
                                     │   • worker_heartbeats table  │
                                     └──────────────────────────────┘
                                                    │
                                                    │ Write Job
                                                    ▼
                    ┌─────────────────────────────────────────┐
                    │        AWS SQS QUEUE                     │
                    │   Queue: DirectoryBolt                   │
                    │   DLQ: DirectoryBolt-dlq                │
                    │   Region: us-east-2                      │
                    └─────────────────────────────────────────┘
                                     │
                                     │ Poll Messages
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     RENDER BACKEND SERVICES                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐        │
│  │  SUBSCRIBER SERVICE (srv-d45u7e7diees738h2ahg)          │        │
│  │  • Polls SQS for new job messages                       │        │
│  │  • Triggers Prefect deployments                         │        │
│  │  • Updates queue_history in Supabase                    │        │
│  └────────────────────────────────────────────────────────┘        │
│                           │                                          │
│                           │ Trigger Flow Run                         │
│                           ▼                                          │
│  ┌────────────────────────────────────────────────────────┐        │
│  │  PREFECT SERVER (srv-d46bvcqli9vc73dehpig)              │        │
│  │  • Self-hosted workflow orchestration                   │        │
│  │  • Work pool: "default" (process type)                  │        │
│  │  • Deployment: process_job/production                   │        │
│  │  • UI: https://prefect-server.onrender.com             │        │
│  │  • API: https://prefect-server.onrender.com/api        │        │
│  └────────────────────────────────────────────────────────┘        │
│                           │                                          │
│                           │ Assign Work                              │
│                           ▼                                          │
│  ┌────────────────────────────────────────────────────────┐        │
│  │  WORKER SERVICE (srv-d45u7eqdbo4c7385qmg0)              │        │
│  │  • Picks up work from Prefect "default" pool            │        │
│  │  • Executes process_job flow                            │        │
│  │  • Runs Playwright browser automation                   │        │
│  │  • Calls Brain service for form mapping                 │        │
│  │  • Writes results to job_results table                  │        │
│  │  • Updates worker_heartbeats                            │        │
│  └────────────────────────────────────────────────────────┘        │
│                           │                                          │
│                           │ Request Form Mapping                     │
│                           ▼                                          │
│  ┌────────────────────────────────────────────────────────┐        │
│  │  BRAIN SERVICE (srv-d45u7cqdbo4c7385ql60)               │        │
│  │  • CrewAI-powered intelligent form field mapping        │        │
│  │  • Maps business data to directory-specific forms       │        │
│  │  • API: http://brain.onrender.com:8080/plan            │        │
│  └────────────────────────────────────────────────────────┘        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Write Results
                                     ▼
                    ┌─────────────────────────────────────────┐
                    │        SUPABASE DATABASE                 │
                    │   • job_results (with idempotency)      │
                    │   • jobs (status updates)               │
                    │   • queue_history (audit trail)         │
                    │   • worker_heartbeats (health checks)   │
                    └─────────────────────────────────────────┘
                                     │
                                     │ Real-time Updates
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STAFF DASHBOARD (Netlify)                         │
│  • Job Progress Monitor                                              │
│  • Real-Time Analytics                                               │
│  • Queue Overview                                                    │
│  • Worker Health Status                                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Service Components

### 1. Frontend (Next.js on Netlify)

**Service**: `directorybolt` (Netlify)
**URL**: https://directorybolt.com
**Repository**: main branch auto-deploys

#### Key Features
- Customer dashboard for managing directory submissions
- Stripe integration for subscription payments
- Admin/staff dashboard for monitoring
- API routes for backend integration

#### API Routes
- `/api/checkout/*` - Stripe payment processing
- `/api/autobolt/*` - Job management and monitoring
- `/api/admin/*` - Admin operations
- `/api/ai/*` - AI service endpoints

#### Environment Variables (Netlify)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://kolgqfjgncdwddziqloz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
STRIPE_SECRET_KEY=<stripe_secret>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<stripe_public>
AWS_DEFAULT_ACCESS_KEY_ID=<aws_key>
AWS_DEFAULT_SECRET_ACCESS_KEY=<aws_secret>
AWS_DEFAULT_REGION=us-east-2
SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/231688741122/DirectoryBolt
```

---

### 2. Brain Service (CrewAI)

**Service ID**: srv-d45u7cqdbo4c7385ql60
**URL**: https://brain-nkil.onrender.com
**Dashboard**: https://dashboard.render.com/web/srv-d45u7cqdbo4c7385ql60

#### Purpose
Intelligent form field mapping using CrewAI. Maps business data to directory-specific form fields.

#### Configuration
- **Dockerfile**: `backend/infra/Dockerfile.brain`
- **Root Directory**: `backend`
- **Port**: 8080 → 10000 (Render maps to 10000)
- **Plan**: Starter

#### Environment Variables
```bash
PORT=10000
```

#### Health Check
- **Endpoint**: `/health`
- **Interval**: 30s

---

### 3. Subscriber Service

**Service ID**: srv-d45u7e7diees738h2ahg
**Type**: Background Worker
**Dashboard**: https://dashboard.render.com/worker/srv-d45u7e7diees738h2ahg

#### Purpose
Polls AWS SQS queue for new job messages and triggers Prefect flow runs.

#### Configuration
- **Dockerfile**: `backend/infra/Dockerfile.subscriber`
- **Root Directory**: `backend`
- **Plan**: Starter

#### Environment Variables
```bash
SUPABASE_URL=https://kolgqfjgncdwddziqloz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
AWS_DEFAULT_REGION=us-east-2
AWS_DEFAULT_ACCESS_KEY_ID=<aws_key>
AWS_DEFAULT_SECRET_ACCESS_KEY=<aws_secret>
SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/231688741122/DirectoryBolt
SQS_DLQ_URL=https://sqs.us-east-2.amazonaws.com/231688741122/DirectoryBolt-dlq
PREFECT_API_URL=https://prefect-server.onrender.com/api
CREWAI_URL=http://brain.onrender.com:8080
LOG_LEVEL=INFO
QUEUE_PROVIDER=sqs
```

#### Key Operations
1. Poll SQS queue every 5 seconds
2. Parse job message
3. Trigger Prefect deployment run
4. Update `queue_history` table
5. Delete message from SQS on success

---

### 4. Worker Service

**Service ID**: srv-d45u7eqdbo4c7385qmg0
**Type**: Background Worker
**Dashboard**: https://dashboard.render.com/worker/srv-d45u7eqdbo4c7385qmg0

#### Purpose
Executes directory submission workflows using Playwright browser automation.

#### Configuration
- **Dockerfile**: `backend/infra/Dockerfile.worker`
- **Root Directory**: `backend`
- **Plan**: Starter

#### Environment Variables
```bash
# Same as Subscriber, plus:
PLAYWRIGHT_HEADLESS=1
ANTHROPIC_API_KEY=<anthropic_key>
GEMINI_API_KEY=<gemini_key>
TWO_CAPTCHA_API_KEY=<2captcha_key>
STRIPE_SECRET_KEY=<stripe_secret>
ENABLE_AI_FEATURES=true
ENABLE_FORM_MAPPING=true
ENABLE_CONTENT_CUSTOMIZATION=true
```

#### Key Operations
1. Connect to Prefect "default" work pool
2. Pick up flow run assignments
3. Execute `process_job` flow
4. For each directory:
   - Call Brain service for form mapping
   - Launch Playwright browser
   - Navigate to directory submission page
   - Fill form with mapped data
   - Submit and capture result
   - Write to `job_results` with idempotency key
5. Update `worker_heartbeats` every 30s

---

### 5. Prefect Server (Self-Hosted)

**Service ID**: srv-d46bvcqli9vc73dehpig
**Type**: Web Service
**URL**: https://prefect-server.onrender.com
**Dashboard**: https://dashboard.render.com/web/srv-d46bvcqli9vc73dehpig

#### Purpose
Self-hosted workflow orchestration server (alternative to Prefect Cloud).

#### Configuration
- **Dockerfile**: `backend/infra/Dockerfile.prefect-server`
- **Root Directory**: `backend`
- **Port**: 10000
- **Plan**: Starter

#### Environment Variables
```bash
PREFECT_SERVER_API_HOST=0.0.0.0
PREFECT_SERVER_API_PORT=10000
PREFECT_UI_API_URL=https://prefect-server.onrender.com/api
```

#### Endpoints
- **UI**: https://prefect-server.onrender.com
- **API**: https://prefect-server.onrender.com/api
- **Health**: https://prefect-server.onrender.com/api/admin/version

#### Deployed Flows
- **Name**: `process_job/production`
- **Function**: `backend/orchestration/flows.py:process_job`
- **Work Pool**: `default` (process type)

---

## Data Flow

### Customer Job Submission Flow

```
1. Customer completes Stripe checkout
   ↓
2. Stripe sends webhook to /api/checkout/stripe-webhook
   ↓
3. Webhook handler creates record in `jobs` table
   ↓
4. API sends message to SQS queue with job details
   ↓
5. Subscriber polls SQS, receives message
   ↓
6. Subscriber triggers Prefect deployment run
   ↓
7. Prefect assigns work to Worker via "default" pool
   ↓
8. Worker executes process_job flow:
   a. Fetch job from database
   b. Loop through directories
   c. Call Brain service for form mapping
   d. Launch Playwright browser
   e. Navigate to directory
   f. Fill and submit form
   g. Write result to job_results (with idempotency)
   h. Update job status
   ↓
9. Customer dashboard shows real-time progress via Supabase Realtime
```

---

## Database Schema

### Key Tables

#### `customers`
Stores user account information and subscription details.
```sql
- customer_id (primary key)
- email
- business_name
- package_type (starter, growth, professional, enterprise)
- stripe_customer_id
- subscription_status
- business_data (JSONB)
```

#### `jobs`
Main job tracking table.
```sql
- id (primary key, auto-increment)
- customer_id (foreign key)
- package_size (number of directories)
- priority_level (1-10)
- status (pending, in_progress, complete, failed)
- business_name
- email
- created_at
- started_at
- completed_at
- error_message
```

#### `job_results`
Individual directory submission results with idempotency.
```sql
- id (primary key)
- job_id (foreign key to jobs)
- directory_name
- directory_url
- status (pending, submitted, approved, failed, rejected)
- submission_url
- error_message
- processing_time_seconds
- idempotency_key (UNIQUE, SHA256 hash)
- payload (JSONB)
- response_log (JSONB)
- created_at
- updated_at
```

**Idempotency Key Format**:
```
SHA256(job_id + directory_name + business_data_hash)
```

#### `queue_history`
Audit trail of job state transitions.
```sql
- id (primary key)
- job_id (foreign key)
- status
- timestamp
- metadata (JSONB)
```

#### `worker_heartbeats`
Worker health monitoring.
```sql
- worker_id (primary key)
- status (active, idle, error)
- last_heartbeat
- current_job_id
- jobs_completed
- jobs_failed
```

#### `directories`
Available directory platforms.
```sql
- id (primary key)
- name
- url
- submission_url
- form_fields (JSONB)
- success_rate
- average_approval_time
```

---

## Deployment Configuration

### Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/Rainking6693/Directory-Bolt-ALL-NEW.git
cd Directory-Bolt-ALL-NEW

# 2. Install frontend dependencies
npm install

# 3. Setup backend
cd backend
pip install -r requirements.txt
playwright install chromium

# 4. Copy environment variables
cp .env.example .env
# Edit .env with your credentials

# 5. Start local Prefect server (optional)
cd infra
docker-compose up -d

# 6. Run frontend
npm run dev

# 7. Run backend worker (in separate terminal)
cd backend
python -m prefect agent start -p default
```

### Render Deployment

All services auto-deploy on push to `main` branch.

**Manual Redeploy**:
```bash
# Using Render API
curl -X POST "https://api.render.com/v1/services/{SERVICE_ID}/deploys" \
  -H "Authorization: Bearer {RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": "do_not_clear"}'
```

**Service IDs**:
- Brain: `srv-d45u7cqdbo4c7385ql60`
- Subscriber: `srv-d45u7e7diees738h2ahg`
- Worker: `srv-d45u7eqdbo4c7385qmg0`
- Prefect Server: `srv-d46bvcqli9vc73dehpig`

### Prefect Flow Deployment

```bash
# 1. Configure Prefect CLI
prefect config set PREFECT_API_URL="https://prefect-server.onrender.com/api"

# 2. Create work pool (if not exists)
prefect work-pool create default --type process

# 3. Deploy flows
cd backend
prefect deploy orchestration/flows.py:process_job --name production --pool default

# Or use the automated script:
.\complete-prefect-setup.ps1
```

---

## Monitoring & Operations

### Staff Dashboard

**Location**: `/admin/staff` on your Next.js app

**Features**:
- **Job Progress Monitor**: Real-time job status and completion percentages
- **Real-Time Analytics**: Queue depth, success rates, processing times
- **Queue Overview**: Pending, processing, completed, and failed jobs
- **Worker Health**: Active workers, heartbeats, current assignments

**API Endpoints**:
- `/api/autobolt/monitoring-overview` - High-level system metrics
- `/api/autobolt/real-time-status` - Active job details
- `/api/autobolt/queue` - Queue status and statistics

### Prefect UI

**URL**: https://prefect-server.onrender.com

**Features**:
- Flow run history and logs
- Work pool status
- Deployment management
- Task execution details
- Error tracking

### Render Dashboard

**URL**: https://dashboard.render.com

**Per-Service Monitoring**:
- Deployment status and logs
- Resource usage (CPU, memory)
- Health check status
- Environment variables
- Manual deploy/restart controls

### Database Monitoring

**Supabase Dashboard**: https://supabase.com/dashboard

**Key Queries**:

```sql
-- Active jobs
SELECT * FROM jobs WHERE status IN ('pending', 'in_progress');

-- Recent failures
SELECT * FROM job_results WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10;

-- Worker health
SELECT * FROM worker_heartbeats WHERE last_heartbeat > NOW() - INTERVAL '5 minutes';

-- Success rate by directory
SELECT
  directory_name,
  COUNT(*) as total_submissions,
  SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM job_results
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY directory_name
ORDER BY success_rate DESC;
```

---

## Troubleshooting

### Common Issues

#### 1. Worker Getting 404 from Prefect Server

**Symptoms**:
```
prefect.exceptions.PrefectHTTPStatusError: Client error '404 Not Found'
for url 'https://prefect-server.onrender.com/api/work_pools/'
```

**Causes**:
- Prefect Server not fully started
- Port misconfiguration
- Dockerfile issue

**Solutions**:
1. Check Prefect Server logs in Render dashboard
2. Verify `PREFECT_SERVER_API_PORT=10000` is set
3. Test endpoint: `curl https://prefect-server.onrender.com/api/admin/version`
4. Redeploy Prefect Server if needed

#### 2. Staff Dashboard Shows 500 Errors

**Symptoms**:
- "failed to fetch job progress: 500 error"
- Real-time analytics tab failing

**Causes**:
- Monitoring APIs querying wrong table names
- Missing database tables

**Solutions**:
1. Verify tables exist: `jobs`, `job_results`, `queue_history`, `worker_heartbeats`
2. Check API endpoints use correct table names (not `autobolt_*` tables)
3. Review recent commits for monitoring API fixes

#### 3. Jobs Stuck in "pending" Status

**Symptoms**:
- Jobs created but never start processing
- No entries in `queue_history`

**Causes**:
- SQS message not sent
- Subscriber not polling
- Prefect flow not deployed

**Solutions**:
1. Check SQS queue has messages: AWS Console → SQS
2. Verify Subscriber logs in Render dashboard
3. List Prefect deployments: `prefect deployment ls`
4. Check Subscriber has correct `PREFECT_API_URL`

#### 4. Duplicate Submissions

**Symptoms**:
- Same directory submitted multiple times for same job
- Customer charged multiple times

**Causes**:
- Idempotency key collision
- Retry logic issue

**Solutions**:
1. Check `job_results` for duplicate `idempotency_key`
2. Verify SHA256 hash includes all relevant fields
3. Review retry logic in `backend/orchestration/tasks.py`

#### 5. Brain Service Not Responding

**Symptoms**:
- Worker logs show "Failed to connect to Brain service"
- Form mapping timeouts

**Causes**:
- Brain service crashed
- Port misconfiguration
- Out of memory

**Solutions**:
1. Check Brain service logs in Render
2. Verify health check: `curl https://brain-nkil.onrender.com/health`
3. Restart Brain service
4. Consider upgrading to higher plan if OOM

### Health Check Commands

```bash
# Prefect Server
curl https://prefect-server.onrender.com/api/admin/version

# Brain Service
curl https://brain-nkil.onrender.com/health

# Check Subscriber status via Render API
curl -s "https://api.render.com/v1/services/srv-d45u7e7diees738h2ahg" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" | jq '.suspended'

# Check Worker status via Render API
curl -s "https://api.render.com/v1/services/srv-d45u7eqdbo4c7385qmg0" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" | jq '.suspended'
```

### Log Access

```bash
# View Render service logs (last 100 lines)
curl "https://api.render.com/v1/services/{SERVICE_ID}/logs?tail=100" \
  -H "Authorization: Bearer ${RENDER_API_KEY}"

# Follow Prefect flow run logs
prefect flow-run logs {FLOW_RUN_ID} --follow
```

---

## Cost Optimization

### Current Costs (Estimated)

| Service | Plan | Est. Monthly Cost |
|---------|------|-------------------|
| Netlify | Free/Starter | $0-19 |
| Render (4 services) | Starter × 4 | $28 ($7 each) |
| Supabase | Free/Pro | $0-25 |
| AWS SQS | Pay-per-use | ~$1 |
| Prefect Cloud | N/A (self-hosted) | $0 |
| **Total** | | **$29-73/month** |

### Optimization Tips

1. **Scale down services during off-hours** (if applicable)
2. **Use Render's autoscaling** when available
3. **Monitor Playwright resource usage** - can be memory-intensive
4. **Clean up old job_results** regularly (archive after 90 days)
5. **Optimize SQS polling interval** based on job volume

---

## Security Considerations

### Secrets Management

**Never commit these to Git**:
- `.env` files
- `RENDER_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- AWS credentials
- API keys

**Use**:
- Render environment variables
- Netlify environment variables
- GitHub Secrets (for CI/CD if needed)

### API Security

1. **Rate Limiting**: All public APIs use rate limiting middleware
2. **Authentication**: Staff routes check `is_admin` flag
3. **Webhook Verification**: Stripe webhooks verify signatures
4. **RLS Policies**: Supabase Row Level Security enforces data access
5. **CORS**: Properly configured CORS headers

### Database Security

1. **Service Role Key**: Only used by backend services, never exposed to frontend
2. **Anon Key**: Limited permissions for public operations
3. **RLS Policies**: Customers can only access their own data
4. **Connection Security**: All connections use SSL/TLS

---

## Future Improvements

### Short Term
- [ ] Add retry logic for transient Brain service failures
- [ ] Implement job priority queuing
- [ ] Add email notifications for job completion
- [ ] Create admin alerts for critical failures

### Medium Term
- [ ] Implement A/B testing framework for submission strategies
- [ ] Add success probability calculator
- [ ] Build intelligent retry analyzer
- [ ] Create comprehensive analytics dashboard

### Long Term
- [ ] Multi-region deployment for global availability
- [ ] Machine learning for form field detection
- [ ] Advanced anti-bot detection countermeasures
- [ ] White-label solution for agencies

---

## Support & Maintenance

### Regular Maintenance Tasks

**Daily**:
- Monitor Render dashboard for service health
- Check Prefect UI for failed flow runs
- Review staff dashboard for stuck jobs

**Weekly**:
- Review error logs for patterns
- Check database growth and clean old records
- Update dependencies if security patches released

**Monthly**:
- Review and optimize costs
- Analyze directory success rates
- Update documentation
- Performance optimization review

### Getting Help

**Internal Documentation**:
- `CLAUDE.md` - Development guide
- `RAILWAY_QUICK_DEPLOY.md` - Railway deployment (legacy)
- `MIGRATION_SUMMARY.md` - Architecture migration notes

**External Resources**:
- Prefect Docs: https://docs.prefect.io
- Render Docs: https://render.com/docs
- Supabase Docs: https://supabase.com/docs

---

**End of Documentation**
