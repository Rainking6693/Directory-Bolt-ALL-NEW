@echo off
REM Quick launch script for Genesis Agents on Directory-Bolt

echo ========================================
echo Genesis Agents for Directory-Bolt
echo ========================================
echo.

REM Check if task argument provided
if "%1"=="" (
    echo Usage: RUN_AGENTS.bat [task] [description]
    echo.
    echo Available tasks:
    echo   build_feature    - Build a new feature ^(requires description^)
    echo   add_billing      - Add Stripe billing integration
    echo   optimize_seo     - Run SEO optimization
    echo   audit_security   - Run security audit
    echo   fix_bug          - Fix a bug ^(requires description^)
    echo   generate_tests   - Generate test suite
    echo   full_audit       - COMPLETE site audit ^(Render, DB, backend, etc.^)
    echo.
    echo Examples:
    echo   RUN_AGENTS.bat add_billing
    echo   RUN_AGENTS.bat build_feature "Add user ratings system"
    echo   RUN_AGENTS.bat fix_bug "Search not working properly"
    echo.
    exit /b 1
)

REM Set Python path
set PYTHONPATH=%CD%;%PYTHONPATH%

REM Run orchestrator
if "%2"=="" (
    python scripts\orchestrate_directory_bolt.py --task %1
) else (
    python scripts\orchestrate_directory_bolt.py --task %1 --description %2
)

echo.
echo ========================================
echo Task completed! Check output above.
echo ========================================
pause
