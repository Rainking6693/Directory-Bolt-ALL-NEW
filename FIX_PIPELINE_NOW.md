# IMMEDIATE ACTION PLAN: Fix Job Processing Pipeline

**Status**: CRITICAL - Pipeline is broken at multiple points
**Estimated Fix Time**: 30-45 minutes
**Priority**: P0 - Blocks all job processing

---

## Root Cause Summary

The job processing pipeline breaks at multiple points:

1. **AWS Credentials Missing from Netlify** (Most Likely)
   - Jobs created in DB but never sent to SQS
   - Silent failure - endpoint returns success but job never queues

2. **Prefect Deployment Not Registered** (Very Likely)
   - Subscriber crashes when trying to trigger `process_job/production`
   - Deployment doesn't exist on Render Prefect Server

3. **AWS Credentials Missing from Render Subscriber** (Likely)
   - Subscriber service crashes on startup
   - Module load fails because SQS client can't initialize

4. **Exposed Credentials in Repository** (Security Issue)
   - Must rotate all credentials immediately

---

## Step-by-Step Fix (In Order)

### STEP 1: Rotate Exposed Credentials (10 minutes)

**Why**: Credentials in `RAILWAY_QUICK_DEPLOY.md` are publicly exposed

**Action A: AWS Access Key Rotation**
```
1. Go to: AWS Console → IAM → Users → Select your user
2. Click: Security Credentials tab
3. Click: "Create access key" button
4. Copy: Access Key ID and Secret Access Key
5. Store safely (you'll need these in next steps)
6. Back to AWS: Delete the old key (ID: AKIATL4NZUEBEHZDU3YI)
```

**Action B: Rotate Supabase Key**
```
1. Go to: Supabase Dashboard → Your Project → Settings
2. Click: API tab
3. Find: Service Role Key
4. Click: Rotate button (or generate new)
5. Copy new key
6. Update all services with new key
```

**Action C: Rotate Prefect Key**
```
1. Go to: Prefect Cloud (or Render Prefect Server)
2. Find: API Key section
3. Generate new key
4. Copy it
5. Update all services
```

**Action D: Rotate Stripe Key** (if applicable)
```
1. Go to: Stripe Dashboard → Developers → API Keys
2. Click: "Roll Key" or "Create restricted key"
3. Copy new key
4. Update worker service
```

**Then remove `RAILWAY_QUICK_DEPLOY.md` from git history:**
```bash
git rm RAILWAY_QUICK_DEPLOY.md
git commit -m "Remove file with exposed credentials"
git push
```

---

### STEP 2: Set AWS Credentials in Netlify (5 minutes)

**Go to**: Netlify Dashboard → Your Site → Site Settings → Build & Deploy → Environment

**Add these variables** (use new AWS keys from Step 1):
```
Key: AWS_DEFAULT_ACCESS_KEY_ID
Value: <your-new-access-key>

Key: AWS_DEFAULT_SECRET_ACCESS_KEY
Value: <your-new-secret-key>

Key: AWS_DEFAULT_REGION
Value: us-east-2

Key: SQS_QUEUE_URL
Value: https://sqs.us-east-2.amazonaws.com/<your-account-id>/DirectoryBolt
```

**After adding:**
1. Go to Netlify Deployments
2. Click "Trigger Deploy" → "Deploy Site"
3. Wait for deploy to complete

**Verify**:
- Go to Functions → autobolt-push logs
- Push a test job
- Should see: `✅ Job {id} sent to SQS queue. MessageId:`

---

### STEP 3: Set AWS Credentials in Render Subscriber (5 minutes)

**Go to**: Render Dashboard → subscriber service → Environment tab

**Add these variables** (same as Netlify):
```
AWS_DEFAULT_REGION=us-east-2
AWS_DEFAULT_ACCESS_KEY_ID=<your-new-access-key>
AWS_DEFAULT_SECRET_ACCESS_KEY=<your-new-secret-key>
SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/<your-account-id>/DirectoryBolt
SQS_DLQ_URL=https://sqs.us-east-2.amazonaws.com/<your-account-id>/DirectoryBolt-dlq
```

**After adding:**
1. Click "Save"
2. Render auto-restarts service
3. Wait 30 seconds for restart

**Verify**:
- Go to Logs tab
- Should see: `Starting SQS subscriber`
- Should NOT see: `AWS credentials not configured` (ERROR)
- Should NOT see: `Can't connect to AWS` (ERROR)
- Should see: `No messages in queue` (normal when queue is empty)

---

### STEP 4: Add Missing Supabase/Prefect Vars to Subscriber (3 minutes)

**Go to**: Render Dashboard → subscriber service → Environment tab

**Verify these are set** (if not, add them):
```
SUPABASE_URL=https://kolgqfjgncdwddziqloz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-new-service-key-from-step-1>

PREFECT_API_URL=https://prefect-server-srv-id.onrender.com
PREFECT_API_KEY=<if-using-prefect-cloud>
```

**After adding**: Click "Save" and wait for restart

---

### STEP 5: Register Prefect Deployment (10 minutes)

**Why**: Subscriber needs `process_job/production` deployment to exist

**Local Deployment Method** (Recommended):
```bash
# Open terminal/command prompt
# Navigate to project
cd "C:\Users\Ben\OneDrive\Documents\GitHub\Directory-Bolt-ALL-NEW\backend"

# Set environment variable (your Render Prefect Server URL)
set PREFECT_API_URL=https://prefect-server-xyz.onrender.com

# Optional if using Prefect Cloud
# set PREFECT_API_KEY=your-key-here

# Run deployment script
python deploy_prefect_flow.py --pool default --name production
```

**Expected Output:**
```
Deploying process_job flow...
  API URL: https://prefect-server-xyz.onrender.com
  Work Pool: default
  Deployment Name: process_job/production
✅ Successfully imported process_job flow
✅ Deployment object created
✅ Deployment applied successfully!
   Deployment ID: <uuid>
Deployment is now ready for use.
Subscriber will trigger: process_job/production
```

**Verify**:
1. Go to Prefect Dashboard (Prefect Cloud or Render server URL)
2. Check Deployments section
3. Look for `process_job/production`
4. Status should be "Active"

---

### STEP 6: Set Remaining Variables in Render Worker (5 minutes)

**Go to**: Render Dashboard → worker service → Environment tab

**Verify all these are set**:
```
# Same as Subscriber
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
AWS_DEFAULT_REGION=...
AWS_DEFAULT_ACCESS_KEY_ID=...
AWS_DEFAULT_SECRET_ACCESS_KEY=...
SQS_QUEUE_URL=...
SQS_DLQ_URL=...
PREFECT_API_URL=...
PREFECT_API_KEY=...

# Plus these for worker
PLAYWRIGHT_HEADLESS=1
ANTHROPIC_API_KEY=<your-key>
GEMINI_API_KEY=<your-key>
TWO_CAPTCHA_API_KEY=<your-key>
STRIPE_SECRET_KEY=<your-key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<your-key>
STRIPE_WEBHOOK_SECRET=<your-secret>
ENABLE_AI_FEATURES=true
ENABLE_FORM_MAPPING=true
ENABLE_CONTENT_CUSTOMIZATION=true
```

**After adding**: Click "Save" and wait for restart

---

### STEP 7: End-to-End Test (5 minutes)

**1. Create test job via API:**
```bash
# Using curl or Postman
POST https://your-netlify-domain.netlify.app/api/autobolt/push
Headers:
  Content-Type: application/json
  Authorization: Bearer <your-staff-token>
Body:
{
  "customerId": "test-customer-123",
  "priority": 2
}
```

**Expected Response:**
```json
{
  "success": true,
  "job": {"id": "...", "status": "pending"},
  "jobId": "..."
}
```

**2. Check SQS Queue:**
- AWS Console → SQS → DirectoryBolt
- Should see 1 message in queue (or 0 if subscriber already consumed it)

**3. Check Subscriber Logs:**
- Render Dashboard → subscriber → Logs
- Should see: `Received 1 messages`
- Should see: `Processing message for job test-customer-123`
- Should see: `Triggered Prefect flow for job test-customer-123`

**4. Check Prefect Flow:**
- Prefect Dashboard → Flow Runs
- Search for your test job ID
- Should see flow in "Running" or "Completed" state

**5. Check Database:**
- Supabase → Query `queue_history` table
- Should see events: `queue_claimed` → `flow_triggered` → `flow_started`

**If all checks pass**: ✅ Pipeline is fixed!

---

## If Something Still Fails

### Problem: Jobs created but not sent to SQS
```
Check: Netlify environment variables
Logs: Netlify → Functions → autobolt-push
Look for: "❌ AWS_DEFAULT_ACCESS_KEY_ID not configured"
Fix: Add AWS credentials to Netlify
```

### Problem: Subscriber crashes on startup
```
Check: Render subscriber logs
Look for: "AWS credentials not configured" or "SQS_QUEUE_URL not set"
Fix: Add missing environment variables to Render subscriber
```

### Problem: Subscriber receives messages but can't trigger flow
```
Check: Render subscriber logs
Look for: "Error processing message" or "Trigger Prefect flow"
Likely cause: `process_job/production` deployment doesn't exist
Fix: Run deployment script from STEP 5
```

### Problem: Worker not connected to Prefect
```
Check: Render worker logs
Look for: "Can't connect to Prefect API" or "Worker registration failed"
Fix: Verify PREFECT_API_URL is correct
```

---

## Security Checklist

- [ ] Deleted RAILWAY_QUICK_DEPLOY.md (or at least removed from git history)
- [ ] Rotated AWS access keys
- [ ] Rotated Supabase service role key
- [ ] Rotated Prefect API key
- [ ] Rotated Stripe keys
- [ ] Rotated AI API keys
- [ ] Verified new credentials are set in all services
- [ ] Deleted old credentials from AWS IAM
- [ ] Added `.env` files to `.gitignore` (should already be there)

---

## Testing Checklist

- [ ] AWS credentials work in Netlify
- [ ] Message appears in SQS queue when job is pushed
- [ ] Subscriber service starts without errors
- [ ] Subscriber receives messages from SQS
- [ ] Subscriber successfully triggers Prefect flow
- [ ] Worker connects to Prefect
- [ ] Flow execution appears in Prefect dashboard
- [ ] Database records show complete event chain

---

## Quick Reference: Service URLs

```
Frontend: https://your-netlify-domain.netlify.app
Render Dashboard: https://dashboard.render.com
Render Subscriber: srv-d45u7e7diees738h2ahg
Render Worker: srv-d45u7eqdbo4c7385qmg0
Render Prefect Server: srv-d46bvcqli9vc73dehpig
AWS Console: https://console.aws.amazon.com
Supabase: https://app.supabase.com
Prefect Cloud: https://app.prefect.cloud
```

---

## DONE!

Once all steps complete and tests pass, your job processing pipeline should be fully operational. Future jobs will:

1. Get pushed to `/api/autobolt/push` endpoint
2. Get saved to Supabase database
3. Get sent to SQS queue
4. Get consumed by subscriber service
5. Get triggered in Prefect as flow runs
6. Get executed by worker service with Playwright
7. Results recorded back to database

**Celebrate!** 🎉 The pipeline is now alive.

