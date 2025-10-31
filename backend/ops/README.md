# DirectoryBolt Backend - Prefect + CrewAI Architecture

## Overview

This is a complete redesign of the DirectoryBolt submission system using production-grade patterns:

- **Orchestration**: Prefect (flows, tasks, retries, concurrency, observability)
- **Queue**: AWS SQS with DLQ for reliable work distribution
- **Brain**: CrewAI for intelligent form mapping
- **Database**: Supabase (Postgres) as system of record
- **Automation**: Playwright for headless browser automation

## Architecture

```
┌─────────────┐      ┌──────────┐      ┌────────────┐
│   Frontend  │─────▶│   API    │─────▶│    SQS     │
│  (Next.js)  │      │(Netlify) │      │   Queue    │
└─────────────┘      └──────────┘      └──────┬─────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │  Subscriber  │
                                       │  (triggers)  │
                                       └──────┬───────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │   Prefect    │
                                       │    Flows     │
                                       └──────┬───────┘
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        ▼                     ▼                     ▼
                 ┌────────────┐       ┌────────────┐       ┌────────────┐
                 │   Task 1   │       │   Task 2   │       │   Task N   │
                 │ (submit to │       │ (submit to │       │ (submit to │
                 │  Yelp)     │       │  Google)   │       │  About.me) │
                 └─────┬──────┘       └─────┬──────┘       └─────┬──────┘
                       │                    │                    │
                       └────────────────────┼────────────────────┘
                                           ▼
                                    ┌──────────────┐
                                    │  CrewAI      │
                                    │  Brain       │
                                    │  (mapping)   │
                                    └──────┬───────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  Playwright  │
                                    │  Runner      │
                                    └──────┬───────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  Supabase    │
                                    │  (results)   │
                                    └──────────────┘
```

## Quick Start

### Prerequisites

- Python 3.11+
- Docker & Docker Compose
- AWS account (for SQS) or GCP (for Pub/Sub)
- Supabase project

### Environment Variables

Create `.env` file:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Prefect
PREFECT_API_URL=http://localhost:4200/api  # or Prefect Cloud URL
PREFECT_API_KEY=your-api-key  # if using Prefect Cloud

# Queue
QUEUE_PROVIDER=sqs
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/directorybolt-jobs
SQS_DLQ_URL=https://sqs.us-east-1.amazonaws.com/123456789/directorybolt-dlq
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Brain
CREWAI_URL=http://brain:8080/plan

# Automation
PLAYWRIGHT_HEADLESS=1
ANTHROPIC_API_KEY=your-anthropic-key
GEMINI_API_KEY=your-gemini-key
TWO_CAPTCHA_API_KEY=your-2captcha-key
```

### Local Development

1. **Run database migrations**:
```bash
cd backend/db/migrations
# Apply each migration to your Supabase project via SQL Editor
```

2. **Start services**:
```bash
docker-compose up -d
```

3. **Start Prefect server** (if using OSS):
```bash
prefect server start
```

4. **Deploy Prefect flows**:
```bash
cd backend/orchestration
python -m prefect deployment build flows.py:process_job -n production -q default
prefect deployment apply process_job-deployment.yaml
```

5. **Start subscriber**:
```bash
python backend/orchestration/subscriber.py
```

## Project Structure

```
backend/
├── orchestration/
│   ├── flows.py          # Prefect flows
│   ├── tasks.py          # Prefect tasks
│   └── subscriber.py     # SQS → Prefect trigger
├── workers/
│   └── submission_runner.py  # Playwright executor
├── brain/
│   ├── service.py        # CrewAI FastAPI service
│   └── client.py         # HTTP client
├── db/
│   ├── dao.py            # Supabase CRUD
│   ├── supabase.py       # Client init
│   └── migrations/       # SQL migrations
├── infra/
│   ├── Dockerfile.worker
│   ├── Dockerfile.subscriber
│   ├── Dockerfile.brain
│   ├── docker-compose.yml
│   └── terraform/        # IaC for AWS/GCP
├── utils/
│   ├── logging.py        # Structured logging
│   ├── ids.py            # Idempotency keys
│   └── retry.py          # Backoff helpers
└── ops/
    ├── README.md         # This file
    └── runbook.md        # Operations guide
```

## Key Features

### Idempotency
- SHA256 idempotency keys prevent duplicate submissions
- Pre-write pattern: insert "submitting" status before execution
- Retries automatically skip if already succeeded

### Retries
- Exponential backoff with jitter (1s → 2s → 4s → 8s...)
- Max 3 attempts per task
- Failed messages go to DLQ after exhaustion

### Observability
- Prefect UI shows all runs, logs, and artifacts
- Structured JSON logging to stdout
- Queue history table tracks every state transition
- Worker heartbeats for health monitoring

### Concurrency
- Prefect work pools limit global concurrency
- Per-directory rate limits via metadata
- In-process semaphores for extra safety

## Testing

```bash
# Unit tests
pytest backend/tests/

# Integration test (requires services running)
python backend/tests/integration_test.py

# Send test message to queue
python backend/tests/send_test_message.py --job-id <uuid>
```

## Monitoring

### Prefect UI
- http://localhost:4200 (OSS) or app.prefect.cloud
- View flow runs, task states, logs, artifacts

### Supabase
- `queue_history` table: audit trail
- `worker_heartbeats` table: active workers
- `job_results` table: submission outcomes

### Alerts
- Stale workers (no heartbeat >2min)
- SQS backlog threshold
- High retry rate (>30%)

## Migration from Old Poller

See `runbook.md` for detailed migration steps.

## Support

For issues, see `runbook.md` or contact the team.
