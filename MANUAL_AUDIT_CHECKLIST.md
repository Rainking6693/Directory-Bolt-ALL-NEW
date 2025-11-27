# Directory-Bolt Manual Audit Checklist

**Created:** November 25, 2025
**Purpose:** Answer all your questions about Render machines, database, backend/staff dashboard communication, and customer flow

---

## ❌ WHY THE AUTOMATED AUDIT FAILED

The Genesis agents require OpenAI/Anthropic API keys to run, which aren't configured in the Directory-Bolt environment. Instead, use this manual checklist to audit your system yourself.

---

## 🎯 YOUR 4 KEY QUESTIONS

### Question 1: How do the 4 Render machines work?
### Question 2: What database are we using now? (after Supabase transfer)
### Question 3: Why isn't backend communicating with staff dashboard?
### Question 4: How does customer flow work? (signup → purchase → DB → jobs → distribution)

---

## 📋 MANUAL AUDIT STEPS

### STEP 1: Find Render Configuration (Answers Question #1)

**Files to check:**
```bash
# Look for render.yaml
find . -name "render.yaml" -o -name "render.yml"

# OR check these common locations:
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\render.yaml
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\backend\render.yaml
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\.render\render.yaml
```

**What to look for in render.yaml:**
```yaml
services:
  - type: worker
    name: worker-service
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: python worker.py
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false

  - type: web
    name: subscriber-service
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn subscriber:app --host 0.0.0.0 --port $PORT

  - type: web
    name: server-service
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn server:app --host 0.0.0.0 --port $PORT

  - type: worker
    name: brain-service
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: python brain.py
```

**Questions to answer:**
- [ ] What is each service's `type`? (web = HTTP server, worker = background job)
- [ ] What is each service's `startCommand`?
- [ ] Do they all connect to the same `DATABASE_URL`?
- [ ] Are there any `CORS_ORIGIN` or `API_URL` environment variables?

**Expected roles:**
- **Worker**: Processes background jobs (customer distribution to directories)
- **Subscriber**: Listens for webhooks (Stripe payment notifications)
- **Server**: Main API server (backend for staff dashboard)
- **Brain**: AI processing (likely for job routing/optimization)

---

### STEP 2: Identify Database (Answers Question #2)

**Files to check:**
```bash
# Check .env files
cat .env
cat backend/.env
cat .env.production

# Check database config files
find . -name "database.py" -o -name "config.py" -o -name "prisma" -o -name "supabase"
```

**What to look for:**

**PostgreSQL indicators:**
```bash
# In .env or environment variables
DATABASE_URL=postgresql://user:password@host:5432/dbname
DATABASE_URL=postgres://user:password@host:5432/dbname

# Files that indicate PostgreSQL
find . -name "prisma" -type d
find . -name "*.prisma"
cat prisma/schema.prisma  # Look for datasource db { provider = "postgresql" }
```

**MongoDB indicators:**
```bash
# In .env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname
DATABASE_URL=mongodb://localhost:27017/dbname

# Files
find . -name "mongoose" -o -name "mongodb"
```

**Supabase indicators:**
```bash
# In .env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...

# Files
find . -name "supabase" -type d
cat supabase/config.toml
```

**Checklist:**
- [ ] What is the `DATABASE_URL` in `.env`?
- [ ] Is it PostgreSQL, MongoDB, MySQL, or Supabase?
- [ ] Are there TWO database URLs? (one for customers, one for jobs)
- [ ] What is the host? (localhost, render.com, supabase.co, mongodb.net, etc.)

---

### STEP 3: Debug Backend ↔ Staff Dashboard Communication (Answers Question #3)

**Files to check:**

**Backend CORS configuration:**
```bash
# Python (FastAPI/Flask)
find backend/ -name "main.py" -o -name "app.py" -o -name "server.py"
grep -r "CORS" backend/
grep -r "allow_origins" backend/

# Node.js (Express)
find backend/ -name "server.js" -o -name "index.js"
grep -r "cors" backend/
```

**Staff Dashboard API URL:**
```bash
# React/Next.js environment files
cat staff-dashboard/.env
cat staff-dashboard/.env.local
cat staff-dashboard/.env.production

# Check for API_URL or BACKEND_URL
grep -r "REACT_APP_API_URL" staff-dashboard/
grep -r "NEXT_PUBLIC_API_URL" staff-dashboard/
grep -r "VITE_API_URL" staff-dashboard/
```

**Common Issues to Check:**

**Issue #1: CORS not configured**
```python
# backend/main.py or app.py
from fastapi.middleware.cors import CORSMiddleware

# ❌ WRONG - Staff dashboard origin NOT in allowed origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Only localhost!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ CORRECT - Add staff dashboard production URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://staff-dashboard.render.com",  # ADD THIS
        "https://your-staff-dashboard-domain.com"  # ADD THIS
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Issue #2: Staff dashboard API URL not configured**
```bash
# staff-dashboard/.env.production
# ❌ WRONG - Using localhost in production
REACT_APP_API_URL=http://localhost:8000

# ✅ CORRECT - Using production server URL
REACT_APP_API_URL=https://server-service.render.com
```

**Issue #3: Render services not communicating**
```yaml
# render.yaml
services:
  - type: web
    name: server-service
    # ❌ WRONG - No internal URL exposed

  - type: web
    name: server-service
    # ✅ CORRECT - Internal URL for other services
    env: python
    plan: starter
    # Other services can access this via:
    # http://server-service:10000 (internal)
```

**Checklist:**
- [ ] Does backend CORS `allow_origins` include staff dashboard URL?
- [ ] Does staff dashboard `.env.production` have correct `API_URL`?
- [ ] Can you `curl` the backend API from browser? (check Network tab in DevTools)
- [ ] Are backend and staff dashboard on the same Render account? (for internal networking)

**Quick Test:**
```bash
# From browser console on staff dashboard
fetch('https://server-service.render.com/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)

# If you see CORS error in console:
# "Access to fetch at 'https://server...' from origin 'https://staff-dashboard...'
#  has been blocked by CORS policy"
# → Backend CORS not configured properly
```

---

### STEP 4: Map Customer Flow (Answers Question #4)

**Flow:** Customer signup → Purchase package → Database → Jobs database → Distribution

**Files to trace:**

**4.1 Customer Signup**
```bash
# Frontend signup form
find staff-dashboard/ -name "*signup*" -o -name "*register*"
cat staff-dashboard/pages/signup.tsx
cat staff-dashboard/components/SignupForm.tsx

# Backend signup endpoint
grep -r "signup\|register" backend/routes/
cat backend/routes/auth.py
```

**Questions:**
- [ ] What API endpoint handles signup? (e.g., `POST /api/signup`)
- [ ] What database table stores users? (e.g., `users` table)
- [ ] What fields are captured? (email, password, name, etc.)

**4.2 Package Purchase (Stripe)**
```bash
# Frontend pricing page
find staff-dashboard/ -name "*pricing*" -o -name "*checkout*"
cat staff-dashboard/pages/pricing.tsx

# Backend Stripe integration
grep -r "stripe\|checkout" backend/
cat backend/routes/checkout.py
cat backend/webhooks/stripe.py
```

**Questions:**
- [ ] What Stripe products exist? (50, 100, 150, 300 directory listings)
- [ ] What endpoint creates Stripe checkout session? (e.g., `POST /api/checkout`)
- [ ] What endpoint receives Stripe webhook? (e.g., `POST /api/webhooks/stripe`)

**4.3 Database Write (Customer Info)**
```bash
# Check database schema
cat prisma/schema.prisma
# OR
grep -r "CREATE TABLE" backend/migrations/

# Look for customers table
# Expected fields:
# - id (UUID or INT)
# - user_id (reference to users table)
# - package_id (50, 100, 150, or 300)
# - stripe_payment_id
# - purchase_date
# - status (active, completed, etc.)
```

**Questions:**
- [ ] What table stores customer purchases? (`customers` or `orders` or `purchases`)
- [ ] When does the Stripe webhook write to this table?
- [ ] What is the `package_id` field? (how is 50/100/150/300 stored?)

**4.4 Transfer to Jobs Database**
```bash
# THIS IS THE MYSTERY - Find where customers → jobs transfer happens

# Look for jobs table
grep -r "jobs\|job_queue\|tasks" backend/

# Check for database trigger or scheduled job
find backend/ -name "*cron*" -o -name "*scheduler*" -o -name "*worker.py"
cat backend/worker.py
cat backend/jobs/processor.py
```

**Critical questions:**
- [ ] Is there a `jobs` table in the same database? OR a separate database?
- [ ] What triggers the transfer? (Stripe webhook? Scheduled job? Manual trigger?)
- [ ] What fields does the jobs table have?
```sql
-- Expected jobs table schema
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  package_size INT,  -- 50, 100, 150, or 300
  directories_submitted INT DEFAULT 0,
  status VARCHAR,  -- pending, processing, completed
  created_at TIMESTAMP
);
```

**4.5 Distribution to Directories**
```bash
# Worker service processes jobs
cat backend/worker.py
cat backend/services/distribution.py

# Look for directory APIs
grep -r "submit.*directory\|post.*listing" backend/
```

**Questions:**
- [ ] How does worker.py fetch jobs? (database query? queue?)
- [ ] What external directory APIs are called?
- [ ] How is the package size (50/100/150/300) used to limit submissions?

**Expected flow:**
```
1. Stripe webhook → POST /api/webhooks/stripe
   ↓
2. Create customer record in `customers` table
   INSERT INTO customers (user_id, package_id, stripe_payment_id)
   ↓
3. Create job record in `jobs` table (FIND THIS STEP!)
   INSERT INTO jobs (customer_id, package_size, status='pending')
   ↓
4. Worker picks up job from `jobs` table
   SELECT * FROM jobs WHERE status='pending' LIMIT 1
   ↓
5. Worker submits to X directories (based on package_size)
   FOR i in range(package_size):
     submit_to_directory(customer_info, directory_api)
   ↓
6. Worker updates job status
   UPDATE jobs SET status='completed', directories_submitted=X
```

---

## 🔧 SPECIFIC FILES TO CHECK

Based on your description, check these files:

```bash
# Render configuration
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\render.yaml

# Database configuration
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\.env
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\backend\.env
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\backend\config.py
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\prisma\schema.prisma

# Backend API
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\backend\main.py
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\backend\app.py
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\backend\routes\auth.py
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\backend\routes\checkout.py
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\backend\webhooks\stripe.py

# Worker service
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\backend\worker.py
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\worker.py

# Subscriber service
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\backend\subscriber.py
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\subscriber.py

# Server service
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\backend\server.py
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\server.py

# Brain service
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\backend\brain.py
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\brain.py

# Staff dashboard
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\staff-dashboard\.env
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\staff-dashboard\.env.production
C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\staff-dashboard\src\config.js
```

---

## 📝 FILL IN YOUR ANSWERS

Once you check the files above, fill this out:

### Render Machines:
- **Worker service command:** `_____________________`
- **Subscriber service command:** `_____________________`
- **Server service command:** `_____________________`
- **Brain service command:** `_____________________`
- **All connect to same DATABASE_URL?** ☐ Yes ☐ No

### Database:
- **Type:** ☐ PostgreSQL ☐ MongoDB ☐ MySQL ☐ Supabase ☐ Other: _____
- **Host:** `_____________________`
- **DATABASE_URL in .env:** `_____________________`
- **Is there a second database for jobs?** ☐ Yes ☐ No

### Backend ↔ Staff Dashboard:
- **Backend CORS allow_origins:** `_____________________`
- **Staff dashboard API_URL:** `_____________________`
- **Can staff dashboard reach backend API?** ☐ Yes ☐ No
- **CORS error in browser console?** ☐ Yes ☐ No

### Customer Flow:
- **Signup endpoint:** `POST _____________________`
- **Checkout endpoint:** `POST _____________________`
- **Stripe webhook endpoint:** `POST _____________________`
- **Customers table name:** `_____________________`
- **Jobs table name:** `_____________________`
- **Where does customers → jobs transfer happen?** `_____________________`
- **Worker.py fetches jobs from:** ☐ Database ☐ Redis queue ☐ Other: _____

---

## 🚀 NEXT STEPS

1. **Read CLAUDE.md** in your Directory-Bolt repo (should explain architecture)
2. **Fill out this checklist** by checking the files listed above
3. **Share your answers** and I can help you fix the specific issues
4. **Fix CORS** if backend/staff dashboard aren't communicating
5. **Find the missing jobs transfer logic** if customers aren't getting distributed

---

**IMPORTANT:** The Genesis agents can't run without API keys. Use this manual checklist instead. Once you find the answers, I can help you write the actual code fixes.
