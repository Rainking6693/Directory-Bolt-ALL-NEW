# DirectoryBolt Migration Runbook

## Migration Strategy: Old Poller → Prefect + SQS

### Overview

Safe, phased migration with rollback capability at each step.

**Phases**:
1. **Dual-write**: New system runs in shadow mode alongside old poller
2. **Shadow**: Both systems process jobs, compare results
3. **Cutover**: Switch traffic to new system, keep old as backup
4. **Cleanup**: Remove old poller after validation period

---

## Phase 1: Dual-Write (Week 1)

### Goal
Run new system in parallel without affecting production.

### Steps

1. **Deploy new infrastructure**:
```bash
# Apply database migrations
psql $DATABASE_URL < backend/db/migrations/001_job_results_idem.sql
psql $DATABASE_URL < backend/db/migrations/002_worker_heartbeats.sql
psql $DATABASE_URL < backend/db/migrations/003_queue_history.sql

# Create SQS queues
cd backend/infra/terraform
terraform init
terraform apply -target=aws_sqs_queue.jobs
terraform apply -target=aws_sqs_queue.dlq

# Deploy Docker services
docker-compose up -d brain subscriber worker
```

2. **Modify job creation API to dual-write**:
```typescript
// pages/api/staff/create-test-customer.ts
// After creating job in Supabase:
if (process.env.ENABLE_NEW_QUEUE === 'true') {
  await sendToSQS({
    job_id: job.id,
    customer_id: customer.customer_id,
    package_size: package_size,
    priority: 'starter'
  });
}
```

3. **Monitor both systems**:
- Old poller logs: DigitalOcean
- New system: Prefect UI + Supabase `queue_history`

4. **Compare results**:
```sql
-- Check if both systems processed same jobs
SELECT 
  j.id,
  j.status as old_status,
  jr.status as new_status,
  jr.directory_name
FROM jobs j
LEFT JOIN job_results jr ON jr.job_id = j.id
WHERE j.created_at > NOW() - INTERVAL '24 hours'
ORDER BY j.created_at DESC;
```

### Success Criteria
- New system processes 100% of test jobs
- No errors in Prefect UI
- Results match old system (>95% agreement)

### Rollback
Set `ENABLE_NEW_QUEUE=false` in environment variables.

---

## Phase 2: Shadow Mode (Week 2)

### Goal
Validate new system handles production load.

### Steps

1. **Enable for 10% of production traffic**:
```typescript
// Gradual rollout
const useNewQueue = Math.random() < 0.10;
if (useNewQueue) {
  await sendToSQS(jobData);
}
```

2. **Monitor metrics**:
- Success rate: `SELECT COUNT(*) FROM job_results WHERE status='submitted' GROUP BY DATE(created_at)`
- Latency: Check Prefect task durations
- Error rate: `SELECT COUNT(*) FROM job_results WHERE status='failed'`

3. **Increase to 50%, then 100%**:
```typescript
const useNewQueue = Math.random() < 0.50; // Then 1.00
```

### Success Criteria
- P95 latency < 5 minutes per job
- Success rate > 90%
- Zero data loss
- No customer complaints

### Rollback
Reduce percentage or set to 0%.

---

## Phase 3: Cutover (Week 3)

### Goal
Make new system primary, keep old as backup.

### Steps

1. **Stop old poller**:
```bash
# In DigitalOcean
# Suspend the db-worker-poller service
```

2. **Route 100% to new system**:
```typescript
// Remove conditional, always use new queue
await sendToSQS(jobData);
```

3. **Monitor for 48 hours**:
- Check Prefect UI for any stuck flows
- Monitor SQS DLQ for failed messages
- Watch `stale_workers` view for unhealthy workers

4. **Keep old poller ready**:
- Don't delete code or infrastructure
- Can restart in <5 minutes if needed

### Success Criteria
- 48 hours of stable operation
- No increase in support tickets
- All jobs completing successfully

### Rollback
1. Restart old poller on DigitalOcean
2. Stop sending to SQS
3. Drain SQS queue or let it process naturally

---

## Phase 4: Cleanup (Week 4+)

### Goal
Remove old system after validation.

### Steps

1. **Archive old poller code**:
```bash
git mv DB-WORKER-THIS-ONE DB-WORKER-ARCHIVED
git commit -m "Archive old poller - replaced by Prefect"
```

2. **Delete old infrastructure**:
- Suspend/delete DigitalOcean service
- Remove old environment variables
- Clean up old Docker images

3. **Update documentation**:
- Remove references to old poller
- Update README with new architecture
- Document new deployment process

---

## Troubleshooting

### Issue: Messages stuck in SQS

**Symptoms**: Queue depth increasing, no processing

**Solution**:
```bash
# Check subscriber logs
docker logs -f subscriber

# Restart subscriber
docker-compose restart subscriber

# Check Prefect server
curl http://localhost:4200/api/health
```

### Issue: High failure rate

**Symptoms**: Many jobs in `failed` status

**Solution**:
```sql
-- Check error patterns
SELECT error_message, COUNT(*) 
FROM job_results 
WHERE status='failed' 
GROUP BY error_message 
ORDER BY COUNT(*) DESC;

-- Check DLQ
aws sqs receive-message --queue-url $SQS_DLQ_URL
```

### Issue: Stale workers

**Symptoms**: Workers not sending heartbeats

**Solution**:
```sql
-- Find stale workers
SELECT * FROM stale_workers;

-- Restart worker
docker-compose restart worker
```

### Issue: Idempotency key conflicts

**Symptoms**: "duplicate key violation" errors

**Solution**:
```sql
-- Check for duplicates
SELECT idempotency_key, COUNT(*) 
FROM job_results 
GROUP BY idempotency_key 
HAVING COUNT(*) > 1;

-- This is expected behavior - retries are working correctly
-- If seeing too many, check retry logic
```

---

## Emergency Procedures

### Complete Rollback to Old System

1. **Stop new system**:
```bash
docker-compose down
```

2. **Restart old poller**:
```bash
# In DigitalOcean: Resume db-worker-poller service
```

3. **Disable SQS writes**:
```bash
# Set in Netlify environment
ENABLE_NEW_QUEUE=false
```

4. **Drain SQS queue** (optional):
```bash
# Let messages expire (visibility timeout)
# Or manually process with old poller
```

### Data Recovery

If jobs were lost during migration:

```sql
-- Find jobs without results
SELECT j.id, j.customer_id, j.created_at
FROM jobs j
LEFT JOIN job_results jr ON jr.job_id = j.id
WHERE j.created_at > '2025-10-30'
  AND jr.id IS NULL
  AND j.status IN ('pending', 'in_progress');

-- Re-queue them
-- (Use script to send to SQS or mark as pending for old poller)
```

---

## Monitoring Dashboards

### Prefect UI
- **URL**: http://localhost:4200 or app.prefect.cloud
- **Key metrics**: Flow run success rate, task durations, active runs

### Supabase Dashboard
- **Tables to monitor**:
  - `queue_history`: Event stream
  - `worker_heartbeats`: Worker health
  - `job_results`: Submission outcomes

### CloudWatch (AWS)
- **SQS metrics**: Queue depth, age of oldest message
- **Alarms**: Set for queue depth > 100, DLQ messages > 10

---

## Acceptance Tests

Run before each phase:

```bash
# 1. Create test customer
curl -X POST https://directorybolt.com/api/staff/create-test-customer \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -d '{"name":"Test Customer","email":"test@example.com"}'

# 2. Verify job in Prefect UI
# Check: http://localhost:4200/flows

# 3. Wait for completion (max 10 minutes)

# 4. Verify results in Supabase
psql $DATABASE_URL -c "SELECT * FROM job_results WHERE job_id='<job-id>'"

# 5. Check customer dashboard
# Visit: https://directorybolt.com/customer-portal
# Verify: Job shows as completed with submission count
```

---

## Support Contacts

- **Infrastructure**: DevOps team
- **Prefect**: prefect-support@example.com
- **Database**: DBA team
- **On-call**: PagerDuty rotation

---

## Appendix: Environment Variables

### Required
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SQS_QUEUE_URL`
- `SQS_DLQ_URL`
- `PREFECT_API_URL`

### Optional
- `PREFECT_API_KEY` (if using Prefect Cloud)
- `CREWAI_URL` (defaults to http://brain:8080)
- `PLAYWRIGHT_HEADLESS` (defaults to 1)
- `LOG_LEVEL` (defaults to INFO)

### Feature Flags
- `ENABLE_NEW_QUEUE` (true/false)
- `SHADOW_MODE_PERCENTAGE` (0-100)
