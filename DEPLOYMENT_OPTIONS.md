# Python Backend Deployment Options

## 🎯 The Problem

Your Python backend (Prefect + Playwright + SQS subscriber) **MUST** run somewhere that can:
- Run long processes (5-30 minutes per job)
- Run Chromium browser (200MB+)
- Keep processes running 24/7
- Handle SQS queue polling

**Netlify CANNOT do this** - it has 10-second timeouts and no browser support.

## ✅ Deployment Options

### Option 1: Railway (Easiest - Recommended)

**Pros:**
- ✅ Easy setup (just connect GitHub repo)
- ✅ Automatic Docker builds
- ✅ Environment variables UI
- ✅ Free tier available ($5/month after)
- ✅ Auto-deploys on git push

**Steps:**
1. Go to https://railway.app
2. Create new project → "Deploy from GitHub repo"
3. Select your `Directory-Bolt-ALL-NEW` repo
4. Set root directory to `backend/infra`
5. Railway will auto-detect `docker-compose.yml`
6. Add environment variables:
   ```
   SUPABASE_URL=your-url
   SUPABASE_SERVICE_ROLE_KEY=your-key
   AWS_DEFAULT_REGION=us-east-1
   AWS_DEFAULT_ACCESS_KEY_ID=your-key
   AWS_DEFAULT_SECRET_ACCESS_KEY=your-secret
   SQS_QUEUE_URL=your-queue-url
   SQS_DLQ_URL=your-dlq-url
   PREFECT_API_URL=http://prefect-server:4200/api
   ```
7. Deploy!

**Cost:** ~$5-20/month depending on usage

---

### Option 2: Render (Similar to Railway)

**Pros:**
- ✅ Free tier available
- ✅ Easy Docker deployment
- ✅ Auto-deploys

**Steps:**
1. Go to https://render.com
2. New → Web Service
3. Connect GitHub repo
4. Set root directory: `backend/infra`
5. Build command: `docker-compose build`
6. Start command: `docker-compose up`
7. Add environment variables

**Cost:** ~$7-25/month

---

### Option 3: AWS EC2 (Most Control)

**Pros:**
- ✅ Full control
- ✅ Can run everything on one server
- ✅ Good for scaling later

**Cons:**
- ❌ More complex setup
- ❌ Need to manage server yourself

**Steps:**
1. Launch EC2 instance (t3.medium or larger)
2. Install Docker & Docker Compose
3. Clone repo: `git clone your-repo`
4. `cd backend/infra`
5. Copy `.env` file
6. `docker-compose up -d`
7. Set up auto-restart on reboot

**Cost:** ~$15-50/month

---

### Option 4: DigitalOcean Droplet (VPS)

**Pros:**
- ✅ Simple VPS
- ✅ Good documentation
- ✅ Predictable pricing

**Steps:**
1. Create Droplet (4GB RAM minimum)
2. Install Docker
3. Clone repo and run `docker-compose up -d`

**Cost:** ~$12-24/month

---

### Option 5: Fly.io (Good for Docker)

**Pros:**
- ✅ Designed for Docker
- ✅ Global edge deployment
- ✅ Free tier

**Steps:**
1. Install Fly CLI
2. `fly launch` in `backend/infra`
3. Configure environment variables
4. Deploy

**Cost:** ~$5-15/month

---

## 🚀 Recommended: Railway (Easiest)

For your use case, **Railway is the best choice** because:
1. ✅ Zero DevOps knowledge needed
2. ✅ Auto-detects Docker Compose
3. ✅ Easy environment variable management
4. ✅ Auto-deploys on git push
5. ✅ Good documentation
6. ✅ Reasonable pricing

## 📋 Quick Railway Setup

1. **Create Railway account**: https://railway.app
2. **New Project** → Deploy from GitHub
3. **Select repo**: `Directory-Bolt-ALL-NEW`
4. **Set root directory**: `backend/infra`
5. **Add environment variables** (from your `.env` file)
6. **Deploy** → Railway builds and runs Docker Compose automatically

That's it! Your backend will be live in ~5 minutes.

## 🔍 What Gets Deployed

Railway will run these services from `docker-compose.yml`:
- ✅ Prefect server (orchestration)
- ✅ Subscriber (SQS → Prefect)
- ✅ Worker (Playwright execution)
- ✅ Brain service (CrewAI)
- ✅ Stale job monitor
- ✅ DLQ monitor

## ⚠️ Important Notes

### Environment Variables Needed:
```
# Supabase
SUPABASE_URL=your-url
SUPABASE_SERVICE_ROLE_KEY=your-key

# AWS SQS
AWS_DEFAULT_REGION=us-east-1
AWS_DEFAULT_ACCESS_KEY_ID=your-key
AWS_DEFAULT_SECRET_ACCESS_KEY=your-secret
SQS_QUEUE_URL=your-queue-url
SQS_DLQ_URL=your-dlq-url

# Prefect
PREFECT_API_URL=http://prefect-server:4200/api
CREWAI_URL=http://brain:8080

# AI Services (optional)
ANTHROPIC_API_KEY=your-key
GEMINI_API_KEY=your-key
```

### Network Access:
- Railway services can talk to each other (internal network)
- Prefect UI will be available at: `https://your-project.railway.app:4200`
- Make sure SQS queue is accessible from Railway's IP ranges

### Prefect Deployment:
After Railway deploys, you still need to:
1. SSH into Railway container OR use Railway shell
2. Run: `cd /app/orchestration && prefect deployment build flows.py:process_job -n production`
3. Run: `prefect deployment apply process_job-deployment.yaml`

OR create a startup script that does this automatically.

## 🎯 Bottom Line

**YES, you need to deploy the Python backend somewhere.**

Railway is the easiest option - just connect GitHub and deploy. The free tier is enough to test, then ~$5-20/month for production.

**Without deploying the backend:**
- Jobs will be sent to SQS ✅
- But nothing will process them ❌
- Jobs will stay "pending" forever ❌

**After deploying:**
- Jobs sent to SQS ✅
- Subscriber picks them up ✅
- Prefect flows run ✅
- Real submissions happen ✅

