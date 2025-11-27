# Quick Production Test Guide - Directory-Bolt

**Purpose:** Verify staff dashboard can read worker outputs in 15 minutes

---

## Pre-Requisites

- [ ] Access to Render dashboard (https://dashboard.render.com)
- [ ] Access to Supabase dashboard (https://supabase.com)
- [ ] Access to AWS Console (https://console.aws.amazon.com)
- [ ] Access to Prefect Cloud (https://app.prefect.cloud)

---

## Step 1: Verify Services Are Running (2 minutes)

### Render Dashboard
Visit: https://dashboard.render.com

Check these services are "Live":
- [ ] brain (Web Service)
- [ ] subscriber (Background Worker)
- [ ] worker (Background Worker)

**If any show "Failed" or "Suspended":**
- Click service → Click "Manual Deploy" → Select main branch → Deploy

---

## Step 2: Fix Brain Health Endpoint (5 minutes)

### Check Current Status
```bash
curl https://brain.onrender.com/health
```

**If you get 404:**

1. Edit `C:\Users\Ben\Desktop\Github\Directory-Bolt-ALL-NEW\backend\brain\service.py`

2. Ensure this endpoint exists:
```python
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "brain"}
```

3. Commit and push:
```bash
git add backend/brain/service.py
git commit -m "Fix: Add health endpoint to Brain service"
git push
```

4. Render auto-deploys (wait 2-3 minutes)

5. Test again:
```bash
curl https://brain.onrender.com/health
# Expected: {"status":"healthy","service":"brain"}
```

---

## Step 3: Create Test Job (3 minutes)

### Via Supabase SQL Editor

Visit: https://supabase.com → Your Project → SQL Editor

```sql
-- 1. Create test customer
INSERT INTO customers (id, email, business_name, package_type, website, description, category)
VALUES (
  gen_random_uuid(),
  'test@directorybolt.com',
  'Test Business Ltd',
  'starter',
  'https://test.com',
  'A test business for integration testing',
  'Technology'
)
RETURNING id;
-- Copy the returned UUID

-- 2. Create test job (use UUID from step 1)
INSERT INTO jobs (id, customer_id, status, package_type, directories_total, directories_done, progress)
VALUES (
  gen_random_uuid(),
  'PASTE-CUSTOMER-UUID-HERE',
  'pending',
  'starter',
  3,
  0,
  0
)
RETURNING id;
-- Copy the returned job UUID

-- 3. Create test directory submissions
INSERT INTO directory_submissions (id, submission_queue_id, directory_url, status)
VALUES
  (gen_random_uuid(), 'PASTE-JOB-UUID-HERE', 'https://example1.com', 'pending'),
  (gen_random_uuid(), 'PASTE-JOB-UUID-HERE', 'https://example2.com', 'pending'),
  (gen_random_uuid(), 'PASTE-JOB-UUID-HERE', 'https://example3.com', 'pending');
```

**Save these UUIDs:**
- Customer ID: ______________________
- Job ID: ______________________

---

## Step 4: Enqueue Job to SQS (2 minutes)

### Option A: Via Brain Service (Recommended)

```bash
curl -X POST https://brain.onrender.com/api/jobs/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "PASTE-JOB-UUID-HERE",
    "customer_id": "PASTE-CUSTOMER-UUID-HERE",
    "package_size": 3,
    "priority": 1
  }'

# Expected response:
# {"queue_provider":"sqs","queue_url":"https://sqs...","message_id":"..."}
```

### Option B: Via AWS Console

1. Go to: https://console.aws.amazon.com/sqs/
2. Select queue: `DirectoryBolt`
3. Click "Send and receive messages"
4. Click "Send message"
5. Paste this as message body:
```json
{
  "job_id": "PASTE-JOB-UUID-HERE",
  "customer_id": "PASTE-CUSTOMER-UUID-HERE",
  "package_size": 3,
  "priority": 1,
  "created_at": "2025-11-27T03:30:00Z",
  "source": "manual_test"
}
```
6. Click "Send message"

---

## Step 5: Monitor System (3 minutes)

### A. Check SQS Queue (30 seconds)

Visit: https://console.aws.amazon.com/sqs/

- [ ] Message appears in `DirectoryBolt` queue
- [ ] After ~30 seconds, message disappears (subscriber processed it)
- [ ] Check `DirectoryBolt-dlq` - should be empty

### B. Check Subscriber Logs (1 minute)

Visit: https://dashboard.render.com/worker/srv-[subscriber-id]/logs

Look for these log messages:
```
Received 1 messages
Processing message for job [your-job-id]
Triggered Prefect flow for job [your-job-id]
Message deleted from queue
```

**If you see errors:** Check environment variables are set

### C. Check Prefect Cloud (1 minute)

Visit: https://app.prefect.cloud/

- [ ] Go to "Flow Runs"
- [ ] Look for new run of "process_job" flow
- [ ] Status should be "Running" or "Completed"
- [ ] Click on run to see task details

### D. Check Worker Logs (1 minute)

Visit: https://dashboard.render.com/worker/srv-[worker-id]/logs

Look for:
```
Starting job [your-job-id] for customer [your-customer-id]
Found 3 directories to process
Processing example1.com for job [your-job-id]
Inserted new result for example1.com
Processing example2.com for job [your-job-id]
...
Job [your-job-id] completed
```

---

## Step 6: Verify Database (2 minutes)

### Check Supabase Tables

Visit: https://supabase.com → Your Project → Table Editor

**1. Check `jobs` table:**
- [ ] Find your job by ID
- [ ] `status` should be "in_progress" or "completed"
- [ ] `progress` should be updating (0 → 33 → 66 → 100)
- [ ] `directories_done` should increment (0 → 1 → 2 → 3)

**2. Check `job_results` table:**
- [ ] Filter by `job_id` = your job ID
- [ ] Should see 3 rows (one per directory)
- [ ] Each row should have:
  - `status` = "submitted" or "failed"
  - `directory_name` = directory URL
  - `payload` = business data (JSON)
  - `idempotency_key` = SHA256 hash

**3. Check `queue_history` table:**
- [ ] Filter by `job_id` = your job ID
- [ ] Should see multiple events:
  - `queue_claimed`
  - `flow_triggered`
  - `flow_started`
  - `submission_complete` (x3)
  - `flow_completed`

---

## Step 7: Verify Staff Dashboard (2 minutes)

### Open Dashboard

Visit: https://directoryboltpython.netlify.app/staff/dashboard

**Check Connection:**
- [ ] Top right shows "🟢 Live" (not "🔴 Reconnecting")

**Check Active Jobs Section:**
- [ ] Your test job appears in the list
- [ ] Shows business name: "Test Business Ltd"
- [ ] Shows package type: "starter"
- [ ] Progress bar animates (0% → 33% → 66% → 100%)
- [ ] Directory count updates (0/3 → 1/3 → 2/3 → 3/3)
- [ ] Elapsed time increments

**Check Activity Feed:**
- [ ] Shows recent events from `queue_history`
- [ ] Events appear in real-time (no refresh needed)
- [ ] Shows timestamps
- [ ] Shows directory names

**Check Statistics:**
- [ ] Total jobs count includes your test job
- [ ] In Progress count updates when job starts
- [ ] Completed count updates when job finishes

---

## Success Criteria

✅ **PASSED** if ALL of these are true:

1. ✅ Brain service returns `{"status":"healthy"}`
2. ✅ SQS message was sent successfully
3. ✅ Subscriber processed message (logs confirm)
4. ✅ Prefect flow was triggered (dashboard shows it)
5. ✅ Worker executed tasks (logs show processing)
6. ✅ Database has results (3 rows in `job_results`)
7. ✅ Staff dashboard shows job with progress
8. ✅ Staff dashboard updates in real-time

---

## Troubleshooting

### Issue: SQS message not appearing

**Check:**
- Environment variable `SQS_QUEUE_URL` set in Brain service
- AWS credentials configured in Render
- Brain service logs for errors

**Fix:**
```bash
# Verify in Render → Brain service → Environment
SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/.../DirectoryBolt
AWS_DEFAULT_ACCESS_KEY_ID=AKIATL4...
AWS_DEFAULT_SECRET_ACCESS_KEY=***
AWS_DEFAULT_REGION=us-east-2
```

### Issue: Subscriber not processing messages

**Check:**
- Subscriber service is running (not crashed)
- Environment variables set:
  - `SQS_QUEUE_URL`
  - `PREFECT_API_URL`
  - `PREFECT_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

**Fix:**
```bash
# Check subscriber logs for:
"SQS_QUEUE_URL environment variable not set"  # Add env var
"Failed to authenticate with Prefect"  # Check API key
"Failed to connect to Supabase"  # Check credentials
```

### Issue: Prefect flow not running

**Check:**
- Prefect Cloud credentials correct
- Worker service is running
- Worker pool "default" exists

**Fix:**
```bash
# In Render → Worker service → Environment
PREFECT_API_URL=https://api.prefect.cloud/api/accounts/.../workspaces/...
PREFECT_API_KEY=pnu_...

# Check worker logs for:
"Worker online"  # Should see this
"Failed to connect to Prefect API"  # Bad credentials
```

### Issue: Worker not writing to database

**Check:**
- Supabase credentials set
- Tables exist in database
- Worker has network access to Supabase

**Fix:**
```bash
# In Render → Worker service → Environment
SUPABASE_URL=https://kolgqfjgncdwddziqloz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Check worker logs for:
"Database connection successful"  # Good
"Failed to connect to Supabase"  # Check URL/key
"Table 'job_results' does not exist"  # Run migrations
```

### Issue: Staff dashboard not showing data

**Check:**
- Supabase URL and anon key in frontend `.env.local`
- Database has data (check Supabase dashboard)
- Real-time enabled on Supabase tables

**Fix:**
```bash
# In .env.local
NEXT_PUBLIC_SUPABASE_URL=https://kolgqfjgncdwddziqloz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# Check browser console for:
"Realtime connected"  # Good
"Failed to connect to Supabase"  # Check credentials
"Permission denied"  # Check RLS policies
```

### Issue: Real-time updates not working

**Check:**
- WebSocket connection established (browser console)
- Supabase Realtime enabled for tables
- RLS policies allow reads

**Fix:**
```sql
-- Enable Realtime for tables
ALTER TABLE jobs REPLICA IDENTITY FULL;
ALTER TABLE job_results REPLICA IDENTITY FULL;
ALTER TABLE queue_history REPLICA IDENTITY FULL;

-- Check RLS policies allow anonymous reads
SELECT * FROM pg_policies WHERE tablename IN ('jobs', 'job_results', 'queue_history');
```

---

## Quick Debug Commands

```bash
# Check SQS queue depth
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-2.amazonaws.com/.../DirectoryBolt \
  --attribute-names ApproximateNumberOfMessages

# Check DLQ for failed messages
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-2.amazonaws.com/.../DirectoryBolt-dlq \
  --attribute-names ApproximateNumberOfMessages

# Check Supabase job status
psql $DATABASE_URL -c "SELECT id, status, progress FROM jobs ORDER BY created_at DESC LIMIT 5;"

# Check job results
psql $DATABASE_URL -c "SELECT job_id, directory_name, status FROM job_results WHERE job_id = 'YOUR-JOB-ID';"

# Check queue history
psql $DATABASE_URL -c "SELECT job_id, event, created_at FROM queue_history WHERE job_id = 'YOUR-JOB-ID' ORDER BY created_at;"
```

---

## Clean Up Test Data

After verification, clean up test data:

```sql
-- Delete test data (use your UUIDs)
DELETE FROM queue_history WHERE job_id = 'YOUR-JOB-ID';
DELETE FROM job_results WHERE job_id = 'YOUR-JOB-ID';
DELETE FROM directory_submissions WHERE submission_queue_id = 'YOUR-JOB-ID';
DELETE FROM jobs WHERE id = 'YOUR-JOB-ID';
DELETE FROM customers WHERE id = 'YOUR-CUSTOMER-ID';
```

---

## Expected Timeline

| Step | Duration |
|------|----------|
| 1. Verify services running | 2 min |
| 2. Fix health endpoint | 5 min |
| 3. Create test job | 3 min |
| 4. Enqueue to SQS | 2 min |
| 5. Monitor system | 3 min |
| 6. Verify database | 2 min |
| 7. Verify dashboard | 2 min |
| **TOTAL** | **19 min** |

---

## Success Message

If all steps pass, you should see:

```
✅ ALL SYSTEMS OPERATIONAL

Frontend → Backend → SQS → Subscriber → Prefect → Worker → Database → Staff Dashboard

The complete data flow works end-to-end.
Staff dashboard CAN successfully read worker outputs.
Real-time updates are functioning.

System is PRODUCTION READY.
```

---

**Guide Created:** November 27, 2025
**Last Updated:** November 27, 2025
