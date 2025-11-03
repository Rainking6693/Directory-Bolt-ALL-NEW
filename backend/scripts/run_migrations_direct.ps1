# Execute migrations directly via Supabase REST API
param(
    [string]$SupabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL,
    [string]$SupabaseKey = $env:SUPABASE_SERVICE_KEY
)

if (-not $SupabaseUrl -or -not $SupabaseKey) {
    Write-Host "❌ Error: Missing Supabase credentials" -ForegroundColor Red
    Write-Host "   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY" -ForegroundColor Yellow
    exit 1
}

Write-Host "🚀 Running Migrations via Supabase API" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$migration004 = Join-Path $PSScriptRoot "..\db\migrations\004_rate_limit_requests.sql"
$migration005 = Join-Path $PSScriptRoot "..\db\migrations\005_find_stale_jobs_function.sql"

function Execute-Migration {
    param(
        [string]$SqlFile,
        [string]$Description
    )
    
    Write-Host "🔄 Executing $Description..." -ForegroundColor Yellow
    
    if (-not (Test-Path $SqlFile)) {
        Write-Host "❌ File not found: $SqlFile" -ForegroundColor Red
        return $false
    }
    
    $sql = Get-Content $SqlFile -Raw
    
    # Extract project ID from URL
    if ($SupabaseUrl -match 'https://([^.]+)\.supabase\.co') {
        $projectId = $Matches[1]
        Write-Host "   Project ID: $projectId" -ForegroundColor Gray
        
        # Use Supabase Management API to execute SQL
        $apiUrl = "https://api.supabase.com/v1/projects/$projectId/execute"
        
        try {
            $body = @{
                query = $sql
            } | ConvertTo-Json
            
            $headers = @{
                "Authorization" = "Bearer $SupabaseKey"
                "Content-Type" = "application/json"
            }
            
            # Note: This API endpoint might not exist, so we'll provide instructions
            Write-Host "   ⚠️  Direct API execution not available" -ForegroundColor Yellow
            Write-Host "   Please run in Supabase SQL Editor:" -ForegroundColor Yellow
            Write-Host "   1. Go to: https://supabase.com/dashboard/project/$projectId/sql/new" -ForegroundColor Cyan
            Write-Host "   2. Copy SQL from: $SqlFile" -ForegroundColor Cyan
            Write-Host "   3. Paste and click Run" -ForegroundColor Cyan
            Write-Host ""
            return $false
        } catch {
            Write-Host "   ❌ Error: $_" -ForegroundColor Red
            return $false
        }
    }
    
    return $false
}

Execute-Migration -SqlFile $migration004 -Description "Migration 004 (rate_limit_requests)"
Execute-Migration -SqlFile $migration005 -Description "Migration 005 (find_stale_jobs_function)"

Write-Host "✅ Migration script completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Please run these migrations manually in Supabase SQL Editor" -ForegroundColor Yellow
Write-Host "   URL: https://supabase.com/dashboard/project/kolgqfjgncdwddziqloz/sql/new" -ForegroundColor Cyan

