# 🔧 Fix Webhook 404 Error

## ❌ Problem

Stripe Dashboard shows **404 ERR** for all webhook events.

**Webhook URL:** `https://directorybolt.com/api/webhooks/stripe`

---

## 🔍 Root Cause

The 404 means Stripe can't reach your endpoint. This could be:

1. **Endpoint not deployed** - File missing from build
2. **URL mismatch** - Stripe URL doesn't match actual endpoint
3. **Netlify routing** - Redirect rules blocking the route
4. **Build issue** - API route not built correctly

---

## ✅ Quick Fixes

### Fix 1: Verify Endpoint URL in Stripe

Your webhook endpoint in Stripe Dashboard should match exactly:

**Current:** `https://directorybolt.com/api/webhooks/stripe`

**For Next.js on Netlify, this should work**, but verify:
- No trailing slash
- Correct domain (`directorybolt.com`)
- Correct path (`/api/webhooks/stripe`)

### Fix 2: Test Endpoint Directly

```bash
# Test GET request (should return 405, not 404)
curl -X GET https://directorybolt.com/api/webhooks/stripe

# Test POST request (should return 400/401, not 404)
curl -X POST https://directorybolt.com/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**Expected responses:**
- `405 Method Not Allowed` (GET) = ✅ Endpoint exists
- `400 Bad Request` (POST) = ✅ Endpoint exists  
- `404 Not Found` = ❌ Endpoint doesn't exist

### Fix 3: Check Netlify Build

1. **Go to Netlify Dashboard** > Your Site > **Deploys**
2. **Click latest deploy**
3. **Check build logs** for:
   - API route compilation errors
   - Missing files
   - Build failures

### Fix 4: Verify File is Committed

```bash
# Check if file exists in git
git ls-files pages/api/webhooks/stripe.js

# If not committed:
git add pages/api/webhooks/stripe.js
git commit -m "Add webhook endpoint"
git push
```

### Fix 5: Check Netlify Functions

1. **Netlify Dashboard** > Your Site > **Functions**
2. **Look for:** `stripe` or `api-webhooks-stripe`
3. **If missing:** The route isn't being built as a function

---

## 🔄 Alternative: Update Webhook URL

If the endpoint path is different, update Stripe:

### Option A: Use Netlify Functions Path
```
https://directorybolt.com/.netlify/functions/stripe
```

### Option B: Use Secure Version
```
https://directorybolt.com/api/webhooks/stripe-secure
```

---

## 🧪 Debugging Steps

### Step 1: Check if Route Exists Locally
```bash
# Start dev server
npm run dev

# Test locally
curl http://localhost:3000/api/webhooks/stripe
# Should return 405 (not 404)
```

### Step 2: Check Netlify Deploy
- Go to Netlify Dashboard
- Check latest deploy logs
- Look for API route build errors

### Step 3: Verify File Structure
```
pages/
  api/
    webhooks/
      stripe.js  ← Should exist
```

### Step 4: Check Redirects
Look for `_redirects` file or `netlify.toml` that might be blocking `/api/*` routes.

---

## 🚀 Most Likely Solutions

### Solution 1: Rebuild Deployment
```bash
# Trigger new deploy
git commit --allow-empty -m "Trigger rebuild"
git push
```

### Solution 2: Update Webhook URL
Try updating Stripe webhook URL to:
```
https://directorybolt.com/api/webhooks/stripe-secure
```
(If `stripe-secure.ts` is working)

### Solution 3: Check Domain
Make sure `directorybolt.com` is:
- ✅ Pointing to your Netlify site
- ✅ SSL certificate valid
- ✅ Not redirecting `/api/*` routes

---

## 📋 Action Items

1. **Test endpoint:** `curl https://directorybolt.com/api/webhooks/stripe`
2. **Check Netlify build logs** for errors
3. **Verify file is committed** to git
4. **Check redirect rules** aren't blocking `/api/*`
5. **Try alternative URL** if needed

---

## 💡 Quick Test

Run this to see what your endpoint returns:

```bash
curl -v https://directorybolt.com/api/webhooks/stripe
```

- **405** = Endpoint exists ✅
- **404** = Endpoint doesn't exist ❌
- **504** = Endpoint exists but timing out ⚠️

Let me know what status code you get!

