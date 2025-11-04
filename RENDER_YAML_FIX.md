# Fix for Render Fields That Can't Be Edited

## Problem
Render UI won't let you delete text from Dockerfile Path, Docker Build Context, or Docker Command fields - only add to them.

## Solution: Use render.yaml Config File

I created `render.yaml` in your repo root. This overrides the UI settings.

## Steps:

1. **Delete the current service in Render** (if it exists)
   - Go to your service
   - Click "Settings" → "Delete Service"
   - This clears all the bad settings

2. **Create new service using render.yaml**
   - Go to Render dashboard
   - Click "New" → "Blueprint"
   - Connect your GitHub repo
   - Render will auto-detect `render.yaml`
   - It will create the service with CORRECT settings

3. **OR manually create new service**
   - New → Web Service
   - Connect repo
   - Settings will be read from `render.yaml` automatically
   - Add environment variables manually

## What render.yaml Does:

- Sets `dockerfilePath: backend/infra/Dockerfile`
- Sets `dockerContext: backend`
- Sets `dockerCommand: python orchestration/subscriber.py`
- Defines environment variables (you still need to add values in UI)

---

**Try deleting and recreating the service - the render.yaml will override the bad settings.**

