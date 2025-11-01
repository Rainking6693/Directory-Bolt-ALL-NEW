# 🚨 Fix Webhook 404 Error - Action Plan

## ❌ Current Issue

Stripe Dashboard shows **404 ERR** for all webhook events.

**Your webhook URL in Stripe:** `https://directorybolt.com/api/webhooks/stripe`

---

## ✅ Step-by-Step Fix

### Step 1: Verify Your Actual Netlify Domain

1. **Go to Netlify Dashboard**
2. **Your Site** > **Site settings** > **Domain management**
3. **Note your primary domain:**
   - Is it `directorybolt.com`?
   - Or `your-site-name.netlify.app`?

### Step 2: Test Endpoint Directly

Open PowerShell and test:

```powershell
# Test GET request (should return 405, not 404)
Invoke-WebRequest -Uri "https://directorybolt.com/api/webhooks/stripe" -Method GET

# If that fails, try your Netlify subdomain:
Invoke-WebRequest -Uri "https://your-site-name.netlify.app/api/webhooks/stripe" -Method GET
```

**What to look for:**
- **405 Method Not Allowed** = ✅ Endpoint exists
- **404 Not Found** = ❌ Endpoint doesn't exist
- **504 Gateway Timeout** = ⚠️ Endpoint exists but has issues

### Step 3: Update Webhook URL in Stripe

1. **Go to:** https://dashboard.stripe.com/webhooks (or test mode)
2. **Click:** "DirectoryBolt Production Webhook"
3. **Click:** "Edit destination" button
4. **Update the endpoint URL to match your actual domain:**

   **If `directorybolt.com` works:**
   ```
   https://directorybolt.com/api/webhooks/stripe
   ```

   **If you need to use Netlify subdomain:**
   ```
   https://your-site-name.netlify.app/api/webhooks/stripe
   ```

5. **Save changes**

### Step 4: Test Again

1. **In Stripe Dashboard**, click **"Send test webhook"**
2. **Select:** `checkout.session.completed`
3. **Click:** "Send test webhook"
4. **Check:** Should now show **200 OK** instead of **404 ERR**

---

## 🔄 Alternative: Use stripe-secure Endpoint

If `stripe.js` still doesn't work, try the secure version:

1. **Update Stripe webhook URL to:**
   ```
   https://directorybolt.com/api/webhooks/stripe-secure
   ```

2. **Or with Netlify subdomain:**
   ```
   https://your-site-name.netlify.app/api/webhooks/stripe-secure
   ```

---

## 🧪 Quick Diagnostic Test

Run this to check what your endpoint returns:

```powershell
# Test your endpoint
$url = "https://directorybolt.com/api/webhooks/stripe"
try {
    $response = Invoke-WebRequest -Uri $url -Method GET -ErrorAction Stop
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "✅ Endpoint exists!" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 404) {
        Write-Host "❌ 404 - Endpoint not found" -ForegroundColor Red
        Write-Host "Check if URL is correct or try Netlify subdomain" -ForegroundColor Yellow
    } elseif ($statusCode -eq 405) {
        Write-Host "✅ 405 - Endpoint exists (method not allowed is expected)" -ForegroundColor Green
    } else {
        Write-Host "Status: $statusCode" -ForegroundColor Yellow
    }
}
```

---

## 📋 Most Likely Fix

**The webhook URL in Stripe Dashboard needs to match your actual Netlify deployment URL.**

**Common issues:**
1. Using `directorybolt.com` but domain not pointing to Netlify
2. Using wrong Netlify subdomain
3. URL has trailing slash or typo

**Solution:**
- Update Stripe webhook URL to match exactly what works when you test it directly
- Make sure domain has valid SSL (HTTPS)
- Verify no typos in the URL

---

## ✅ After Fixing

Once you update the URL and test:

1. **Stripe Dashboard** should show **200 OK**
2. **Event deliveries** tab shows successful deliveries
3. **Webhook logs** show processing

**Test with:**
```bash
stripe trigger checkout.session.completed
```

Then check Stripe Dashboard - should see **200 OK** instead of **404 ERR**!

