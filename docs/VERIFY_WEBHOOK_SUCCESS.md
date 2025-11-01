# ✅ Verify Your Webhook Received the Test Event

## 🎉 Success! Test Event Triggered

Your Stripe CLI command worked! Now let's verify your webhook received and processed it.

---

## ✅ Step 1: Check Stripe Dashboard

1. **Go to Stripe Dashboard:**
   - Test mode: https://dashboard.stripe.com/test/webhooks
   - Live mode: https://dashboard.stripe.com/webhooks

2. **Click on your webhook endpoint:**
   - "DirectoryBolt Production Webhook"

3. **Click "Event deliveries" tab**

4. **Look for the test event:**
   - Should see a recent `checkout.session.completed` event
   - Check the status:
     - ✅ **Green checkmark** = Successfully delivered (200 OK)
     - ❌ **Red X** = Failed (check error message)
     - ⏱️ **Pending** = Still processing

---

## ✅ Step 2: Check Event Details

Click on the event to see:
- **Status Code:** Should be `200`
- **Response:** Should show `{"received": true}` or similar
- **Request/Response:** Full details of what was sent/received
- **Timestamp:** When it was delivered

---

## ✅ Step 3: Check Your Server Logs

If you have access to your server logs (Netlify Functions logs), check for:
- Webhook received messages
- Event processing logs
- Any errors

**Netlify:**
- Go to: Netlify Dashboard > Your Site > Functions > View logs
- Look for `/api/webhooks/stripe` function logs

---

## 🔍 What Success Looks Like

### In Stripe Dashboard:
- ✅ Event status: **Delivered**
- ✅ Response code: **200**
- ✅ Response time: < 1000ms (usually)

### In Your Code:
- Customer data stored (if implemented)
- Payment status updated (if implemented)
- Confirmation email sent (if implemented)
- Analysis process triggered (if implemented)

---

## ⚠️ Troubleshooting

### If Event Shows "Failed":

1. **Check Response Code:**
   - `400` = Bad request (check webhook secret)
   - `401` = Unauthorized (webhook secret mismatch)
   - `500` = Server error (check server logs)

2. **Check Error Message:**
   - Click on the failed event
   - Read the error response
   - Common issues:
     - Webhook secret mismatch
     - Endpoint URL incorrect
     - Server timeout
     - Missing environment variables

3. **Verify Webhook Secret:**
   ```bash
   node scripts/verify-webhook-secret.js
   ```

### If Event Shows "Pending":

- Wait a few seconds (Stripe retries automatically)
- Check if your server is responding
- Verify endpoint URL is accessible

---

## 🧪 Test More Events

Try triggering other events:

```bash
# Payment succeeded
stripe trigger payment_intent.succeeded

# Payment failed
stripe trigger payment_intent.payment_failed

# Customer created
stripe trigger customer.created
```

---

## 📊 Monitor Webhooks in Real-Time

To see webhooks as they happen:

```bash
# Forward webhooks to your endpoint
stripe listen --forward-to https://directorybolt.com/api/webhooks/stripe
```

Then trigger events in another terminal to see them in real-time.

---

## ✅ Success Checklist

- [ ] Test event triggered successfully ✅
- [ ] Event appears in Stripe Dashboard
- [ ] Event status is "Delivered" (200 OK)
- [ ] Server logs show webhook received
- [ ] No errors in response

---

**Next Steps:**
1. Check Stripe Dashboard for event delivery status
2. Verify response code is 200
3. Check server logs for processing confirmation
4. Test with a real checkout flow if everything looks good!

