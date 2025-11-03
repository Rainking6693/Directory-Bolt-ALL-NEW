# How to Create a Slack App in Your Workspace

## Step-by-Step Guide

### Step 1: Go to Slack Apps Dashboard

1. Open your browser
2. Go to: **https://api.slack.com/apps**
3. You should see the Slack API dashboard

### Step 2: Create New App

1. Click the **"Create New App"** button (top right, green button)

2. Choose **"From scratch"** option
   - This gives you full control

3. Fill in app details:
   - **App Name:** e.g., "DirectoryBolt DLQ Monitor" or "DLQ Alerts"
   - **Pick a workspace:** Select YOUR workspace from the dropdown
   - Click **"Create App"**

### Step 3: Enable Incoming Webhooks

1. In the left sidebar, look for **"Features"** section
2. Click **"Incoming Webhooks"**
3. Toggle the switch **"Activate Incoming Webhooks"** to **ON** (it turns green)

### Step 4: Add Webhook to Your Workspace

1. Scroll down to **"Webhook URLs for Your Workspace"** section
2. Click **"Add New Webhook to Workspace"** button
3. You'll see a list of channels in your workspace:
   - Select a channel (e.g., #general, or create #alerts)
   - Or create a new channel first
4. Click **"Allow"** button
5. **Copy the Webhook URL** that appears - it looks like:
   ```
   https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
   ```

### Step 5: Use the Webhook URL

Add it to your `backend/.env` file:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/ACTUAL/URL/HERE
```

---

## Quick Visual Guide

```
Slack Apps Dashboard (https://api.slack.com/apps)
    ↓
Click "Create New App"
    ↓
Choose "From scratch"
    ↓
Enter app name + select your workspace
    ↓
Click "Create App"
    ↓
Click "Incoming Webhooks" (left sidebar)
    ↓
Toggle "Activate Incoming Webhooks" ON
    ↓
Click "Add New Webhook to Workspace"
    ↓
Select channel (e.g., #general or #alerts)
    ↓
Click "Allow"
    ↓
Copy the webhook URL
    ↓
Add to backend/.env file
```

---

## Troubleshooting

### Can't see "Create New App" button?
- Make sure you're logged into Slack
- Go to https://api.slack.com/apps directly
- Check that you're using the correct Slack account

### Don't see your workspace in dropdown?
- Make sure you're logged into Slack
- Refresh the page
- Try logging out and back into Slack

### Can't find "Incoming Webhooks"?
- Look in the left sidebar under "Features"
- It might be collapsed - expand the "Features" section
- Make sure you're on the app's settings page (not the workspace)

### Webhook URL not working?
- Verify you copied the ENTIRE URL (it's long)
- Check there are no extra spaces
- Make sure Incoming Webhooks is enabled (green toggle)
- Verify the app is installed in your workspace

---

## Alternative: Check Existing Apps

If you already created an app but can't find it:

1. Go to https://api.slack.com/apps
2. Look at "Your Apps" section (top of page)
3. You should see any apps you've created
4. Click on your app name to configure it

---

## Next Steps After Setup

Once you have the webhook URL:

1. **Test it** (optional):
   ```powershell
   $webhookUrl = "https://hooks.slack.com/services/YOUR/URL"
   $body = @{
       text = "Test message from DirectoryBolt!"
   } | ConvertTo-Json
   
   Invoke-RestMethod -Uri $webhookUrl -Method Post -Body $body -ContentType "application/json"
   ```

2. **Add to .env file:**
   ```bash
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/ACTUAL/URL
   ```

3. **Restart DLQ monitor:**
   ```powershell
   cd backend\infra
   docker-compose restart dlq-monitor
   ```

---

## Summary

**Question:** How do I create an app in my workspace?
**Answer:** Go to https://api.slack.com/apps → Create New App → Select your workspace

**Question:** Where do I find Incoming Webhooks?
**Answer:** In the app settings → Left sidebar → "Incoming Webhooks" under Features

**Question:** How do I add it to my workspace?
**Answer:** Click "Add New Webhook to Workspace" → Select channel → Allow → Copy URL

