# Critical Fixes Implementation Plan

**Priority:** P0 - Implement Immediately  
**Estimated Time:** 4-6 hours  
**Owner:** Backend Team

---

## Fix #1: Stale Job Detection & Recovery

### Problem
Jobs stuck in "in_progress" state when workers crash. No automatic recovery mechanism.

### Impact
- **Severity:** High
- **Frequency:** 2-3 times per week
- **Customer Impact:** Jobs never complete, customers see "processing" forever

### Solution: Implement Stale Job Monitor

**File:** `backend/workers/stale_job_monitor.py` (NEW)

```python
"""Monitor and recover stale jobs."""
import os
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any
from supabase import create_client
from utils.logging import setup_logger
import boto3

logger = setup_logger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SQS_QUEUE_URL = os.getenv("SQS_QUEUE_URL")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
sqs = boto3.client('sqs', region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"))

STALE_THRESHOLD_MINUTES = 10


def find_stale_jobs() -> List[Dict[str, Any]]:
    """Find jobs with no worker heartbeat in 10+ minutes."""
    threshold = datetime.utcnow() - timedelta(minutes=STALE_THRESHOLD_MINUTES)
    
    # Query jobs that are in_progress but have no recent heartbeat
    query = """
    SELECT j.id, j.customer_id, j.package_size, j.priority_level
    FROM jobs j
    LEFT JOIN worker_heartbeats wh ON wh.current_job_id = j.id
    WHERE j.status = 'in_progress'
      AND (wh.last_heartbeat IS NULL OR wh.last_heartbeat < :threshold)
    """
    
    result = supabase.rpc('find_stale_jobs', {'threshold': threshold.isoformat()}).execute()
    return result.data or []


def requeue_job(job: Dict[str, Any]) -> bool:
    """Requeue a stale job to SQS."""
    try:
        message = {
            "job_id": job["id"],
            "customer_id": job["customer_id"],
            "package_size": job["package_size"],
            "priority": job.get("priority_level", "starter"),
            "retry": True,
            "reason": "stale_job_recovery"
        }
        
        sqs.send_message(
            QueueUrl=SQS_QUEUE_URL,
            MessageBody=json.dumps(message)
        )
        
        # Mark job as pending (will be picked up again)
        supabase.table("jobs").update({
            "status": "pending",
            "error_message": "Recovered from stale state (no worker heartbeat)"
        }).eq("id", job["id"]).execute()
        
        logger.info(f"Requeued stale job {job['id']}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to requeue job {job['id']}: {e}")
        return False


def monitor_loop():
    """Main monitoring loop."""
    logger.info("Starting stale job monitor")
    
    while True:
        try:
            stale_jobs = find_stale_jobs()
            
            if stale_jobs:
                logger.warning(f"Found {len(stale_jobs)} stale jobs")
                
                for job in stale_jobs:
                    requeue_job(job)
            
            # Check every 2 minutes
            time.sleep(120)
            
        except Exception as e:
            logger.error(f"Error in monitor loop: {e}")
            time.sleep(60)


if __name__ == "__main__":
    monitor_loop()
```

**Deployment:**
1. Add to `docker-compose.yml`:
```yaml
stale-job-monitor:
  build: ./backend
  command: python workers/stale_job_monitor.py
  environment:
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
    - SQS_QUEUE_URL
    - AWS_DEFAULT_REGION
  restart: always
```

2. Create Supabase function:
```sql
CREATE OR REPLACE FUNCTION find_stale_jobs(threshold TIMESTAMPTZ)
RETURNS TABLE (
    id UUID,
    customer_id UUID,
    package_size INT,
    priority_level TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT j.id, j.customer_id, j.package_size, j.priority_level
    FROM jobs j
    LEFT JOIN worker_heartbeats wh ON wh.current_job_id = j.id
    WHERE j.status = 'in_progress'
      AND (wh.last_heartbeat IS NULL OR wh.last_heartbeat < threshold);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Testing:**
```bash
# Simulate stale job
# 1. Start a job
# 2. Kill worker (docker kill directorybolt-worker-1)
# 3. Wait 10 minutes
# 4. Verify job is requeued
```

---

## Fix #2: API Rate Limiting

### Problem
No rate limiting on API endpoints. Vulnerable to DoS attacks and abuse.

### Impact
- **Severity:** High
- **Risk:** API abuse, server overload, increased costs
- **Compliance:** Required for production deployment

### Solution: Implement Rate Limiting Middleware

**File:** `lib/middleware/rate-limit.ts` (NEW)

```typescript
import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyGenerator?: (req: NextApiRequest) => string
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  keyGenerator: (req) => {
    // Use IP address as key
    const forwarded = req.headers['x-forwarded-for']
    const ip = typeof forwarded === 'string' 
      ? forwarded.split(',')[0] 
      : req.socket.remoteAddress
    return ip || 'unknown'
  }
}

export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  return async (req: NextApiRequest, res: NextApiResponse, next: () => void) => {
    const key = finalConfig.keyGenerator!(req)
    const now = Date.now()
    const windowStart = now - finalConfig.windowMs

    try {
      // Get recent requests from this key
      const { data: requests, error } = await supabase
        .from('rate_limit_requests')
        .select('created_at')
        .eq('key', key)
        .gte('created_at', new Date(windowStart).toISOString())

      if (error) throw error

      const requestCount = requests?.length || 0

      // Check if limit exceeded
      if (requestCount >= finalConfig.maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Max ${finalConfig.maxRequests} requests per ${finalConfig.windowMs / 1000}s`,
          retryAfter: Math.ceil(finalConfig.windowMs / 1000)
        })
      }

      // Record this request
      await supabase.from('rate_limit_requests').insert({
        key,
        endpoint: req.url,
        method: req.method,
        created_at: new Date().toISOString()
      })

      // Clean up old requests (async, don't wait)
      supabase
        .from('rate_limit_requests')
        .delete()
        .lt('created_at', new Date(windowStart).toISOString())
        .then(() => {})

      // Continue to next middleware/handler
      next()

    } catch (error) {
      console.error('Rate limit error:', error)
      // On error, allow request (fail open)
      next()
    }
  }
}

// Preset configurations
export const rateLimitPresets = {
  strict: { windowMs: 60 * 1000, maxRequests: 10 }, // 10/min
  standard: { windowMs: 60 * 1000, maxRequests: 100 }, // 100/min
  relaxed: { windowMs: 60 * 1000, maxRequests: 1000 }, // 1000/min
  apiKey: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10000, // 10k/hour
    keyGenerator: (req: NextApiRequest) => {
      const apiKey = req.headers['x-api-key'] as string
      return apiKey || 'no-key'
    }
  }
}
```

**Database Migration:**
```sql
-- Create rate_limit_requests table
CREATE TABLE IF NOT EXISTS rate_limit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_rate_limit_key_time 
ON rate_limit_requests(key, created_at DESC);

-- Auto-delete old records (>1 hour)
CREATE OR REPLACE FUNCTION cleanup_rate_limit_requests()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit_requests
    WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup every 10 minutes (using pg_cron extension)
-- SELECT cron.schedule('cleanup-rate-limits', '*/10 * * * *', 'SELECT cleanup_rate_limit_requests()');
```

**Usage in API Routes:**

```typescript
// pages/api/queue/[customerId].ts
import { rateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit'

const limiter = rateLimit(rateLimitPresets.standard)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply rate limiting
  await new Promise((resolve) => limiter(req, res, resolve))
  
  // Continue with normal handler
  const { customerId } = req.query
  // ... rest of handler
}
```

**Testing:**
```bash
# Test rate limit
for i in {1..150}; do
  curl http://localhost:3000/api/queue/TEST-001
done

# Expected: First 100 succeed, next 50 return 429
```

---

## Fix #3: DLQ Monitoring & Alerts

### Problem
Dead Letter Queue (DLQ) messages not monitored. Failed jobs go unnoticed.

### Impact
- **Severity:** High
- **Customer Impact:** Failed submissions never retried
- **Business Impact:** Lost revenue, poor customer experience

### Solution: CloudWatch Alarm + Slack Notifications

**File:** `backend/infra/cloudwatch-alarms.tf` (NEW - Terraform)

```hcl
# CloudWatch alarm for DLQ depth
resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  alarm_name          = "directorybolt-dlq-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300 # 5 minutes
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "Alert when DLQ has messages"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    QueueName = "directorybolt-dlq"
  }
}

# SNS topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "directorybolt-alerts"
}

# SNS subscription to Slack webhook
resource "aws_sns_topic_subscription" "slack" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "https"
  endpoint  = var.slack_webhook_url
}
```

**Alternative: Python Script (No Terraform)**

**File:** `backend/workers/dlq_monitor.py` (NEW)

```python
"""Monitor DLQ and send Slack alerts."""
import os
import time
import boto3
import requests
from utils.logging import setup_logger

logger = setup_logger(__name__)

SQS_DLQ_URL = os.getenv("SQS_DLQ_URL")
SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK_URL")

sqs = boto3.client('sqs', region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"))


def get_dlq_depth() -> int:
    """Get number of messages in DLQ."""
    response = sqs.get_queue_attributes(
        QueueUrl=SQS_DLQ_URL,
        AttributeNames=['ApproximateNumberOfMessages']
    )
    return int(response['Attributes']['ApproximateNumberOfMessages'])


def send_slack_alert(message_count: int):
    """Send Slack notification."""
    payload = {
        "text": f"🚨 *DLQ Alert*: {message_count} failed jobs in Dead Letter Queue",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*DLQ Alert*\n{message_count} jobs failed after 3 retries and moved to DLQ."
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View DLQ"},
                        "url": f"https://console.aws.amazon.com/sqs/v2/home?region=us-east-1#/queues/{SQS_DLQ_URL}"
                    }
                ]
            }
        ]
    }
    
    requests.post(SLACK_WEBHOOK, json=payload)


def monitor_loop():
    """Monitor DLQ every 5 minutes."""
    logger.info("Starting DLQ monitor")
    last_alert_count = 0
    
    while True:
        try:
            depth = get_dlq_depth()
            
            # Alert if depth increased
            if depth > 0 and depth > last_alert_count:
                logger.warning(f"DLQ depth: {depth}")
                send_slack_alert(depth)
                last_alert_count = depth
            elif depth == 0:
                last_alert_count = 0
            
            time.sleep(300)  # 5 minutes
            
        except Exception as e:
            logger.error(f"Error monitoring DLQ: {e}")
            time.sleep(60)


if __name__ == "__main__":
    monitor_loop()
```

**Deployment:**
```yaml
# docker-compose.yml
dlq-monitor:
  build: ./backend
  command: python workers/dlq_monitor.py
  environment:
    - SQS_DLQ_URL
    - SLACK_WEBHOOK_URL
    - AWS_DEFAULT_REGION
  restart: always
```

**Testing:**
```bash
# Send test message to DLQ
aws sqs send-message \
  --queue-url $SQS_DLQ_URL \
  --message-body '{"test": "dlq_alert"}'

# Verify Slack notification received
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Review all code changes
- [ ] Run unit tests
- [ ] Test in staging environment
- [ ] Update documentation

### Deployment Steps
1. **Deploy Database Changes**
   ```bash
   # Run migrations in Supabase SQL Editor
   # - Create find_stale_jobs() function
   # - Create rate_limit_requests table
   ```

2. **Deploy Backend Services**
   ```bash
   cd backend/infra
   docker-compose up -d --build
   
   # Verify services running
   docker-compose ps
   ```

3. **Deploy Frontend Changes**
   ```bash
   # Add rate limiting to API routes
   git add lib/middleware/rate-limit.ts
   git commit -m "feat: add rate limiting middleware"
   git push origin main
   
   # Netlify auto-deploys
   ```

4. **Configure Alerts**
   ```bash
   # Set Slack webhook URL
   export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
   
   # Restart DLQ monitor
   docker-compose restart dlq-monitor
   ```

### Post-Deployment Verification
- [ ] Verify stale job monitor running: `docker logs directorybolt-stale-job-monitor-1`
- [ ] Test rate limiting: `curl` 150 times, verify 429 after 100
- [ ] Test DLQ alert: Send test message, verify Slack notification
- [ ] Monitor logs for errors: `docker-compose logs -f`

---

## Rollback Plan

If issues occur:

1. **Stop new services:**
   ```bash
   docker-compose stop stale-job-monitor dlq-monitor
   ```

2. **Revert frontend changes:**
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Disable rate limiting:**
   ```typescript
   // Comment out rate limiter in API routes
   // await new Promise((resolve) => limiter(req, res, resolve))
   ```

4. **Investigate and fix issues**

5. **Re-deploy when ready**

---

## Success Metrics

After deployment, monitor:

1. **Stale Job Recovery**
   - Metric: Number of jobs recovered per day
   - Target: 0 (no stale jobs)
   - Alert: >5 stale jobs per day

2. **Rate Limiting**
   - Metric: 429 responses per hour
   - Target: <10 (legitimate traffic)
   - Alert: >100 (potential attack)

3. **DLQ Depth**
   - Metric: Messages in DLQ
   - Target: 0
   - Alert: >0 (immediate Slack notification)

---

**End of Implementation Plan**

