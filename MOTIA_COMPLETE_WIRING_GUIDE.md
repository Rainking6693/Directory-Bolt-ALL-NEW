# How Motia Backend Handles Directory Submissions - Complete Wiring Guide

## 🎯 THE BIG PICTURE

Your Motia backend is designed to replace 4 Render services and automate directory submissions. Here's how the entire flow works:

```
Customer Purchase
      ↓
Frontend API Call → Motia Customer Portal API
      ↓
Creates Job in Supabase
      ↓
Triggers Job Processing Event
      ↓
Motia Job Processor
      ↓
Calls Brain Service (AI Field Mapping)
      ↓
Triggers Playwright Worker
      ↓
Worker Submits to Directory
      ↓
Updates Job Status in Supabase
      ↓
Customer Sees Progress in Dashboard
```

---

## 🔌 HOW IT'S ALL WIRED TOGETHER

### Step 1: Customer Creates Submission

**Frontend calls:**
```javascript
POST https://your-motia-url.com/api/customer/submission
{
  "packageType": "professional",  // starter, growth, professional, enterprise
  "businessData": {
    "name": "ACME Corp",
    "address": "123 Main St, City, State 12345",
    "phone": "555-1234",
    "email": "contact@acme.com",
    "website": "https://acme.com",
    "description": "We do amazing things...",
    "categories": ["technology", "consulting"]
  }
}
```

**Motia handles this in:**
`Directory Bolt Motia/steps/api/customerPortal.step.ts` line 128-144

**What happens:**
1. Creates job record in Supabase `jobs` table
2. Saves business data to Supabase `customers` table
3. Determines how many directories based on package:
   - starter = 10 directories
   - growth = 25 directories
   - professional = 50 directories
   - enterprise = 100 directories
4. Returns `jobId` to customer

---

### Step 2: Job Gets Queued for Processing

**Current Implementation:**
The `enqueueJob()` function (line 111-119 in `directorySubmission.ts`) currently just logs. **This is where we need to connect it to your worker.**

**What NEEDS to happen (the missing piece):**
```typescript
private async enqueueJob(jobId: string, customerId: string, packageSize: number, packageType: string) {
  // Option 1: Emit Motia event that jobProcessor listens to
  await this.emit({
    topic: 'process-job',
    data: {
      jobId,
      customerId,
      directory: 'first-directory-from-list',
      payload: businessData
    }
  });
  
  // Option 2: Call your existing Playwright worker directly
  // (Keep using your current backend/workers/submission_runner.py)
  
  // Option 3: Use SQS (like you had before)
  await sqs.sendMessage({
    QueueUrl: process.env.SQS_QUEUE_URL,
    MessageBody: JSON.stringify({
      jobId,
      customerId,
      packageSize,
      packageType
    })
  });
}
```

---

### Step 3: Brain Service Maps Form Fields

**When a directory needs to be submitted:**

1. **Get directory URL from database:**
```sql
SELECT url, form_fields FROM directories LIMIT 1;
```

2. **Call Brain Service:**
```javascript
POST https://your-motia-url.com/plan
{
  "businessData": { ...customer business info... },
  "directory": "example-directory.com",
  "useAI": true
}
```

**Brain Service returns:**
```json
{
  "url": "https://example-directory.com/submit",
  "fields": {
    "business_name": "ACME Corp",
    "business_address": "123 Main St...",
    "business_phone": "555-1234",
    "business_email": "contact@acme.com",
    "business_website": "https://acme.com",
    "business_description": "We do amazing things..."
  },
  "steps": [
    "Navigate to submission page",
    "Fill in business name field",
    "Fill in address field",
    "Submit form"
  ],
  "requires_captcha": false,
  "submission_method": "form_post"
}
```

**This is handled in:**
`Directory Bolt Motia/steps/api/brain.step.ts` lines 52-112

**Uses either:**
- Anthropic Claude (if `ANTHROPIC_API_KEY` is set)
- Google Gemini (if `GEMINI_API_KEY` is set)
- Rule-based fallback (if no AI keys)

---

### Step 4: Playwright Worker Submits to Directory

**This is where your existing Python worker comes in!**

Your worker is already built: `backend/workers/submission_runner.py`

**It does:**
1. Launches headless Chrome browser
2. Navigates to directory URL
3. Fills form fields with mapped values
4. Handles captchas (if needed)
5. Submits the form
6. Takes screenshots for verification
7. Updates job status in Supabase

**The worker uses:**
- Playwright for browser automation
- Anthropic/Gemini for AI assistance
- Supabase for job tracking

---

## 🔧 THE MISSING LINK (What You Need to Fix)

The Motia `jobProcessor` has a TODO comment (line 22):

```typescript
// TODO: wire to Playwright runner / worker pipeline
```

**This is the connection you need to make!**

### Option A: Keep Your Existing Python Worker (Recommended)

Your Python worker (`backend/workers/submission_runner.py`) already works. Just keep using it!

**How to wire it:**

1. **Deploy Motia backend** (handles API endpoints and job creation)
2. **Keep running your Python worker separately**
3. **Worker polls Supabase for new jobs**

**The worker already does this:**
```python
# In submission_runner.py
def get_next_pending_job():
    """Get the next pending job from Supabase."""
    # Worker already polls for jobs with status='pending'
    # And updates them to 'in_progress'
```

**So the flow is:**
```
Customer → Motia API → Creates job in Supabase (status='pending')
                                ↓
Python Worker (running separately) → Polls Supabase every 30 seconds
                                ↓
Finds pending job → Processes it with Playwright
                                ↓
Updates Supabase with results
```

**YOU DON'T NEED TO CHANGE ANYTHING!** Just deploy Motia AND keep your Python worker running.

---

### Option B: Move Everything to Motia (More Complex)

Convert your Python worker to TypeScript and integrate it fully into Motia:

```typescript
// Directory Bolt Motia/steps/events/jobProcessor.step.ts
export const handler: Handlers['JobProcessor'] = async (input, { traceId, logger, emit }) => {
  logger.info('Processing job', { input, traceId })

  // 1. Get business data from Supabase
  const customer = await db.getCustomerById(input.customerId);
  
  // 2. Call brain service for field mapping
  const plan = await fetch('/plan', {
    method: 'POST',
    body: JSON.stringify({
      businessData: customer.businessData,
      directory: input.directory,
      useAI: true
    })
  });
  
  // 3. Execute with Playwright
  const result = await executePlaywrightSubmission(plan);
  
  // 4. Update job status
  await db.updateJobResult(input.jobId, result);
  
  // 5. Emit completion event
  await emit({
    topic: 'job-processed',
    data: { jobId: input.jobId, status: result.status }
  });
}
```

**This requires:**
- Installing Playwright in Motia
- Converting Python logic to TypeScript
- More complexity

**Not recommended** - your Python worker already works!

---

## 🚀 DEPLOYMENT GUIDE - WHAT YOU ACTUALLY NEED TO DO

### Architecture Decision: Hybrid Approach (Best for You)

Keep your **Python worker** + Deploy **Motia backend**

**Why?**
- Your Python worker already works with Playwright
- Motia provides clean API endpoints for frontend
- Simpler to maintain
- Easier to debug

---

### Deployment Steps

#### 1. Deploy Motia Backend to Motia Cloud

```bash
cd "Directory Bolt Motia"

# Install Motia CLI
npm install -g @motiadev/cli

# Login
npx motia login

# Set environment variables
npx motia env:set ANTHROPIC_API_KEY=<your_key>
npx motia env:set GEMINI_API_KEY=<your_key>
npx motia env:set SUPABASE_URL=<your_url>
npx motia env:set SUPABASE_SERVICE_ROLE_KEY=<your_key>
npx motia env:set SUPABASE_ANON_KEY=<your_key>

# Deploy
npx motia deploy
```

**This gives you:**
- `https://your-app.motia.cloud/api/customer/*` - Customer APIs
- `https://your-app.motia.cloud/api/staff/*` - Staff APIs
- `https://your-app.motia.cloud/plan` - AI Brain Service
- `https://your-app.motia.cloud/health` - Health check

#### 2. Deploy Python Worker (Keep Existing Setup)

Your Python worker can run:
- On Render (where it was before)
- On Railway
- On any server with Python 3.11+

**Worker needs these env vars:**
```bash
SUPABASE_URL=<same as Motia>
SUPABASE_SERVICE_ROLE_KEY=<same as Motia>
ANTHROPIC_API_KEY=<same as Motia>
GEMINI_API_KEY=<same as Motia>
PLAYWRIGHT_HEADLESS=1
```

**Start the worker:**
```bash
cd backend
python workers/submission_runner.py
```

**Worker will:**
- Poll Supabase every 30 seconds for `status='pending'` jobs
- Process them with Playwright
- Update job status to `in_progress` → `completed`

#### 3. Update Frontend to Use Motia

**In your Next.js site, update API calls:**

```javascript
// OLD (Render)
const response = await fetch('https://brain.onrender.com/plan', {...});

// NEW (Motia)
const response = await fetch('https://your-app.motia.cloud/plan', {...});
```

**Or better yet, use environment variable:**
```javascript
// .env
NEXT_PUBLIC_API_URL=https://your-app.motia.cloud

// In code
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/plan`, {...});
```

---

## 📊 FULL WORKFLOW EXAMPLE

### User Purchases Professional Package

**1. Frontend calls Motia:**
```javascript
const result = await fetch('https://your-app.motia.cloud/api/customer/submission', {
  method: 'POST',
  body: JSON.stringify({
    packageType: 'professional',
    businessData: {
      name: "Ben's Business",
      address: "123 Main St",
      phone: "555-1234",
      email: "ben@business.com",
      website: "https://bensbusiness.com",
      description: "Amazing business",
      categories: ["consulting"]
    }
  })
});

// Returns: { jobId: "uuid-123", status: "pending", directoriesTotal: 50 }
```

**2. Motia creates job in Supabase:**
```sql
INSERT INTO jobs (id, customer_id, status, package_type, directories_total, directories_done, progress)
VALUES ('uuid-123', 'customer-456', 'pending', 'professional', 50, 0, 0);
```

**3. Python worker picks up job (polling every 30s):**
```python
job = get_next_pending_job()  # Finds uuid-123
# job = { id: 'uuid-123', customer_id: 'customer-456', ... }
```

**4. Worker gets directory list:**
```python
directories = get_directories_for_job('uuid-123', limit=50)
# directories = [
#   { url: 'example-directory.com', name: 'Example Directory' },
#   { url: 'another-dir.com', name: 'Another Dir' },
#   ...
# ]
```

**5. For each directory, worker:**

a. **Calls Motia Brain Service for field mapping:**
```python
plan = await call_brain_service(business_data, directory_url)
# Returns field mapping plan
```

b. **Executes with Playwright:**
```python
async with async_playwright() as p:
    browser = await p.chromium.launch()
    page = await browser.new_page()
    await page.goto(plan['url'])
    
    # Fill fields
    for field, value in plan['fields'].items():
        await page.fill(f'input[name="{field}"]', value)
    
    # Submit
    await page.click('button[type="submit"]')
    
    # Verify success
    success = await verify_submission(page)
```

c. **Updates Supabase:**
```sql
UPDATE jobs SET directories_done = directories_done + 1, progress = (directories_done / directories_total * 100) WHERE id = 'uuid-123';

INSERT INTO job_results (job_id, directory_name, status, submission_url)
VALUES ('uuid-123', 'Example Directory', 'success', 'https://example-directory.com/listing/12345');
```

**6. Customer sees progress in dashboard:**
```javascript
// Frontend polls every 5 seconds
const status = await fetch('https://your-app.motia.cloud/api/customer/jobs/uuid-123/status');

// Returns:
{
  jobId: 'uuid-123',
  status: 'in_progress',
  directoriesTotal: 50,
  directoriesDone: 15,
  progress: 30,
  recentResults: [
    { directory: 'Example Directory', status: 'success', timestamp: '...' },
    { directory: 'Another Dir', status: 'success', timestamp: '...' }
  ]
}
```

**7. When all 50 directories done:**
```sql
UPDATE jobs SET status = 'completed', completed_at = NOW() WHERE id = 'uuid-123';
```

---

## 🎯 SUMMARY - WHAT YOU NEED TO KNOW

### What Motia Does:
✅ Provides clean REST APIs for your frontend
✅ Handles customer job creation
✅ Stores business data in Supabase
✅ Provides AI Brain Service for form mapping
✅ Gives you staff dashboard APIs
✅ Tracks job progress

### What Motia Doesn NOT Do (Yet):
❌ Run the Playwright worker (your Python script does this)
❌ Submit to directories (your Python script does this)

### The Connection:
- **Motia** creates jobs in Supabase (status='pending')
- **Your Python worker** polls Supabase, finds pending jobs, processes them
- Both update the same Supabase database
- Frontend queries Motia APIs to show progress

### You Need Both:
1. **Motia Backend** (for APIs) - Deploy to Motia Cloud
2. **Python Worker** (for submissions) - Keep running on Render/Railway/etc.

---

## 🔑 KEY ENVIRONMENT VARIABLES

### Both Motia AND Worker Need:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ANTHROPIC_API_KEY=sk-ant-api03-...
GEMINI_API_KEY=... (optional, fallback to Anthropic)
```

### Only Worker Needs:
```bash
PLAYWRIGHT_HEADLESS=1
AWS_ACCESS_KEY_ID=... (if using SQS)
AWS_SECRET_ACCESS_KEY=... (if using SQS)
SQS_QUEUE_URL=... (if using SQS)
```

---

## ✅ CHECKLIST - GETTING IT ALL WORKING

- [ ] Deploy Motia backend to Motia Cloud
- [ ] Set environment variables in Motia
- [ ] Test Motia APIs are accessible
- [ ] Deploy Python worker (or keep existing deployment)
- [ ] Set environment variables for worker
- [ ] Verify worker can connect to Supabase
- [ ] Test worker can poll for jobs
- [ ] Update frontend API endpoints to point to Motia
- [ ] Test full flow: Purchase → Job Creation → Worker Processing → Results
- [ ] Monitor both Motia logs and worker logs

---

## 🆘 TROUBLESHOOTING

### If jobs aren't being processed:

1. **Check Motia created the job:**
```sql
SELECT * FROM jobs ORDER BY created_at DESC LIMIT 1;
```

2. **Check worker is running:**
```bash
# SSH to worker server
ps aux | grep submission_runner
```

3. **Check worker logs:**
```bash
tail -f /var/log/worker.log
```

4. **Check worker can connect to Supabase:**
```python
# Test connection
from db.supabase import supabase
result = supabase.table('jobs').select('*').limit(1).execute()
print(result)
```

5. **Manually trigger worker:**
```bash
python workers/submission_runner.py
```

---

**Bottom Line:** Your Python worker is the engine that does the actual work. Motia is the control panel that manages it. Deploy both, connect them through Supabase, and you're golden! 🚀


