# 🔍 How to Send Test Webhook in Stripe Dashboard

## 📍 Finding "Send Test Webhook"

Based on your Stripe Dashboard, here's where to find it:

### Option 1: From the Webhook Overview Page
1. **Click the "..." (three dots)** button next to "Edit destination"
2. Look for **"Send test event"** or **"Test webhook"** in the dropdown menu

### Option 2: From the Events Page
1. Click **"Events"** in the top navigation bar
2. Click **"Send test event"** button (usually at the top right)
3. Select your webhook endpoint from the dropdown
4. Choose event type: `checkout.session.completed`
5. Click **"Send test event"**

### Option 3: Edit Destination
1. Click **"Edit destination"** button
2. Scroll down to find **"Send test event"** section
3. Select event type and send

### Option 4: Interactive Webhook Endpoint Builder
1. Click **"Interactive webhook endpoint builder"** under Resources
2. This tool lets you build and test webhook payloads

---

## ⚠️ IMPORTANT: Fix Your Webhook Endpoint URL

Your current webhook endpoint is:
```
https://directorybolt.com/api/webhooks/stripe
```

But your actual endpoint should be:
```
https://directorybolt.com/api/webhooks/stripe-secure
```

### To Fix:
1. Click **"Edit destination"** button
2. Update **"Endpoint URL"** to:
   ```
   https://directorybolt.com/api/webhooks/stripe-secure
   ```
3. Click **"Save"** or **"Update"**

---

## 🧪 Testing Steps

Once you find "Send test webhook":

1. **Select Event Type:**
   - Choose: `checkout.session.completed`
   - Or: `payment_intent.succeeded`

2. **Send Test Event:**
   - Click **"Send test event"** or **"Send"**

3. **Check Response:**
   - Should see `200 OK` response
   - Check "Event deliveries" tab for status

4. **Verify in Logs:**
   - Go to **"Event deliveries"** tab
   - Look for your test event
   - Should show ✅ Success (green checkmark)

---

## 📸 Alternative: Using Stripe CLI

If you can't find it in the dashboard, use Stripe CLI:

```bash
# Install Stripe CLI (if not installed)
# macOS: brew install stripe/stripe-cli/stripe
# Windows: Download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Trigger test event
stripe trigger checkout.session.completed

# Or forward to your endpoint
stripe listen --forward-to https://directorybolt.com/api/webhooks/stripe-secure
```

---

## 🔧 Quick Fix Checklist

- [ ] Update webhook endpoint URL to `/api/webhooks/stripe-secure`
- [ ] Find "Send test webhook" using one of the options above
- [ ] Send test event: `checkout.session.completed`
- [ ] Verify response is `200 OK`
- [ ] Check "Event deliveries" tab for success

---

## 💡 Where It Usually Is

In most Stripe dashboards, "Send test webhook" is located:
- In the **"..." menu** next to Edit destination
- In the **"Events"** page (top navigation)
- In the **"Edit destination"** page (scroll down)
- Sometimes visible as a button on the Overview page

If you still can't find it, try:
1. Refresh the page
2. Check if you're in the correct mode (test vs live)
3. Make sure you have proper permissions
4. Use Stripe CLI as an alternative

