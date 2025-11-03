# Getting Started with Slack

## First: Do You Need Slack?

**Slack is OPTIONAL** for the DLQ monitor. If you don't want Slack alerts, you can:
- Skip this step entirely
- The DLQ monitor will still work, just won't send alerts
- You can check DLQ manually via AWS console or monitor logs

---

## If You Want Slack Alerts: Setup Steps

### Option 1: Create a New Slack Account (Recommended)

1. **Go to Slack:** https://slack.com/get-started
   - Click **"Create a workspace"** (or "Sign up")

2. **Enter your email:**
   - Use your work email or personal email
   - Click **"Continue"**

3. **Confirm your email:**
   - Check your inbox for confirmation code
   - Enter the code

4. **Set up your workspace:**
   - **Workspace name:** e.g., "My Projects" or "DirectoryBolt"
   - **Company name:** (optional)
   - Click **"Next"**

5. **Create your first channel:**
   - Default is #general (you can use this)
   - Or create #alerts or #monitoring
   - Click **"See your channel in Slack"**

6. **Download Slack** (optional):
   - Desktop app: https://slack.com/downloads
   - Or use web: https://your-workspace.slack.com
   - Mobile app: Available in app stores

### Option 2: Join an Existing Workspace

If someone invited you:
1. Check your email for Slack invitation
2. Click the invitation link
3. Sign in or create account
4. You'll be added to their workspace

---

## Quick Start Checklist

- [ ] Go to https://slack.com/get-started
- [ ] Create account with your email
- [ ] Create/join a workspace
- [ ] Create a channel for alerts (e.g., #alerts)
- [ ] Then follow the webhook setup guide

---

## Alternative: Skip Slack Alerts

If you don't want to set up Slack, you can:

1. **Monitor via AWS Console:**
   - Go to AWS SQS console
   - Check DLQ manually
   - View messages and errors

2. **Monitor via Logs:**
   - The DLQ monitor logs to console/logs
   - Check Docker logs: `docker-compose logs dlq-monitor`

3. **Use Email Alerts** (if you set up AWS SNS):
   - Configure SNS topic
   - Subscribe email to DLQ alerts
   - More complex but no Slack needed

---

## Next Steps After Slack Setup

Once you have Slack:
1. Create a channel (e.g., #alerts)
2. Follow: `backend/scripts/SLACK_WEBHOOK_SETUP.md`
3. Enable Incoming Webhooks
4. Add webhook URL to `backend/.env`

---

## Summary

**Question:** Do I need Slack?
**Answer:** No - it's optional. DLQ monitor works without it.

**Question:** Should I use Slack?
**Answer:** Only if you want instant alerts. Otherwise, check logs manually.

**Question:** Is it free?
**Answer:** Yes - Slack free tier works fine for alerts.

