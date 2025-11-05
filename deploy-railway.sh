#!/bin/bash
# Railway Deployment Script
# Run this from the Directory-Bolt-ALL-NEW root directory

set -e  # Exit on any error

echo "🚂 Starting Railway Deployment..."

# Set Railway token
export RAILWAY_TOKEN="50c24454-b4f8-4fce-8e2c-87e779b3425f"

echo "✅ Railway token set"

# Initialize project (if not already done)
echo "📦 Initializing Railway project..."
railway init --name directory-bolt-backend || echo "Project already initialized"

# Set environment variables
echo "⚙️ Setting environment variables..."

railway variables set SUPABASE_URL="https://kolgqfjgncdwddziqloz.supabase.co"
railway variables set NEXT_PUBLIC_SUPABASE_URL="https://kolgqfjgncdwddziqloz.supabase.co"
railway variables set SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbGdxZmpnbmNkd2RkemlxbG96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMTU3NTEwNywiZXhwIjoyMDM3MTUxMTA3fQ.mq7wtkh2q5HdpHlAJRxmfZYrUWqkOoVqxaO2EqX1_LE"
railway variables set AWS_DEFAULT_REGION="us-east-2"
railway variables set SQS_QUEUE_URL="https://sqs.us-east-2.amazonaws.com/231688741122/DirectoryBolt"
railway variables set SQS_DLQ_URL="https://sqs.us-east-2.amazonaws.com/231688741122/DirectoryBolt-dlq"
railway variables set PREFECT_API_URL="http://localhost:4200/api"
railway variables set CREWAI_URL="http://localhost:8080"

echo ""
echo "⚠️  IMPORTANT: You need to add these 3 variables manually:"
echo ""
echo "railway variables set AWS_DEFAULT_ACCESS_KEY_ID=\"YOUR_AWS_KEY\""
echo "railway variables set AWS_DEFAULT_SECRET_ACCESS_KEY=\"YOUR_AWS_SECRET\""
echo "railway variables set ANTHROPIC_API_KEY=\"YOUR_ANTHROPIC_KEY\""
echo ""
echo "Press ENTER when you've added them, or Ctrl+C to exit and add them manually..."
read

# Deploy
echo "🚀 Deploying to Railway..."
railway up

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "📊 View logs with: railway logs"
echo "🌐 Open dashboard: railway open"
echo "📈 Check status: railway status"
