# Netlify Build Check & Debug Guide

## Quick Diagnostics

### Step 1: Check Current Deployment Status

Visit your Netlify dashboard and look for these indicators:

**Site Dashboard → Deploys**
- Latest deploy status: ✅ Published or ❌ Failed?
- Deploy time: When was the last successful deploy?
- Build time: How long did it take?

### Step 2: Review Build Log for Errors

Look for these specific error patterns in the build logs:

#### ❌ Critical Errors to Look For:

**1. TypeScript Compilation Errors**
```
Error: Type error: ...
pages/analyze.tsx:XX:XX - error TS...
pages/pricing.tsx:XX:XX - error TS...
```

**2. Module Not Found Errors**
```
Error: Cannot find module '../lib/config/pricing'
Module not found: Can't resolve 'components/...'
```

**3. Next.js Build Errors**
```
Failed to compile
Build error occurred
Error occurred prerendering page
```

**4. Memory/Resource Errors**
```
FATAL ERROR: ... JavaScript heap out of memory
Build exceeded maximum allowed runtime
```

---

## Common Issues & Solutions

### Issue 1: TypeScript Errors in Updated Files

**If you see errors related to pricing.tsx:**
```typescript
// The import I added should be:
import { PRICING_TIERS, PricingTier } from '../lib/config/pricing'
```

**If error persists**, try this alternative fix:
```typescript
import { PRICING_TIERS } from '../lib/config/pricing'
import type { PricingTier } from '../lib/config/pricing'
```

---

### Issue 2: Pages Excluded from Build

**Check next.config.js for:**
- No `exportPathMap` that excludes pages
- No `pageExtensions` that filters out .tsx files
- No custom webpack config that excludes pages

**Current next.config.js looks good** ✅

---

### Issue 3: getServerSideProps Issues

Both pages use `getServerSideProps` which requires server-side rendering:

**pages/analyze.tsx:**
```typescript
export async function getServerSideProps() {
  return {
    props: {}
  }
}
```

This is correct for Netlify + Next.js ✅

---

## Netlify Environment Variables Check

Make sure these are set in Netlify:

### Required for Site to Function:
```bash
NODE_VERSION=18.17.0
NEXT_TELEMETRY_DISABLED=1
NPM_FLAGS=--legacy-peer-deps
```

### Required for Features to Work:
```bash
# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_GROWTH_PRICE_ID=price_...
STRIPE_PROFESSIONAL_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# Supabase
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...

# AI Services
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...

# Staff Auth
STAFF_USERNAME=staffuser
STAFF_PASSWORD=DirectoryBoltStaff2025!
```

---

## Build Commands Verification

**In netlify.toml:**
```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "18.17.0"
  NEXT_TELEMETRY_DISABLED = "1"
  NPM_FLAGS = "--legacy-peer-deps"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

This configuration is correct ✅

---

## Manual Build Test (If Needed)

If you want to test the build locally before deploying:

```bash
# Clean everything
rm -rf .next
rm -rf node_modules
rm -rf package-lock.json

# Fresh install
npm install --legacy-peer-deps

# Try to build
npm run build
```

**What to look for:**
- Build should complete successfully
- Should see: `Compiled successfully`
- Should create `.next` folder
- Should include both analyze and pricing pages

**Check page output:**
```bash
# After successful build
ls .next/server/pages/
```

Should see:
- `analyze.html` or `analyze.js`
- `pricing.html` or `pricing.js`

---

## Alternative: Check Netlify Functions

If pages still don't work, the issue might be with Netlify's Next.js plugin.

**Try updating the plugin:**

```bash
npm install @netlify/plugin-nextjs@latest
git add package.json package-lock.json
git commit -m "Update Netlify Next.js plugin"
git push
```

---

## Debug: Check What's Actually Deployed

After deployment, check what Netlify actually deployed:

**Method 1: Check Build Output**
In Netlify build log, look for:
```
┌─────────────────────────────────────────────────────────┐
│   ✓ Generating static pages                            │
│   ✓ Collecting page data                              │
│   ✓ Finalizing page optimization                       │
└─────────────────────────────────────────────────────────┘

Route (pages)                              Size
┌ ƒ /analyze                               X KB
├ ƒ /pricing                               X KB
├ ○ /                                       X KB
```

**Method 2: Check Deployed Files**
Visit:
- https://directorybolt.com/analyze.html (might work)
- https://directorybolt.com/_next/server/pages/analyze.js

---

## Emergency Rollback

If new deployment breaks things:

1. Go to Netlify Dashboard → Deploys
2. Find the last working deployment
3. Click "..." menu → "Publish deploy"
4. Reverts to previous version

---

## Contact Points

**If build still fails after trying everything:**

1. **Check Netlify Status:** https://www.netlifystatus.com
2. **Netlify Support:** https://answers.netlify.com
3. **Next.js Docs:** https://nextjs.org/docs/deployment

---

## What I Can Do Next

Once you provide the build log or error messages, I can:

1. ✅ Fix TypeScript errors in the code
2. ✅ Adjust Next.js configuration
3. ✅ Update dependencies if needed
4. ✅ Create workaround solutions
5. ✅ Set up alternative routing

**Just share the error messages from the build log!**

---

## Quick Checklist

Before contacting me about build issues, check:

- [ ] Latest deploy shows "Published" (not "Failed")
- [ ] Build log shows "Compiled successfully"
- [ ] All environment variables are set in Netlify
- [ ] Node version is 18.x
- [ ] No red error messages in build log
- [ ] Tried "Clear cache and deploy"

If any of these are ❌, that's likely the issue!

