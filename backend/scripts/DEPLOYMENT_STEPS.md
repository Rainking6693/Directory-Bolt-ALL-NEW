# Deployment Steps - Audit Fixes

## Step 1: Run Database Migrations

Since Supabase Python client doesn't support direct SQL execution, run migrations manually in Supabase SQL Editor:

1. **Open Supabase SQL Editor:**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Navigate to SQL Editor

2. **Run Migration 004:**
   - Open: `backend/db/migrations/004_rate_limit_requests.sql`
   - Copy all SQL content
   - Paste into Supabase SQL Editor
   - Click "Run"

3. **Run Migration 005:**
   - Open: `backend/db/migrations/005_find_stale_jobs_function.sql`
   - Copy all SQL content
   - Paste into Supabase SQL Editor
   - Click "Run"

4. **Verify migrations:**
   ```sql
   -- Check if table exists
   SELECT table_name FROM information_schema.tables 
   WHERE table_name = 'rate_limit_requests';
   -- Expected result: 1 row with value "rate_limit_requests" in the table_name column
   
   -- Check if function exists
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name = 'find_stale_jobs';
   -- Expected result: 1 row with value "find_stale_jobs" in the routine_name column
   
   -- Check if view exists
   SELECT table_name FROM information_schema.views 
   WHERE table_name = 'stale_jobs_view';
   -- Expected result: 1 row with value "stale_jobs_view" in the table_name column
   ```
   
   ✅ **If all queries return 1 row each, migrations are successful!**

## Step 2: Configure Slack Webhook (OPTIONAL)

**Note:** Slack alerts are optional. The DLQ monitor works without them, but alerts help you know immediately when failures occur.

If you don't have Slack or don't want alerts:
- Skip this step
- Monitor DLQ manually via AWS console or Docker logs
- See `backend/scripts/SLACK_GETTING_STARTED.md` for alternatives

If you want Slack alerts:

1. **Get Slack** (if you don't have it):
   - Go to https://slack.com/get-started
   - Create account and workspace
   - See `backend/scripts/SLACK_GETTING_STARTED.md` for details

2. **Set up webhook:**
   - Follow guide: `backend/scripts/SLACK_WEBHOOK_SETUP.md`
   - Or quick steps:
     - Go to https://api.slack.com/apps
     - Create new app → Enable "Incoming Webhooks"
     - Add webhook to workspace → Select channel
     - Copy webhook URL

3. **Add to `backend/.env`:**

## Step 3: Build and Start Monitoring Services

```powershell
cd backend\infra
docker-compose build stale-job-monitor dlq-monitor
docker-compose up -d stale-job-monitor dlq-monitor
```

## Step 4: Verify Services

```powershell
# Check if services are running
docker-compose ps

# Check logs
docker-compose logs -f stale-job-monitor
docker-compose logs -f dlq-monitor
```

## Step 5: Test Health Endpoint

```powershell
# Test health endpoint
curl http://localhost:3000/api/health

# Should return JSON with status: "healthy"
```

## Step 6: Test Rate Limiting

```powershell
# Make multiple requests to test rate limiting
for ($i=1; $i -le 105; $i++) {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing
    Write-Host "Request $i`: Status $($response.StatusCode)"
}

# Expected: First 100 requests succeed, last 5 return 429
```

