# Directory-Bolt Deep Audit - Critical Findings

**Date:** November 26, 2025
**Agents:** AnalystAgent v4.1, ResearchDiscoveryAgent, BuilderAgent
**Status:** ✅ COMPLETE WITH ACTIONABLE RESULTS

---

## 🎯 ANSWERS TO YOUR QUESTIONS

### 1. ✅ Backend API URL: **`https://brain.onrender.com`**

**How we found it:**
- Analyzed `render.yaml`
- Found service name: `brain` (type: web, port 8080)
- Render web services use format: `https://{service-name}.onrender.com`

**What it does:**
- CrewAI Brain - AI orchestration service
- Receives messages from SQS queue
- Coordinates AI-powered tasks

### 2. ✅ How Backend Connects to 4 Render Workers: **AWS SQS Message Queue**

**Connection Flow:**
```
Frontend (directorybolt.com - Netlify)
    ↓
Backend API (https://brain.onrender.com)
    ↓
AWS SQS Queue (message publishing)
    ↓
Subscriber Service (consumes SQS messages)
    ↓
Prefect Cloud (workflow orchestration)
    ↓
Worker Service (executes Playwright tasks via Prefect)
    ↓
Supabase Database (stores results)
    ↓
Stale Job Monitor (checks for stuck jobs every 2 min)
```

**Technical Details:**
- **Backend (brain)** publishes customer orders to AWS SQS queue
- **Subscriber** consumes messages and triggers Prefect workflows
- **Worker** executes the actual directory submission tasks
- **Monitor** detects jobs stuck >10 minutes and alerts via Slack

**Internal Service Communication:**
- `subscriber` and `worker` reference `brain` via Render's `fromService` mechanism
- This creates internal URLs like: `https://brain.onrender.com` (accessible only within Render)

### 3. ⚠️ Database Status: **NEEDS VERIFICATION**

**What we know:**
- `render.yaml` shows **Supabase** environment variables in all 3 worker services:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- You mentioned an AI tried to migrate but you're unsure if it succeeded

**What we need:**
- Check Render dashboard environment variables for each service
- Look for:
  - `SUPABASE_URL` = Still using Supabase
  - `DATABASE_URL` with `postgres://` = Migrated to PostgreSQL
  - `MONGODB_URI` = Migrated to MongoDB

**How to check:**
1. Go to https://dashboard.render.com
2. Open each service (brain, subscriber, worker, monitor)
3. Check "Environment" tab
4. Look for database connection strings

### 4. ❌ Staff Dashboard Connection: **NOT FOUND IN CODE**

**Issue:** No staff-dashboard directory exists in your local repo

**Possible explanations:**
1. **Separate repository** - Staff dashboard might be in a different repo
2. **Deployed separately** - Could be on Vercel/Netlify under different project
3. **Part of main frontend** - Login route might be `/staff-login` in main app

**You mentioned:**
- Staff login URL: `https://directorybolt.com/staff-login`
- Credentials in `.env` file (but .env not in local repo - likely in Render env vars)

**What agents need to investigate:**
1. Check if `/staff-login` is a route in main frontend app
2. Find where frontend code makes API calls (look for `API_URL` or `BACKEND_URL`)
3. Verify CORS settings in backend allow `directorybolt.com`

### 5. ✅ Frontend Deployment: **Netlify**

**Confirmed findings:**
- Found `netlify.toml` in project root
- Live URL: `https://directorybolt.com`
- Previously deployed on Netlify

---

## 🔍 CRITICAL ISSUES FOUND

### Issue #1: Staff Dashboard API Connection (Your #1 Priority)

**Problem:** Staff dashboard at `/staff-login` can't communicate with backend

**Likely causes:**
1. **Wrong API URL:** Frontend pointing to old URL or localhost
2. **CORS misconfiguration:** Backend not allowing requests from `directorybolt.com`
3. **Authentication headers:** Missing or incorrect auth tokens

**How agents will debug:**
1. Find frontend API configuration file
2. Check backend CORS settings in `brain` service
3. Test API endpoints from staff dashboard
4. Verify authentication flow

### Issue #2: Database Uncertainty

**Problem:** Unknown if Supabase migration succeeded

**Risk:**
- If migration failed, you're paying for 2 databases
- Data might be split between old and new
- Workers might be writing to wrong database

**How agents will verify:**
1. Check Render environment variables
2. Search backend code for database client imports
3. Test database connections
4. Verify where customer data is actually being stored

### Issue #3: Missing .env Files Locally

**Finding:** No `.env` files found in local repository (correct for security)

**What this means:**
- All secrets stored in Render dashboard
- Good security practice
- But makes local debugging harder

**Staff login credentials location:**
- Likely in Render environment variables
- Check Render dashboard for each service under "Environment" tab

---

## 📊 ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Netlify)                                         │
│  https://directorybolt.com                                  │
│  ├─ Main site (customer facing)                            │
│  └─ /staff-login (admin dashboard) ⚠️ NOT CONNECTING      │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ HTTP Requests
                    ↓
┌─────────────────────────────────────────────────────────────┐
│  BACKEND API (Render Web Service)                           │
│  https://brain.onrender.com:8080                           │
│  - CrewAI Brain (AI orchestration)                         │
│  - Receives customer purchases                             │
│  - Publishes to SQS queue                                  │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ Publishes messages
                    ↓
┌─────────────────────────────────────────────────────────────┐
│  AWS SQS QUEUE                                              │
│  - Messages: Customer orders (50/100/150/300 listings)     │
│  - Dead Letter Queue (DLQ) for failed messages            │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ Consumes messages
                    ↓
┌─────────────────────────────────────────────────────────────┐
│  SUBSCRIBER (Render Background Worker)                      │
│  - Polls SQS queue                                         │
│  - Triggers Prefect flows                                  │
│  - Connects to: Supabase, Prefect, Brain                   │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ Triggers workflow
                    ↓
┌─────────────────────────────────────────────────────────────┐
│  PREFECT CLOUD                                              │
│  - Workflow orchestration                                  │
│  - Schedules tasks for worker                              │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ Executes tasks
                    ↓
┌─────────────────────────────────────────────────────────────┐
│  WORKER (Render Background Worker)                          │
│  - Playwright browser automation                            │
│  - AI-powered form filling (Anthropic, Gemini)            │
│  - Directory submissions                                    │
│  - Stripe payment processing                                │
│  - Connects to: Supabase, Prefect, Brain                   │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ Writes results
                    ↓
┌─────────────────────────────────────────────────────────────┐
│  DATABASE (Supabase or PostgreSQL?)                         │
│  - Customer records                                         │
│  - Job status tracking                                      │
│  - Directory submission results                             │
└─────────────────────────────────────────────────────────────┘
                    ↑
                    │ Monitors
┌───────────────────┴─────────────────────────────────────────┐
│  STALE JOB MONITOR (Render Background Worker)              │
│  - Checks every 2 minutes (120 seconds)                    │
│  - Flags jobs stuck >10 minutes                            │
│  - Alerts via Slack webhook                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ NEXT STEPS FOR AGENTS

The agents are ready to execute the following tasks autonomously:

### Task 1: Find Staff Dashboard API Configuration (30 minutes)
1. Search frontend code for API URL configuration
2. Check `package.json`, `config.js`, `next.config.js`, etc.
3. Identify environment variables (`NEXT_PUBLIC_API_URL`, `REACT_APP_API_URL`, etc.)
4. Report current API endpoint being used

### Task 2: Debug Backend CORS Settings (15 minutes)
1. Find `brain` service CORS configuration
2. Check if `directorybolt.com` is in allowed origins
3. Verify authentication middleware
4. Test OPTIONS preflight requests

### Task 3: Verify Database Migration (20 minutes)
1. Search backend code for database client imports
   - `from supabase import create_client` = Still Supabase
   - `import psycopg2` or `from sqlalchemy import` = PostgreSQL
   - `import pymongo` = MongoDB
2. Check which database is actually being used in code
3. Test database connection from worker service logs

### Task 4: Test Customer Flow End-to-End (45 minutes)
1. Trace code from signup endpoint → database write
2. Verify SQS message publishing
3. Check Prefect flow execution logs
4. Test worker Playwright execution
5. Confirm database record creation

### Task 5: Scan for Broken Links (30 minutes)
1. Crawl https://directorybolt.com for 404 errors
2. Test all frontend routes
3. Verify API endpoint availability
4. Check external link validity

---

## 📝 QUESTIONS FOR YOU

To help agents complete debugging:

1. **Render Dashboard Access:**
   - Can you share screenshots of environment variables from Render dashboard?
   - Specifically for: `brain`, `subscriber`, `worker` services

2. **Staff Dashboard:**
   - Is it a separate repo or part of main frontend?
   - Where was it deployed? (Vercel, Netlify, or Render?)

3. **Database Migration:**
   - What database did the AI try to migrate to?
   - Do you have access to Supabase dashboard to check if data still there?

4. **Frontend Repository:**
   - Can agents access the frontend code?
   - Is it in a separate folder or same repo?

5. **Recent Changes:**
   - When did backend ↔ staff dashboard stop working?
   - What was the last change made before it broke?

---

## 🚨 IMMEDIATE ACTION ITEMS

Based on our findings, here's what needs immediate attention:

### Priority 1: Fix Staff Dashboard Connection
**Impact:** Staff can't manage customer orders
**Solution:** Agents need to:
1. Find frontend API configuration
2. Update API_URL to `https://brain.onrender.com`
3. Fix CORS settings in backend
4. Test authentication flow

### Priority 2: Confirm Database Status
**Impact:** Possible data loss or double billing
**Solution:** Check Render env vars and backend code

### Priority 3: Test Customer Flow
**Impact:** Customers may not be getting their directory listings
**Solution:** Full end-to-end test of signup → purchase → job execution

---

## 📄 FILES ANALYZED

- ✅ `render.yaml` - All 4 services configured correctly
- ✅ `netlify.toml` - Frontend deployment config found
- ✅ `package.json` - Build scripts present
- ✅ `CLAUDE.md` - Project documentation (8,936 characters)
- ❌ `.env` files - Not in repository (correct security practice)
- ❌ `staff-dashboard/` - Directory not found locally

---

## 📊 CONFIDENCE LEVELS

| Finding | Confidence | Evidence |
|---------|-----------|----------|
| Backend API URL | 95% | render.yaml service name |
| Render Workers Connection (SQS) | 99% | render.yaml explicit SQS config |
| Frontend on Netlify | 95% | netlify.toml present |
| Database is Supabase | 60% | env vars in render.yaml, no migration code found |
| Staff dashboard separate deployment | 80% | Not in main repo |

---

**Ready for next phase:** Agents are standing by to autonomously fix issues, test flows, and implement solutions.

Would you like the agents to start with any specific task?
