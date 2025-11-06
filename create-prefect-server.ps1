# Create Prefect Server on Render

$RENDER_API_KEY = "rnd_kQhzTdBeGFlHjx6LtSz9mH7dhiFK"

$headers = @{
    "Authorization" = "Bearer $RENDER_API_KEY"
    "Content-Type" = "application/json"
}

$body = @{
    type = "web_service"
    name = "prefect-server"
    ownerId = "tea-d372kinfte5s73ascfpg"
    repo = "https://github.com/Rainking6693/Directory-Bolt-ALL-NEW"
    autoDeploy = "yes"
    branch = "main"
    rootDir = "backend"
    serviceDetails = @{
        env = "docker"
        envSpecificDetails = @{
            dockerfilePath = "infra/Dockerfile.prefect-server"
            dockerContext = "."
            dockerCommand = ""
        }
        healthCheckPath = "/api/health"
        plan = "starter"
        region = "oregon"
    }
} | ConvertTo-Json -Depth 10

Write-Host "Creating Prefect Server service on Render..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri "https://api.render.com/v1/services" `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop

    Write-Host "✅ Prefect Server service created successfully!" -ForegroundColor Green
    Write-Host "   Service ID: $($response.service.id)" -ForegroundColor Gray
    Write-Host "   Service URL: https://$($response.service.name).onrender.com" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Deployment started. Check status at:" -ForegroundColor Yellow
    Write-Host "   https://dashboard.render.com/web/$($response.service.id)" -ForegroundColor Gray
    Write-Host ""

    # Save service ID for later use
    $response.service.id | Out-File "prefect-server-id.txt"

} catch {
    Write-Host "❌ Failed to create Prefect Server service" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}
