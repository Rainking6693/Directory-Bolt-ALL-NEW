# Staff Dashboard - Complete Connection Map

**Motia API Gateway:** `https://cq60ji-dhzi0x.entone-u7811w1dpp.motia.cloud`  
**Status:** ✅ LIVE

---

## 🎯 OVERVIEW

Your staff dashboard has **7 tabs**, each calling different API endpoints. Here's the complete map of what needs to be connected.

---

## 📋 TAB-BY-TAB BREAKDOWN

### **TAB 1: Queue (Customer Queue)**
**Component:** `RealTimeQueue.tsx`

**API Endpoints Called:**
| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/staff/queue` | GET | Get pending customers | ⚠️ NEEDS MOTIA |
| `/api/staff/jobs/push-to-autobolt` | POST | Push job to AutoBolt | ⚠️ NEEDS MOTIA |
| `/api/staff/jobs/reset` | POST | Reset job status | ⚠️ NEEDS MOTIA |
| `/api/staff/customers/delete` | POST | Delete test customer | ⚠️ NEEDS MOTIA |
| `/api/staff/customers/create` | POST | Create test customer | ⚠️ NEEDS MOTIA |

**What It Shows:**
- List of customers in queue
- Package type (Starter, Growth, Professional, Enterprise)
- Time in queue
- Actions: Push to AutoBolt, Reset, Delete

**Current Connection:**
```typescript
// Line 119 in RealTimeQueue.tsx
const response = await authFetch("/api/staff/queue");
```

**Needs to Connect To:**
- Motia: `GET /api/staff/jobs?status=pending`
- Or: Netlify Function at `/api/staff/queue`

---

### **TAB 2: Jobs (Job Progress Monitor)**
**Component:** `JobProgressMonitor.tsx`

**API Endpoints Called:**
| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/staff/jobs/progress` | GET | Get active jobs with progress | ⚠️ NEEDS MOTIA |

**What It Shows:**
- Active jobs being processed
- Progress bars (e.g., "15/50 - 30%")
- Customer info
- Time elapsed
- Real-time updates

**Current Connection:**
```typescript
// In JobProgressMonitor.tsx
const response = await fetch('/api/staff/jobs/progress');
```

**Needs to Connect To:**
- Motia: `GET /api/staff/jobs/active`
- Returns jobs with `status IN ('pending', 'in_progress')`

---

### **TAB 3: Analytics (Real-Time Analytics)**
**Component:** `RealTimeAnalytics.tsx`

**API Endpoints Called:**
| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/staff/analytics` | GET | Get system statistics | ⚠️ NEEDS MOTIA |
| `/api/staff/analytics?detail={key}` | GET | Get detailed stats for metric | ⚠️ NEEDS MOTIA |

**What It Shows:**
- Total jobs: 1,234
- Pending: 45
- In Progress: 12
- Completed: 1,150
- Failed: 27
- Success rate: 96%
- Average completion time
- Charts and graphs

**Current Connection:**
```typescript
// Line 65 in RealTimeAnalytics.tsx
const response = await fetch("/api/staff/analytics", { credentials: 'include' });
```

**Needs to Connect To:**
- Motia: `GET /api/staff/stats`
- Aggregates data from Supabase `jobs` table

---

### **TAB 4: AutoBolt (AutoBolt Monitor)**
**Component:** `AutoBoltQueueMonitor.tsx`

**API Endpoints Called:**
| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/staff/auth-check` | GET | Verify staff authentication | ✅ EXISTS |
| `/api/staff/autobolt-queue` | GET | Get AutoBolt queue status | ⚠️ NEEDS MOTIA |
| `/api/staff/jobs/push-to-autobolt` | POST | Manually push job to AutoBolt | ⚠️ NEEDS MOTIA |

**What It Shows:**
- AutoBolt queue status
- Jobs being processed by automation
- Worker health indicators
- Manual override options

**Current Connection:**
```typescript
// Line 210 in AutoBoltQueueMonitor.tsx
const response = await fetch(
  `${baseApiUrl}/api/staff/autobolt-queue`,
  { credentials: 'include' }
);
```

**Needs to Connect To:**
- Motia: `GET /api/staff/workers/status` (NEW - needs to be added)
- Queries `worker_heartbeats` table

---

### **TAB 5: Activity (Submission Logs)**
**Component:** `SubmissionLogsWidget.tsx`

**API Endpoints Called:**
| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/staff/submission-logs` | GET | Get recent submission activity | ⚠️ NEEDS MOTIA |

**What It Shows:**
- Real-time feed of submissions
- Customer name
- Directory submitted to
- Status (Success/Failed)
- Timestamp
- Submission URL
- Screenshot link

**Current Connection:**
```typescript
// Line 30 in SubmissionLogsWidget.tsx
const res = await fetch(`/api/staff/submission-logs?${params.toString()}`, { credentials: 'include' })
```

**Needs to Connect To:**
- Motia: `GET /api/staff/submissions/recent?limit=100` (NEW - needs to be added)
- Queries `job_results` table with joins to `jobs` and `customers`

---

### **TAB 6: 2FA Queue (Manual Review Queue)**
**Component:** `TwoFAQueueWidget.tsx`

**API Endpoints Called:**
| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/staff/2fa-queue` | GET | Get submissions needing manual review | ⚠️ NEEDS MOTIA |
| `/api/staff/jobs/resume` | POST | Resume job after manual intervention | ⚠️ NEEDS MOTIA |

**What It Shows:**
- Submissions that hit captchas
- Submissions needing 2FA
- Submissions requiring manual verification
- "Complete Manually" button
- Upload proof option

**Current Connection:**
```typescript
// Line 29 in TwoFAQueueWidget.tsx
const res = await fetch('/api/staff/2fa-queue', { credentials: 'include' })
```

**Needs to Connect To:**
- Motia: `GET /api/staff/submissions/manual-review` (NEW - needs to be added)
- Queries `job_results WHERE status='requires_manual'`

---

### **TAB 7: Settings (Directory Settings)**
**Component:** `DirectorySettings.tsx`

**API Endpoints Called:**
| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/staff/directory-settings` | GET | Get all directories | ⚠️ NEEDS MOTIA |
| `/api/staff/directory-overrides/save` | POST | Save directory configuration | ⚠️ NEEDS MOTIA |

**What It Shows:**
- List of all 500+ directories
- Enable/disable toggle for each
- Edit directory URLs
- Success rate per directory
- Add new directory button

**Current Connection:**
```typescript
// Line 14 in DirectorySettings.tsx
const res = await fetch('/api/staff/directory-settings', { credentials: 'include' })
```

**Needs to Connect To:**
- Motia: `GET /api/staff/directories` (NEW - needs to be added)
- Queries `directories` table

---

## 🔌 CURRENT API ARCHITECTURE

### What Exists Now:

**Netlify Functions (in `/pages/api/staff/`):**
```
✅ /api/staff/auth-check.ts
✅ /api/staff/login.ts
✅ /api/staff/logout.ts
✅ /api/staff/queue.ts
✅ /api/staff/analytics.ts
✅ /api/staff/submission-logs.ts
✅ /api/staff/2fa-queue.ts
✅ /api/staff/directory-settings.ts
✅ /api/staff/create-test-customer.ts
✅ /api/staff/jobs/progress.ts
✅ /api/staff/jobs/push-to-autobolt.ts
✅ /api/staff/jobs/reset.ts
✅ /api/staff/jobs/resume.ts
✅ /api/staff/customers/create.ts
✅ /api/staff/customers/delete.ts
✅ /api/staff/directory-overrides/save.ts
✅ /api/staff/autobolt-queue.ts
```

**Motia Backend (in `/Directory Bolt Motia/steps/api/`):**
```
✅ staffDashboard.step.ts (handles /api/staff/*)
   - /api/staff/jobs
   - /api/staff/jobs/active
   - /api/staff/jobs/{jobId}/results
   - /api/staff/jobs/{jobId}/history
   - /api/staff/stats
   
❌ Missing endpoints (need to add):
   - /api/staff/submissions/recent
   - /api/staff/workers/status
   - /api/staff/directories
   - /api/staff/submissions/manual-review
```

---

## 🎯 CONNECTION OPTIONS

### **Option 1: Use Netlify Functions (Current Setup)**

**Pros:**
- Already deployed and working
- No additional setup needed
- Functions already connect to Supabase

**Cons:**
- Duplicates logic between Netlify and Motia
- Not using Motia's capabilities
- More maintenance burden

**How It Works:**
```
Frontend → Netlify Functions → Supabase
```

**Status:** ✅ Should work NOW (after Netlify rebuild)

---

### **Option 2: Switch to Motia (Recommended)**

**Pros:**
- Centralized API layer
- Cleaner architecture
- Better monitoring
- Easier to maintain

**Cons:**
- Need to update frontend API URLs
- Need to add missing endpoints to Motia

**How It Works:**
```
Frontend → Motia API → Supabase
```

**Required Changes:**

1. **Update Frontend API Base URL:**
```typescript
// In your Next.js app
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cq60ji-dhzi0x.entone-u7811w1dpp.motia.cloud';

// Update all fetch calls:
fetch(`${API_BASE_URL}/api/staff/queue`)
```

2. **Add Missing Endpoints to Motia:**
```typescript
// In Directory Bolt Motia/steps/api/staffDashboard.step.ts

// Add these routes:
else if (requestPath === '/api/staff/submissions/recent') {
  const { limit = 100 } = queryParams;
  const { data, error } = await supabase
    .from('job_results')
    .select('*, jobs!inner(customer_id, customers!inner(business_name))')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  return { status: 200, body: { submissions: data } };
}

else if (requestPath === '/api/staff/workers/status') {
  const { data, error } = await supabase
    .from('worker_heartbeats')
    .select('*')
    .gte('last_heartbeat', new Date(Date.now() - 10 * 60 * 1000).toISOString());
  
  return { status: 200, body: { workers: data } };
}

else if (requestPath === '/api/staff/directories') {
  const { data, error } = await supabase
    .from('directories')
    .select('*')
    .order('name', { ascending: true });
  
  return { status: 200, body: { directories: data } };
}

else if (requestPath === '/api/staff/submissions/manual-review') {
  const { data, error } = await supabase
    .from('job_results')
    .select('*, jobs!inner(customer_id, customers!inner(business_name))')
    .in('status', ['requires_manual', 'captcha_failed', '2fa_required'])
    .order('created_at', { ascending: true });
  
  return { status: 200, body: { submissions: data } };
}
```

3. **Redeploy Motia:**
```bash
cd "Directory Bolt Motia"
npx motia deploy
```

---

### **Option 3: Hybrid Approach (Easiest for Now)**

**Use Netlify Functions for now, migrate to Motia later**

**Pros:**
- No changes needed immediately
- Dashboard works right away
- Can migrate gradually

**Cons:**
- Temporary solution
- Still have duplication

**How It Works:**
```
Frontend → Netlify Functions → Supabase
           (for staff dashboard)

Frontend → Motia → Supabase  
           (for customer portal & brain service)
```

**Status:** ✅ This should work NOW

---

## 🔍 PYTHON WORKER CONNECTION

### Where Worker Comes From:
**Location:** `backend/workers/submission_runner.py`

**Deployment:** Configured in `render.yaml` for Render.com

**Services Defined:**
1. **brain** - Web service (AI field mapping)
2. **subscriber** - Background worker (SQS polling)
3. **worker** - Background worker (Playwright submissions) ← THIS IS IT
4. **stale-job-monitor** - Background worker (monitors stuck jobs)

### How Worker Connects:

```
1. Worker polls Supabase for pending jobs
   ↓
2. Finds job with status='pending'
   ↓
3. Calls Motia Brain Service:
   POST https://cq60ji-dhzi0x.entone-u7811w1dpp.motia.cloud/plan
   ↓
4. Gets AI field mapping
   ↓
5. Uses Playwright to submit
   ↓
6. Updates Supabase with results
   ↓
7. Staff dashboard reads from Supabase (via Netlify or Motia)
```

### Worker Environment Variables Needed:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
BRAIN_SERVICE_URL=https://cq60ji-dhzi0x.entone-u7811w1dpp.motia.cloud/plan
ANTHROPIC_API_KEY=sk-ant-...
PLAYWRIGHT_HEADLESS=1
```

---

## ✅ IMMEDIATE ACTION ITEMS

### 1. Check if Worker is Running on Render
```bash
# Go to https://dashboard.render.com
# Look for services:
# - directory-bolt-worker
# - directory-bolt-brain
# - directory-bolt-subscriber
```

### 2. Test Staff Dashboard (After Netlify Rebuild)
```bash
# 1. Go to https://directorybolt.com/staff-login
# 2. Login with: staffuser / DirectoryBoltStaff2025!
# 3. Click through all 7 tabs
# 4. Note which ones work vs show errors
```

### 3. Check Browser Console for API Errors
```javascript
// Open DevTools (F12)
// Go to Console tab
// Look for failed fetch() calls
// Note the endpoints that are failing
```

### 4. Verify Supabase Has Data
```sql
-- Check for jobs
SELECT COUNT(*) FROM jobs;

-- Check for recent activity
SELECT * FROM job_results ORDER BY created_at DESC LIMIT 10;

-- Check for worker heartbeats
SELECT * FROM worker_heartbeats ORDER BY last_heartbeat DESC LIMIT 5;
```

---

## 📊 CONNECTION STATUS SUMMARY

| Component | Endpoint | Netlify Function | Motia Endpoint | Status |
|-----------|----------|------------------|----------------|--------|
| Queue Tab | `/api/staff/queue` | ✅ EXISTS | ✅ EXISTS | ⚠️ NEEDS TESTING |
| Jobs Tab | `/api/staff/jobs/progress` | ✅ EXISTS | ✅ EXISTS | ⚠️ NEEDS TESTING |
| Analytics Tab | `/api/staff/analytics` | ✅ EXISTS | ✅ EXISTS | ⚠️ NEEDS TESTING |
| AutoBolt Tab | `/api/staff/autobolt-queue` | ✅ EXISTS | ❌ MISSING | ⚠️ ADD TO MOTIA |
| Activity Tab | `/api/staff/submission-logs` | ✅ EXISTS | ❌ MISSING | ⚠️ ADD TO MOTIA |
| 2FA Tab | `/api/staff/2fa-queue` | ✅ EXISTS | ❌ MISSING | ⚠️ ADD TO MOTIA |
| Settings Tab | `/api/staff/directory-settings` | ✅ EXISTS | ❌ MISSING | ⚠️ ADD TO MOTIA |

**Python Worker** | Polls Supabase | N/A | Calls `/plan` | ⚠️ CHECK RENDER |

---

## 🎯 RECOMMENDED APPROACH

### **Phase 1: Get Dashboard Working (TODAY)**
1. Fix Netlify 404 errors (rebuild)
2. Test staff login
3. Test all 7 tabs with Netlify Functions
4. Verify data displays correctly

### **Phase 2: Verify Worker (THIS WEEK)**
1. Check Render dashboard for worker status
2. If running, update worker to use Motia URL
3. If not running, deploy worker to Render
4. Test end-to-end job processing

### **Phase 3: Migrate to Motia (NEXT WEEK)**
1. Add missing endpoints to Motia
2. Update frontend to use Motia URLs
3. Test all dashboard tabs with Motia
4. Deprecate Netlify Functions

---

## 🆘 TROUBLESHOOTING

### Dashboard Shows "No Data"
- Check Supabase has jobs in database
- Check API endpoints return data (use browser DevTools)
- Verify authentication is working

### Dashboard Shows API Errors
- Check browser console for error messages
- Verify API endpoints exist (Netlify or Motia)
- Check CORS settings

### Worker Not Processing Jobs
- Check Render dashboard for worker status
- Verify worker environment variables
- Check worker logs for errors
- Verify worker can connect to Supabase

---

**Bottom Line:** Your staff dashboard has Netlify Functions that SHOULD work now. The Python worker needs to be checked/deployed on Render and configured to call your Motia API for brain service. Test the dashboard first, then tackle the worker! 🚀


