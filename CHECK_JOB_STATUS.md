# How to Check if Jobs Are Processing

## Quick Status Check

### 1. Check Docker Services
```powershell
cd backend\infra
docker-compose ps
```

**Expected running services:**
- `prefect-server` - Job orchestration (port 4200)
- `subscriber` - SQS queue subscriber
- `worker` - Playwright submission runner
- `stale-job-monitor` - Stale job recovery
- `dlq-monitor` - Dead letter queue monitor

### 2. Prefect UI (Main Job Monitoring)
**URL:** http://localhost:4200

**What to check:**
- Flow runs tab - See active/completed jobs
- Task states - See which tasks are running
- Logs - View detailed execution logs
- Artifacts - See screenshots/results

**If Prefect UI is not accessible:**
```powershell
cd backend\infra
docker-compose logs prefect-server
```

### 3. Staff Dashboard (Your Site)
**URL:** http://localhost:3000/staff-dashboard

**Tabs to check:**
- **Queue** - Pending jobs waiting to process
- **Jobs** - Active job progress
- **Analytics** - Processing statistics
- **Activity** - Submission logs

### 4. Supabase Database Queries

**Check active jobs:**
```sql
SELECT id, customer_id, status, created_at, updated_at 
FROM jobs 
WHERE status IN ('pending', 'in_progress')
ORDER BY created_at DESC;
```

**Check job results:**
```sql
SELECT job_id, directory_name, status, error_message, created_at
FROM job_results
ORDER BY created_at DESC
LIMIT 50;
```

**Check queue history:**
```sql
SELECT job_id, event, created_at, details
FROM queue_history
ORDER BY created_at DESC
LIMIT 50;
```

**Check worker health:**
```sql
SELECT worker_id, last_seen, status
FROM worker_heartbeats
ORDER BY last_seen DESC;
```

### 5. Docker Logs (Real-time Monitoring)

**View all logs:**
```powershell
cd backend\infra
docker-compose logs -f
```

**View specific service:**
```powershell
# Subscriber (SQS → Prefect)
docker-compose logs -f subscriber

# Worker (Playwright execution)
docker-compose logs -f worker

# Stale job monitor
docker-compose logs -f stale-job-monitor

# DLQ monitor
docker-compose logs -f dlq-monitor
```

### 6. Check if Services Are Healthy

**Test Prefect connection:**
```powershell
curl http://localhost:4200/api/health
```

**Check SQS queue depth:**
- AWS Console → SQS → Your queue
- Or check Supabase `queue_history` table

**Check for errors:**
```powershell
cd backend\infra
docker-compose logs | Select-String -Pattern "ERROR|FAILED|Exception" | Select-Object -Last 20
```

## Troubleshooting

### No jobs processing?
1. Check if `subscriber` is running: `docker-compose ps subscriber`
2. Check if `worker` is running: `docker-compose ps worker`
3. Check SQS queue for messages
4. Check Prefect UI for flow runs

### Jobs stuck "in_progress"?
1. Check `stale-job-monitor` logs
2. Check worker heartbeats in Supabase
3. Check Prefect UI for failed tasks

### Can't access Prefect UI?
1. Check if port 4200 is in use: `Get-NetTCPConnection -LocalPort 4200`
2. Check Prefect logs: `docker-compose logs prefect-server`
3. Restart: `docker-compose restart prefect-server`

