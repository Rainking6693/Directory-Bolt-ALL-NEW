# Render Deployment Guide - DirectoryBolt Backend

Complete guide for deploying the DirectoryBolt backend to Render.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Step-by-Step Deployment](#step-by-step-deployment)
4. [Environment Variables](#environment-variables)
5. [Service Architecture](#service-architecture)
6. [Health Checks](#health-checks)
7. [Troubleshooting](#troubleshooting)
8. [Cost Estimates](#cost-estimates)
9. [Scaling](#scaling)

---

## Prerequisites

### Required Accounts
- **Render Account**: Sign up at [render.com](https://render.com)
- **GitHub Account**: Repository must be on GitHub (GitLab also supported)
- **AWS Account**: For SQS queue (or use alternative queue provider)
- **Supabase Account**: For database
- **Prefect Cloud Account**: For orchestration (or use self-hosted Prefect)

### Required Information
- AWS SQS Queue URL
- AWS Access Key ID and Secret Access Key
- Supabase Project URL and Service Role Key
- Prefect Cloud API URL and Key (if using Prefect Cloud)
- GitHub repository URL

---

## Quick Start

1. **Fork/Clone Repository**
   ```bash
   git clone https://github.com/your-org/Directory-Bolt-ALL-NEW.git
   cd Directory-Bolt-ALL-NEW
   ```

2. **Connect Repository to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Select the repository and branch

3. **Render will auto-detect `render.yaml`**
   - Render will read the Blueprint configuration
   - All services and environment variables will be configured automatically

4. **Set Environment Variables**
   - Go to your service → Environment
   - Add all required variables (see [Environment Variables](#environment-variables))

5. **Deploy**
   - Render will automatically start the deployment
   - Monitor logs in the Render dashboard

---

## Step-by-Step Deployment

### Option 1: Using Render Blueprint (Recommended)

1. **Push `render.yaml` to Repository**
   ```bash
   git add render.yaml
   git commit -m "Add Render Blueprint configuration"
   git push origin main
   ```

2. **Create Blueprint in Render**
   - Dashboard → "New +" → "Blueprint"
   - Connect GitHub repository
   - Select branch (usually `main` or `master`)
   - Click "Apply"

3. **Configure Environment Variables**
   - Click on the created service
   - Go to "Environment" tab
   - Add all required variables (see below)

4. **Deploy**
   - Click "Manual Deploy" → "Deploy latest commit"
   - Monitor logs

### Option 2: Manual Service Creation

1. **Create New Web Service**
   - Dashboard → "New +" → "Web Service"
   - Connect GitHub repository
   - Configure:
     - **Name**: `directorybolt-backend`
     - **Root Directory**: `backend`
     - **Environment**: `Docker`
     - **Dockerfile Path**: `Dockerfile`
     - **Docker Build Context**: `backend`
     - **Docker Command**: `./start.sh`

2. **Set Plan**
   - Starter: $7/month (suitable for development)
   - Standard: $25/month (recommended for production)
   - Pro: $85/month (high-traffic production)

3. **Configure Environment Variables** (see section below)

4. **Set Health Check**
   - Health Check Path: `/health`
   - Render will use this to monitor service health

5. **Enable Auto-Deploy**
   - Auto-Deploy: "Yes" (deploys on every push to main branch)

---

## Environment Variables

### Required Variables

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co  # Optional, fallback

# AWS SQS
AWS_DEFAULT_REGION=us-east-1
AWS_DEFAULT_ACCESS_KEY_ID=your-aws-access-key
AWS_DEFAULT_SECRET_ACCESS_KEY=your-aws-secret-key
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/your-queue
SQS_DLQ_URL=https://sqs.us-east-1.amazonaws.com/123456789/your-dlq
BACKEND_ENQUEUE_TOKEN=long-shared-secret-used-between-render-and-netlify

# Prefect (choose one)
# Option A: Prefect Cloud
PREFECT_API_URL=https://api.prefect.cloud/api/accounts/YOUR_ACCOUNT_ID/workspaces/YOUR_WORKSPACE_ID
PREFECT_API_KEY=your-prefect-api-key

# Option B: Self-hosted Prefect Server (if running separately)
# PREFECT_API_URL=http://your-prefect-server:4200/api
# PREFECT_API_KEY=not-needed-for-oss
```

> **Netlify reminder:** define `BACKEND_ENQUEUE_URL` (Render brain service base URL) and the matching `BACKEND_ENQUEUE_TOKEN` so the frontend queue manager can call `/api/jobs/enqueue` securely.

### Optional Variables

```bash
# Brain Service (internal, defaults to localhost:8080)
CREWAI_URL=http://localhost:8080

# Playwright
PLAYWRIGHT_HEADLESS=1

# AI Features
ENABLE_AI_FEATURES=true
ENABLE_CONTENT_CUSTOMIZATION=true
ENABLE_FORM_MAPPING=true

# AI API Keys (if using AI features)
ANTHROPIC_API_KEY=your-anthropic-key
GEMINI_API_KEY=your-gemini-key
TWO_CAPTCHA_API_KEY=your-2captcha-key

# Monitoring
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# SQS Configuration (optional, has defaults)
SQS_VISIBILITY_TIMEOUT=600
SQS_MAX_MESSAGES=5
SQS_WAIT_TIME_SECONDS=20
SQS_MAX_CONSECUTIVE_ERRORS=10
SQS_RETRY_THRESHOLD=3

# Prefect Worker (optional)
ENABLE_PREFECT_WORKER=true
PREFECT_WORK_POOL=default
```

### How to Add Variables in Render

1. Go to your service dashboard
2. Click "Environment" tab
3. Click "Add Environment Variable"
4. Enter Key and Value
5. Click "Save Changes"
6. Service will restart automatically

---

## Service Architecture

The `start.sh` script runs multiple services in a single container:

```
┌─────────────────────────────────────┐
│     Render Container                │
│                                     │
│  ┌──────────────┐                   │
│  │ Brain Service│ :8080             │
│  │ (FastAPI)    │                   │
│  └──────────────┘                   │
│                                     │
│  ┌──────────────┐                   │
│  │ SQS          │                   │
│  │ Subscriber   │                   │
│  └──────────────┘                   │
│                                     │
│  ┌──────────────┐                   │
│  │ Prefect      │ (optional)        │
│  │ Worker       │                   │
│  └──────────────┘                   │
└─────────────────────────────────────┘
```

### Services Running

1. **Brain Service (FastAPI)**
   - Port: `8080` (configurable via `PORT` env var)
   - Endpoint: `/health` for health checks
   - Endpoint: `/plan` for CrewAI form mapping

2. **SQS Subscriber**
   - Polls AWS SQS queue for job messages
   - Triggers Prefect flows
   - Runs in background

3. **Prefect Worker** (optional)
   - Executes Prefect flow runs
   - Connects to Prefect Cloud or self-hosted server
   - Disable with `ENABLE_PREFECT_WORKER=false`

---

## Health Checks

Render automatically monitors your service using the health check endpoint.

### Health Check Endpoint

- **URL**: `http://your-service.onrender.com/health`
- **Method**: `GET`
- **Expected Response**: `200 OK` with `{"status": "healthy", "service": "brain"}`

### Configure Health Check

In Render dashboard:
- **Health Check Path**: `/health`
- **Health Check Interval**: 30 seconds (default)

### Manual Testing

```bash
curl https://your-service.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "brain"
}
```

---

## Troubleshooting

### Build Failures

**Error**: `failed to solve: failed to compute cache key`

**Solution**:
- Ensure `backend/Dockerfile` exists
- Check that `dockerContext` is set to `backend` in `render.yaml`
- Clear build cache in Render dashboard → Settings → Clear Build Cache

**Error**: `ModuleNotFoundError: No module named 'X'`

**Solution**:
- Verify `requirements.txt` includes all dependencies
- Check Dockerfile is installing from `requirements.txt`
- Rebuild without cache: Settings → Clear Build Cache

### Runtime Failures

**Error**: `Unable to locate credentials` (AWS)

**Solution**:
- Verify `AWS_DEFAULT_ACCESS_KEY_ID` and `AWS_DEFAULT_SECRET_ACCESS_KEY` are set
- Check AWS credentials are valid
- Ensure SQS queue URL is correct

**Error**: `SQS_QUEUE_URL environment variable not set`

**Solution**:
- Add `SQS_QUEUE_URL` environment variable in Render dashboard
- Format: `https://sqs.REGION.amazonaws.com/ACCOUNT_ID/QUEUE_NAME`

**Error**: `Brain Service health check failed`

**Solution**:
- Check logs for Brain service errors
- Verify `PORT` environment variable is set (defaults to 8080)
- Ensure no port conflicts

**Error**: `Prefect API connection failed`

**Solution**:
- Verify `PREFECT_API_URL` is correct
- If using Prefect Cloud, check `PREFECT_API_KEY` is valid
- If using self-hosted, ensure Prefect server is accessible

### Service Not Starting

**Symptoms**: Service shows "Unhealthy" in Render dashboard

**Diagnosis**:
1. Check logs: Dashboard → Logs tab
2. Look for error messages
3. Verify all required environment variables are set

**Common Fixes**:
- Restart service: Dashboard → Manual Deploy → Deploy latest commit
- Check environment variables are correct
- Verify external services (Supabase, AWS SQS) are accessible

### Performance Issues

**Symptoms**: Slow response times, timeouts

**Solutions**:
1. **Upgrade Plan**: Starter → Standard → Pro
2. **Optimize Dockerfile**: Use multi-stage builds
3. **Enable Caching**: Use Docker layer caching
4. **Monitor Logs**: Check for bottlenecks

---

## Cost Estimates

### Render Service Plans

| Plan | Price | RAM | CPU | Suitable For |
|------|-------|-----|-----|--------------|
| **Starter** | $7/month | 512 MB | Shared | Development, low traffic |
| **Standard** | $25/month | 2 GB | Shared | Production, moderate traffic |
| **Pro** | $85/month | 4 GB | Dedicated | High traffic, production |

### Additional Costs

- **AWS SQS**: ~$0.40 per million requests (very low cost)
- **Supabase**: Free tier available, Pro starts at $25/month
- **Prefect Cloud**: Free tier available, Pro starts at $20/month

### Estimated Monthly Costs

**Development Setup**:
- Render Starter: $7
- AWS SQS: <$1
- Supabase Free: $0
- Prefect Cloud Free: $0
- **Total**: ~$8/month

**Production Setup**:
- Render Standard: $25
- AWS SQS: ~$5-10 (depending on volume)
- Supabase Pro: $25
- Prefect Cloud Pro: $20 (optional)
- **Total**: ~$55-80/month

---

## Scaling

### Vertical Scaling (More Resources)

1. Go to Render dashboard → Your service
2. Click "Settings"
3. Change plan: Starter → Standard → Pro
4. Click "Save Changes"
5. Service will restart with new resources

### Horizontal Scaling (More Instances)

**Note**: Current setup runs multiple services in one container. For true horizontal scaling:

1. **Option A**: Deploy separate services
   - Brain Service: Separate Render service
   - Subscriber: Separate Render service
   - Worker: Separate Render service

2. **Option B**: Use Render's "Instance Count"
   - Settings → Instance Count → Increase to 2+
   - Each instance runs all services
   - Load balancer distributes traffic

### Recommended Scaling Strategy

- **Low Traffic** (<100 jobs/day): Starter plan, 1 instance
- **Medium Traffic** (100-1000 jobs/day): Standard plan, 1-2 instances
- **High Traffic** (>1000 jobs/day): Pro plan, 2+ instances, consider separate services

---

## Next Steps

1. ✅ Deploy to Render
2. ✅ Verify health checks pass
3. ✅ Test job processing
4. ✅ Set up monitoring (Slack alerts)
5. ✅ Configure custom domain (optional)
6. ✅ Set up CI/CD (optional)

---

## Support

- **Render Docs**: [render.com/docs](https://render.com/docs)
- **Render Status**: [status.render.com](https://status.render.com)
- **DirectoryBolt Issues**: GitHub Issues

---

**Last Updated**: 2025-01-02
