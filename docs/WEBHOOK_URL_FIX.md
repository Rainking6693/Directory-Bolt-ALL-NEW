# 🔧 Fix Webhook 404 - URL Configuration

## ❌ Problem

Stripe Dashboard shows **404 ERR** - endpoint not found.

**Current webhook URL:** `https://directorybolt.com/api/webhooks/stripe`

---

## ✅ Solution: Update Webhook URL in Stripe Dashboard

The endpoint file exists, but Stripe can't reach it. Here's how to fix:

### Step 1: Verify Your Actual Domain

Check what your Netlify site URL is:
- Go to **Netlify Dashboard** > Your Site > **Site settings** > **Domain management**
- Note your **primary domain**

### Step 2: Test the Endpoint

Try these URLs in your browser or with curl:

```bash
# Option 1: Your custom domain
curl https://directorybolt.com/api/webhooks/stripe

# Option 2: Netlify subdomain
curl https://your-site-name.netlify.app/api/webhooks/stripe

# Option 3: Test locally first
curl http://localhost:3000/api/webhooks/stripe
```

**Expected:** `405 Method Not Allowed` (means endpoint exists)

### Step 3: Update Stripe Webhook URL

In Stripe Dashboard:

1. **Go to:** Developers > Webhooks
2. **Click:** Your webhook endpoint
3. **Click:** "Edit destination" or "Update endpoint"
4. **Update URL to match your actual deployment:**

   **If using custom domain:**
   ```
   https://directorybolt.com/api/webhooks/stripe
   ```

   **If using Netlify subdomain:**
   ```
   https://your-site-name.netlify.app/api/webhooks/stripe
   ```

5. **Save changes**

### Step 4: Verify Domain Configuration

Make sure `directorybolt.com`:
- ✅ Points to your Netlify site
- ✅ Has SSL certificate (HTTPS working)
- ✅ Not blocking `/api/*` routes

---

## 🔄 Alternative: Use stripe-secure Endpoint

If `stripe.js` isn't working, try the secure version:

1. **Update Stripe webhook URL to:**
   ```
   https://directorybolt.com/api/webhooks/stripe-secure
   ```

2. **This uses `stripe-secure.ts`** which might be more reliable

---

## 🧪 Quick Test

After updating the URL in Stripe:

1. **Send test webhook** from Stripe Dashboard
2. **Check "Event deliveries" tab**
3. **Should see:** `200 OK` instead of `404 ERR`

---

## 📋 Checklist

- [ ] Verified actual Netlify domain
- [ ] Tested endpoint URL directly (returns 405, not 404)
- [ ] Updated webhook URL in Stripe Dashboard
- [ ] Domain has valid SSL certificate
- [ ] No redirect rules blocking `/api/*`
- [ ] Sent test webhook and verified 200 OK

---

## 💡 Most Common Fix

**Update the webhook URL in Stripe Dashboard to match your actual Netlify deployment URL.**

If `directorybolt.com` isn't pointing to Netlify correctly, use your Netlify subdomain instead:
```
https://your-site-name.netlify.app/api/webhooks/stripe
```

