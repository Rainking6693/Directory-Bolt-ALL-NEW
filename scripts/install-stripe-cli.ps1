# Install Stripe CLI on Windows
# Run this script as Administrator for system-wide installation
# Or run normally for user-only installation

param(
    [switch]$UserOnly = $false,
    [string]$SourcePath = "C:\Users\Ben\OneDrive\Desktop\6_Installers\stripe_1.32.0_windows_x86_64"
)

Write-Host "🚀 Installing Stripe CLI..." -ForegroundColor Cyan

# Check if source exists
if (-not (Test-Path "$SourcePath\stripe.exe")) {
    Write-Host "❌ Error: stripe.exe not found at $SourcePath" -ForegroundColor Red
    Write-Host "Please update the SourcePath parameter or extract Stripe CLI first." -ForegroundColor Yellow
    exit 1
}

# Determine installation path
if ($UserOnly) {
    $InstallPath = "$env:USERPROFILE\Stripe"
    $PathTarget = [EnvironmentVariableTarget]::User
    Write-Host "📁 Installing to user directory: $InstallPath" -ForegroundColor Yellow
} else {
    $InstallPath = "C:\Program Files\Stripe"
    $PathTarget = [EnvironmentVariableTarget]::Machine
    Write-Host "📁 Installing to system directory: $InstallPath" -ForegroundColor Yellow
    Write-Host "⚠️  This requires Administrator privileges" -ForegroundColor Yellow
}

# Create directory
try {
    New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null
    Write-Host "✅ Created directory: $InstallPath" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create directory: $_" -ForegroundColor Red
    exit 1
}

# Copy stripe.exe
try {
    Copy-Item "$SourcePath\stripe.exe" -Destination "$InstallPath\stripe.exe" -Force
    Write-Host "✅ Copied stripe.exe to $InstallPath" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to copy stripe.exe: $_" -ForegroundColor Red
    exit 1
}

# Add to PATH
try {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", $PathTarget)
    if ($currentPath -notlike "*$InstallPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$InstallPath", $PathTarget)
        Write-Host "✅ Added $InstallPath to PATH" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  $InstallPath already in PATH" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to add to PATH: $_" -ForegroundColor Red
    Write-Host "⚠️  You may need to run as Administrator for system-wide installation" -ForegroundColor Yellow
    Write-Host "💡 Or run with -UserOnly flag for user-only installation" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Close and reopen PowerShell for PATH changes to take effect" -ForegroundColor Yellow
Write-Host ""
Write-Host "Then test with:" -ForegroundColor Cyan
Write-Host "  stripe --version" -ForegroundColor White
Write-Host "  stripe login" -ForegroundColor White
Write-Host "  stripe trigger checkout.session.completed" -ForegroundColor White

