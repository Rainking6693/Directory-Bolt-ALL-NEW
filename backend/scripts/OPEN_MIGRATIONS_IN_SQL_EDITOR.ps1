# Open migrations in Supabase SQL Editor for manual execution

Write-Host "🚀 Backend Audit Fixes - Database Migrations" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$sqlEditorUrl = "https://supabase.com/dashboard/project/kolgqfjgncdwddziqloz/sql/new"

Write-Host "Opening SQL Editor in browser..." -ForegroundColor Green
Start-Process $sqlEditorUrl

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Migration 004: Rate Limit Requests Table" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Get-Content backend\db\migrations\004_rate_limit_requests.sql
Write-Host ""
Write-Host "Press Enter to show next migration..." -ForegroundColor Yellow
$null = Read-Host

Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Migration 005: Find Stale Jobs Function" -ForegroundColor Green  
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Get-Content backend\db\migrations\005_find_stale_jobs_function.sql

Write-Host ""
Write-Host "✅ Both migrations displayed above" -ForegroundColor Green
Write-Host "📝 Copy each SQL block and run in the SQL Editor that just opened" -ForegroundColor Yellow
Write-Host ""
