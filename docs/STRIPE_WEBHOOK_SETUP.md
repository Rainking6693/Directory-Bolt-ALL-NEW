# Stripe Webhook Setup Guide

## Production Webhook Configuration

This guide walks you through setting up the Stripe webhook endpoint for production.

---

## 📋 Prerequisites

- Stripe account (test or live mode)
- Netlify deployment URL or your production domain
- `STRIPE_WEBHOOK_SECRET` environment variable configured

---

## 🔧 Step 1: Configure Webhook in Stripe Dashboard

### For Test Mode:
1. Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click **"Add endpoint"**
3. Enter your webhook URL:
   ```
   https://yourdomain.com/api/webhooks/stripe-secure
   ```
   Or for Netlify:
   ```
   https://your-app-name.netlify.app/api/webhooks/stripe-secure
   ```

### For Live Mode:
1. Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks)
2. Switch to **"Live mode"** (toggle in top right)
3. Click **"Add endpoint"**
4. Enter your production webhook URL

---

## 📨 Step 2: Select Events to Listen To

Select these events for the webhook:

### Required Events:
- ✅ `checkout.session.completed` - When a checkout is completed
- ✅ `payment_intent.succeeded` - When payment succeeds
- ✅ `payment_intent.payment_failed` - When payment fails

### Optional Events (Recommended):
- ✅ `customer.created` - When a new customer is created
- ✅ `customer.updated` - When customer info is updated
- ✅ `invoice.payment_succeeded` - When invoice payment succeeds
- ✅ `invoice.payment_failed` - When invoice payment fails

**Click "Add events"** after selecting, then **"Add endpoint"**

---

## 🔐 Step 3: Get Webhook Secret

After creating the endpoint:

1. Click on your newly created webhook endpoint
2. Find the **"Signing secret"** section
3. Click **"Reveal"** to show the secret
4. Copy the secret (starts with `whsec_`)

---

## 🌐 Step 4: Configure Environment Variables

### In Netlify:
1. Go to **Site settings > Environment variables**
2. Add or update:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   ```
3. Make sure it's set for **Production** environment

### In Local `.env`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

**⚠️ Important:** Use different webhook secrets for test and live modes!

---

## ✅ Step 5: Test the Webhook

### Using Stripe CLI (Recommended):

1. **Install Stripe CLI:**
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # Windows (with Scoop)
   scoop install stripe
   
   # Or download from: https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe:**
   ```bash
   stripe login
   ```

3. **Forward webhooks to local server:**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe-secure
   ```

4. **Trigger a test event:**
   ```bash
   stripe trigger checkout.session.completed
   ```

### Using Stripe Dashboard:

1. Go to your webhook endpoint in Stripe Dashboard
2. Click **"Send test webhook"**
3. Select event: `checkout.session.completed`
4. Click **"Send test webhook"**
5. Check the response - should be `200 OK`

---

## 🧪 Step 6: Verify Webhook Endpoint

### Test Endpoint Manually:

```bash
# Test that endpoint exists and requires POST
curl -X GET https://yourdomain.com/api/webhooks/stripe-secure
# Should return: 405 Method Not Allowed

# Test with invalid signature (should fail)
curl -X POST https://yourdomain.com/api/webhooks/stripe-secure \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
# Should return: 400 Bad Request or 401 Unauthorized
```

### Run Automated Test:

```bash
node scripts/test-stripe-checkout.js
```

---

## 🔍 Step 7: Monitor Webhook Activity

### In Stripe Dashboard:
1. Go to **Developers > Webhooks**
2. Click on your webhook endpoint
3. View **"Recent events"** tab
4. Check for successful deliveries (green) or failures (red)

### Webhook Event Logs:
- ✅ Green checkmark = Successfully delivered
- ❌ Red X = Failed delivery
- ⏱️ Pending = Waiting to retry

---

## 🛠️ Troubleshooting

### Webhook Returns 401/400:
- **Check:** `STRIPE_WEBHOOK_SECRET` is set correctly
- **Check:** Webhook secret matches the one in Stripe Dashboard
- **Check:** Using correct secret for test vs live mode

### Webhook Returns 500:
- **Check:** Server logs for errors
- **Check:** All required environment variables are set
- **Check:** Database connections are working

### Webhook Not Receiving Events:
- **Check:** Webhook URL is accessible (not blocked by firewall)
- **Check:** Webhook is enabled in Stripe Dashboard
- **Check:** Correct events are selected
- **Check:** Using HTTPS (required for production)

### Test Mode vs Live Mode:
- **Test mode webhook:** Use `sk_test_` keys and test webhook secret
- **Live mode webhook:** Use `sk_live_` keys and live webhook secret
- **⚠️ Never mix test and live credentials!**

---

## 📝 Webhook Endpoint Details

**Path:** `/api/webhooks/stripe-secure`

**Method:** `POST` only

**Content-Type:** `application/json`

**Headers Required:**
- `stripe-signature` - Stripe webhook signature (automatic)

**Response Codes:**
- `200` - Webhook processed successfully
- `400` - Invalid request/signature
- `405` - Method not allowed (GET/PUT/etc.)
- `500` - Server error

---

## 🔒 Security Features

The webhook endpoint includes:

1. **Signature Verification** - Validates webhook authenticity
2. **Event Type Filtering** - Only processes allowed events
3. **Rate Limiting** - Prevents abuse
4. **Error Handling** - Graceful failure handling
5. **Logging** - Comprehensive event logging

---

## 📊 Event Handling

### `checkout.session.completed`
- Stores customer data
- Triggers analysis process
- Sends confirmation email

### `payment_intent.succeeded`
- Updates payment status
- Sends payment confirmation

### `payment_intent.payment_failed`
- Logs payment failure
- Sends failure notification
- Monitors for anomalies

---

## 🚀 Production Checklist

- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] Correct events selected
- [ ] Webhook secret copied and configured
- [ ] Environment variable set in Netlify/production
- [ ] Webhook tested with Stripe CLI or Dashboard
- [ ] Webhook returns 200 OK for test events
- [ ] Monitoring enabled in Stripe Dashboard
- [ ] Error alerts configured (optional)

---

## 📞 Support

If you encounter issues:

1. Check Stripe Dashboard webhook logs
2. Check server application logs
3. Verify environment variables
4. Test with Stripe CLI
5. Contact support with webhook event IDs

---

## 🔗 Additional Resources

- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Webhook Security Best Practices](https://stripe.com/docs/webhooks/signatures)

