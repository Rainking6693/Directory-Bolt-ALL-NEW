# CRITICAL: Render Deployment Setup Checklist

This checklist identifies and fixes the blocking issues preventing job processing on Render.

---

## ISSUE #1: AWS Credentials Not in Netlify Environment

### Status Check
Go to: Netlify Dashboard → Your Site → Site Settings → Build & Deploy → Environment

### Required Variables
These must be set exactly:
```
AWS_DEFAULT_ACCESS_KEY_ID=<your-aws-access-key>
AWS_DEFAULT_SECRET_ACCESS_KEY=<your-aws-secret-key>
AWS_DEFAULT_REGION=us-east-2  (or your configured region)
SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/<account-id>/DirectoryBolt
```

### How to Fix
1. Get AWS credentials from AWS IAM (or create new access key)
2. Go to Netlify → Site Settings → Environment
3. Add each variable one by one (copy-paste carefully)
4. Click "Save" for each variable
5. Trigger a new deploy: Deploys → Trigger Deploy → Deploy Site

### Verification
- After deploy, check function logs: Functions → autobolt-push
- Push a test job
- Look for log line: `✅ Job {id} sent to SQS queue. MessageId:`
- If you see this, AWS is configured correctly

---

## ISSUE #2: Subscriber Service Missing AWS Credentials on Render

### Status Check
Go to: Render Dashboard → Select "subscriber" service → Environment

### Required Variables
```
SUPABASE_URL=https://kolgqfjgncdwddziqloz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>

AWS_DEFAULT_REGION=us-east-2
AWS_DEFAULT_ACCESS_KEY_ID=<same-as-netlify>
AWS_DEFAULT_SECRET_ACCESS_KEY=<same-as-netlify>

SQS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/<account-id>/DirectoryBolt
SQS_DLQ_URL=https://sqs.us-east-2.amazonaws.com/<account-id>/DirectoryBolt-dlq

PREFECT_API_URL=<your-prefect-server-url>
PREFECT_API_KEY=<optional-if-using-cloud>
```

### How to Fix
1. Go to Render Dashboard
2. Click on "subscriber" service
3. Go to "Environment" tab
4. Add each variable
5. Click "Save" when done
6. Render will automatically restart the service

### Verification
- Check service logs: Logs tab
- Should see: `Starting SQS subscriber`
- Should see: `Received X messages` or `No messages in queue` (normal)
- Should NOT see: `AWS credentials not configured` (ERROR)
- Should NOT see: `SQS_QUEUE_URL environment variable not set` (ERROR)

---

## ISSUE #3: Prefect Deployment Not Registered

### Status Check
Go to: Render Dashboard → Select "prefect-server" service

Check if Prefect is running and accessible at the provided URL.

### How to Fix

#### Option A: Deploy from Local Machine (Recommended)
```bash
# Set environment variables
export PREFECT_API_URL=https://prefect-server-xyz.onrender.com
# Optional if using Prefect Cloud
# export PREFECT_API_KEY=your-prefect-cloud-key

# Navigate to backend directory
cd backend

# Install dependencies (if not already installed)
pip install -r requirements.txt

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
   - Flow: process_job
   - Deployment Name: production
   - Work Pool: default
✅ Deployment applied successfully!
   Deployment ID: <uuid>

Deployment is now ready for use.
Subscriber will trigger: process_job/production
```

#### Option B: Deploy from Render (Using Render Deployment)
If you have `render.yaml` with a deployment service (not currently in config), it would auto-register.

### Verification
1. Go to Prefect Dashboard (Prefect Cloud or Render Prefect Server UI)
2. Navigate to "Deployments" section
3. Look for `process_job/production`
4. If found, check status (should be "Active")
5. If not found, re-run the deployment script

### Manual Verification (If Prefect Server Running)
```bash
# From Render Prefect Server UI
curl https://prefect-server-xyz.onrender.com/api/deployments \
  | grep "process_job"
```

---

## ISSUE #4: Worker Service Can't Connect to Prefect

### Status Check
Go to: Render Dashboard → Select "worker" service → Logs

Look for errors like:
```
Can't connect to Prefect API
Connection refused
Unable to register with work pool
```

### How to Fix

1. **Verify PREFECT_API_URL is set in Worker Environment**
   - Go to Render → worker service → Environment
   - Verify `PREFECT_API_URL` is exactly the same as on Subscriber

2. **Verify Work Pool Exists**
   - Go to Prefect Dashboard
   - Check "Work Pools" section
   - Look for `default` pool
   - If not found, create new work pool named `default`

3. **Restart Worker Service**
   - Go to Render → worker service → Settings
   - Click "Restart Worker"
   - Wait for service to start
   - Check logs for successful startup

### Verification
- Logs should show: `Starting worker...`
- Logs should show: `Worker registered with pool: default`
- No connection errors in logs

---

## ISSUE #5: Subscriber Service Can't Connect to SQS

### Status Check
Go to: Render Dashboard → Select "subscriber" service → Logs

Look for errors like:
```
InvalidClientTokenId
AccessDenied
SignatureDoesNotMatch
```

These indicate invalid AWS credentials.

### How to Fix
1. Verify AWS credentials are correct in Render subscriber environment
2. Verify AWS credentials have SQS permissions:
   - Go to AWS IAM → Users → Select your user
   - Check "Permissions" tab
   - Should have policy allowing: `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:SendMessage`

3. If credentials are invalid, create new AWS access key:
   - AWS Console → IAM → Users → Select User
   - Security Credentials → Create Access Key
   - Update Netlify AND all Render services with new credentials
   - Delete old access key

### Verification
- Logs should show: `No messages in queue` (normal, no polling error)
- Should NOT show AWS credential errors

---

## ISSUE #6: Subscriber Can't Connect to Database

### Status Check
Go to: Render Dashboard → Select "subscriber" service → Logs

Look for errors like:
```
Connection refused to Supabase
Invalid service role key
Authentication failed
```

### How to Fix
1. Go to Render → subscriber → Environment
2. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
3. Test locally:
   ```bash
   python -c "from db.supabase import get_supabase_client; c = get_supabase_client(); print('Connected!')"
   ```

### Verification
- No database connection errors in logs
- Should be able to record history events

---

## ISSUE #7: Subscriber Crashes on Startup

### Status Check
Go to: Render Dashboard → Select "subscriber" service

If status is "Failed" or "Crashed", check logs for startup errors.

### Common Causes and Fixes

**Cause 1: Missing AWS Credentials**
```
AWS credentials not configured
```
**Fix**: See ISSUE #2 above

**Cause 2: Missing SQS_QUEUE_URL**
```
SQS_QUEUE_URL environment variable not set
```
**Fix**: Add `SQS_QUEUE_URL` to environment variables

**Cause 3: Missing PREFECT_API_URL**
```
PREFECT_API_URL environment variable not set
```
**Fix**: Add `PREFECT_API_URL` to environment variables

**Cause 4: Python Module Error**
```
ModuleNotFoundError: No module named 'xxx'
```
**Fix**: Check if `requirements.txt` is up to date and rebuild service

---

## Complete Setup Flow (Checklist)

Follow this order to ensure all dependencies are in place:

### Step 1: AWS Configuration (Netlify)
- [ ] Get AWS access key ID
- [ ] Get AWS secret access key
- [ ] Get SQS queue URL from AWS
- [ ] Add to Netlify environment
- [ ] Trigger deploy
- [ ] Test `/api/autobolt/push` endpoint
- [ ] Verify message appears in SQS queue

### Step 2: Render Subscriber Setup
- [ ] Add all AWS variables to Render subscriber environment
- [ ] Add Supabase variables
- [ ] Add PREFECT_API_URL
- [ ] Save and wait for service restart
- [ ] Check logs for startup success

### Step 3: Prefect Setup
- [ ] Verify Prefect Server is running
- [ ] Register `process_job/production` deployment
- [ ] Create `default` work pool if it doesn't exist

### Step 4: Render Worker Setup
- [ ] Add PREFECT_API_URL to worker environment
- [ ] Add all other variables from subscriber
- [ ] Save and wait for service restart
- [ ] Check logs for successful registration with work pool

### Step 5: End-to-End Test
- [ ] Create test job via `/api/autobolt/push`
- [ ] Verify message in SQS queue
- [ ] Wait for message to be consumed
- [ ] Check Prefect flow execution
- [ ] Verify job completed in database

---

## Credentials That Need Rotation (SECURITY ALERT)

**IMPORTANT**: The file `RAILWAY_QUICK_DEPLOY.md` contains exposed credentials. These MUST be rotated:

1. **AWS Access Keys** (currently exposed)
   - Current Key ID: `AKIATL4NZUEBEHZDU3YI` - **COMPROMISED**
   - Action: Create new key, update all services, delete old key

2. **Supabase Service Role Key** (currently exposed)
   - Action: Rotate in Supabase dashboard

3. **Prefect API Key** (currently exposed)
   - Action: Rotate in Prefect dashboard

4. **Stripe Secret Key** (currently exposed)
   - Action: Rotate in Stripe dashboard

5. **AI API Keys** (currently exposed)
   - Anthropic, Gemini, 2Captcha

**Steps to Rotate AWS Keys:**
1. Go to AWS Console → IAM → Users → Select your user
2. Security Credentials → Create New Access Key
3. Copy new key and secret
4. Update all services (Netlify, all Render services)
5. Verify everything still works
6. Delete old access key from AWS

---

## Still Having Issues?

If you've completed all steps above and jobs still aren't processing:

1. **Check Netlify Logs**
   ```
   Netlify Dashboard → Functions → autobolt-push
   Look for: "✅ Job {id} sent to SQS queue"
   ```

2. **Check SQS Queue**
   ```
   AWS Console → SQS → DirectoryBolt
   Should show: Message count (if messages not consumed)
   ```

3. **Check Render Subscriber Logs**
   ```
   Render Dashboard → subscriber → Logs
   Look for: "Triggered Prefect flow for job"
   ```

4. **Check Prefect Flow Execution**
   ```
   Prefect Dashboard → Flow Runs
   Look for your job ID
   ```

5. **Check Worker Logs**
   ```
   Render Dashboard → worker → Logs
   Should show task execution
   ```

6. **Check Database**
   ```
   Supabase → Query queue_history table
   Should show: queue_claimed → flow_triggered → flow_started → ...
   ```

---

## Support

If you need help debugging:
1. Collect all logs from:
   - Netlify functions
   - Render subscriber service
   - Render worker service
   - Prefect dashboard
   - Supabase database (queue_history table)

2. Check that all credentials are correct and match across services

3. Verify Prefect deployment exists and has correct name

4. Ensure work pool `default` exists in Prefect

