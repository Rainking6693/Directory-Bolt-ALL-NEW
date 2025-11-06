# Complete Prefect Setup - Deploy Flows to Self-Hosted Server
# Run this after Prefect Server finishes deploying on Render

Write-Host "=== Complete Prefect Setup ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Wait for Prefect Server to be ready
Write-Host "Step 1: Checking if Prefect Server is ready..." -ForegroundColor Yellow
$maxAttempts = 20
$attempt = 0
$serverReady = $false

while ($attempt -lt $maxAttempts -and -not $serverReady) {
    try {
        $response = Invoke-WebRequest -Uri "https://prefect-server-64g1.onrender.com/api/health" -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Prefect Server is ready!" -ForegroundColor Green
            $serverReady = $true
        }
    } catch {
        $attempt++
        Write-Host "   Attempt $attempt/$maxAttempts - Server not ready yet, waiting 15 seconds..." -ForegroundColor Gray
        Start-Sleep -Seconds 15
    }
}

if (-not $serverReady) {
    Write-Host "❌ Prefect Server failed to become ready after $($maxAttempts * 15) seconds" -ForegroundColor Red
    Write-Host "   Check deployment status at: https://dashboard.render.com/web/srv-d46bvcqli9vc73dehpig" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 2: Configure Prefect CLI to use self-hosted server
Write-Host "Step 2: Configuring Prefect CLI..." -ForegroundColor Yellow
$env:PREFECT_API_URL = "https://prefect-server-64g1.onrender.com/api"

try {
    prefect config set PREFECT_API_URL="https://prefect-server-64g1.onrender.com/api"
    Write-Host "✅ Prefect CLI configured to use self-hosted server" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to configure Prefect CLI" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Create work pool
Write-Host "Step 3: Creating 'default' work pool..." -ForegroundColor Yellow

try {
    prefect work-pool create default --type process 2>&1 | Out-Null
    Write-Host "✅ Work pool 'default' created successfully!" -ForegroundColor Green
} catch {
    # Work pool might already exist, which is fine
    Write-Host "   Work pool may already exist (this is OK)" -ForegroundColor Gray
}

Write-Host ""

# Step 4: Deploy flows
Write-Host "Step 4: Deploying Prefect flows..." -ForegroundColor Yellow

try {
    cd backend
    prefect deploy orchestration/flows.py:process_job --name production --pool default
    cd ..
    Write-Host "✅ Flows deployed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to deploy flows" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Monitor deployments at Render dashboard" -ForegroundColor Gray
Write-Host "   - Prefect Server: https://dashboard.render.com/web/srv-d46bvcqli9vc73dehpig" -ForegroundColor Gray
Write-Host "   - Subscriber: https://dashboard.render.com/worker/srv-d45u7e7diees738h2ahg" -ForegroundColor Gray
Write-Host "   - Worker: https://dashboard.render.com/worker/srv-d45u7eqdbo4c7385qmg0" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Access Prefect UI at: https://prefect-server-64g1.onrender.com" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test the system by sending a job through your app" -ForegroundColor Gray
Write-Host ""
