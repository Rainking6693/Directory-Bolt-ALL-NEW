# Staff Dashboard Data Flow - How Motia Shows Readable Details

## 🎯 THE COMPLETE DATA FLOW

This explains exactly how job data flows from customer purchase → worker processing → staff dashboard display.

---

## 📊 DATABASE SCHEMA (Supabase Tables)

### 1. `jobs` Table
**What it stores:** Main job records
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  status VARCHAR(50),  -- 'pending', 'in_progress', 'completed', 'failed'
  package_type VARCHAR(50),  -- 'starter', 'growth', 'professional', 'enterprise'
  directories_total INTEGER,  -- How many directories to submit to
  directories_done INTEGER,   -- How many completed
  progress DECIMAL(5,2),      -- Percentage (0.00 to 100.00)
  created_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
);
```

### 2. `job_results` Table
**What it stores:** Individual directory submission results
```sql
CREATE TABLE job_results (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  directory_name VARCHAR(255),  -- "Yelp", "Google Business", etc.
  directory_url VARCHAR(500),   -- "https://yelp.com"
  status VARCHAR(50),            -- 'success', 'failed', 'pending'
  submission_url VARCHAR(500),  -- URL of the created listing
  screenshot_url VARCHAR(500),  -- Screenshot of submission
  error_message TEXT,
  created_at TIMESTAMP
);
```

### 3. `queue_history` Table
**What it stores:** Audit trail of job state changes
```sql
CREATE TABLE queue_history (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  event_type VARCHAR(50),  -- 'job_created', 'job_started', 'directory_submitted', etc.
  event_data JSONB,        -- Additional details
  created_at TIMESTAMP
);
```

### 4. `customers` Table
**What it stores:** Customer business information
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  business_name VARCHAR(255),
  business_address TEXT,
  business_phone VARCHAR(50),
  business_email VARCHAR(255),
  business_website VARCHAR(500),
  business_description TEXT,
  business_categories TEXT,  -- Comma-separated
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 🔄 HOW DATA FLOWS THROUGH THE SYSTEM

### Step 1: Customer Purchases Package

**Frontend → Motia API:**
```javascript
POST /api/customer/submission
{
  "packageType": "professional",
  "businessData": {
    "name": "ACME Corp",
    "address": "123 Main St",
    "phone": "555-1234",
    "email": "contact@acme.com",
    "website": "https://acme.com",
    "description": "We do amazing things",
    "categories": ["technology", "consulting"]
  }
}
```

**Motia creates records:**
```sql
-- 1. Insert/Update customer
INSERT INTO customers (id, email, business_name, business_address, ...)
VALUES ('customer-uuid', 'contact@acme.com', 'ACME Corp', '123 Main St', ...);

-- 2. Create job
INSERT INTO jobs (id, customer_id, status, package_type, directories_total, directories_done, progress)
VALUES ('job-uuid', 'customer-uuid', 'pending', 'professional', 50, 0, 0.00);

-- 3. Log to history
INSERT INTO queue_history (id, job_id, event_type, event_data)
VALUES (UUID(), 'job-uuid', 'job_created', '{"package": "professional", "directories": 50}');
```

**Staff Dashboard now shows:**
- New job in "Queue" tab
- Status: "Pending"
- Progress: 0%
- Package: Professional (50 directories)

---

### Step 2: Python Worker Picks Up Job

**Worker polls Supabase:**
```python
# In backend/workers/submission_runner.py
job = supabase.table('jobs').select('*').eq('status', 'pending').limit(1).single().execute()
```

**Worker updates job status:**
```sql
UPDATE jobs 
SET status = 'in_progress', 
    started_at = NOW()
WHERE id = 'job-uuid';

INSERT INTO queue_history (job_id, event_type, event_data)
VALUES ('job-uuid', 'job_started', '{"worker_id": "worker-123"}');
```

**Staff Dashboard now shows:**
- Job moved to "Jobs" tab (in progress)
- Status: "In Progress"
- Started timestamp visible
- Progress bar appears

---

### Step 3: Worker Submits to First Directory

**Worker process:**
1. Gets directory from list (e.g., "Yelp")
2. Calls Motia Brain Service for field mapping
3. Uses Playwright to submit form
4. Takes screenshot
5. Verifies submission

**Worker updates database:**
```sql
-- Update job progress
UPDATE jobs 
SET directories_done = 1, 
    progress = (1.0 / 50.0 * 100),  -- 2%
    updated_at = NOW()
WHERE id = 'job-uuid';

-- Insert result
INSERT INTO job_results (id, job_id, directory_name, directory_url, status, submission_url, screenshot_url)
VALUES (
  UUID(),
  'job-uuid',
  'Yelp',
  'https://yelp.com',
  'success',
  'https://yelp.com/biz/acme-corp-123',
  'https://storage.com/screenshots/job-uuid-yelp.png'
);

-- Log to history
INSERT INTO queue_history (job_id, event_type, event_data)
VALUES ('job-uuid', 'directory_submitted', '{"directory": "Yelp", "status": "success"}');
```

**Staff Dashboard now shows:**
- Progress: 2% (1/50)
- Recent result: "Yelp - Success ✅"
- Click on job → See submission URL
- Click on job → See screenshot

---

### Step 4: Worker Continues Processing

**For each of the 50 directories, worker repeats:**
```sql
-- After each submission
UPDATE jobs SET directories_done = directories_done + 1, progress = (directories_done / directories_total * 100);
INSERT INTO job_results (...);
INSERT INTO queue_history (...);
```

**Staff Dashboard updates in real-time:**
- Progress bar moves: 2% → 4% → 6% → ... → 100%
- Results list grows with each submission
- Can see which directories succeeded/failed
- Can click to view submission URLs and screenshots

---

### Step 5: Job Completes

**When all 50 directories done:**
```sql
UPDATE jobs 
SET status = 'completed', 
    completed_at = NOW(),
    progress = 100.00
WHERE id = 'job-uuid';

INSERT INTO queue_history (job_id, event_type, event_data)
VALUES ('job-uuid', 'job_completed', '{"total_directories": 50, "successful": 48, "failed": 2}');
```

**Staff Dashboard shows:**
- Job moved to "Completed" section
- Final stats: 48 successful, 2 failed
- Total time taken
- Full list of all 50 submissions with links

---

## 🖥️ STAFF DASHBOARD TABS & DATA SOURCES

### Tab 1: Queue (Customer Queue)
**Shows:** All pending jobs waiting to be processed

**Data Source:**
```javascript
GET /api/staff/jobs?status=pending

// Motia queries:
SELECT * FROM jobs WHERE status = 'pending' ORDER BY created_at DESC;
```

**Displays:**
- Customer name
- Package type
- Number of directories
- Time in queue
- "Start Processing" button (if manual trigger needed)

---

### Tab 2: Jobs (Job Progress Monitor)
**Shows:** All jobs currently being processed

**Data Source:**
```javascript
GET /api/staff/jobs/active

// Motia queries:
SELECT * FROM jobs WHERE status IN ('pending', 'in_progress') ORDER BY created_at DESC;
```

**Displays:**
- Job ID
- Customer name
- Progress bar (e.g., "15/50 - 30%")
- Current status
- Time elapsed
- Recent submissions
- Click to see full details

---

### Tab 3: Analytics (Real-Time Analytics)
**Shows:** System-wide statistics

**Data Source:**
```javascript
GET /api/staff/stats

// Motia queries:
SELECT status, COUNT(*) as count FROM jobs GROUP BY status;
SELECT AVG(directories_done / directories_total * 100) as avg_progress FROM jobs WHERE status = 'in_progress';
```

**Displays:**
- Total jobs: 1,234
- Pending: 45
- In Progress: 12
- Completed: 1,150
- Failed: 27
- Average completion time
- Success rate: 96%
- Directories submitted today: 5,432

---

### Tab 4: AutoBolt Monitor
**Shows:** Worker health and activity

**Data Source:**
```javascript
GET /api/staff/workers/status

// Queries worker_heartbeats table:
SELECT * FROM worker_heartbeats WHERE last_heartbeat > NOW() - INTERVAL '5 minutes';
```

**Displays:**
- Active workers: 3
- Worker IDs and status
- Last heartbeat time
- Jobs being processed by each worker
- Worker health indicators

---

### Tab 5: Activity (Submission Logs)
**Shows:** Recent submission activity across all jobs

**Data Source:**
```javascript
GET /api/staff/submissions/recent?limit=100

// Motia queries:
SELECT jr.*, j.customer_id, c.business_name 
FROM job_results jr
JOIN jobs j ON jr.job_id = j.id
JOIN customers c ON j.customer_id = c.id
ORDER BY jr.created_at DESC
LIMIT 100;
```

**Displays:**
- Time: "2 minutes ago"
- Customer: "ACME Corp"
- Directory: "Yelp"
- Status: ✅ Success
- View submission link
- View screenshot

---

### Tab 6: 2FA Queue (Manual Review Queue)
**Shows:** Submissions that need manual intervention

**Data Source:**
```javascript
GET /api/staff/submissions/manual-review

// Motia queries:
SELECT * FROM job_results 
WHERE status = 'requires_manual' OR status = 'captcha_failed'
ORDER BY created_at ASC;
```

**Displays:**
- Submissions that hit captchas
- Submissions that need 2FA
- Submissions that need verification
- "Complete Manually" button
- Upload proof of submission

---

### Tab 7: Settings (Directory Settings)
**Shows:** Directory database management

**Data Source:**
```javascript
GET /api/staff/directories

// Motia queries:
SELECT * FROM directories ORDER BY name ASC;
```

**Displays:**
- List of all 500+ directories
- Enable/disable directories
- Edit directory URLs
- View success rates per directory
- Add new directories

---

## 🔍 DETAILED VIEW: Clicking on a Job

**When staff clicks on a job in the dashboard:**

**Frontend calls:**
```javascript
GET /api/staff/jobs/{jobId}/results
GET /api/staff/jobs/{jobId}/history
```

**Motia returns:**
```json
{
  "job": {
    "id": "job-uuid",
    "customer_id": "customer-uuid",
    "status": "in_progress",
    "package_type": "professional",
    "directories_total": 50,
    "directories_done": 23,
    "progress": 46.00,
    "created_at": "2025-12-03T10:00:00Z",
    "started_at": "2025-12-03T10:05:00Z"
  },
  "customer": {
    "business_name": "ACME Corp",
    "business_email": "contact@acme.com",
    "business_website": "https://acme.com"
  },
  "results": [
    {
      "directory_name": "Yelp",
      "status": "success",
      "submission_url": "https://yelp.com/biz/acme-corp",
      "screenshot_url": "https://storage.com/screenshots/...",
      "created_at": "2025-12-03T10:06:00Z"
    },
    {
      "directory_name": "Google Business",
      "status": "success",
      "submission_url": "https://business.google.com/...",
      "screenshot_url": "https://storage.com/screenshots/...",
      "created_at": "2025-12-03T10:08:00Z"
    },
    // ... 21 more results
  ],
  "history": [
    {
      "event_type": "job_created",
      "event_data": {"package": "professional"},
      "created_at": "2025-12-03T10:00:00Z"
    },
    {
      "event_type": "job_started",
      "event_data": {"worker_id": "worker-123"},
      "created_at": "2025-12-03T10:05:00Z"
    },
    {
      "event_type": "directory_submitted",
      "event_data": {"directory": "Yelp", "status": "success"},
      "created_at": "2025-12-03T10:06:00Z"
    },
    // ... more history events
  ]
}
```

**Dashboard displays:**
- Job header with customer info
- Progress bar: 23/50 (46%)
- Timeline of events
- Table of all submissions with:
  - Directory name
  - Status (✅ success, ❌ failed, ⏳ pending)
  - Submission URL (clickable)
  - Screenshot (clickable thumbnail)
  - Timestamp
- Filter/search submissions
- Export to CSV button

---

## 🔗 HOW MOTIA ENDPOINTS MAP TO DASHBOARD COMPONENTS

### Dashboard Component → Motia Endpoint → Database Query

**1. RealTimeQueue Component**
```typescript
// components/staff-dashboard/RealTimeQueue.tsx
useEffect(() => {
  fetch('/api/staff/jobs?status=pending')
    .then(res => res.json())
    .then(data => setJobs(data.jobs));
}, []);
```
↓
```typescript
// Motia: Directory Bolt Motia/steps/api/staffDashboard.step.ts
supabase.from('jobs').select('*').eq('status', 'pending').order('created_at', { ascending: false });
```

**2. JobProgressMonitor Component**
```typescript
// components/staff/JobProgressMonitor.tsx
useEffect(() => {
  fetch('/api/staff/jobs/active')
    .then(res => res.json())
    .then(data => setActiveJobs(data.jobs));
}, []);
```
↓
```typescript
// Motia
supabase.from('jobs').select('*').in('status', ['pending', 'in_progress']).order('created_at', { ascending: false});
```

**3. RealTimeAnalytics Component**
```typescript
// components/staff-dashboard/RealTimeAnalytics.tsx
useEffect(() => {
  fetch('/api/staff/stats')
    .then(res => res.json())
    .then(data => setStats(data.stats));
}, []);
```
↓
```typescript
// Motia
supabase.from('jobs').select('status');
// Then aggregates in code
```

**4. SubmissionLogsWidget Component**
```typescript
// components/staff-dashboard/SubmissionLogsWidget.tsx
useEffect(() => {
  fetch('/api/staff/submissions/recent?limit=50')
    .then(res => res.json())
    .then(data => setLogs(data.submissions));
}, []);
```
↓
```typescript
// Motia (needs to be added to staffDashboard.step.ts)
supabase.from('job_results')
  .select('*, jobs(customer_id), customers(business_name)')
  .order('created_at', { ascending: false })
  .limit(50);
```

---

## ✅ WHAT'S WORKING vs WHAT NEEDS FIXING

### ✅ Already Working in Motia:
- `/api/staff/jobs` - Get all jobs
- `/api/staff/jobs/active` - Get active jobs
- `/api/staff/jobs/{jobId}/results` - Get job results
- `/api/staff/jobs/{jobId}/history` - Get job history
- `/api/staff/stats` - Get system stats

### ❌ Missing from Motia (Need to add):
- `/api/staff/submissions/recent` - Recent submissions across all jobs
- `/api/staff/workers/status` - Worker heartbeat status
- `/api/staff/directories` - Directory management
- `/api/staff/submissions/manual-review` - 2FA/manual review queue

---

## 🚀 NEXT STEPS TO GET DASHBOARD FULLY WORKING

### 1. Deploy Motia Backend
```bash
cd "Directory Bolt Motia"
npx motia deploy
```

### 2. Update Frontend API URLs
```javascript
// In your Next.js site, update:
const API_URL = 'https://your-app.motia.cloud';

// Replace all staff dashboard API calls:
fetch(`${API_URL}/api/staff/jobs/active`)
```

### 3. Add Missing Endpoints to Motia
Add to `staffDashboard.step.ts`:
```typescript
else if (requestPath === '/api/staff/submissions/recent') {
  const { limit = 50 } = queryParams;
  const { data, error } = await supabase
    .from('job_results')
    .select('*, jobs!inner(customer_id, customers!inner(business_name))')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  return { status: 200, body: { submissions: data } };
}
```

### 4. Test Each Dashboard Tab
- Login with: staffuser / DirectoryBoltStaff2025!
- Click through all 7 tabs
- Verify data displays correctly
- Check real-time updates work

---

## 📝 SUMMARY

**How it all connects:**

1. **Customer purchases** → Motia creates job in Supabase
2. **Python worker** → Polls Supabase, processes job, updates results
3. **Staff dashboard** → Calls Motia APIs → Motia queries Supabase → Returns formatted data
4. **Dashboard displays** → Real-time job progress, submission results, analytics

**The key insight:** Motia is the "API layer" between your frontend and Supabase. It provides clean REST endpoints that query the database and return formatted data for the dashboard to display.

**Your Python worker doesn't talk to Motia** - it talks directly to Supabase. Motia just reads what the worker writes to the database and presents it nicely to the staff dashboard.

This is why you need BOTH deployed:
- **Motia** = API server for dashboard
- **Python Worker** = Does the actual directory submissions

They communicate through the Supabase database! 🎯

