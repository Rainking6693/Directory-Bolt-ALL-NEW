# How to Enable Incoming Webhooks in Slack

## Step-by-Step Instructions

### Step 1: Create or Select a Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"** button (top right)
   - OR select an existing app if you already have one

3. Choose how to create:
   - **"From scratch"** - Start fresh
   - **"From an app manifest"** - If you have a config file
   - **"From an existing app"** - Copy settings from another app

4. Enter app details:
   - **App Name:** e.g., "DirectoryBolt Alerts" or "DLQ Monitor"
   - **Workspace:** Select your workspace
   - Click **"Create App"**

### Step 2: Enable Incoming Webhooks

1. In your app settings, click **"Incoming Webhooks"** in the left sidebar
   - (Under "Features" section)

2. Toggle **"Activate Incoming Webhooks"** to **ON** (green)

### Step 3: Add Webhook to Workspace

1. Scroll down to **"Webhook URLs for Your Workspace"** section

2. Click **"Add New Webhook to Workspace"** button

3. Select the channel where you want alerts sent:
   - Choose a channel (e.g., #alerts, #monitoring, #devops)
   - Or create a new channel first
   - Click **"Allow"**

4. **Copy the Webhook URL** - it looks like:
   ```
   https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
   ```

### Step 4: Add Webhook URL to Your Project

Add this to your `backend/.env` file:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL/HERE
```

Replace `YOUR/WEBHOOK/URL/HERE` with the actual webhook URL you copied.

### Step 5: Test the Webhook (Optional)

You can test it with a simple curl command:

```powershell
$webhookUrl = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
$body = @{
    text = "Test message from DirectoryBolt DLQ Monitor"
} | ConvertTo-Json

Invoke-RestMethod -Uri $webhookUrl -Method Post -Body $body -ContentType "application/json"
```

If it works, you'll see a message appear in your selected Slack channel!

---

## Quick Reference

- **Slack Apps Dashboard:** https://api.slack.com/apps
- **Webhook URL Format:** `https://hooks.slack.com/services/TEAM_ID/BOT_ID/WEBHOOK_TOKEN`
- **Documentation:** https://api.slack.com/messaging/webhooks

---

## Troubleshooting

### Webhook not working?
- Verify the URL is correct (no extra spaces)
- Check that Incoming Webhooks is enabled
- Ensure the app is installed in your workspace
- Check the channel still exists and the app has permission

### Need to change the channel?
- Go back to Incoming Webhooks settings
- Click "Remove" next to existing webhook
- Add new webhook and select different channel
- Update the URL in your `.env` file

---

## Security Notes

⚠️ **Important:** Keep your webhook URL secret!
- Don't commit it to git
- Add `.env` to `.gitignore` if not already there
- Use environment variables in production
- Rotate webhooks if accidentally exposed

