@echo off
REM Directory-Bolt Dashboard API Test Script (Windows)
REM Tests all critical API endpoints for production readiness

setlocal enabledelayedexpansion

REM Configuration
if "%FRONTEND_URL%"=="" set FRONTEND_URL=http://localhost:3000
if "%BRAIN_URL%"=="" set BRAIN_URL=http://localhost:8080
if "%STAFF_KEY%"=="" set STAFF_KEY=DirectoryBolt-Staff-2025-SecureKey

echo ==================================
echo Directory-Bolt API Test Suite
echo ==================================
echo Frontend URL: %FRONTEND_URL%
echo Brain URL: %BRAIN_URL%
echo Staff Key: %STAFF_KEY:~0,20%...
echo.

set PASSED=0
set FAILED=0

REM Test Brain Health
echo Testing Brain Health Check...
curl -s -o response.json -w "%%{http_code}" "%BRAIN_URL%/health" > status.txt
set /p STATUS=<status.txt
if "%STATUS%"=="200" (
    echo [PASSED] Brain Health Check ^(HTTP %STATUS%^)
    set /a PASSED+=1
) else (
    echo [FAILED] Brain Health Check ^(Expected 200, got %STATUS%^)
    set /a FAILED+=1
)
echo.

REM Test Brain Job Enqueue
echo Testing Brain Job Enqueue...
curl -s -o response.json -w "%%{http_code}" -X POST "%BRAIN_URL%/api/jobs/enqueue" ^
    -H "Content-Type: application/json" ^
    -H "X-Staff-Key: %STAFF_KEY%" ^
    -d "{\"job_id\":\"test-%RANDOM%\",\"customer_id\":\"test-customer-001\",\"package_size\":5,\"priority\":1}" > status.txt
set /p STATUS=<status.txt
if "%STATUS%"=="200" (
    echo [PASSED] Brain Job Enqueue ^(HTTP %STATUS%^)
    set /a PASSED+=1
) else (
    echo [FAILED] Brain Job Enqueue ^(Expected 200, got %STATUS%^)
    set /a FAILED+=1
)
echo.

REM Test Staff Auth Check
echo Testing Staff Auth Check...
curl -s -o response.json -w "%%{http_code}" "%FRONTEND_URL%/api/staff/auth-check" ^
    -H "X-Staff-Key: %STAFF_KEY%" > status.txt
set /p STATUS=<status.txt
if "%STATUS%"=="200" (
    echo [PASSED] Staff Auth Check ^(HTTP %STATUS%^)
    set /a PASSED+=1
) else (
    echo [FAILED] Staff Auth Check ^(Expected 200, got %STATUS%^)
    set /a FAILED+=1
)
echo.

REM Test AutoBolt Queue
echo Testing AutoBolt Queue...
curl -s -o response.json -w "%%{http_code}" "%FRONTEND_URL%/api/staff/autobolt-queue" ^
    -H "X-Staff-Key: %STAFF_KEY%" > status.txt
set /p STATUS=<status.txt
if "%STATUS%"=="200" (
    echo [PASSED] AutoBolt Queue ^(HTTP %STATUS%^)
    set /a PASSED+=1
) else (
    echo [FAILED] AutoBolt Queue ^(Expected 200, got %STATUS%^)
    set /a FAILED+=1
)
echo.

REM Test AutoBolt Status
echo Testing AutoBolt Status...
curl -s -o response.json -w "%%{http_code}" "%FRONTEND_URL%/api/autobolt-status" ^
    -H "X-Staff-Key: %STAFF_KEY%" > status.txt
set /p STATUS=<status.txt
if "%STATUS%"=="200" (
    echo [PASSED] AutoBolt Status ^(HTTP %STATUS%^)
    set /a PASSED+=1
) else (
    echo [FAILED] AutoBolt Status ^(Expected 200, got %STATUS%^)
    set /a FAILED+=1
)
echo.

REM Test AutoBolt Directories
echo Testing AutoBolt Directories...
curl -s -o response.json -w "%%{http_code}" "%FRONTEND_URL%/api/autobolt/directories?limit=10" ^
    -H "X-Staff-Key: %STAFF_KEY%" > status.txt
set /p STATUS=<status.txt
if "%STATUS%"=="200" (
    echo [PASSED] AutoBolt Directories ^(HTTP %STATUS%^)
    set /a PASSED+=1
) else (
    echo [FAILED] AutoBolt Directories ^(Expected 200, got %STATUS%^)
    set /a FAILED+=1
)
echo.

REM Test Staff Realtime Status
echo Testing Staff Real-time Status...
curl -s -o response.json -w "%%{http_code}" "%FRONTEND_URL%/api/staff/realtime-status" ^
    -H "X-Staff-Key: %STAFF_KEY%" > status.txt
set /p STATUS=<status.txt
if "%STATUS%"=="200" (
    echo [PASSED] Staff Real-time Status ^(HTTP %STATUS%^)
    set /a PASSED+=1
) else (
    echo [FAILED] Staff Real-time Status ^(Expected 200, got %STATUS%^)
    set /a FAILED+=1
)
echo.

REM Cleanup
del response.json status.txt 2>nul

echo ==================================
echo Test Summary
echo ==================================
echo Passed: %PASSED%
echo Failed: %FAILED%
echo.

if %FAILED%==0 (
    echo [SUCCESS] All tests passed! System is production-ready.
    exit /b 0
) else (
    echo [ERROR] Some tests failed. Review errors above.
    exit /b 1
)
