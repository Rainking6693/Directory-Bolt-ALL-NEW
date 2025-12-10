# DirectoryBolt Website Issues & Fixes Report
**Date:** December 3, 2025  
**Website:** https://www.directorybolt.com

## 🔴 CRITICAL ISSUES FOUND

### 1. Missing Pages (404 Errors)
**Affected Pages:**
- `/analyze` - Returns 404 (page exists in code at `pages/analyze.tsx`)
- `/pricing` - Returns 404 (page exists in code at `pages/pricing.tsx`)

**Impact:** High - Core functionality broken
- "Get My Analysis" button on homepage doesn't work (navigates to /analyze)
- Pricing plans not accessible to users
- Users cannot use the free website analysis feature
  
**Root Cause:** Netlify build issue - pages exist in codebase but aren't being deployed

**Fix Required:**
1. Rebuild and redeploy the Next.js application on Netlify
2. Check Netlify build logs for errors
3. Verify `pages/analyze.tsx` and `pages/pricing.tsx` are being included in build

**Quick Fix Command:**
```bash
# In project root
npm run build
# Check for build errors
# Then redeploy to Netlify
```

---

### 2. Stripe Payment Integration
**Status:** Cannot test (pricing page shows 404)

**What Needs Testing (After fixing 404):**
- All "Start Free Trial" buttons on pricing cards
- Checkout session creation
- Stripe redirect functionality
- Payment confirmation flow

**Current Stripe Configuration:**
- Uses `/api/stripe/create-checkout-session` endpoint
- Configured with 4 pricing tiers (starter, growth, professional, enterprise)
- Located at: `pages/api/stripe/create-checkout-session.ts`

**Known Issues:**
- Pricing page shows outdated pricing ($49, $99, $199 instead of $149, $299, $499, $799)
- Mismatch between `pages/pricing.tsx` and `lib/config/pricing.ts`

---

### 3. Staff Dashboard Access
**Status:** Partially working - requires authentication

**Default Credentials (from code):**
- **Staff Login:** 
  - Username: `staff`
  - Password: `DirectoryBoltStaff2025!`
- **Admin Login:**
  - Username: `admin`
  - Password: `DirectoryBolt2025!`

**Dashboard Components:**
- Queue Monitor
- Job Progress
- Real-Time Analytics
- AutoBolt Monitor
- Activity Logs
- 2FA Queue
- Directory Settings

**Issues to Verify:**
- All tabs functional
- Real-time data updates working
- API endpoints responding
- Test customer creation works

---

## ⚠️ MEDIUM PRIORITY ISSUES

### 4. Homepage "Get My Analysis" Button
**Issue:** Button click causes JavaScript error
**Location:** Homepage hero section
**Error:** Script execution failure when clicking

**Code Location:**
```typescript
// components/LandingPage.tsx line 71
onClick={() => typeof window !== 'undefined' && (window.location.href = '/analyze')}
```

**Fix:** Once /analyze page is fixed and deployed, button should work

---

### 5. Pricing Configuration Mismatch
**Issue:** Multiple pricing configurations exist with different values

**Files with Pricing Info:**
1. `lib/config/pricing.ts` - **Correct prices ($149, $299, $499, $799)**
2. `pages/pricing.tsx` - Outdated prices ($49, $99, $199, Custom)
3. `pages/api/create-checkout-session.ts` - Uses env variables or defaults
4. `pages/api/stripe/create-checkout-session.ts` - Uses lib/config/pricing.ts ✓

**Fix Required:** Update `pages/pricing.tsx` to use pricing from `lib/config/pricing.ts`

---

### 6. Cookie Consent Banner Issues
**Issue:** JavaScript errors when interacting with cookie consent
**Error:** "Element not found" when clicking buttons
**Impact:** User experience degradation

---

## 🟡 MOTIA BACKEND STATUS

### Current State
**Motia Cloud:** Enabled but NOT actively running
**Previous Setup:** 4 Render services (Brain, Subscriber, Worker, Monitor)
**New Setup:** Single Motia application (ready to deploy but not deployed)

### Motia Integration Details

**What Motia Replaces:**
1. **Brain Service** (Field Mapping AI) → `steps/api/brain.step.ts`
2. **Subscriber Service** (SQS Queue) → `steps/events/sqsProcessor.step.ts`
3. **Worker Service** (Job Executor) → `steps/events/jobProcessor.step.ts`
4. **Monitor Service** (Stale Jobs) → `steps/cron/staleJobMonitor.step.ts`

**Motia Features Implemented:**
- ✅ Customer Portal API endpoints
- ✅ Staff Dashboard API endpoints
- ✅ AI-powered form mapping service
- ✅ Real-time job processing
- ✅ Health monitoring
- ✅ Event-driven architecture

**Deployment Status:**
- **Code:** Complete and ready in `/Directory Bolt Motia/`
- **Configuration:** `motia.config.ts` configured
- **Environment:** `.env` template provided
- **Deployment:** **NOT YET DEPLOYED TO MOTIA CLOUD**

### How to Deploy Motia Backend

```bash
cd "Directory Bolt Motia"

# Install Motia CLI
npm install -g @motiadev/cli

# Login to Motia Cloud
npx motia login

# Set environment variables
npx motia env:set ANTHROPIC_API_KEY=<your_key>
npx motia env:set GEMINI_API_KEY=<your_key>
npx motia env:set SUPABASE_URL=<your_url>
npx motia env:set SUPABASE_SERVICE_ROLE_KEY=<your_key>
# ... set all required env vars

# Deploy
npx motia deploy
```

**⚠️ IMPORTANT:** Motia backend is NOT currently running. The website relies on the old Render services or direct Supabase/API calls.

---

## 📋 COMPLETE FIX CHECKLIST

### Immediate Action Items (Critical)

- [ ] **1. Fix /analyze page 404**
  - Check Netlify deployment logs
  - Verify `pages/analyze.tsx` is building correctly
  - Redeploy if needed
  
- [ ] **2. Fix /pricing page 404**
  - Check Netlify deployment logs  
  - Verify `pages/pricing.tsx` is building correctly
  - Redeploy if needed

- [ ] **3. Update Pricing Page**
  - Replace hardcoded prices in `pages/pricing.tsx`
  - Import and use `PRICING_TIERS` from `lib/config/pricing.ts`
  - Ensure consistency across all pricing displays

- [ ] **4. Test Stripe Integration**
  - Test all "Start Free Trial" buttons
  - Verify checkout session creation
  - Test payment flow end-to-end
  - Confirm webhook integration

- [ ] **5. Test Staff Dashboard**
  - Login with default credentials
  - Test all 7 dashboard tabs
  - Verify real-time updates work
  - Test "Create Test Customer" button

### Secondary Action Items

- [ ] **6. Fix Cookie Consent JavaScript Errors**
  - Debug `components/CookieConsent.tsx`
  - Fix element selection issues
  - Test on multiple browsers

- [ ] **7. Deploy Motia Backend (Optional)**
  - Decide whether to use Motia or keep Render services
  - If using Motia: Follow deployment guide above
  - Update frontend API endpoints if switching to Motia

- [ ] **8. Test All Homepage Links**
  - "Free Analysis" navigation link
  - "Pricing" navigation link
  - "Customer Portal" link
  - "Start Free Trial" buttons
  - "Get My Analysis" buttons

---

## 🔧 RECOMMENDED FIXES

### Fix 1: Update pages/pricing.tsx

Replace the hardcoded pricing with the centralized configuration:

```typescript
// pages/pricing.tsx
import { PRICING_TIERS, getAllTiers } from '../lib/config/pricing'

export default function PricingPage() {
  const plans = getAllTiers() // Use centralized pricing
  
  // Rest of component...
}
```

### Fix 2: Rebuild and Deploy

```bash
# Check for build errors
npm run build

# Fix any TypeScript/build errors

# Deploy to Netlify (automatic if connected to Git)
git add .
git commit -m "Fix routing and pricing issues"
git push origin main
```

### Fix 3: Verify Netlify Configuration

Check `netlify.toml` has correct Next.js plugin:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

---

## 📊 TESTING CHECKLIST

### After Fixes Are Deployed

**Homepage:**
- [ ] "Get My Analysis" button works (navigates to /analyze)
- [ ] "See Sample Analysis" button works
- [ ] "Free Analysis" nav link works
- [ ] "Pricing" nav link works
- [ ] "Customer Portal" nav link works
- [ ] All "Start Free Trial" buttons work

**Analysis Page (/analyze):**
- [ ] Page loads without 404
- [ ] Form accepts website URL
- [ ] Analysis starts and shows progress
- [ ] Redirects to results page
- [ ] Results display correctly

**Pricing Page (/pricing):**
- [ ] Page loads without 404
- [ ] Shows correct pricing ($149, $299, $499, $799)
- [ ] All "Start Free Trial" buttons create Stripe session
- [ ] Stripe checkout page loads
- [ ] Can complete test payment

**Staff Dashboard (/staff-dashboard):**
- [ ] Login page accessible
- [ ] Can login with default credentials
- [ ] All 7 tabs load
- [ ] Real-time data updates
- [ ] "Create Test Customer" works
- [ ] Can view job details
- [ ] Can monitor queue

---

## 🚨 CRITICAL NOTES FOR USER

### 1. Motia Backend Status
**Your Motia backend code is ready but NOT deployed.** The website currently relies on either:
- Old Render services (if still running)
- Direct Supabase calls from frontend
- Netlify Functions in `/pages/api/*`

**Decision needed:** Deploy Motia backend OR continue with current architecture?

### 2. Page Routing Issue
The 404 errors for `/analyze` and `/pricing` are likely caused by:
- Netlify build failure
- Pages excluded from static generation
- Build errors during deployment

**Fix:** Check Netlify dashboard → Deploys → Latest deploy → Build logs

### 3. Pricing Inconsistency
Multiple places define pricing. Need to consolidate to single source of truth in `lib/config/pricing.ts`.

---

## 📞 NEXT STEPS

1. **Fix Critical 404s**
   - Check Netlify build logs
   - Rebuild and redeploy site
   
2. **Update Pricing Page**
   - Use centralized pricing config
   - Test Stripe integration

3. **Decide on Motia**
   - Deploy Motia backend if needed
   - OR continue with current setup

4. **Test Everything**
   - Follow testing checklist above
   - Document any new issues found

---

**Report Generated:** 2025-12-03  
**Next Review:** After fixes are deployed


