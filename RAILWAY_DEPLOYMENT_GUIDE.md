# 🚂 Railway Deployment Guide

## 📦 What You're Deploying

Your backend uses **docker-compose** with 6 services:
- **prefect-server**: Workflow orchestration
- **postgres**: Database for Prefect
- **subscriber**: SQS queue listener
- **worker**: Job executor with Playwright
- **brain**: CrewAI service
- **stale-job-monitor**: Monitors stuck jobs
- **dlq-monitor**: Monitors dead letter queue

---

## 🔧 Install Railway CLI

### **Windows**
```powershell
# Using npm (if you have Node.js)
npm i -g @railway/cli

# OR using Scoop
scoop install railway

# OR download .exe directly
# Visit: https://github.com/railwayapp/cli/releases
```

### **Mac**
```bash
# Using Homebrew
brew install railway

# OR using npm
npm i -g @railway/cli
```

### **Linux**
```bash
# Using npm
npm i -g @railway/cli

# OR using curl
curl -fsSL https://railway.app/install.sh | sh

# OR using cargo (if you have Rust)
cargo install railway-cli
```

### **Verify Installation**
```bash
railway --version
```

---

## 🚀 Deploy to Railway

### **Step 1: Login to Railway**
```bash
railway login
```
This will open your browser to authenticate.

### **Step 2: Create a New Project**
```bash
cd /path/to/Directory-Bolt-ALL-NEW
railway init
```
Follow the prompts:
- Project name: `directory-bolt-backend`
- Environment: `production`

### **Step 3: Link to GitHub (Recommended)**
Instead of deploying from CLI, link your GitHub repo:

```bash
railway link
```

Then go to Railway dashboard: https://railway.app/dashboard
- Select your project
- Click "New" → "GitHub Repo"
- Select: `Rainking6693/Directory-Bolt-ALL-NEW`
- Railway will auto-detect your docker-compose.yml

---

## ⚙️ Configure Services

Railway will create **separate services** for each container in docker-compose.yml.

### **Service 1: Prefect Server + Postgres**

**Create as one service:**
- Service name: `prefect-server`
- Dockerfile: `backend/infra/docker-compose.yml` (Railway will extract prefect-server)
- **Environment Variables:**
  ```bash
  PREFECT_SERVER_API_HOST=0.0.0.0
  PREFECT_API_DATABASE_CONNECTION_URL=postgresql+asyncpg://postgres:postgres@postgres.railway.internal:5432/prefect
  ```

### **Service 2: Subscriber**

- Service name: `subscriber`
- Dockerfile: `backend/infra/Dockerfile.subscriber`
- Root Directory: `backend`
- **Environment Variables:**
  ```bash
  # Supabase
  SUPABASE_URL=https://kolgqfjgncdwddziqloz.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<your-key>

  # AWS SQS
  AWS_DEFAULT_REGION=us-east-2
  AWS_DEFAULT_ACCESS_KEY_ID=<your-key>
  AWS_DEFAULT_SECRET_ACCESS_KEY=<your-secret>
  SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/231688741122/DirectoryBolt
  SQS_DLQ_URL=https://sqs.us-east-2.amazonaws.com/231688741122/DirectoryBolt-dlq

  # Prefect (use Railway internal URL)
  PREFECT_API_URL=http://prefect-server.railway.internal:4200/api

  # CrewAI (use Railway internal URL)
  CREWAI_URL=http://brain.railway.internal:8080
  ```

### **Service 3: Worker**

- Service name: `worker`
- Dockerfile: `backend/infra/Dockerfile.worker`
- Root Directory: `backend`
- **Environment Variables:** (same as subscriber, plus:)
  ```bash
  PLAYWRIGHT_HEADLESS=1
  ANTHROPIC_API_KEY=<your-key>
  ```

### **Service 4: Brain**

- Service name: `brain`
- Dockerfile: `backend/infra/Dockerfile.brain`
- Root Directory: `backend`
- **Environment Variables:**
  ```bash
  PORT=8080
  ```

---

## 🔐 Set Environment Variables via CLI

Instead of the dashboard, you can use CLI:

```bash
# Switch to your service
railway service

# Set variables
railway variables set SUPABASE_URL="https://kolgqfjgncdwddziqloz.supabase.co"
railway variables set AWS_DEFAULT_REGION="us-east-2"
railway variables set AWS_DEFAULT_ACCESS_KEY_ID="your-key"
# ... etc
```

Or upload from .env file:
```bash
cd backend
railway variables set --file .env
```

---

## 🚀 Deploy

### **Option A: Deploy from GitHub (Recommended)**
1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Configure Railway deployment"
   git push origin main
   ```

2. Railway will automatically deploy when you push

### **Option B: Deploy from CLI**
```bash
railway up
```

---

## 📊 Monitor Deployment

```bash
# View logs
railway logs

# Check status
railway status

# Open in browser
railway open
```

---

## ⚠️ Important Notes

### **Railway Internal Networking**

Services communicate using Railway's internal DNS:
- Format: `<service-name>.railway.internal:<port>`
- Examples:
  - `prefect-server.railway.internal:4200`
  - `brain.railway.internal:8080`
  - `postgres.railway.internal:5432`

### **Cost Estimates**

Railway pricing (as of 2025):
- **Hobby Plan**: $5/month + usage
- **Usage**: ~$0.000231/GB-hour RAM, ~$0.000463/vCPU-hour
- **Estimated**: $20-40/month for all services

### **Scaling**

Railway auto-scales based on:
- CPU usage
- Memory usage
- Request queue depth

Configure in dashboard: Settings → Autoscaling

---

## 🐛 Troubleshooting

### **"Module not found" errors**
```bash
# Ensure dockerfilePath is relative to repo root
# In railway.json: "dockerfilePath": "backend/infra/Dockerfile"
```

### **Services can't connect**
```bash
# Use Railway internal URLs:
PREFECT_API_URL=http://prefect-server.railway.internal:4200/api
# NOT: http://localhost:4200/api
```

### **Database connection fails**
```bash
# Railway provides DATABASE_URL automatically for postgres
# Or use: postgres.railway.internal:5432
```

---

## 📚 Useful Commands

```bash
# Link to existing project
railway link <project-id>

# Switch environments
railway environment

# Run command in Railway environment
railway run python manage.py migrate

# Generate Railway config
railway init

# Shell into running service
railway shell

# Disconnect from project
railway unlink
```

---

## 🔗 Resources

- Railway Docs: https://docs.railway.app
- Railway CLI: https://docs.railway.app/develop/cli
- Support: https://railway.app/discord

---

## ✅ Deployment Checklist

- [ ] Railway CLI installed
- [ ] Logged into Railway (`railway login`)
- [ ] GitHub repo connected
- [ ] Environment variables set for all services
- [ ] Supabase credentials added
- [ ] AWS credentials added
- [ ] Services deployed
- [ ] Logs checked for errors
- [ ] Test a job submission

---

**Need help? Check Railway logs:**
```bash
railway logs --service subscriber
railway logs --service worker
```
