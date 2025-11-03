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
   -- Should return 1 row
   
   -- Check if function exists
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name = 'find_stale_jobs';
   -- Should return 1 row
   ```

## Step 2: Configure Slack Webhook

Add to `backend/.env`:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

To get a Slack webhook:
1. Go to https://api.slack.com/apps
2. Create new app or select existing
3. Enable Incoming Webhooks
4. Add webhook to workspace
5. Copy webhook URL

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

