# Railway Multi-Service Setup for Directory Bolt

Your Directory Bolt backend requires **4 separate services** on Railway.

## Architecture Overview
```
GitHub Repo (Rainking6693/Directory-Bolt-ALL-NEW)
└─ Railway Project: Directory-Bolt
   ├─ Service 1: PostgreSQL Database (✅ Already Added)
   ├─ Service 2: brain (CrewAI AI orchestration)
   ├─ Service 3: subscriber (SQS message consumer)
   └─ Service 4: worker (Prefect worker with Playwright)
```

---

## 🚀 Quick Setup via Railway Dashboard

### **Go to Railway Dashboard**
Visit: https://railway.app/project/2dd0f1ef-d8a0-4999-8cbb-a1df14d6ef53

---

### **Service 1: Brain (CrewAI)**

1. Click **"+ New"** → **"GitHub Repo"**
2. Select: `Rainking6693/Directory-Bolt-ALL-NEW`
3. **Settings**:
   - **Service Name**: `brain`
   - **Root Directory**: `backend`
   - **Dockerfile Path**: `infra/Dockerfile.brain`
4. **Environment Variables**:
   ```
   PORT=8080
   ```
5. Click **"Deploy"**

---

### **Service 2: Subscriber (SQS Consumer)**

1. Click **"+ New"** → **"GitHub Repo"**
2. Select: `Rainking6693/Directory-Bolt-ALL-NEW` (same repo)
3. **Settings**:
   - **Service Name**: `subscriber`
   - **Root Directory**: `backend`
   - **Dockerfile Path**: `infra/Dockerfile.subscriber`
4. **Environment Variables**: Copy from your `backend/.env` file:
   ```
   SUPABASE_URL=<your-supabase-url>
   SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
   AWS_DEFAULT_REGION=<your-aws-region>
   AWS_DEFAULT_ACCESS_KEY_ID=<your-aws-access-key>
   AWS_DEFAULT_SECRET_ACCESS_KEY=<your-aws-secret-key>
   SQS_QUEUE_URL=<your-sqs-queue-url>
   SQS_DLQ_URL=<your-sqs-dlq-url>
   PREFECT_API_URL=<your-prefect-cloud-api-url>
   PREFECT_API_KEY=<your-prefect-api-key>
   CREWAI_URL=http://brain.railway.internal:8080
   LOG_LEVEL=INFO
   QUEUE_PROVIDER=sqs
   ```
5. Click **"Deploy"**

---

### **Service 3: Worker (Prefect + Playwright)**

1. Click **"+ New"** → **"GitHub Repo"**
2. Select: `Rainking6693/Directory-Bolt-ALL-NEW` (same repo)
3. **Settings**:
   - **Service Name**: `worker`
   - **Root Directory**: `backend`
   - **Dockerfile Path**: `infra/Dockerfile.worker`
4. **Environment Variables**: Copy all from Subscriber service above, plus add these from `backend/.env`:
   ```
   # All Subscriber variables +
   PLAYWRIGHT_HEADLESS=1
   ANTHROPIC_API_KEY=<your-anthropic-key>
   GEMINI_API_KEY=<your-gemini-key>
   TWO_CAPTCHA_API_KEY=<your-2captcha-key>
   STRIPE_SECRET_KEY=<your-stripe-secret-key>
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
   STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
   ENABLE_AI_FEATURES=true
   ENABLE_FORM_MAPPING=true
   ENABLE_CONTENT_CUSTOMIZATION=true
   ```

   **Note**: Get actual values from your `backend/.env` file
5. Click **"Deploy"**

---

## ✅ Verification Checklist

After deployment, verify in Railway dashboard:

- [ ] PostgreSQL: Status = "Active"
- [ ] brain: Deployment successful, port 8080 listening
- [ ] subscriber: Deployment successful, consuming SQS messages
- [ ] worker: Deployment successful, Prefect worker running

---

## 🔗 Internal Service Communication

Railway provides private networking between services:
- **Brain Service**: `http://brain.railway.internal:8080`
- Services communicate internally without public exposure

---

## 🛠️ Important Notes

1. **No Docker Compose Support**: Railway requires each service deployed separately
2. **Prefect Cloud**: Using Prefect Cloud (not self-hosted server)
3. **Service Order**: Deploy in order: brain → subscriber → worker (worker depends on brain being available)
4. **Billing**: Each service billed separately on Railway

---

## 📊 Monitoring

Monitor your services:
- Railway Dashboard: https://railway.app/project/2dd0f1ef-d8a0-4999-8cbb-a1df14d6ef53
- Prefect Cloud: https://app.prefect.cloud
- AWS SQS: https://console.aws.amazon.com/sqs
- Supabase: https://supabase.com/dashboard

---

## 🐛 Troubleshooting

**Brain service not accessible:**
- Check logs in Railway dashboard
- Verify PORT=8080 environment variable is set

**Worker not connecting to Brain:**
- Verify CREWAI_URL uses Railway internal DNS: `http://brain.railway.internal:8080`
- Ensure brain service is deployed and running first

**SQS messages not being consumed:**
- Check AWS credentials in subscriber environment variables
- Verify SQS_QUEUE_URL is correct
- Check subscriber logs for connection errors
