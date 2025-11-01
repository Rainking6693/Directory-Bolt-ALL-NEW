# 🚀 Stripe CLI Quick Start Guide

## Step 1: Install Stripe CLI

### Windows (PowerShell):
```powershell
# Using Scoop (recommended)
scoop install stripe

# Or download from:
# https://github.com/stripe/stripe-cli/releases/latest
# Download stripe_X.X.X_windows_x86_64.zip
# Extract and add to PATH
```

### macOS:
```bash
brew install stripe/stripe-cli/stripe
```

### Linux:
```bash
# Download and install
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_X.X.X_linux_x86_64.tar.gz
tar -xvf stripe_X.X.X_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

---

## Step 2: Login to Stripe

```bash
stripe login
```

This will:
1. Open your browser
2. Ask you to authorize Stripe CLI
3. Connect to your Stripe account

**Note:** Make sure you're logged into the correct Stripe account (test or live mode)

---

## Step 3: Test Your Webhook

### Option A: Send a Test Event (Quick Test)

```bash
# Test checkout completion
stripe trigger checkout.session.completed

# Test payment success
stripe trigger payment_intent.succeeded

# Test payment failure
stripe trigger payment_intent.payment_failed
```

This sends a test event directly to your webhook endpoint configured in Stripe Dashboard.

---

### Option B: Forward Webhooks to Your Local Server (Development)

```bash
# Forward webhooks to localhost
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe

# Forward webhooks to your Netlify deployment
stripe listen --forward-to https://directorybolt.com/api/webhooks/stripe
```

This will:
- Show you all webhook events in real-time
- Forward them to your endpoint
- Display the response from your server

**Press Ctrl+C to stop**

---

### Option C: Trigger Specific Events While Listening

```bash
# Terminal 1: Start listening
stripe listen --forward-to https://directorybolt.com/api/webhooks/stripe

# Terminal 2: Trigger an event
stripe trigger checkout.session.completed
```

---

## Step 4: Check Your Webhook Secret

When you run `stripe listen`, it will give you a webhook signing secret:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

**Use this secret for local testing:**
- Add to your `.env` file: `STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx`
- This is different from your production webhook secret

---

## 📋 Common Commands

### Test Events:
```bash
# Checkout completed
stripe trigger checkout.session.completed

# Payment succeeded
stripe trigger payment_intent.succeeded

# Payment failed
stripe trigger payment_intent.payment_failed

# Customer created
stripe trigger customer.created
```

### Monitor Webhooks:
```bash
# Listen to all events
stripe listen

# Listen and forward to endpoint
stripe listen --forward-to https://your-endpoint.com/webhook

# Listen to specific events only
stripe listen --events checkout.session.completed,payment_intent.succeeded
```

### Check Status:
```bash
# Check Stripe CLI version
stripe --version

# Check login status
stripe config --list

# See all available commands
stripe --help
```

---

## 🧪 Testing Your Webhook Endpoint

### Quick Test Sequence:

1. **Start listening:**
   ```bash
   stripe listen --forward-to https://directorybolt.com/api/webhooks/stripe
   ```

2. **In another terminal, trigger an event:**
   ```bash
   stripe trigger checkout.session.completed
   ```

3. **Watch the output:**
   - You should see the event being sent
   - Your server should respond with `200 OK`
   - Check your server logs for processing

---

## 🔍 Troubleshooting

### "Command not found"
- Make sure Stripe CLI is installed
- Check it's in your PATH: `stripe --version`

### "Not logged in"
- Run: `stripe login`
- Authorize in browser

### "Webhook secret mismatch"
- Use the secret from `stripe listen` output for local testing
- Use dashboard secret for production

### "Connection refused"
- Make sure your server is running
- Check the URL is correct
- Verify HTTPS for production URLs

---

## 💡 Pro Tips

1. **Use different terminals:**
   - Terminal 1: `stripe listen` (keeps running)
   - Terminal 2: `stripe trigger` (sends events)

2. **Test locally first:**
   ```bash
   stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
   ```

3. **Check event logs:**
   ```bash
   stripe events list --limit 10
   ```

4. **See webhook responses:**
   The `stripe listen` command shows response status codes and bodies

---

## ✅ Success Checklist

- [ ] Stripe CLI installed
- [ ] Logged in: `stripe login`
- [ ] Tested trigger: `stripe trigger checkout.session.completed`
- [ ] Webhook responds with 200 OK
- [ ] Checked server logs for event processing

---

**Quick Start:**
```bash
stripe login
stripe trigger checkout.session.completed
```

That's it! 🎉

