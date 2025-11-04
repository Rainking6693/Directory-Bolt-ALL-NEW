# Deploy Prefect Flow Script (runs inside Docker)
# This deploys the process_job flow to Prefect so jobs can actually run

$ErrorActionPreference = 'Stop'

Write-Host "Building Prefect deployment..." -ForegroundColor Yellow

# Run inside the subscriber container (which has Prefect installed)
# Use 'prefect' command directly (not python -m)
docker exec -w /app/orchestration infra-subscriber-1 prefect deployment build flows.py:process_job -n production -q default

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build deployment. Exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

Write-Host "
Checking for deployment YAML..." -ForegroundColor Yellow
docker exec infra-subscriber-1 ls -la /app/orchestration/*-deployment.yaml 2>&1

Write-Host "
Applying deployment..." -ForegroundColor Yellow
docker exec -w /app/orchestration infra-subscriber-1 prefect deployment apply process_job-deployment.yaml

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to apply deployment. Exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

Write-Host "
✅ Deployment successful! Verifying..." -ForegroundColor Green
docker exec infra-prefect-server-1 prefect deployment ls

Write-Host "
✅ Prefect flow deployed! Check http://localhost:4200" -ForegroundColor Green
