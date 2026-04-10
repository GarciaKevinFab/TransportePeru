# TransportePeru Backend - Windows Service Installation via NSSM
# Prerequisites: NSSM installed (https://nssm.cc/download)
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install-service.ps1

$ServiceName = "TransportePeru-API"
$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UvicornPath = Join-Path $BackendDir "venv\Scripts\uvicorn.exe"
$LogDir = Join-Path $BackendDir "logs"

Write-Host "=== TransportePeru Service Installer ===" -ForegroundColor Cyan
Write-Host "Backend Dir: $BackendDir"
Write-Host "Uvicorn: $UvicornPath"

# Verify prerequisites
if (!(Test-Path $UvicornPath)) {
    Write-Host "ERROR: uvicorn not found at $UvicornPath" -ForegroundColor Red
    Write-Host "Run: python -m venv venv && venv\Scripts\pip install -r requirements.txt"
    exit 1
}

if (!(Get-Command nssm -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: NSSM not found. Install from https://nssm.cc/download" -ForegroundColor Red
    exit 1
}

# Stop and remove existing service
Write-Host "`nRemoving existing service..." -ForegroundColor Yellow
nssm stop $ServiceName 2>$null
nssm remove $ServiceName confirm 2>$null

# Create logs directory
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# Install service
Write-Host "Installing service..." -ForegroundColor Green
nssm install $ServiceName $UvicornPath "server:app --host 0.0.0.0 --port 8000 --workers 2"
nssm set $ServiceName AppDirectory $BackendDir
nssm set $ServiceName DisplayName "TransportePeru API"
nssm set $ServiceName Description "FastAPI backend for G&E Transporta"
nssm set $ServiceName Start SERVICE_AUTO_START
nssm set $ServiceName AppStdout "$LogDir\stdout.log"
nssm set $ServiceName AppStderr "$LogDir\stderr.log"
nssm set $ServiceName AppRotateFiles 1
nssm set $ServiceName AppRotateBytes 10485760

# Start the service
Write-Host "Starting service..." -ForegroundColor Green
nssm start $ServiceName
Start-Sleep -Seconds 3

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
    Write-Host "`n=== Service '$ServiceName' installed and running ===" -ForegroundColor Green
    Write-Host "API: http://localhost:8000"
    Write-Host "Logs: $LogDir"
} else {
    Write-Host "`nWARNING: Service may not be running. Check logs at $LogDir" -ForegroundColor Yellow
}
