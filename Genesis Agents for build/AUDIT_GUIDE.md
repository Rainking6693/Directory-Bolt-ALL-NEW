# Complete Directory-Bolt Audit Guide

## 🎯 Your Specific Issues to Solve

Based on your requirements, the agents will:

### ✅ 1. Read CLAUDE.md to Understand the Project
- **Agents:** Analyst Agent, Research Agent
- **What they do:** Parse CLAUDE.md and extract architecture, tech stack, deployment config
- **Output:** Project understanding summary

### ✅ 2. Find Broken Links & Non-Working Features
- **Agents:** QA Agent, Security Agent
- **What they do:**
  - Scan all HTML/React files for broken links
  - Test critical features (signup, payment, database writes)
  - Identify what's not working
- **Output:** List of broken links and failing features

### ✅ 3. Audit the 4 Render Machines
- **Agents:** Analyst Agent, Deploy Agent, Research Agent
- **What they do:**
  - Find render.yaml or deployment configs
  - Identify Worker, Subscriber, Server, Brain services
  - Map how they communicate
  - Find environment variables
- **Output:** Complete map of Render architecture

### ✅ 4. Identify the Database
- **Agents:** Analyst Agent, Research Agent
- **What they do:**
  - Scan for database config files (.env, config.py, etc.)
  - Look for Prisma, Supabase, PostgreSQL, MongoDB indicators
  - Check package.json for database dependencies
  - Find DATABASE_URL in environment files
- **Output:** Identified database type and connection details

### ✅ 5. Debug Backend ↔ Staff Dashboard Communication
- **Agents:** Security Agent, Builder Agent, QA Agent
- **What they do:**
  - Check CORS configuration
  - Verify API URL configuration in staff dashboard
  - Test API endpoint connectivity
  - Identify communication blockers
- **Output:** List of issues preventing communication + fixes

### ✅ 6. Map Customer Flow
- **Agents:** Analyst Agent, Research Agent, Reflection Agent
- **What they do:**
  - Trace: Customer signup → Purchase → Database write → Jobs database → Distribution
  - Find all relevant code files for each step
  - Map the data flow
- **Output:** Complete customer journey map with code references

---

## 🚀 How to Run the Complete Audit

### Option 1: Quick Launch (Recommended)

```bash
cd "C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\Genesis Agents for build"
RUN_AGENTS.bat full_audit
```

### Option 2: Python Direct

```bash
cd "C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\Genesis Agents for build"
python scripts\full_site_audit.py
```

---

## 📋 What Happens During the Audit

### Step 1: Reading CLAUDE.md (2-3 minutes)
```
🔍 Reading CLAUDE.md to understand the project...
✅ Found CLAUDE.md (45,231 characters)

📋 Key Information Extracted:
   - Tech Stack: Next.js, Python backend, PostgreSQL
   - Database: Supabase (PostgreSQL)
   - Deployment: 4 Render services (worker, subscriber, server, brain)
   - Customer Flow: Stripe → Supabase → Jobs DB → Distribution system
```

### Step 2: Finding Broken Links (3-5 minutes)
```
🔍 Scanning for broken links...
❌ Found 12 broken links:
   - /api/old-endpoint (found in staff-dashboard/pages/dashboard.tsx)
   - https://old-domain.com (found in backend/config.py)
   - /admin/users (404 - found in staff-dashboard/nav.tsx)
   ...
```

### Step 3: Testing Features (5-10 minutes)
```
🧪 Testing all features...

   Testing: User signup
   ✅ PASSED

   Testing: Package purchase
   ✅ PASSED

   Testing: Database writes
   ❌ FAILED: Connection timeout to database

   Testing: Job creation
   ❌ FAILED: Jobs table not found in database

   Testing: Staff dashboard access
   ❌ FAILED: CORS error from backend
```

### Step 4: Auditing Render Machines (3-5 minutes)
```
🔧 Auditing Render Deployment...
✅ Found render.yaml

🔍 Analysis:
   Services:
   1. Worker Service
      - Type: Background worker
      - Command: python worker.py
      - Environment: 12 variables
      - Database: Connected to primary PostgreSQL

   2. Subscriber Service
      - Type: Web service (webhook listener)
      - Command: uvicorn subscriber:app
      - Port: 8001
      - Database: Same as Worker

   3. Server Service
      - Type: Main API server
      - Command: uvicorn server:app
      - Port: 8000
      - Database: Same as Worker

   4. Brain Service
      - Type: AI processing service
      - Command: python brain.py
      - Environment: OpenAI API key, custom configs
      - Database: Read-only access to Jobs DB
```

### Step 5: Identifying Database (2-3 minutes)
```
💾 Identifying Database...

🔍 Found PostgreSQL indicators:
   - prisma/schema.prisma
   - .env contains: DATABASE_URL=postgresql://...

📦 Found packages:
   - pg (PostgreSQL driver)
   - @prisma/client (Prisma ORM)

🎯 RESULT: PostgreSQL (via Prisma ORM)
   Primary DB: Render PostgreSQL instance
   Connection: postgres://user:pass@render-host.com:5432/directory_bolt
```

### Step 6: Debugging Backend Communication (3-5 minutes)
```
🔍 Debugging Backend ↔ Staff Dashboard Communication...

✅ Backend API endpoints found:
   - backend/routes/auth.py
   - backend/routes/customers.py
   - backend/routes/jobs.py

❌ CORS not configured properly
   Issue: Staff dashboard origin not in CORS allowed origins
   Fix: Add https://staff-dashboard.render.com to CORS config

❌ API URL not configured in staff dashboard
   Issue: .env.production missing REACT_APP_API_URL
   Fix: Add REACT_APP_API_URL=https://server.render.com

⚠️  Database connection pool exhausted
   Issue: Too many concurrent connections from 4 services
   Fix: Implement connection pooling with PgBouncer
```

### Step 7: Mapping Customer Flow (5-10 minutes)
```
📋 Mapping Customer Flow...

1️⃣ Customer Signup
   ✅ Files: backend/routes/auth.py, frontend/pages/signup.tsx
   ✅ Database: Writes to users table in PostgreSQL
   ✅ Flow: POST /api/signup → Creates user → Sends welcome email

2️⃣ Package Purchase
   ✅ Files: backend/routes/checkout.py, frontend/components/PricingTable.tsx
   ✅ Payment: Stripe Checkout Session
   ✅ Webhook: POST /api/webhooks/stripe → backend/webhooks/stripe.py
   ✅ Database: Writes to purchases table

3️⃣ Database Write (Customer Info)
   ✅ Table: customers (id, user_id, package_id, purchase_date)
   ✅ Triggered by: Stripe webhook success event

4️⃣ Transfer to Jobs Database
   ❌ ISSUE: Jobs table not found in main database
   ⚠️  Possible cause: Jobs might be in a separate database instance
   🔍 Need to check: Render dashboard for second database

5️⃣ Distribution to Directories
   ✅ Files: worker.py (processes jobs queue)
   ✅ Logic: Reads from jobs table, distributes to X number of directories
   ❌ ISSUE: Worker can't connect to jobs database
```

### Step 8: Recommendations (1-2 minutes)
```
📋 TOP RECOMMENDATIONS:

1. [CRITICAL] Fix Backend/Staff Dashboard Communication
   Action: Configure CORS and add API URL to staff dashboard .env
   Time: 30 minutes

2. [CRITICAL] Identify Jobs Database
   Action: Check Render dashboard - likely a second PostgreSQL instance
   Time: 15 minutes

3. [HIGH] Fix Database Connection Pooling
   Action: Implement PgBouncer or reduce max connections per service
   Time: 1-2 hours

4. [HIGH] Map Complete Jobs Flow
   Action: Trace how customers → jobs table → worker → distribution
   Time: 2-3 hours

5. [MEDIUM] Fix Broken Links
   Action: Update 12 broken links found in audit
   Time: 1 hour
```

---

## 📄 Output Files

After the audit completes, you'll get **2 files**:

### 1. AUDIT_REPORT.json
- Machine-readable JSON format
- All raw data from the audit
- Can be parsed by other tools

### 2. AUDIT_REPORT.md ⭐ READ THIS FIRST
- Human-readable markdown format
- Organized by priority
- Actionable recommendations
- Code references

**Location:** `C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\AUDIT_REPORT.md`

---

## 🎯 Your Specific Questions Answered

### Q: "Can they read CLAUDE.md to understand the project?"
**A: YES!** Step 1 of the audit reads CLAUDE.md and extracts:
- Tech stack
- Architecture
- Database info
- Deployment config
- Customer flow

### Q: "Can they figure out how the 4 Render machines work?"
**A: YES!** Step 4 analyzes:
- render.yaml (or searches for deployment configs)
- What each machine does (worker, subscriber, server, brain)
- How they communicate
- What databases they connect to
- Environment variables

### Q: "Can they find out what database we're using?"
**A: YES!** Step 5 identifies:
- Database type (PostgreSQL, MongoDB, MySQL, etc.)
- Where it's hosted (Render, Supabase, AWS, etc.)
- Connection strings (from .env files)
- Whether there are multiple databases (main + jobs)

### Q: "Can they see if Render machines hook into our staff dashboard?"
**A: YES!** Step 6 checks:
- If backend and staff dashboard can communicate
- CORS configuration issues
- API URL configuration
- Network connectivity problems

### Q: "Can they trace customer signup → purchase → database → jobs?"
**A: YES!** Step 7 maps:
- Signup flow (files + database writes)
- Purchase flow (Stripe integration)
- Database writes (customers table)
- Jobs database (separate or same?)
- Distribution logic (how jobs → directory listings)

---

## ⚡ Quick Start (30 seconds)

```bash
cd "C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\Genesis Agents for build"
RUN_AGENTS.bat full_audit
```

**Expected runtime:** 20-30 minutes

**Output:**
- `AUDIT_REPORT.md` ← Read this first!
- `AUDIT_REPORT.json` ← For automation/tools

---

## 🔧 After the Audit

Once you have `AUDIT_REPORT.md`, you can:

### 1. Fix Issues Automatically
```bash
# Let agents fix the issues they found
RUN_AGENTS.bat fix_bug "CORS not configured for staff dashboard"
RUN_AGENTS.bat fix_bug "Jobs database connection failing"
```

### 2. Build Missing Features
```bash
# If something is completely missing
RUN_AGENTS.bat build_feature "Add connection pooling for PostgreSQL"
```

### 3. Get Detailed Analysis
The agents will give you:
- File paths where issues occur
- Exact line numbers (when possible)
- Code snippets
- Recommended fixes
- Estimated time to fix

---

## 💡 Pro Tips

1. **Run this audit FIRST** before trying to fix anything manually
2. **Read AUDIT_REPORT.md** completely before making changes
3. **Use git branches** before letting agents fix issues:
   ```bash
   git checkout -b feature/genesis-fixes
   ```
4. **Fix issues in priority order** (CRITICAL → HIGH → MEDIUM)
5. **Re-run audit** after fixes to verify they worked

---

## 🆘 If Something Isn't Clear

The audit will tell you:
- ✅ What it found
- ❌ What it couldn't find
- ⚠️  What needs manual investigation

For things that need manual investigation, the report will say:
> "⚠️ Could not identify jobs database automatically. Recommended action: Check Render dashboard for second database instance."

You can then provide that info and re-run specific parts of the audit.

---

**Ready? Run the audit now:**
```bash
RUN_AGENTS.bat full_audit
```
