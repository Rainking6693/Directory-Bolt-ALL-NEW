# Railway Deployment Script (PowerShell)
# Run this from the Directory-Bolt-ALL-NEW root directory

$ErrorActionPreference = "Stop"

Write-Host "🚂 Starting Railway Deployment..." -ForegroundColor Cyan

# Set Railway token
$env:RAILWAY_TOKEN = "50c24454-b4f8-4fce-8e2c-87e779b3425f"

Write-Host "✅ Railway token set" -ForegroundColor Green

# Initialize project (if not already done)
Write-Host "📦 Initializing Railway project..." -ForegroundColor Yellow
try {
    railway init --name directory-bolt-backend
} catch {
    Write-Host "Project already initialized or error occurred" -ForegroundColor Yellow
}

# Set environment variables
Write-Host "⚙️ Setting environment variables..." -ForegroundColor Yellow

railway variables set SUPABASE_URL="https://kolgqfjgncdwddziqloz.supabase.co"
railway variables set NEXT_PUBLIC_SUPABASE_URL="https://kolgqfjgncdwddziqloz.supabase.co"
railway variables set SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvbGdxZmpnbmNkd2RkemlxbG96Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMTU3NTEwNywiZXhwIjoyMDM3MTUxMTA3fQ.mq7wtkh2q5HdpHlAJRxmfZYrUWqkOoVqxaO2EqX1_LE"
railway variables set AWS_DEFAULT_REGION="us-east-2"
railway variables set SQS_QUEUE_URL="https://sqs.us-east-2.amazonaws.com/231688741122/DirectoryBolt"
railway variables set SQS_DLQ_URL="https://sqs.us-east-2.amazonaws.com/231688741122/DirectoryBolt-dlq"
railway variables set PREFECT_API_URL="http://localhost:4200/api"
railway variables set CREWAI_URL="http://localhost:8080"

Write-Host ""
Write-Host "⚠️  IMPORTANT: You need to add these 3 variables manually:" -ForegroundColor Red
Write-Host ""
Write-Host 'railway variables set AWS_DEFAULT_ACCESS_KEY_ID="YOUR_AWS_KEY"' -ForegroundColor Yellow
Write-Host 'railway variables set AWS_DEFAULT_SECRET_ACCESS_KEY="YOUR_AWS_SECRET"' -ForegroundColor Yellow
Write-Host 'railway variables set ANTHROPIC_API_KEY="YOUR_ANTHROPIC_KEY"' -ForegroundColor Yellow
Write-Host ""
Write-Host "Press ENTER when you've added them..." -ForegroundColor Cyan
Read-Host

# Deploy
Write-Host "🚀 Deploying to Railway..." -ForegroundColor Cyan
railway up

Write-Host ""
Write-Host "✅ Deployment initiated!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 View logs with: railway logs" -ForegroundColor Yellow
Write-Host "🌐 Open dashboard: railway open" -ForegroundColor Yellow
Write-Host "📈 Check status: railway status" -ForegroundColor Yellow
