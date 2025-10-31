# DirectoryBolt - Production Architecture

> **AI-powered directory submission automation with Prefect orchestration**

## 🎯 What This Is

A complete redesign of DirectoryBolt using production-grade patterns:

- **Prefect** for workflow orchestration
- **AWS SQS** for reliable queueing with DLQ
- **CrewAI** for intelligent form mapping
- **Playwright** for browser automation
- **Supabase** as system of record

## 🚀 Quick Start

```bash
# 1. Clone and setup
git clone <repo-url>
cd Directory-Bolt-ALL-NEW

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit .env with your credentials

# 3. Run migrations (in Supabase SQL Editor)
# - backend/db/migrations/001_job_results_idem.sql
# - backend/db/migrations/002_worker_heartbeats.sql
# - backend/db/migrations/003_queue_history.sql

# 4. Start services
cd backend/infra
docker-compose up -d

# 5. Deploy Prefect flow
cd ../
python -m prefect deployment build orchestration/flows.py:process_job -n production
prefect deployment apply process_job-deployment.yaml

# 6. Start subscriber
python orchestration/subscriber.py
```

## 📁 Repository Structure

```
Directory-Bolt-ALL-NEW/
├── backend/                    # New Python backend
│   ├── orchestration/          # Prefect flows & tasks
│   ├── workers/                # Playwright submission runner
│   ├── brain/                  # CrewAI form mapping service
│   ├── db/                     # Supabase DAO & migrations
│   ├── utils/                  # Logging, retry, idempotency
│   ├── infra/                  # Docker & IaC
│   └── ops/                    # Documentation & runbooks
├── frontend/                   # Next.js frontend (to be copied)
├── MIGRATION_SUMMARY.md        # Complete migration guide
└── README.md                   # This file
```

## 🔑 Key Features

### Idempotency
- SHA256 keys prevent duplicate submissions
- Pre-write pattern for retry safety
- Unique constraints in database

### Retries & Backoff
- Exponential backoff with jitter
- Max 3 attempts per task
- Dead letter queue for failures

### Observability
- Prefect UI for flow monitoring
- Structured JSON logging
- Audit trail in `queue_history`
- Worker health via heartbeats

### Concurrency Control
- Work pools limit parallelism
- Per-directory rate limits
- Priority-based pacing

## 📊 Architecture

```
Frontend (Next.js)
    ↓
API (Netlify Functions)
    ↓
SQS Queue ← DLQ
    ↓
Subscriber (triggers)
    ↓
Prefect Flows
    ↓
Tasks (parallel)
    ↓
CrewAI Brain → Playwright Runner
    ↓
Supabase (results)
```

## 🔧 Development

### Prerequisites
- Python 3.11+
- Docker & Docker Compose
- AWS account (SQS)
- Supabase project
- Node.js 18+ (for frontend)

### Local Setup
```bash
# Backend
cd backend
pip install -r requirements.txt
playwright install chromium

# Frontend (after copying from old repo)
cd frontend
npm install
npm run dev
```

### Running Tests
```bash
# Unit tests
pytest backend/tests/

# Integration tests
python backend/tests/integration_test.py
```

## 📖 Documentation

- **[Migration Guide](MIGRATION_SUMMARY.md)** - Complete migration from old system
- **[Backend README](backend/ops/README.md)** - Architecture overview
- **[Runbook](backend/ops/runbook.md)** - Operations & troubleshooting

## 🚦 Migration Status

- ✅ Backend architecture complete
- ✅ Database migrations ready
- ✅ Docker infrastructure ready
- ✅ Documentation complete
- ⏳ Frontend migration pending
- ⏳ Production deployment pending

## 🆘 Support

See `backend/ops/runbook.md` for:
- Troubleshooting guide
- Emergency procedures
- Monitoring dashboards
- Acceptance tests

## 📝 License

[Your License Here]

## 👥 Contributors

[Your Team Here]

---

**Next Steps**: Follow `MIGRATION_SUMMARY.md` to deploy and migrate from the old system!
