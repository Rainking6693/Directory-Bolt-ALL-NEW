# 🔧 Webhook Secret Configuration Fix

## ✅ Current Status

Your webhook secret **IS configured** and **IS valid**:
- ✅ Format: Correct (`whsec_...`)
- ✅ Length: Valid (38 characters)
- ✅ Mode: LIVE MODE detected

## ⚠️ The Issue

The webhook secret works, but there are a few things to verify:

### 1. **Netlify Environment Variables**

The webhook secret needs to be set in **Netlify's environment variables**, not just your local `.env` file.

**To fix:**
1. Go to **Netlify Dashboard** > Your Site > **Site settings** > **Environment variables**
2. Check if `STRIPE_WEBHOOK_SECRET` is set
3. If not, add it with your webhook secret value
4. Make sure it's set for **Production** environment

### 2. **Test vs Live Mode Mismatch**

Your script detected **LIVE MODE** keys, but you might be testing with **TEST MODE** webhooks.

**To fix:**
- **Test Mode:** Use webhook secret from `https://dashboard.stripe.com/test/webhooks`
- **Live Mode:** Use webhook secret from `https://dashboard.stripe.com/webhooks`
- Make sure the webhook secret matches the mode of your Stripe keys

### 3. **Webhook Endpoint URL**

The webhook endpoint in Stripe Dashboard must match your Netlify URL.

**To verify:**
1. Go to Stripe Dashboard > Webhooks
2. Check your webhook endpoint URL
3. It should be: `https://your-app.netlify.app/api/webhooks/stripe-secure`
4. If different, update it to match your Netlify deployment URL

## 🧪 Testing the Webhook

### Test 1: Verify Webhook Secret Locally
```bash
node scripts/verify-webhook-secret.js
```

### Test 2: Test Webhook Endpoint
1. Go to Stripe Dashboard > Webhooks
2. Click on your webhook endpoint
3. Click **"Send test webhook"**
4. Select event: `checkout.session.completed`
5. Click **"Send test webhook"**
6. Should return `200 OK`

### Test 3: Check Webhook Logs
1. In Stripe Dashboard, go to your webhook endpoint
2. Click **"Recent events"** tab
3. Check for:
   - ✅ Green checkmarks = Success
   - ❌ Red X = Failed (check error message)

## 🔍 Common Issues

### Issue: "Webhook secret not configured"
**Cause:** `STRIPE_WEBHOOK_SECRET` not set in Netlify environment variables
**Fix:** Add it in Netlify Dashboard > Site settings > Environment variables

### Issue: "Invalid webhook signature"
**Cause:** Webhook secret doesn't match the one in Stripe Dashboard
**Fix:** 
1. Go to Stripe Dashboard > Webhooks > Your endpoint
2. Click "Reveal" on signing secret
3. Copy the exact secret
4. Update `STRIPE_WEBHOOK_SECRET` in Netlify

### Issue: "Webhook not receiving events"
**Cause:** Webhook endpoint URL mismatch or webhook disabled
**Fix:**
1. Verify webhook URL in Stripe matches your Netlify URL
2. Make sure webhook is enabled (not disabled)
3. Check that correct events are selected

### Issue: "Test mode vs Live mode mismatch"
**Cause:** Using test webhook secret with live keys (or vice versa)
**Fix:**
- Use test webhook secret with `sk_test_` keys
- Use live webhook secret with `sk_live_` keys
- Don't mix them!

## ✅ Verification Checklist

- [ ] `STRIPE_WEBHOOK_SECRET` is set in Netlify environment variables
- [ ] Webhook secret matches the one in Stripe Dashboard
- [ ] Webhook endpoint URL in Stripe matches your Netlify URL
- [ ] Test mode secret used with test keys (or live secret with live keys)
- [ ] Webhook is enabled in Stripe Dashboard
- [ ] Correct events are selected (`checkout.session.completed`, etc.)
- [ ] Test webhook returns `200 OK`

## 🚀 Quick Fix Commands

### Verify webhook secret:
```bash
node scripts/verify-webhook-secret.js
```

### Test webhook endpoint (if server running locally):
```bash
curl -X POST http://localhost:3000/api/webhooks/stripe-secure \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
# Should return 400/401 (expected - no signature)
```

## 📝 Summary

**Your webhook secret IS configured correctly!** 

The webhook should work if:
1. ✅ Secret is in Netlify environment variables (not just local .env)
2. ✅ Webhook endpoint is configured in Stripe Dashboard
3. ✅ Webhook secret matches the one in Stripe Dashboard
4. ✅ Test/live mode matches between keys and webhook secret

If you're still having issues, check:
- Netlify function logs
- Stripe Dashboard webhook logs
- Make sure you're testing with the correct mode (test vs live)

