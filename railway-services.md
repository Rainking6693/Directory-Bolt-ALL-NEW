# Railway Multi-Service Deployment Guide

This project requires deploying **3 separate services** on Railway:

## Service 1: CrewAI Brain Service
- **Dockerfile**: `backend/infra/Dockerfile.brain`
- **Root Directory**: `backend`
- **Port**: 8080
- **Environment Variables**: PORT=8080

## Service 2: Subscriber Service
- **Dockerfile**: `backend/infra/Dockerfile.subscriber`
- **Root Directory**: `backend`
- **Required Environment Variables**:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - AWS_DEFAULT_REGION
  - AWS_DEFAULT_ACCESS_KEY_ID
  - AWS_DEFAULT_SECRET_ACCESS_KEY
  - SQS_QUEUE_URL
  - SQS_DLQ_URL
  - PREFECT_API_URL (Prefect Cloud)
  - PREFECT_API_KEY
  - CREWAI_URL (use Railway internal URL: http://brain.railway.internal:8080)

## Service 3: Worker Service
- **Dockerfile**: `backend/infra/Dockerfile.worker`
- **Root Directory**: `backend`
- **Required Environment Variables**:
  - All variables from Subscriber +
  - PLAYWRIGHT_HEADLESS=1
  - ANTHROPIC_API_KEY
  - GEMINI_API_KEY
  - TWO_CAPTCHA_API_KEY
  - STRIPE_SECRET_KEY
  - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

## Database
- Use PostgreSQL addon (already added)
- Connection string will be auto-injected as DATABASE_URL
