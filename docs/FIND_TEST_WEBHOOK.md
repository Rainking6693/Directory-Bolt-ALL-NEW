# 🔍 Where to Find "Send Test Webhook" in Stripe Dashboard

## Quick Answer

Based on your Stripe Dashboard screenshot, here's where to find it:

### **Method 1: Three Dots Menu (Most Likely)**
1. Look at the **"..." (three dots)** button to the right of "Edit destination"
2. Click it
3. Look for **"Send test event"** or **"Test webhook"** in the dropdown

### **Method 2: Events Page**
1. Click **"Events"** in the top navigation bar (next to "Webhooks")
2. At the top right, you should see a **"Send test event"** button
3. Click it and select your webhook endpoint

### **Method 3: Edit Destination Page**
1. Click **"Edit destination"** button
2. Scroll down - there should be a **"Send test event"** section
3. Select event type and send

---

## ⚠️ Important: Your Webhook Endpoint

Your current endpoint in Stripe is:
```
https://directorybolt.com/api/webhooks/stripe
```

You have TWO webhook handlers:
- ✅ `/api/webhooks/stripe.js` - This is what you're currently using (matches your Stripe config)
- ✅ `/api/webhooks/stripe-secure.ts` - This is the newer secure version

**Recommendation:** 
- If `/api/webhooks/stripe` is working, keep using it
- Or update Stripe to use `/api/webhooks/stripe-secure` for enhanced security

---

## 🧪 Using Stripe CLI (Easiest Way)

If you can't find the button, use Stripe CLI:

```bash
# Install Stripe CLI first (if needed)
# Then login
stripe login

# Trigger a test checkout completion event
stripe trigger checkout.session.completed

# Or forward webhooks to your endpoint
stripe listen --forward-to https://directorybolt.com/api/webhooks/stripe
```

---

## 📍 Visual Guide

In your Stripe Dashboard:

1. **Top Navigation:** Click "Events" tab
   - Should see "Send test event" button there

2. **Webhook Page:** Click the "..." menu
   - Should have "Send test event" option

3. **Edit Page:** Click "Edit destination"
   - Scroll to bottom, should see test options

---

## ✅ What to Do Next

1. **Try clicking the "..." menu** next to "Edit destination"
2. **Or go to "Events" tab** and look for "Send test event" button
3. **Or use Stripe CLI** (easiest if button is hard to find)
4. **Test with event:** `checkout.session.completed`
5. **Check "Event deliveries" tab** to see if it succeeded

---

## 🎯 Alternative: Interactive Webhook Builder

You mentioned seeing "Interactive webhook endpoint builder" under Resources:
- Click that link
- It should let you build and test webhook payloads
- This is another way to test your endpoint

---

**TL;DR:** Click the **"..." menu** or go to **"Events" tab** to find "Send test event". If you can't find it, use Stripe CLI!

