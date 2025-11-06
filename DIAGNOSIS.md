# CRITICAL DIAGNOSIS: Job Processing Pipeline Breakdown

## Problem Statement
User pushes job via `/api/autobolt/push` → Job created in Supabase → **NOTHING HAPPENS** → No polling/processing

**Current Service Status on Render:**
- Subscriber service: LIVE on Render (srv-d45u7e7diees738h2ahg)
- Worker service: Building on Render (srv-d45u7eqdbo4c7385qmg0)
- Prefect Server: Running on Render (srv-d46bvcqli9vc73dehpig)

---

## Investigation Findings

### 1. `/api/autobolt/push` Endpoint Analysis

**File**: `pages/api/autobolt/push.ts`

#### Findings:
- ✅ Creates job in Supabase database (lines 73-92)
- ✅ Attempts to send message to SQS queue (lines 102-154)
- ⚠️ **CRITICAL ISSUE**: Silently fails if AWS credentials not set (line 149)

**Code Issue**:
```typescript
const awsAccessKeyId = process.env.AWS_DEFAULT_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AWS_DEFAULT_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const sqsQueueUrl = process.env.SQS_QUEUE_URL;

if (awsAccessKeyId && awsSecretAccessKey && sqsQueueUrl) {
  // Send to SQS
} else {
  console.warn(`⚠️ Job ${jobData.id} created but not sent to SQS (AWS credentials not configured)`);
  // NO ERROR RETURNED - request still succeeds!
}
```

**Problem**: The endpoint returns HTTP 201 (success) even if message wasn't sent to SQS. User gets no indication that the job won't be processed.

---

### 2. Subscriber Service (`backend/orchestration/subscriber.py`)

#### Startup Requirements:
1. AWS credentials: `AWS_DEFAULT_ACCESS_KEY_ID`, `AWS_DEFAULT_SECRET_ACCESS_KEY`
2. SQS queue URL: `SQS_QUEUE_URL`
3. Prefect API: `PREFECT_API_URL` and optionally `PREFECT_API_KEY`

#### Potential Issues:
1. **Initialization Failure** (lines 22-38):
   ```python
   def get_sqs_client():
       access_key = os.getenv("AWS_DEFAULT_ACCESS_KEY_ID")
       secret_key = os.getenv("AWS_DEFAULT_SECRET_ACCESS_KEY")

       if not access_key or not secret_key:
           raise ValueError("AWS credentials not configured")

       return boto3.client(...)

   sqs = get_sqs_client()  # Called at module load time
   ```
   **CRITICAL**: If AWS credentials are missing, the entire subscriber module fails to load, and the service crashes on startup.

2. **No Queue URL Check at Startup**:
   ```python
   QUEUE_URL = os.getenv("SQS_QUEUE_URL")
   ```
   If `SQS_QUEUE_URL` is missing, the service won't fail until `main_loop()` is called (line 244-246).

3. **Prefect Flow Triggering** (lines 112-123):
   ```python
   flow_run = run_deployment(
       name="process_job/production",  # Hardcoded deployment name
       parameters={...},
       timeout=0
   )
   ```
   **CRITICAL**: This assumes a Prefect deployment named `process_job/production` exists. If not registered, this fails.

---

### 3. Prefect Deployment Status

#### Missing Evidence:
- No `process_job-deployment.yaml` file found in repository
- No deployment registration commands in deployment guide
- No documentation of how `process_job/production` deployment was created

#### Likely Scenario:
The Prefect deployment `process_job/production` **does not exist** on the Render Prefect Server. The subscriber will crash when trying to trigger a non-existent deployment.

---

### 4. Environment Variables on Render Services

#### Required for Subscriber Service:
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
AWS_DEFAULT_REGION
AWS_DEFAULT_ACCESS_KEY_ID
AWS_DEFAULT_SECRET_ACCESS_KEY
SQS_QUEUE_URL
SQS_DLQ_URL
PREFECT_API_URL
PREFECT_API_KEY (if using Prefect Cloud)
```

#### Required for Netlify Frontend:
```
AWS_DEFAULT_ACCESS_KEY_ID
AWS_DEFAULT_SECRET_ACCESS_KEY
AWS_DEFAULT_REGION
SQS_QUEUE_URL
```

#### Required for Worker Service:
```
PREFECT_API_URL
PREFECT_API_KEY
(+ all other services' variables)
```

---

### 5. Docker Entry Points

#### Subscriber Dockerfile (`backend/infra/Dockerfile.subscriber`):
```dockerfile
CMD ["python", "orchestration/subscriber.py"]
```
- ✅ Correct entry point
- ⚠️ If module load fails (missing AWS creds), no error logging before crash

#### Worker Dockerfile (`backend/infra/Dockerfile.worker`):
```dockerfile
CMD ["prefect", "worker", "start", "--pool", "default"]
```
- ✅ Correct entry point
- ⚠️ Requires `PREFECT_API_URL` to be set
- ⚠️ Pool name `default` must exist in Prefect

---

## Root Cause Analysis

### Primary Break Points (in order of likelihood):

#### 1. **[MOST LIKELY] AWS Credentials Not Configured on Netlify**
- **Impact**: Jobs created in database but never sent to SQS
- **Evidence**: No error returned from `/api/autobolt/push` endpoint
- **Symptom**: Jobs appear "pending" but subscriber never receives message
- **Fix**: Set `AWS_DEFAULT_ACCESS_KEY_ID`, `AWS_DEFAULT_SECRET_ACCESS_KEY`, `SQS_QUEUE_URL` in Netlify environment

#### 2. **[VERY LIKELY] Prefect Deployment Not Registered**
- **Impact**: Subscriber crashes when trying to trigger flow
- **Evidence**: Missing `process_job-deployment.yaml` in repository
- **Symptom**: Subscriber service crashes or reports "deployment not found" error
- **Fix**: Register Prefect deployment on Render Prefect Server

#### 3. **[LIKELY] AWS Credentials Missing from Render Subscriber**
- **Impact**: Subscriber service crashes on startup
- **Evidence**: Module-level error in `subscriber.py` line 38
- **Symptom**: Subscriber service shows "crashed" status with exit code non-zero
- **Fix**: Set AWS credentials in Render subscriber service environment

#### 4. **[POSSIBLE] SQS_QUEUE_URL Misconfigured**
- **Impact**: Messages sent to wrong queue or invalid URL
- **Evidence**: Queue URL format doesn't match AWS SQS URL pattern
- **Symptom**: "InvalidQueueUrl" error in logs
- **Fix**: Verify queue URL matches: `https://sqs.{region}.amazonaws.com/{account-id}/{queue-name}`

#### 5. **[POSSIBLE] Prefect Server Not Accessible from Subscriber**
- **Impact**: Subscriber can't connect to Prefect API
- **Evidence**: `PREFECT_API_URL` points to unreachable endpoint
- **Symptom**: "Connection refused" error when triggering flow
- **Fix**: Verify `PREFECT_API_URL` is correct and accessible from Render subscriber

---

## Diagnostic Checklist

### Frontend (Netlify)
- [ ] Check if `AWS_DEFAULT_ACCESS_KEY_ID` is set in Netlify environment
- [ ] Check if `AWS_DEFAULT_SECRET_ACCESS_KEY` is set in Netlify environment
- [ ] Check if `SQS_QUEUE_URL` is set and correct format
- [ ] Test `/api/autobolt/push` endpoint with sample customer ID
- [ ] Check Netlify function logs for SQS errors

### Subscriber Service (Render)
- [ ] Check Render logs for subscriber service startup errors
- [ ] Verify AWS credentials are set: `AWS_DEFAULT_ACCESS_KEY_ID`, `AWS_DEFAULT_SECRET_ACCESS_KEY`
- [ ] Verify `SQS_QUEUE_URL` and `SQS_DLQ_URL` are set
- [ ] Verify `PREFECT_API_URL` is set and correct
- [ ] Test SQS connection by publishing test message manually
- [ ] Check Prefect API accessibility from subscriber container
- [ ] Verify `process_job/production` deployment exists in Prefect

### Worker Service (Render)
- [ ] Check Render logs for worker startup errors
- [ ] Verify Prefect pool `default` exists
- [ ] Verify worker can connect to Prefect API
- [ ] Check worker heartbeat in Prefect

### Prefect Server (Render)
- [ ] Verify Prefect server is running and accessible
- [ ] Check if any deployments are registered
- [ ] Verify `process_job/production` deployment exists
- [ ] Check Prefect server logs for errors

---

## Next Steps (In Priority Order)

1. **IMMEDIATE**: Verify AWS credentials are set in Netlify environment variables
2. **IMMEDIATE**: Verify SQS queue URL is correct in Netlify environment
3. **IMMEDIATE**: Check Subscriber service logs on Render for startup errors
4. **HIGH**: Verify `process_job/production` deployment exists on Prefect Server
5. **HIGH**: If deployment missing, register it using deployment build command
6. **MEDIUM**: Add better error handling to push endpoint to fail loudly
7. **MEDIUM**: Add health check endpoints to all services
8. **LOW**: Implement service discovery and health monitoring dashboard

---

## Credentials Currently Exposed (from RAILWAY_QUICK_DEPLOY.md)

⚠️ **SECURITY WARNING**: The file `RAILWAY_QUICK_DEPLOY.md` contains exposed credentials. These need to be rotated immediately:

- AWS Access Key ID: `AKIATL4NZUEBEHZDU3YI`
- AWS Secret Access Key: `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`
- Supabase Service Role Key: `eyJhbGc...` (JWT token)
- Prefect API Key: `pnu_Qv3Dxk4dTGdA4Euwup8ylOxIZRlrKl1sgAmM`
- Stripe Secret Key: `sk_live_...`
- AI API Keys: Anthropic, Gemini, 2Captcha

**ACTION REQUIRED**: Rotate all these credentials immediately.

