# 🚨 FIX FOR RENDER ERROR

## Problem
Render is looking for `Dockerfile` but you only have `Dockerfile.brain`, `Dockerfile.subscriber`, etc.

## Solution
I created `backend/infra/Dockerfile` that runs the subscriber service.

## What to Do in Render

### Step 1: Update Dockerfile Path
1. Go to "Advanced" section
2. Find "Dockerfile Path" field
3. Change from: `backend/infra/Dockerfile` (if it's wrong)
4. To: `backend/infra/Dockerfile`
5. OR leave it as default if it auto-detected

### Step 2: Docker Build Context Directory
1. Make sure "Docker Build Context Directory" is: `backend/infra`
2. This tells Render where to build from

### Step 3: Docker Command
1. Find "Docker Command" field
2. Leave it EMPTY (the Dockerfile CMD will run)
3. OR enter: `python orchestration/subscriber.py`

### Step 4: Deploy
1. Click "Deploy Web Service"

---

## ⚠️ IMPORTANT NOTE

This Dockerfile only runs the **subscriber** service. For a full setup, you need:

1. **This service** (subscriber) - runs on Render
2. **Prefect server** - needs separate service OR use Prefect Cloud
3. **Worker** - needs separate service
4. **Brain service** - needs separate service

**OR** use a VPS that can run docker-compose with all services together.

---

## Better Solution: Use One Service at a Time

Since Render can't easily run docker-compose, deploy the **subscriber** service first:

1. This service will connect to:
   - Prefect Cloud (instead of local Prefect server)
   - SQS queue
   - Supabase

2. Then deploy other services separately if needed.

**Try the Dockerfile I created first and see if it works.**

