# Netlify Deployment Fix - Complete Guide

**Date:** October 31, 2025  
**Status:** 🔧 **ACTION REQUIRED**

---

## 🚨 Issues Identified

### 1. ✅ Missing `next-sitemap.config.js` - **FIXED**
**Error:** `next-sitemap` cannot find configuration file  
**Status:** ✅ **RESOLVED** - File created

### 2. ⚠️ Reserved AWS Environment Variables - **ACTION REQUIRED**
**Error:** `Your environment variables contain reserved keys`  
**Reserved Keys:**
- `AWS_DEFAULT_ACCESS_KEY_ID`
- `AWS_DEFAULT_REGION`
- `AWS_DEFAULT_SECRET_ACCESS_KEY`

**Status:** ⚠️ **REQUIRES MANUAL ACTION IN NETLIFY DASHBOARD**

---

## ✅ Fix #1: next-sitemap.config.js (COMPLETED)

Created `next-sitemap.config.js` in the project root with the following configuration:

```javascript
/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://directorybolt.com',
  generateRobotsTxt: true,
  generateIndexSitemap: true,
  exclude: [
    '/admin',
    '/admin/*',
    '/staff',
    '/staff/*',
    '/customer-portal',
    '/api/*',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/staff', '/customer-portal', '/api/*'],
      },
    ],
    additionalSitemaps: [
      'https://directorybolt.com/sitemap-blog.xml',
      'https://directorybolt.com/sitemap-cities.xml',
      'https://directorybolt.com/sitemap-guides.xml',
    ],
  },
}
```

**What this does:**
- Generates sitemap.xml automatically after build
- Creates robots.txt with proper crawling rules
- Excludes admin/staff/customer portal pages from search engines
- References additional sitemaps for blog, cities, and guides

---

## ⚠️ Fix #2: Remove AWS Environment Variables from Netlify

### Why This Is Happening

The AWS environment variables (`AWS_DEFAULT_ACCESS_KEY_ID`, `AWS_DEFAULT_REGION`, `AWS_DEFAULT_SECRET_ACCESS_KEY`) are **ONLY needed for the Python backend**, not for the Next.js frontend that Netlify deploys.

Netlify reserves these variable names because they conflict with Netlify's own AWS infrastructure.

### Solution: Remove AWS Variables from Netlify

**IMPORTANT:** These variables should ONLY exist in your backend Python environment, NOT in Netlify.

#### Step 1: Go to Netlify Dashboard

1. Log in to [Netlify](https://app.netlify.com/)
2. Select your DirectoryBolt site
3. Go to **Site settings** → **Environment variables**

#### Step 2: Remove These Variables

Delete the following environment variables from Netlify:

- ❌ `AWS_DEFAULT_ACCESS_KEY_ID`
- ❌ `AWS_DEFAULT_REGION`
- ❌ `AWS_DEFAULT_SECRET_ACCESS_KEY`
- ❌ `SQS_QUEUE_URL` (also backend-only)
- ❌ `SQS_DLQ_URL` (also backend-only)

**These are backend-only variables and should NOT be in Netlify.**

#### Step 3: Keep These Variables in Netlify

✅ **Frontend variables (keep these):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `SUPABASE_SERVICE_ROLE_KEY` (for API routes)
- `STRIPE_SECRET_KEY` (for API routes)
- `STRIPE_WEBHOOK_SECRET` (for API routes)
- `ANTHROPIC_API_KEY` (for AI API routes)
- `OPENAI_API_KEY` (for AI API routes)
- `GEMINI_API_KEY` (for AI API routes)
- `TWO_CAPTCHA_API_KEY` (if used in frontend)

---

## 📋 Complete Environment Variable Checklist

### ✅ Netlify Environment Variables (Frontend + API Routes)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_GROWTH_PRICE_ID=price_...
STRIPE_PROFESSIONAL_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# URLs
NEXT_PUBLIC_SITE_URL=https://directorybolt.com
NEXT_PUBLIC_APP_URL=https://directorybolt.com
BASE_URL=https://directorybolt.com

# AI Services (for API routes)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# Analytics (optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-...

# Security (for API routes)
JWT_SECRET=your-jwt-secret
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Admin/Staff (for API routes)
ADMIN_API_KEY=your-admin-key
STAFF_API_KEY=your-staff-key
AUTOBOLT_API_KEY=your-autobolt-key
```

### ❌ Backend-Only Variables (DO NOT ADD TO NETLIFY)

These should ONLY be in your backend `.env` file:

```bash
# AWS SQS (backend only)
AWS_DEFAULT_REGION=us-east-1
AWS_DEFAULT_ACCESS_KEY_ID=AKIA...
AWS_DEFAULT_SECRET_ACCESS_KEY=...
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...
SQS_DLQ_URL=https://sqs.us-east-1.amazonaws.com/...

# Prefect (backend only)
PREFECT_API_URL=http://localhost:4200/api
PREFECT_API_KEY=...

# CrewAI Brain (backend only)
CREWAI_URL=http://brain:8080/plan

# Worker Config (backend only)
WORKER_CONCURRENCY=3
SHADOW_MODE_PERCENTAGE=10
```

---

## 🚀 Deployment Steps

### Step 1: Commit the sitemap config
```bash
git add next-sitemap.config.js
git commit -m "fix: add next-sitemap config for Netlify build"
```

### Step 2: Remove AWS variables from Netlify
1. Go to Netlify Dashboard → Site settings → Environment variables
2. Delete: `AWS_DEFAULT_ACCESS_KEY_ID`, `AWS_DEFAULT_REGION`, `AWS_DEFAULT_SECRET_ACCESS_KEY`, `SQS_QUEUE_URL`, `SQS_DLQ_URL`
3. Click "Save"

### Step 3: Trigger new deployment
```bash
git push origin main
```

Or manually trigger in Netlify Dashboard:
- Go to **Deploys** tab
- Click **Trigger deploy** → **Deploy site**

---

## 🔍 Verification

After deployment, verify:

1. **Build succeeds** - Check Netlify deploy logs
2. **Sitemap generated** - Visit `https://directorybolt.com/sitemap.xml`
3. **Robots.txt created** - Visit `https://directorybolt.com/robots.txt`
4. **No AWS errors** - Build logs should not mention reserved keys

---

## 📝 Architecture Notes

### Frontend (Netlify)
- **Platform:** Next.js 14.2.33 on Netlify
- **Purpose:** User-facing website, customer portal, API routes
- **Needs:** Supabase, Stripe, AI APIs (for API routes)
- **Does NOT need:** AWS SQS, Prefect, CrewAI

### Backend (Separate Infrastructure)
- **Platform:** Python 3.11 + Docker
- **Purpose:** Directory submission automation, Prefect workflows
- **Needs:** AWS SQS, Prefect, CrewAI, Playwright
- **Deployment:** Separate from Netlify (Docker containers)

**Key Point:** The frontend and backend are separate deployments with different environment variables.

---

## ✅ Summary

1. ✅ **Created `next-sitemap.config.js`** - Sitemap will now generate after build
2. ⚠️ **Remove AWS variables from Netlify** - Manual action required in dashboard
3. 🚀 **Push changes and redeploy** - Build should succeed after AWS vars removed

**Next Action:** Remove the AWS environment variables from Netlify dashboard, then trigger a new deployment.

