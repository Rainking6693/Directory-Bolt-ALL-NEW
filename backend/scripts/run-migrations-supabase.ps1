# Run Database Migrations via Supabase Client
# This script executes migrations 004 and 005 using Supabase client in PowerShell

param(
    [string]$SupabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL,
    [string]$SupabaseKey = $env:SUPABASE_SERVICE_KEY
)

Write-Host "🚀 Running Database Migrations for Audit Fixes" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

if (-not $SupabaseUrl) {
    Write-Host "❌ Error: NEXT_PUBLIC_SUPABASE_URL or SupabaseUrl parameter required" -ForegroundColor Red
    exit 1
}

if (-not $SupabaseKey) {
    Write-Host "❌ Error: SUPABASE_SERVICE_KEY or SupabaseKey parameter required" -ForegroundColor Red
    exit 1
}

# Get script directory and find migrations
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$migration004 = Join-Path $projectRoot "db\migrations\004_rate_limit_requests.sql"
$migration005 = Join-Path $projectRoot "db\migrations\005_find_stale_jobs_function.sql"

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

# Execute using Supabase REST API
function Execute-SupabaseSQL {
    param(
        [string]$Sql,
        [string]$Description
    )
    
    Write-Host "🔄 Executing $Description..." -ForegroundColor Yellow
    
    # Supabase REST API endpoint for executing SQL
    $restUrl = "$SupabaseUrl/rest/v1/rpc/exec_sql"
    
    $body = @{
        query = $Sql
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri $restUrl -Method Post -Headers @{
            "apikey" = $SupabaseKey
            "Authorization" = "Bearer $SupabaseKey"
            "Content-Type" = "application/json"
        } -Body $body -ErrorAction Stop
        
        Write-Host "✅ $Description executed successfully!" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "⚠️  API call failed, using alternative method..." -ForegroundColor Yellow
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
        
        # Alternative: Use psql if available
        Write-Host "   Attempting to use psql..." -ForegroundColor Yellow
        
        # Extract connection info from URL
        if ($SupabaseUrl -match 'https://([^.]+)\.supabase\.co') {
            $projectRef = $Matches[1]
            Write-Host "   Project: $projectRef" -ForegroundColor Gray
            Write-Host "   Please run this migration manually in Supabase SQL Editor:" -ForegroundColor Yellow
            Write-Host "   1. Go to: https://supabase.com/dashboard/project/$projectRef/sql/new" -ForegroundColor Cyan
            Write-Host "   2. Copy and paste the SQL from: $migration004" -ForegroundColor Cyan
            Write-Host "   3. Click Run" -ForegroundColor Cyan
        }
        return $false
    }
}

# Read and execute migration 004
$sql004 = Get-Content $migration004 -Raw
Execute-SupabaseSQL -Sql $sql004 -Description "Migration 004 (rate_limit_requests)"

Write-Host ""

# Read and execute migration 005
$sql005 = Get-Content $migration005 -Raw
Execute-SupabaseSQL -Sql $sql005 -Description "Migration 005 (find_stale_jobs_function)"

Write-Host ""
Write-Host "✅ Migration script completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Verify migrations in Supabase Dashboard"
Write-Host "   2. Set SLACK_WEBHOOK_URL in backend\.env"
Write-Host "   3. Build and start monitoring services"
Write-Host ""
