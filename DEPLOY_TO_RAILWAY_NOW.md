# 🚂 Deploy to Railway - Simple Steps

## ⚠️ IMPORTANT
Your Railway token: `50c24454-b4f8-4fce-8e2c-87e779b3425f`
**Keep this secret!** Don't share it publicly.

---

## 📋 Copy-Paste These Commands

### **Step 1: Install Railway CLI**

**On Windows (PowerShell):**
```powershell
npm i -g @railway/cli
```

**On Mac/Linux:**
```bash
npm i -g @railway/cli
```

---

### **Step 2: Set Your Railway Token**

**On Windows (PowerShell):**
```powershell
$env:RAILWAY_TOKEN="50c24454-b4f8-4fce-8e2c-87e779b3425f"
```

**On Mac/Linux:**
```bash
export RAILWAY_TOKEN="50c24454-b4f8-4fce-8e2c-87e779b3425f"
```

---

### **Step 3: Go to Your Project Folder**

```bash
cd Directory-Bolt-ALL-NEW
```

---

### **Step 4: Create Railway Project**

```bash
railway init
```

When it asks:
- Project name: Type `directory-bolt` and press Enter
- Just press Enter for other questions (use defaults)

---

### **Step 5: Deploy the Subscriber Service**

```bash
railway up --service subscriber
```

This will deploy your backend subscriber service.

---

### **Step 6: Set Environment Variables**

Copy-paste this **entire block** into your terminal:

**On Windows (PowerShell):**
```powershell
railway variables set SUPABASE_URL="https://kolgqfjgncdwddziqloz.supabase.co"
railway variables set NEXT_PUBLIC_SUPABASE_URL="https://kolgqfjgncdwddziqloz.supabase.co"
railway variables set SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbGdxZmpnbmNkd2RkemlxbG96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMTU3NTEwNywiZXhwIjoyMDM3MTUxMTA3fQ.mq7wtkh2q5HdpHlAJRxmfZYrUWqkOoVqxaO2EqX1_LE"
railway variables set AWS_DEFAULT_REGION="us-east-2"
railway variables set SQS_QUEUE_URL="https://sqs.us-east-2.amazonaws.com/231688741122/DirectoryBolt"
railway variables set SQS_DLQ_URL="https://sqs.us-east-2.amazonaws.com/231688741122/DirectoryBolt-dlq"
```

**⚠️ STOP HERE** - You need to add your AWS keys:

```powershell
railway variables set AWS_DEFAULT_ACCESS_KEY_ID="YOUR_AWS_KEY_HERE"
railway variables set AWS_DEFAULT_SECRET_ACCESS_KEY="YOUR_AWS_SECRET_HERE"
railway variables set ANTHROPIC_API_KEY="YOUR_ANTHROPIC_KEY_HERE"
```

Replace `YOUR_AWS_KEY_HERE`, `YOUR_AWS_SECRET_HERE`, and `YOUR_ANTHROPIC_KEY_HERE` with your actual keys.

---

### **Step 7: Redeploy with Variables**

```bash
railway up
```

---

### **Step 8: Check Logs**

```bash
railway logs
```

You should see your service starting without the Supabase error.

---

## 🎯 Alternative: Use Railway Dashboard (Easier!)

If the CLI is confusing, use the web dashboard instead:

1. Go to: https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose: `Rainking6693/Directory-Bolt-ALL-NEW`
5. Railway will ask which service to deploy
6. Choose **"Create service from Dockerfile"**
7. Set **Root Directory**: `backend`
8. Set **Dockerfile Path**: `infra/Dockerfile`
9. Click **"Add Variables"** and paste these:

```
SUPABASE_URL=https://kolgqfjgncdwddziqloz.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://kolgqfjgncdwddziqloz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbGdxZmpnbmNkd2RkemlxbG96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMTU3NTEwNywiZXhwIjoyMDM3MTUxMTA3fQ.mq7wtkh2q5HdpHlAJRxmfZYrUWqkOoVqxaO2EqX1_LE
AWS_DEFAULT_REGION=us-east-2
SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/231688741122/DirectoryBolt
SQS_DLQ_URL=https://sqs.us-east-2.amazonaws.com/231688741122/DirectoryBolt-dlq
AWS_DEFAULT_ACCESS_KEY_ID=(your key)
AWS_DEFAULT_SECRET_ACCESS_KEY=(your secret)
ANTHROPIC_API_KEY=(your key)
PREFECT_API_URL=http://localhost:4200/api
CREWAI_URL=http://localhost:8080
```

10. Click **"Deploy"**

---

## ✅ Success Check

Once deployed, go to your Railway dashboard and check:
- Service is **"Running"** (green)
- Logs show **"Starting SQS subscriber"** (not the Supabase error)

---

## ❓ What If It Still Doesn't Work?

**Option 1:** Use the Railway Dashboard (much easier)

**Option 2:** Tell me the exact error you're getting and I'll fix it

**Option 3:** Use a different host like Render or Fly.io
