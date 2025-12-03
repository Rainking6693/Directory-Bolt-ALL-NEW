# Python Worker Location & Status

## 📍 WHERE IS THE PYTHON WORKER?

### Worker Code Location:
**File:** `backend/workers/submission_runner.py`
**Purpose:** Playwright-based directory submission automation

### Current Deployment Status:

Based on your codebase, the Python worker was configured to deploy to **Render.com**:

**Historical Render Services (from `render.yaml`):**
1. **Brain Service** (`brain`) - FastAPI AI field mapping service
2. **Subscriber Service** (`subscriber`) - Polls SQS and triggers Prefect flows  
3. **Worker Service** (`worker`) - Playwright submission runner
4. **Monitor Service** (`monitor`) - Monitors for stale jobs

---

## 🔍 CHECK IF WORKER IS CURRENTLY RUNNING

### Option 1: Check Render Dashboard
1. Go to https://dashboard.render.com
2. Log in with your Render account
3. Look for services named:
   - `directory-bolt-worker` or `worker`
   - `directory-bolt-brain` or `brain`
   - `directory-bolt-subscriber` or `subscriber`

### Option 2: Check Worker Status via API
```bash
# If worker is running on Render, check health
curl https://directory-bolt-worker.onrender.com/health

# Or check brain service
curl https://brain.onrender.com/health
```

### Option 3: Check Supabase for Worker Heartbeats
```sql
-- Check if worker has sent recent heartbeats
SELECT * FROM worker_heartbeats 
WHERE last_heartbeat > NOW() - INTERVAL '10 minutes'
ORDER BY last_heartbeat DESC;
```

---

## ⚙️ WHAT THE PYTHON WORKER DOES

### Core Functionality:
```python
# backend/workers/submission_runner.py

1. Polls Supabase for pending jobs
2. Gets customer business data
3. Calls Motia Brain Service (/plan) for field mapping
4. Uses Playwright to:
   - Launch headless Chrome browser
   - Navigate to directory submission pages
   - Fill forms with business data
   - Handle captchas (if needed)
   - Submit forms
   - Take screenshots for verification
5. Updates Supabase with results
6. Sends heartbeats to track worker health
```

### Environment Variables Required:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-api03-...
GEMINI_API_KEY=... (optional)
PLAYWRIGHT_HEADLESS=1
```

---

## 🚀 HOW TO DEPLOY THE WORKER

### Option A: Deploy to Render.com (Original Setup)

**Using render.yaml:**
1. Worker configuration already exists in `render.yaml`
2. Push to GitHub
3. Connect Render to your GitHub repo
4. Render automatically deploys all services

**Manual Render Deployment:**
1. Go to https://dashboard.render.com
2. Click "New" → "Background Worker"
3. Connect your GitHub repo
4. Settings:
   - **Name:** directory-bolt-worker
   - **Environment:** Python 3.11
   - **Build Command:** `pip install -r backend/requirements.txt && playwright install chromium`
   - **Start Command:** `python backend/workers/submission_runner.py`
   - **Working Directory:** Leave blank or `backend/`
5. Add environment variables (see above)
6. Click "Create Background Worker"

---

### Option B: Deploy to Railway

```bash
cd backend
railway login
railway init
railway up
```

---

### Option C: Run Locally (For Testing)

```bash
cd backend

# Install dependencies
pip install -r requirements.txt
playwright install chromium

# Set environment variables
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export ANTHROPIC_API_KEY=...

# Run worker
python workers/submission_runner.py
```

**Note:** Worker will run continuously, polling Supabase every 30 seconds.

---

## 🔗 HOW WORKER CONNECTS TO MOTIA

### The Worker-Motia Connection:

```
1. Job Created
   → Customer purchases on website
   → Frontend calls Motia: POST /api/customer/submission
   → Motia creates job in Supabase (status='pending')

2. Worker Picks Up Job
   → Worker polls Supabase every 30 seconds
   → Finds job with status='pending'
   → Updates status to 'in_progress'

3. Worker Gets Field Mapping
   → Worker calls Motia Brain Service:
     POST https://cq60ji-dhzi0x.entone-u7811w1dpp.motia.cloud/plan
   → Motia returns AI-generated field mapping

4. Worker Submits to Directory
   → Uses Playwright with mapped fields
   → Takes screenshot
   → Verifies submission

5. Worker Updates Results
   → Writes to Supabase job_results table
   → Updates job progress
   → Logs to queue_history
```

**Key Point:** Worker needs Motia's API URL to call the Brain Service!

---

## ✅ UPDATE WORKER TO USE YOUR MOTIA URL

### Current Motia API Gateway:
```
https://cq60ji-dhzi0x.entone-u7811w1dpp.motia.cloud
```

### Worker Needs This Environment Variable:
```bash
BRAIN_SERVICE_URL=https://cq60ji-dhzi0x.entone-u7811w1dpp.motia.cloud/plan
# or just
API_BASE_URL=https://cq60ji-dhzi0x.entone-u7811w1dpp.motia.cloud
```

### Update Worker Code:
In `backend/workers/submission_runner.py`, find where it calls the brain service and update:

```python
# OLD (if it was using Render)
brain_url = "https://brain.onrender.com/plan"

# NEW (use Motia)
brain_url = os.getenv("BRAIN_SERVICE_URL", "https://cq60ji-dhzi0x.entone-u7811w1dpp.motia.cloud/plan")
```

Or in `backend/brain/client.py`:
```python
BRAIN_SERVICE_URL = os.getenv(
    "BRAIN_SERVICE_URL",
    "https://cq60ji-dhzi0x.entone-u7811w1dpp.motia.cloud/plan"
)
```

---

## 📊 CHECK IF WORKER IS PROCESSING JOBS

### Test 1: Check Supabase for Active Jobs
```sql
-- Look for jobs being processed
SELECT * FROM jobs 
WHERE status IN ('pending', 'in_progress')
ORDER BY created_at DESC;
```

### Test 2: Check Worker Heartbeats
```sql
-- Check if worker is alive
SELECT 
  worker_id,
  status,
  last_heartbeat,
  NOW() - last_heartbeat AS age
FROM worker_heartbeats
WHERE last_heartbeat > NOW() - INTERVAL '10 minutes';
```

### Test 3: Check Recent Results
```sql
-- See recent submissions
SELECT 
  jr.directory_name,
  jr.status,
  jr.created_at,
  j.customer_id
FROM job_results jr
JOIN jobs j ON jr.job_id = j.id
ORDER BY jr.created_at DESC
LIMIT 20;
```

---

## 🚨 IF WORKER IS NOT RUNNING

### Symptoms:
- Jobs stuck in 'pending' status
- No worker heartbeats in database
- No new job_results entries
- Staff dashboard shows no activity

### Solution:
1. **Deploy the worker** (see deployment options above)
2. **Set environment variables** (especially SUPABASE_URL and Motia API URL)
3. **Start the worker**
4. **Verify it's running** (check logs, heartbeats)

---

## 📝 NEXT STEPS

### 1. Determine Current Status:
- [ ] Check Render dashboard for existing worker services
- [ ] Check Supabase `worker_heartbeats` table for recent activity
- [ ] Check Supabase `jobs` table for stuck jobs

### 2. If Worker Is Running:
- [ ] Update it to use Motia API URL (not old Render brain service)
- [ ] Verify it can call Motia endpoints
- [ ] Test job processing end-to-end

### 3. If Worker Is NOT Running:
- [ ] Choose deployment platform (Render recommended)
- [ ] Deploy worker with correct environment variables
- [ ] Test it picks up jobs from Supabase
- [ ] Verify it calls Motia Brain Service

### 4. Verify Integration:
- [ ] Create test job via Motia API
- [ ] Watch worker pick it up
- [ ] See results in staff dashboard
- [ ] Confirm end-to-end flow works

---

## 🎯 SUMMARY

**Worker Location:** `backend/workers/submission_runner.py` (code)

**Original Deployment:** Render.com (configured in `render.yaml`)

**Current Status:** Unknown - need to check Render dashboard

**Connection to Motia:** Worker calls Motia Brain Service at `/plan` endpoint

**What You Need To Do:**
1. Check if worker is running on Render
2. If yes, update it to use new Motia URL
3. If no, deploy it (to Render, Railway, or run locally)
4. Verify it's processing jobs

**Motia URL to Use:**
```
https://cq60ji-dhzi0x.entone-u7811w1dpp.motia.cloud
```

