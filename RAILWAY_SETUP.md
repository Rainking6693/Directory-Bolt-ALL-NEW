# Railway Deployment - ACTUAL Setup Instructions

## ✅ What You Actually Have

Your project structure:
```
Directory-Bolt-ALL-NEW/
├── backend/
│   ├── infra/
│   │   ├── docker-compose.yml  ← This is what Railway needs
│   │   ├── Dockerfile.brain
│   │   ├── Dockerfile.subscriber
│   │   ├── Dockerfile.worker
│   │   └── Dockerfile.monitor
│   ├── orchestration/
│   ├── workers/
│   ├── brain/
│   └── requirements.txt
```

## 🚀 Railway Setup (Step-by-Step)

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub (easiest)

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Find and select your `Directory-Bolt-ALL-NEW` repository

### Step 3: Configure Service
**IMPORTANT:** Railway needs to know where your docker-compose.yml is.

1. After connecting repo, Railway will ask "What do you want to deploy?"
2. Select "Empty Service" (we'll configure manually)
3. Click on the service to configure it

### Step 4: Set Root Directory
1. In service settings, find "Root Directory"
2. Set it to: `backend/infra`
3. This tells Railway where your `docker-compose.yml` is

### Step 5: Configure Build
1. In service settings, find "Build Command"
2. Leave it empty (Railway will auto-detect docker-compose.yml)

### Step 6: Configure Start Command
1. In service settings, find "Start Command"
2. Set it to: `docker-compose up -d`

**OR** Railway might auto-detect this. If it does, leave it.

### Step 7: Add Environment Variables
Click "Variables" tab and add ALL of these:

```bash
# Supabase
SUPABASE_URL=your-url
SUPABASE_SERVICE_ROLE_KEY=your-key

# AWS SQS
AWS_DEFAULT_REGION=us-east-1
AWS_DEFAULT_ACCESS_KEY_ID=your-key
AWS_DEFAULT_SECRET_ACCESS_KEY=your-secret
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/your-queue
SQS_DLQ_URL=https://sqs.us-east-1.amazonaws.com/123456789/your-dlq

# Prefect (internal - Railway will handle networking)
PREFECT_API_URL=http://prefect-server:4200/api
CREWAI_URL=http://brain:8080

# AI Services (optional)
ANTHROPIC_API_KEY=your-key
GEMINI_API_KEY=your-key
TWO_CAPTCHA_API_KEY=your-key

# Monitoring
STALE_THRESHOLD_MINUTES=10
CHECK_INTERVAL_SECONDS=120
DLQ_CHECK_INTERVAL_SECONDS=300
DLQ_ALERT_THRESHOLD=1

# Slack (optional)
SLACK_WEBHOOK_URL=your-webhook-url
```

### Step 8: Deploy
1. Click "Deploy" button
2. Railway will:
   - Build all Docker images
   - Run docker-compose up
   - Start all services

### Step 9: Check Logs
1. Click on your service
2. Go to "Logs" tab
3. Watch for:
   - ✅ "Prefect server started"
   - ✅ "Subscriber connected to SQS"
   - ✅ "Worker started"
   - ✅ "Brain service running"

### Step 10: Deploy Prefect Flow
After Railway deploys, you need to deploy the Prefect flow:

1. Click "Connect" button in Railway service
2. Or use Railway CLI: `railway connect`
3. Run these commands:
```bash
cd backend/orchestration
python -m prefect deployment build flows.py:process_job -n production -q default
prefect deployment apply process_job-deployment.yaml
```

## ⚠️ Potential Issues & Fixes

### Issue 1: Railway doesn't recognize docker-compose.yml
**Fix:** Make sure Root Directory is set to `backend/infra`

### Issue 2: Build fails with "context: .." error
**Fix:** Railway handles this automatically. The Dockerfiles use `context: ..` which means they build from the `backend/` directory, which Railway will handle correctly.

### Issue 3: Services can't talk to each other
**Fix:** Railway uses internal networking. Services can reach each other via service names:
- `prefect-server:4200`
- `brain:8080`
- `postgres:5432`

### Issue 4: Prefect UI not accessible
**Fix:** 
1. Railway exposes ports automatically
2. Find your service URL in Railway dashboard
3. Prefect UI will be at: `https://your-service.railway.app` (port 4200)

## 📋 What Gets Deployed

Railway will run these services from docker-compose.yml:
1. ✅ **prefect-server** - Orchestration UI
2. ✅ **postgres** - Prefect database
3. ✅ **brain** - CrewAI service
4. ✅ **subscriber** - SQS → Prefect trigger
5. ✅ **worker** - Playwright executor
6. ✅ **stale-job-monitor** - Job recovery
7. ✅ **dlq-monitor** - Failure alerts

## 🔍 Verify It's Working

1. **Check Railway logs** - All services should show "Up"
2. **Check Prefect UI** - Should be accessible at Railway URL
3. **Test SQS** - Create a test job, verify subscriber picks it up
4. **Check Supabase** - Jobs should change from "pending" → "in_progress" → "completed"

## 💰 Pricing

- **Free tier:** $5 credit/month
- **After free tier:** ~$5-20/month depending on usage
- **Pricing based on:** CPU, RAM, network usage

## 🆘 Need Help?

If Railway deployment fails:
1. Check logs in Railway dashboard
2. Common issues:
   - Missing environment variables
   - Wrong root directory
   - Docker build failing
   - Network connectivity issues

## ✅ That's It!

Once deployed, your backend will:
- ✅ Process jobs from SQS
- ✅ Run Prefect flows
- ✅ Execute real Playwright submissions
- ✅ Monitor stale jobs
- ✅ Alert on failures

**No more mock processing!**

