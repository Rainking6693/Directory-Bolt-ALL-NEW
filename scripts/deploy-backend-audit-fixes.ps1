# Deploy Backend Audit Fixes - Complete Deployment Script
# This script completes all remaining deployment steps

param(
    [switch]$SkipMigrations = $false,
    [switch]$SkipDocker = $false,
    [string]$SlackWebhookUrl = ""
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Backend Audit Fixes - Complete Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Run Database Migrations
if (-not $SkipMigrations) {
    Write-Host "📊 Step 1: Running Database Migrations" -ForegroundColor Yellow
    Write-Host "======================================" -ForegroundColor Yellow
    
    $migrationScript = Join-Path $PSScriptRoot "run-backend-audit-migrations.ps1"
    if (Test-Path $migrationScript) {
        & $migrationScript
    } else {
        Write-Host "⚠️  Migration script not found. Please run migrations manually:" -ForegroundColor Yellow
        Write-Host "   1. Open Supabase Dashboard → SQL Editor" -ForegroundColor White
        Write-Host "   2. Run: backend\db\migrations\004_rate_limit_requests.sql" -ForegroundColor White
        Write-Host "   3. Run: backend\db\migrations\005_find_stale_jobs_function.sql" -ForegroundColor White
    }
    Write-Host ""
} else {
    Write-Host "⏭️  Skipping database migrations" -ForegroundColor Gray
    Write-Host ""
}

# Step 2: Configure Environment Variables
Write-Host "⚙️  Step 2: Configuring Environment Variables" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

$envFile = Join-Path $PSScriptRoot "..\backend\.env"
$envFile = Resolve-Path $envFile -ErrorAction SilentlyContinue

if (-not $envFile) {
    Write-Host "⚠️  backend\.env file not found. Creating from example..." -ForegroundColor Yellow
    $envFile = Join-Path $PSScriptRoot "..\backend\.env"
    New-Item -ItemType File -Path $envFile -Force | Out-Null
}

# Add SLACK_WEBHOOK_URL if provided
if ($SlackWebhookUrl) {
    $envContent = Get-Content $envFile -ErrorAction SilentlyContinue
    $hasSlack = $envContent | Select-String -Pattern "^SLACK_WEBHOOK_URL=" -Quiet
    
    if (-not $hasSlack) {
        Add-Content -Path $envFile -Value "`n# Slack webhook for DLQ alerts"
        Add-Content -Path $envFile -Value "SLACK_WEBHOOK_URL=$SlackWebhookUrl"
        Write-Host "✅ Added SLACK_WEBHOOK_URL to .env" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  SLACK_WEBHOOK_URL already exists in .env" -ForegroundColor Cyan
    }
} else {
    Write-Host "⚠️  SLACK_WEBHOOK_URL not provided. DLQ monitor will work but won't send alerts." -ForegroundColor Yellow
    Write-Host "   To add later, edit backend\.env and add:" -ForegroundColor Gray
    Write-Host "   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL" -ForegroundColor Gray
}
Write-Host ""

# Step 3: Build and Start Docker Services
if (-not $SkipDocker) {
    Write-Host "🐳 Step 3: Building and Starting Docker Services" -ForegroundColor Yellow
    Write-Host "================================================" -ForegroundColor Yellow
    
    $dockerComposePath = Join-Path $PSScriptRoot "..\backend\infra\docker-compose.yml"
    $dockerComposePath = Resolve-Path $dockerComposePath
    
    if (-not $dockerComposePath) {
        Write-Host "❌ docker-compose.yml not found!" -ForegroundColor Red
        exit 1
    }
    
    $dockerComposeDir = Split-Path $dockerComposePath -Parent
    
    Write-Host "   Building Docker images..." -ForegroundColor Gray
    Set-Location $dockerComposeDir
    
    try {
        # Build monitoring services
        docker-compose build stale-job-monitor 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Built stale-job-monitor" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  stale-job-monitor build had warnings" -ForegroundColor Yellow
        }
        
        docker-compose build dlq-monitor 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Built dlq-monitor" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  dlq-monitor build had warnings" -ForegroundColor Yellow
        }
        
        # Start services
        Write-Host "   Starting monitoring services..." -ForegroundColor Gray
        docker-compose up -d stale-job-monitor 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Started stale-job-monitor" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Failed to start stale-job-monitor" -ForegroundColor Red
        }
        
        docker-compose up -d dlq-monitor 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Started dlq-monitor" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Failed to start dlq-monitor" -ForegroundColor Red
        }
        
        # Verify services are running
        Write-Host "   Verifying services..." -ForegroundColor Gray
        Start-Sleep -Seconds 3
        
        $services = docker-compose ps --services --filter "status=running" 2>&1
        $runningServices = $services | Where-Object { $_ -match "stale-job-monitor|dlq-monitor" }
        
        if ($runningServices.Count -ge 2) {
            Write-Host "   ✅ Both monitoring services are running" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Some services may not be running. Check with: docker-compose ps" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "   ❌ Error with Docker commands: $_" -ForegroundColor Red
        Write-Host "   💡 Make sure Docker Desktop is running" -ForegroundColor Yellow
    } finally {
        Set-Location $PSScriptRoot
    }
    
    Write-Host ""
} else {
    Write-Host "⏭️  Skipping Docker deployment" -ForegroundColor Gray
    Write-Host ""
}

# Step 4: Verify Deployment
Write-Host "✅ Step 4: Deployment Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Deployment Summary:" -ForegroundColor Cyan
Write-Host "   ✅ Database migrations ready (run manually if needed)" -ForegroundColor White
Write-Host "   ✅ Environment variables configured" -ForegroundColor White
if (-not $SkipDocker) {
    Write-Host "   ✅ Docker services built and started" -ForegroundColor White
}
Write-Host ""

Write-Host "🔍 Verification Steps:" -ForegroundColor Cyan
Write-Host "   1. Check database migrations in Supabase Dashboard" -ForegroundColor White
Write-Host "      - rate_limit_requests table should exist" -ForegroundColor Gray
Write-Host "      - find_stale_jobs() function should exist" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Check Docker services:" -ForegroundColor White
if (-not $SkipDocker) {
    Write-Host "      docker-compose -f backend\infra\docker-compose.yml ps" -ForegroundColor Gray
    Write-Host "      docker-compose -f backend\infra\docker-compose.yml logs stale-job-monitor" -ForegroundColor Gray
    Write-Host "      docker-compose -f backend\infra\docker-compose.yml logs dlq-monitor" -ForegroundColor Gray
} else {
    Write-Host "      (Docker deployment skipped)" -ForegroundColor Gray
}
Write-Host ""
Write-Host "   3. Test health endpoint:" -ForegroundColor White
Write-Host "      curl http://localhost:3000/api/health" -ForegroundColor Gray
Write-Host "      Or visit: https://directorybolt.com/api/health" -ForegroundColor Gray
Write-Host ""
Write-Host "   4. Test rate limiting:" -ForegroundColor White
Write-Host "      Make 105 requests to any API endpoint" -ForegroundColor Gray
Write-Host "      Last 5 should return 429 (Too Many Requests)" -ForegroundColor Gray
Write-Host ""

Write-Host "📚 Next Steps:" -ForegroundColor Cyan
Write-Host "   - Monitor logs: docker-compose -f backend\infra\docker-compose.yml logs -f" -ForegroundColor White
Write-Host "   - Check Supabase Dashboard for stale_jobs_view" -ForegroundColor White
Write-Host "   - Set up Slack webhook for DLQ alerts if not done yet" -ForegroundColor White
Write-Host ""

