# DirectoryBolt - Complete Motia & Backend Endpoint Test Suite
# Tests all staff dashboard endpoints, worker status, and data flow

$baseUrl = "https://directorybolt.com"
$motiaUrl = "https://cq60ji-dhzi0x.entone-u7811w1dpp.motia.cloud"

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  DIRECTORYBOLT ENDPOINT TEST SUITE" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Function to test an endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [bool]$ExpectAuth = $false
    )
    
    Write-Host "Testing: $Name" -ForegroundColor Cyan
    Write-Host "  URL: $Url"
    Write-Host "  Method: $Method"
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            UseBasicParsing = $true
            TimeoutSec = 15
            ErrorAction = "Stop"
        }
        
        $resp = Invoke-WebRequest @params
        Write-Host "  Status: $($resp.StatusCode) OK" -ForegroundColor Green
        
        $content = $resp.Content
        if ($content.Length -gt 500) { 
            $content = $content.Substring(0, 500) + "..." 
        }
        
        # Try to parse as JSON and display key info
        try {
            $json = $content | ConvertFrom-Json
            if ($json.status) { Write-Host "  -> Status: $($json.status)" -ForegroundColor Gray }
            if ($json.success -ne $null) { Write-Host "  -> Success: $($json.success)" -ForegroundColor Gray }
            if ($json.data -and $json.data.stats) {
                Write-Host "  -> Jobs: Pending=$($json.data.stats.pending), Processing=$($json.data.stats.processing), Completed=$($json.data.stats.completed), Failed=$($json.data.stats.failed)" -ForegroundColor Gray
            }
            if ($json.metrics) {
                Write-Host "  -> Metrics: Pending=$($json.metrics.jobs_pending), InProgress=$($json.metrics.jobs_in_progress)" -ForegroundColor Gray
            }
            if ($json.services -and $json.services.workers) {
                Write-Host "  -> Workers: Active=$($json.services.workers.active_count), Stale=$($json.services.workers.stale_count)" -ForegroundColor Gray
            }
        } catch {}
        
        return @{ Success = $true; Status = $resp.StatusCode; Content = $content }
    }
    catch {
        $statusCode = "Error"
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        
        if ($ExpectAuth -and $statusCode -eq 401) {
            Write-Host "  Status: 401 (Auth Required - Expected)" -ForegroundColor Yellow
            return @{ Success = $true; Status = 401; Content = "Auth required" }
        }
        
        Write-Host "  Status: $statusCode FAILED" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        return @{ Success = $false; Status = $statusCode; Error = $_.Exception.Message }
    }
    finally {
        Write-Host ""
    }
}

# ========================================
# SECTION 1: Core Health & Public Endpoints
# ========================================
Write-Host "SECTION 1: Core Health & Public Endpoints" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta

$results = @()
$results += Test-Endpoint -Name "Health Check" -Url "$baseUrl/api/health"
$results += Test-Endpoint -Name "Motia Cloud Health" -Url "$motiaUrl/health"

# ========================================
# SECTION 2: Staff Dashboard Endpoints
# ========================================
Write-Host "SECTION 2: Staff Dashboard Endpoints (Auth Required)" -ForegroundColor Magenta
Write-Host "=====================================================" -ForegroundColor Magenta

$staffEndpoints = @(
    @{Name="Staff Auth Check"; Url="$baseUrl/api/staff/auth-check"; ExpectAuth=$true},
    @{Name="Staff Queue"; Url="$baseUrl/api/staff/queue"; ExpectAuth=$false},
    @{Name="Staff Analytics"; Url="$baseUrl/api/staff/analytics"; ExpectAuth=$true},
    @{Name="Staff Jobs Progress"; Url="$baseUrl/api/staff/jobs/progress"; ExpectAuth=$true},
    @{Name="Staff AutoBolt Queue"; Url="$baseUrl/api/staff/autobolt-queue"; ExpectAuth=$true},
    @{Name="Staff Submission Logs"; Url="$baseUrl/api/staff/submission-logs"; ExpectAuth=$true},
    @{Name="Staff 2FA Queue"; Url="$baseUrl/api/staff/2fa-queue"; ExpectAuth=$true},
    @{Name="Staff Directory Settings"; Url="$baseUrl/api/staff/directory-settings"; ExpectAuth=$true}
)

foreach ($ep in $staffEndpoints) {
    $results += Test-Endpoint -Name $ep.Name -Url $ep.Url -ExpectAuth $ep.ExpectAuth
}

# ========================================
# SECTION 3: AutoBolt Worker Status
# ========================================
Write-Host "SECTION 3: AutoBolt Worker Status" -ForegroundColor Magenta
Write-Host "==================================" -ForegroundColor Magenta

$results += Test-Endpoint -Name "AutoBolt Status" -Url "$baseUrl/api/autobolt-status" -ExpectAuth $true

# ========================================
# Summary
# ========================================
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "              SUMMARY" -ForegroundColor Yellow  
Write-Host "========================================" -ForegroundColor Yellow

$passed = ($results | Where-Object { $_.Success }).Count
$failed = ($results | Where-Object { -not $_.Success }).Count
$total = $results.Count

Write-Host "Total Tests: $total" 
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if($failed -gt 0){"Red"}else{"Green"})
Write-Host ""

# Critical findings
Write-Host "CRITICAL FINDINGS:" -ForegroundColor Yellow
Write-Host "==================" -ForegroundColor Yellow

# Check health response for worker status
$healthResult = $results | Where-Object { $_.Content -like "*workers*" } | Select-Object -First 1
if ($healthResult -and $healthResult.Content) {
    try {
        $health = $healthResult.Content | ConvertFrom-Json
        if ($health.services.workers.active_count -eq 0) {
            Write-Host "[!] NO ACTIVE WORKERS DETECTED!" -ForegroundColor Red
            Write-Host "    The Python worker is NOT running or not sending heartbeats." -ForegroundColor Red
            Write-Host "    Jobs will NOT be processed until a worker is started." -ForegroundColor Red
        }
        if ($health.metrics.jobs_in_progress -gt 0 -and $health.services.workers.active_count -eq 0) {
            Write-Host "[!] STUCK JOB DETECTED!" -ForegroundColor Red
            Write-Host "    $($health.metrics.jobs_in_progress) job(s) in_progress but no workers running." -ForegroundColor Red
        }
    } catch {}
}

