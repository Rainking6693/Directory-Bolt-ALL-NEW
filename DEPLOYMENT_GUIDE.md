# Backend Audit Fixes - Deployment Guide

**Date:** November 2, 2025  
**Version:** 1.0  
**Status:** Ready for Deployment

---

## 🎯 Overview

This guide walks you through deploying all P0 critical fixes identified in the backend audit:

1. **Stale Job Monitor** - Detects and recovers stuck jobs
2. **API Rate Limiting** - Protects against abuse
3. **DLQ Monitoring** - Alerts on failed jobs

**Total Deployment Time:** ~30 minutes  
**Downtime Required:** None (zero-downtime deployment)

---

## 📋 Pre-Deployment Checklist

### Environment Variables

Ensure these are set in your environment:

#### Required (Already Configured)
- [ ] `SUPABASE_URL` - Supabase project URL
- [ ] `SUPABASE_SERVICE_KEY` - Supabase service role key
- [ ] `SQS_QUEUE_URL` - AWS SQS queue URL
- [ ] `SQS_DLQ_URL` - AWS SQS dead letter queue URL
- [ ] `AWS_DEFAULT_REGION` - AWS region (e.g., us-east-1)
- [ ] `AWS_DEFAULT_ACCESS_KEY_ID` - AWS access key
- [ ] `AWS_DEFAULT_SECRET_ACCESS_KEY` - AWS secret key

#### New (Required for Monitoring)
- [ ] `SLACK_WEBHOOK_URL` - Slack webhook for DLQ alerts

**Get Slack Webhook:**
1. Go to https://api.slack.com/apps
2. Create new app or select existing
3. Enable Incoming Webhooks
4. Add webhook to workspace
5. Copy webhook URL

### Database Migrations

Run these SQL migrations in Supabase SQL Editor:

1. [ ] `backend/db/migrations/004_rate_limit_requests.sql`
2. [ ] `backend/db/migrations/005_find_stale_jobs_function.sql`

**How to run:**
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of each migration file
3. Click "Run" for each migration
4. Verify no errors

---

## 🚀 Deployment Steps

### Step 1: Deploy Database Migrations (5 minutes)

```bash
# Navigate to project root
cd c:\Users\Ben\OneDrive\Documents\GitHub\Directory-Bolt-ALL-NEW

# Open Supabase Dashboard
# Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql

# Run migration 004_rate_limit_requests.sql
# Copy and paste the contents, then click "Run"

# Run migration 005_find_stale_jobs_function.sql
# Copy and paste the contents, then click "Run"

# Verify migrations
# Run this query to check:
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'rate_limit_requests';

# Should return 1 row

# Verify function exists:
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'find_stale_jobs';

# Should return 1 row
```

**Expected Output:**
- ✅ `rate_limit_requests` table created
- ✅ `find_stale_jobs()` function created
- ✅ `stale_jobs_view` view created
- ✅ `cleanup_rate_limit_records()` function created

### Step 2: Configure Slack Webhook (2 minutes)

```bash
# Add to backend/.env file
echo "SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL" >> backend/.env

# Verify
cat backend/.env | grep SLACK_WEBHOOK_URL
```

**Test Slack Webhook:**
```bash
curl -X POST YOUR_SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test alert from DirectoryBolt DLQ Monitor"}'
```

**Expected:** Message appears in Slack channel

### Step 3: Build and Deploy Backend Services (10 minutes)

```bash
# Navigate to backend infrastructure directory
cd backend/infra

# Build Docker images
docker-compose build stale-job-monitor
docker-compose build dlq-monitor

# Start services
docker-compose up -d stale-job-monitor
docker-compose up -d dlq-monitor

# Verify services are running
docker-compose ps

# Expected output:
# NAME                          STATUS
# stale-job-monitor-1          Up
# dlq-monitor-1                Up

# Check logs
docker-compose logs -f stale-job-monitor
docker-compose logs -f dlq-monitor

# Expected: "Starting stale job monitor..." and "Starting DLQ monitor..."
```

**Troubleshooting:**
- If build fails: Check `backend/requirements.txt` includes `boto3` and `requests`
- If service crashes: Check environment variables are set correctly
- If no logs: Check Docker daemon is running

### Step 4: Deploy Frontend Changes (10 minutes)

```bash
# Navigate to project root
cd c:\Users\Ben\OneDrive\Documents\GitHub\Directory-Bolt-ALL-NEW

# Commit changes
git add .
git commit -m "feat: implement P0 audit fixes - stale job recovery, rate limiting, DLQ monitoring"

# Push to main branch
git push origin main

# Netlify will auto-deploy
# Monitor deployment at: https://app.netlify.com/sites/YOUR_SITE/deploys
```

**Expected:**
- ✅ Build succeeds
- ✅ No TypeScript errors
- ✅ Deployment completes in ~2 minutes

### Step 5: Verify Deployment (5 minutes)

#### Test Health Endpoint

```bash
# Test health endpoint
curl https://directorybolt.com/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-11-02T...",
  "uptime": 123.45,
  "services": {
    "database": {
      "status": "up",
      "latency": 45
    },
    "workers": {
      "status": "up",
      "active_count": 1,
      "stale_count": 0
    }
  },
  "metrics": {
    "jobs_pending": 5,
    "jobs_in_progress": 2,
    "jobs_completed_today": 10,
    "jobs_failed_today": 0
  }
}
```

#### Test Rate Limiting

```bash
# Test rate limiting (should succeed first 100 times)
for i in {1..105}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://directorybolt.com/api/queue/test-customer-id
done

# Expected:
# First 100 requests: 200 or 404
# Last 5 requests: 429 (Too Many Requests)
```

#### Test Stale Job Monitor

```bash
# Check monitor logs
docker-compose logs stale-job-monitor | tail -20

# Expected:
# "Starting check iteration #1"
# "No stale jobs found" or "Found X stale jobs"
# "Sleeping for 120 seconds"
```

#### Test DLQ Monitor

```bash
# Send test message to DLQ
aws sqs send-message \
  --queue-url $SQS_DLQ_URL \
  --message-body '{"job_id":"test-123","customer_id":"test-customer","test":true}'

# Wait 5 minutes, then check Slack
# Expected: Alert message in Slack channel

# Check monitor logs
docker-compose logs dlq-monitor | tail -20

# Expected:
# "DLQ threshold exceeded: 1 messages"
# "Slack alert sent successfully"
```

---

## ✅ Post-Deployment Verification

### Checklist

- [ ] **Database migrations applied successfully**
  - Run: `SELECT * FROM rate_limit_requests LIMIT 1;`
  - Run: `SELECT * FROM find_stale_jobs(10);`

- [ ] **Monitoring services running**
  - Run: `docker-compose ps | grep monitor`
  - Both services should show "Up"

- [ ] **Health endpoint working**
  - Visit: https://directorybolt.com/api/health
  - Status should be "healthy"

- [ ] **Rate limiting active**
  - Make 105 requests to any API endpoint
  - Last 5 should return 429

- [ ] **Stale job monitor working**
  - Check logs: `docker-compose logs stale-job-monitor`
  - Should see "Starting check iteration" every 2 minutes

- [ ] **DLQ monitor working**
  - Send test message to DLQ
  - Check Slack for alert within 5 minutes

- [ ] **No errors in logs**
  - Check: `docker-compose logs --tail=100`
  - No ERROR or CRITICAL messages

---

## 📊 Monitoring

### Dashboards

**Supabase Dashboard:**
- Monitor `rate_limit_requests` table growth
- Check `stale_jobs_view` for stuck jobs
- Review `queue_history` for requeue events

**Docker Logs:**
```bash
# Stale job monitor
docker-compose logs -f stale-job-monitor

# DLQ monitor
docker-compose logs -f dlq-monitor

# All services
docker-compose logs -f
```

**Slack Alerts:**
- DLQ alerts appear in configured channel
- Format: "🚨 Dead Letter Queue Alert - X failed job(s)"

### Metrics to Watch

| Metric | Target | Alert If |
|--------|--------|----------|
| Stale jobs detected | 0 | > 0 |
| DLQ depth | 0 | > 0 |
| Rate limit 429s | < 1% | > 5% |
| Monitor uptime | 100% | < 99% |
| Health check status | healthy | degraded/unhealthy |

---

## 🔧 Troubleshooting

### Issue: Stale Job Monitor Not Starting

**Symptoms:**
- Container exits immediately
- Logs show "Missing required environment variables"

**Solution:**
```bash
# Check environment variables
docker-compose exec stale-job-monitor env | grep SUPABASE

# If missing, add to backend/.env:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...

# Restart service
docker-compose restart stale-job-monitor
```

### Issue: DLQ Monitor Not Sending Alerts

**Symptoms:**
- DLQ has messages but no Slack alerts
- Logs show "SLACK_WEBHOOK_URL not configured"

**Solution:**
```bash
# Add Slack webhook to backend/.env
echo "SLACK_WEBHOOK_URL=https://hooks.slack.com/..." >> backend/.env

# Restart service
docker-compose restart dlq-monitor

# Test webhook
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test"}'
```

### Issue: Rate Limiting Not Working

**Symptoms:**
- Can make unlimited requests
- No 429 responses

**Solution:**
```bash
# Check if migration ran
# In Supabase SQL Editor:
SELECT COUNT(*) FROM rate_limit_requests;

# If table doesn't exist, run migration:
# backend/db/migrations/004_rate_limit_requests.sql

# Check Netlify deployment logs
# Ensure no build errors

# Test locally:
npm run dev
# Make 105 requests to http://localhost:3000/api/health
```

### Issue: Health Endpoint Returns 503

**Symptoms:**
- `/api/health` returns "unhealthy"
- Database status is "down"

**Solution:**
```bash
# Check Supabase connection
# In Supabase Dashboard → Settings → API
# Verify URL and service key are correct

# Test connection:
curl https://YOUR_PROJECT.supabase.co/rest/v1/jobs?limit=1 \
  -H "apikey: YOUR_SERVICE_KEY"

# If fails, regenerate service key in Supabase Dashboard
```

---

## 🔄 Rollback Plan

If deployment fails, follow these steps:

### Rollback Frontend

```bash
# Revert Git commit
git revert HEAD
git push origin main

# Or rollback in Netlify Dashboard:
# 1. Go to Deploys
# 2. Find previous successful deploy
# 3. Click "Publish deploy"
```

### Rollback Backend Services

```bash
# Stop monitoring services
docker-compose stop stale-job-monitor dlq-monitor

# Remove containers
docker-compose rm -f stale-job-monitor dlq-monitor

# System continues working without monitors
# (just no automatic recovery or alerts)
```

### Rollback Database Migrations

```sql
-- In Supabase SQL Editor:

-- Drop rate_limit_requests table
DROP TABLE IF EXISTS rate_limit_requests CASCADE;

-- Drop find_stale_jobs function
DROP FUNCTION IF EXISTS find_stale_jobs(INTEGER) CASCADE;

-- Drop stale_jobs_view
DROP VIEW IF EXISTS stale_jobs_view CASCADE;

-- Drop cleanup function
DROP FUNCTION IF EXISTS cleanup_rate_limit_records(INTEGER) CASCADE;
```

---

## 📞 Support

**Issues during deployment?**
- Check logs: `docker-compose logs`
- Review troubleshooting section above
- Check Supabase Dashboard for errors

**Need help?**
- Review audit documentation in project root
- Check `BACKEND_AUDIT_REPORT.md` for details
- Check `CRITICAL_FIXES_IMPLEMENTATION.md` for code examples

---

## ✅ Success Criteria

Deployment is successful when:

- [ ] All database migrations applied
- [ ] Both monitoring services running
- [ ] Health endpoint returns "healthy"
- [ ] Rate limiting returns 429 after 100 requests
- [ ] Stale job monitor logs show regular checks
- [ ] DLQ monitor sends Slack alerts
- [ ] No errors in any logs
- [ ] Frontend deployed successfully on Netlify

---

**Deployment Status:** 🟢 Ready  
**Next Steps:** Monitor for 24 hours, then proceed with P1 fixes

---

**End of Deployment Guide**

