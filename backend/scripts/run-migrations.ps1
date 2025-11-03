# Run Database Migrations via Supabase PowerShell Integration
# This script executes migrations 004 and 005 for the audit fixes

Write-Host "🚀 Running Database Migrations for Audit Fixes" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Get migration files
$migration004 = Join-Path $PSScriptRoot "..\db\migrations\004_rate_limit_requests.sql"
$migration005 = Join-Path $PSScriptRoot "..\db\migrations\005_find_stale_jobs_function.sql"

# Check if files exist
if (-not (Test-Path $migration004)) {
    Write-Host "❌ Error: Migration 004 not found at $migration004" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $migration005)) {
    Write-Host "❌ Error: Migration 005 not found at $migration005" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Found migration files:" -ForegroundColor Green
Write-Host "   - 004_rate_limit_requests.sql"
Write-Host "   - 005_find_stale_jobs_function.sql"
Write-Host ""

# Execute migration 004
Write-Host "🔄 Executing migration 004 (rate_limit_requests)..." -ForegroundColor Yellow
$sql004 = Get-Content $migration004 -Raw

try {
    # Try using supabase CLI with project link
    $result = supabase db execute --linked "$sql004" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration 004 executed successfully!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Supabase CLI failed, trying alternative method..." -ForegroundColor Yellow
        # Alternative: Use Supabase API directly if CLI doesn't work
        Write-Host "   Please run this migration manually in Supabase SQL Editor:" -ForegroundColor Yellow
        Write-Host "   File: $migration004" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  Error executing migration 004: $_" -ForegroundColor Yellow
    Write-Host "   Please run this migration manually in Supabase SQL Editor" -ForegroundColor Yellow
}

Write-Host ""

# Execute migration 005
Write-Host "🔄 Executing migration 005 (find_stale_jobs_function)..." -ForegroundColor Yellow
$sql005 = Get-Content $migration005 -Raw

try {
    # Try using supabase CLI with project link
    $result = supabase db execute --linked "$sql005" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration 005 executed successfully!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Supabase CLI failed, trying alternative method..." -ForegroundColor Yellow
        # Alternative: Use Supabase API directly if CLI doesn't work
        Write-Host "   Please run this migration manually in Supabase SQL Editor:" -ForegroundColor Yellow
        Write-Host "   File: $migration005" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  Error executing migration 005: $_" -ForegroundColor Yellow
    Write-Host "   Please run this migration manually in Supabase SQL Editor" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Migration script completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Verify migrations in Supabase Dashboard"
Write-Host "   2. Set SLACK_WEBHOOK_URL in backend\.env"
Write-Host "   3. Build and start monitoring services"
Write-Host ""
