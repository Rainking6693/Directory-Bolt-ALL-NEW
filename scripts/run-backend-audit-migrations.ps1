# Run Backend Audit Fixes Migrations
# Executes database migrations 004 and 005 for rate limiting and stale job detection

param(
    [string]$SupabaseProjectRef = "",
    [string]$DatabasePassword = ""
)

Write-Host "🚀 Running Backend Audit Fixes Migrations" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if supabase CLI is available
$supabaseAvailable = $false
try {
    $null = Get-Command supabase -ErrorAction Stop
    $supabaseAvailable = $true
} catch {
    Write-Host "⚠️  Supabase CLI not found. Will use psql directly." -ForegroundColor Yellow
}

# Migration files
$migrations = @(
    @{
        File = "backend\db\migrations\004_rate_limit_requests.sql"
        Description = "Rate Limit Requests Table"
    },
    @{
        File = "backend\db\migrations\005_find_stale_jobs_function.sql"
        Description = "Find Stale Jobs Function"
    }
)

foreach ($migration in $migrations) {
    $filePath = Join-Path $PSScriptRoot "..\$($migration.File)"
    $filePath = Resolve-Path $filePath -ErrorAction SilentlyContinue
    
    if (-not $filePath -or -not (Test-Path $filePath)) {
        Write-Host "❌ Migration file not found: $($migration.File)" -ForegroundColor Red
        continue
    }
    
    Write-Host "📄 Running migration: $($migration.Description)" -ForegroundColor Yellow
    Write-Host "   File: $($migration.File)" -ForegroundColor Gray
    
    $sqlContent = Get-Content $filePath -Raw
    
    if ($supabaseAvailable) {
        # Use Supabase CLI
        Write-Host "   Using Supabase CLI..." -ForegroundColor Gray
        
        try {
            # Save SQL to temp file
            $tempFile = [System.IO.Path]::GetTempFileName()
            Set-Content -Path $tempFile -Value $sqlContent -Encoding UTF8
            
            # Run via supabase db push or execute
            if ($SupabaseProjectRef) {
                supabase db push --db-url "postgresql://postgres:$DatabasePassword@db.$SupabaseProjectRef.supabase.co:5432/postgres" --file $tempFile
            } else {
                supabase db push --file $tempFile
            }
            
            Remove-Item $tempFile -ErrorAction SilentlyContinue
            Write-Host "   ✅ Migration completed" -ForegroundColor Green
        } catch {
            Write-Host "   ❌ Migration failed: $_" -ForegroundColor Red
            Write-Host "   💡 Try running manually in Supabase SQL Editor" -ForegroundColor Yellow
        }
    } else {
        # Instructions for manual execution
        Write-Host "   ⚠️  Supabase CLI not available. Please run manually:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   1. Open Supabase Dashboard → SQL Editor" -ForegroundColor White
        Write-Host "   2. Copy the contents of: $($migration.File)" -ForegroundColor White
        Write-Host "   3. Paste into SQL Editor and click 'Run'" -ForegroundColor White
        Write-Host ""
        
        # Show SQL content preview
        $preview = ($sqlContent -split "`n")[0..10] -join "`n"
        Write-Host "   SQL Preview (first 10 lines):" -ForegroundColor Gray
        Write-Host "   $preview" -ForegroundColor DarkGray
        Write-Host ""
    }
}

Write-Host ""
Write-Host "✅ Migration script completed" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Verify migrations in Supabase Dashboard" -ForegroundColor White
Write-Host "   2. Check that rate_limit_requests table exists" -ForegroundColor White
Write-Host "   3. Check that find_stale_jobs() function exists" -ForegroundColor White
Write-Host ""

