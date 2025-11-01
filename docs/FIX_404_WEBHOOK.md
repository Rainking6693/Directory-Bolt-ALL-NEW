# 🔧 Fix 404 Error for Webhook Endpoint

## ❌ Problem

Your webhook is returning **404 ERR** - Stripe can't find your endpoint.

**Current webhook URL in Stripe:**
```
https://directorybolt.com/api/webhooks/stripe
```

---

## 🔍 Diagnosis

A 404 means the route isn't being found. Possible causes:

1. **Route not deployed** - File might not be in the build
2. **Path mismatch** - URL doesn't match the file path
3. **Next.js routing issue** - Build configuration problem
4. **Netlify routing** - Redirect rules blocking the route

---

## ✅ Solutions

### Solution 1: Verify File Exists and is Deployed

Check that `pages/api/webhooks/stripe.js` exists and is committed to git:

```bash
# Check if file exists
ls pages/api/webhooks/stripe.js

# Check if it's in git
git ls-files pages/api/webhooks/stripe.js
```

### Solution 2: Test Endpoint Directly

Test if the endpoint is accessible:

```bash
# Test GET (should return 405 Method Not Allowed, not 404)
curl -X GET https://directorybolt.com/api/webhooks/stripe

# Test POST (should return 400/401, not 404)
curl -X POST https://directorybolt.com/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**Expected:**
- `405` for GET = Endpoint exists ✅
- `400/401` for POST = Endpoint exists ✅
- `404` = Endpoint doesn't exist ❌

### Solution 3: Check Netlify Build Logs

1. Go to **Netlify Dashboard** > Your Site > **Deploys**
2. Click on latest deploy
3. Check **Build log** for:
   - Errors building API routes
   - Missing files
   - Build failures

### Solution 4: Verify Next.js Configuration

Check `next.config.js` - make sure it's not blocking API routes:

```javascript
// Should NOT have redirects that block /api/*
// Should allow API routes to be built
```

### Solution 5: Update Webhook URL in Stripe

If the file path is different, update Stripe:

**Current:** `https://directorybolt.com/api/webhooks/stripe`

**Try these alternatives:**
- `https://directorybolt.com/.netlify/functions/stripe`
- `https://directorybolt.com/api/webhooks/stripe-secure` (if using the secure version)

---

## 🚀 Quick Fixes

### Fix 1: Rebuild and Redeploy

```bash
# Commit and push changes
git add pages/api/webhooks/stripe.js
git commit -m "Fix webhook endpoint"
git push

# Or trigger rebuild in Netlify Dashboard
```

### Fix 2: Create Netlify Redirect Rule

Create `netlify.toml` in project root:

```toml
[[redirects]]
  from = "/api/webhooks/stripe"
  to = "/.netlify/functions/stripe"
  status = 200
  force = true
```

### Fix 3: Verify Endpoint Exports Correctly

Make sure `stripe.js` has:
```javascript
export default async function handler(req, res) {
  // ... handler code
}
```

---

## 🧪 Testing Steps

1. **Check if endpoint exists:**
   ```bash
   curl -X GET https://directorybolt.com/api/webhooks/stripe
   ```
   - Should return `405` (not `404`)

2. **Check Netlify Functions:**
   - Go to Netlify Dashboard > Functions
   - See if `stripe` function exists

3. **Check build output:**
   - Look for `.next/server/pages/api/webhooks/stripe.js` in build logs

---

## 📋 Checklist

- [ ] File `pages/api/webhooks/stripe.js` exists
- [ ] File is committed to git
- [ ] File has `export default` handler
- [ ] Netlify build succeeds
- [ ] Endpoint returns 405 for GET (not 404)
- [ ] Webhook URL in Stripe matches deployed URL

---

## 🔄 Alternative: Use stripe-secure.ts

If `stripe.js` isn't working, switch to the secure version:

1. **Update Stripe Dashboard webhook URL to:**
   ```
   https://directorybolt.com/api/webhooks/stripe-secure
   ```

2. **Verify `stripe-secure.ts` is deployed**

3. **Test again**

---

## 💡 Most Likely Fix

**Check Netlify build logs** - the route might not be building correctly, or there's a redirect rule blocking it.

**Quick test:**
```bash
# Should return 405, not 404
curl https://directorybolt.com/api/webhooks/stripe
```

If it returns 404, the route isn't deployed. Check Netlify build logs!

