# Job Processing Pipeline Test Guide

## Testing Strategy

This guide provides step-by-step instructions to identify where the pipeline breaks.

---

## Phase 1: Frontend Verification (Netlify)

### 1.1 Check Environment Variables

Go to Netlify Dashboard → Your Site → Site Settings → Build & Deploy → Environment

**Required Variables to Check:**
```
✅ AWS_DEFAULT_ACCESS_KEY_ID (should be set and not empty)
✅ AWS_DEFAULT_SECRET_ACCESS_KEY (should be set and not empty)
✅ AWS_DEFAULT_REGION (should be "us-east-2" or your configured region)
✅ SQS_QUEUE_URL (should match format: https://sqs.{region}.amazonaws.com/{account}/{queue})
```

**What to look for:**
- Empty values = Pipeline fails at step 1
- Incorrect SQS_QUEUE_URL format = Pipeline fails at step 1

---

### 1.2 Test Push Endpoint Manually

```bash
# Test locally or use curl
curl -X POST https://your-netlify-domain.netlify.app/api/autobolt/push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_STAFF_TOKEN" \
  -d '{
    "customerId": "test-customer-id",
    "priority": 2
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "job": { "id": "...", "status": "pending", ... },
  "jobId": "...",
  "queueId": "..."
}
```

**Check the Response Body** for notes:
- If `notes` contains "AWS credentials not configured" → **AWS creds missing from Netlify**
- If response is HTTP 201 with job created → **Message might not be sent to SQS**

### 1.3 Check Netlify Function Logs

Netlify Dashboard → Functions → autobolt-push logs

**Look for:**
- `✅ Job {id} sent to SQS queue. MessageId: {msgId}` = Success
- `⚠️ Job {id} created but not sent to SQS (AWS credentials not configured)` = **FOUND ISSUE #1**
- `❌ Failed to send job {id} to SQS: {error}` = Check error details

---

## Phase 2: SQS Queue Verification (AWS Console)

### 2.1 Check Queue Attributes

AWS Console → SQS → Select Queue → Details tab

**Verify:**
- Queue URL matches `SQS_QUEUE_URL` environment variable
- Queue is not in DLQ
- Queue attributes: Visibility timeout ≥ 600 seconds
- Message retention period: Should be at least 1 day

### 2.2 Check for Messages in Queue

AWS Console → SQS → Select Queue → Send and receive messages

**Scenario A: Messages in queue**
- ✅ `/api/autobolt/push` is working (messages are being sent)
- ❌ Subscriber service is NOT consuming them
- **Next**: Go to Phase 3 (Check Subscriber)

**Scenario B: No messages in queue**
- ❌ Job is not being sent to SQS from Netlify
- **Next**: Go back to Phase 1.3 and check Netlify logs

### 2.3 Check Dead Letter Queue (DLQ)

AWS Console → SQS → Select DLQ → Send and receive messages

**If messages in DLQ:**
- ✅ Messages were sent to SQS
- ✅ Subscriber received messages but failed processing
- Message body should show `_dlq_reason` field
- **Next**: Go to Phase 3 (Check Subscriber Logs)

---

## Phase 3: Subscriber Service Verification (Render)

### 3.1 Check Service Status

Render Dashboard → Select Subscriber Service → Overview

**Check:**
- Status should be "Live" or "Running"
- If status is "Failed" or "Crashed" → Check logs
- If building → Wait for build to complete

### 3.2 Check Service Logs

Render Dashboard → Select Subscriber Service → Logs tab

**Filter for errors:**

**Looking for startup errors:**
- `AWS credentials not configured` = **FOUND ISSUE #2**: Missing AWS credentials on Render
- `SQS_QUEUE_URL environment variable not set` = **FOUND ISSUE #3**: Missing queue URL
- `Error loading module` = Check error details
- `Connection refused` when trying to reach Prefect = **FOUND ISSUE #4**: Can't reach Prefect

**Looking for runtime errors:**
- `Invalid message format` = Message from SQS is malformed
- `Missing required field: job_id` = Check SQS message format
- `Error processing message` = Check error type
- `Failed to delete message` = Issue with SQS permissions
- `Trigger Prefect flow` succeeded but no flow ID = **FOUND ISSUE #5**: Deployment doesn't exist

### 3.3 Verify Environment Variables

Render Dashboard → Select Subscriber Service → Environment tab

**Required variables (check if set):**
```
✅ SUPABASE_URL
✅ SUPABASE_SERVICE_ROLE_KEY
✅ AWS_DEFAULT_REGION
✅ AWS_DEFAULT_ACCESS_KEY_ID
✅ AWS_DEFAULT_SECRET_ACCESS_KEY
✅ SQS_QUEUE_URL
✅ SQS_DLQ_URL
✅ PREFECT_API_URL
✅ PREFECT_API_KEY (optional if Prefect Cloud)
```

**Common Issues:**
- Empty values = Not set
- Wrong values = Copy/paste error
- Missing values = Not configured during deployment

### 3.4 Verify AWS Credentials

Test SQS connectivity from subscriber logs:
- If "No messages in queue" repeated = ✅ Subscriber is polling SQS correctly
- If "connection refused to SQS" = ❌ AWS credentials invalid or region wrong

---

## Phase 4: Prefect Deployment Verification

### 4.1 Check Prefect Server Status

Render Dashboard → Select Prefect Server → Logs

**Should see:**
```
Prefect server started successfully
Listening on {host}:{port}
```

### 4.2 Check Registered Deployments

**Option A: Via Prefect Cloud Dashboard (if using Prefect Cloud)**
- Go to https://app.prefect.cloud
- Select your workspace
- Check "Deployments" section
- Look for `process_job/production` deployment

**Option B: Via Render Prefect Server**
- Access Render Prefect Server at `https://{render-prefect-url}` (usually https://prefect-server-srv-id.onrender.com)
- Look for Deployments section
- Check if `process_job/production` exists

**Result:**
- If deployment exists → **Check execution history for errors**
- If deployment missing → **FOUND ISSUE #6**: Need to register deployment

### 4.3 Check Deployment Configuration

**Expected deployment name:** `process_job/production`

**Verify in deployment configuration:**
- Work pool: `default` (or configured pool)
- Flow name: `process_job`
- Parameters: Should accept `job_id`, `customer_id`, `package_size`, `priority`

---

## Phase 5: Worker Service Verification (Render)

### 5.1 Check Worker Status

Render Dashboard → Select Worker Service → Overview

**Status checks:**
- If "Failed" → Check logs for startup error
- If "Building" → Wait for build to complete
- If "Live" → ✅ Service is running

### 5.2 Check Worker Logs

Render Dashboard → Select Worker Service → Logs

**Looking for:**
```
Starting worker...
Worker started successfully
Listening on work pool: default
```

**Errors to watch for:**
- `PREFECT_API_URL not configured` = Missing Prefect API URL
- `Can't connect to Prefect API` = Can't reach Prefect server
- `Failed to register with work pool` = Work pool doesn't exist
- `Connection refused` = Prefect server not accessible

### 5.3 Verify Worker Registration

Check Prefect dashboard:
- Navigate to Work Pools
- Look for `default` pool
- Check if worker is registered and healthy

---

## Phase 6: End-to-End Test

Once all phases pass, perform complete test:

### 6.1 Create Test Job

```bash
curl -X POST https://your-netlify-domain.netlify.app/api/autobolt/push \
  -H "Content-Type: application/json" \
  -d '{"customerId": "test-customer-123", "priority": 2}'
```

### 6.2 Monitor SQS Queue

AWS Console → SQS → Select Queue → Watch for:
- Message appears in queue
- Message is consumed (disappears from queue)
- Check DLQ for any failures

### 6.3 Check Subscriber Logs

Look for:
```
Received 1 messages
Processing message for job {job_id}
Triggered Prefect flow for job {job_id}
flow_run_id: {flow_id}
```

### 6.4 Check Prefect Flow Execution

Prefect Dashboard → Flow Runs → Search for job ID

**Monitor:**
- Flow state transitions: Scheduled → Running → Completed
- Task execution logs
- Any failure details

### 6.5 Check Database Records

Supabase → Query `queue_history` table:
```sql
SELECT * FROM queue_history WHERE job_id = '{job_id}'
ORDER BY created_at DESC;
```

**Expected events (in order):**
1. `queue_claimed` - Subscriber received from SQS
2. `flow_triggered` - Flow started in Prefect
3. `flow_started` - Flow execution began
4. (task-specific events)
5. `job_completed` or `job_failed`

---

## Quick Troubleshooting Guide

| Symptom | Most Likely Cause | Fix |
|---------|------------------|-----|
| Jobs created but nothing happens | AWS credentials not in Netlify | Set AWS creds in Netlify environment |
| Subscriber crashes on startup | AWS credentials not in Render | Set AWS creds in Render subscriber |
| Messages stay in SQS queue | Subscriber not consuming | Check subscriber service status |
| Messages go to DLQ | Prefect deployment doesn't exist | Register `process_job/production` deployment |
| Flow fails to execute | Worker pool doesn't exist | Create `default` work pool in Prefect |
| Worker shows offline | Can't reach Prefect API | Check PREFECT_API_URL is correct |

---

## Credentials to Rotate (URGENT)

The following credentials in `RAILWAY_QUICK_DEPLOY.md` are publicly exposed and must be rotated:

1. AWS Access Keys (current set is compromised)
2. Supabase Service Role Key
3. Prefect API Key
4. Stripe Secret Key
5. All AI API Keys

**Rotation Steps:**
1. Go to AWS IAM → Users → Create new access key
2. Update all services with new keys
3. Delete old access key from AWS
4. Follow similar process for other services

