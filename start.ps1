# PowerShell startup script for ReachInbox Email Scheduler
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Starting ReachInbox Email Scheduler (All Services)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Start PostgreSQL
Write-Host "`n[1/4] Starting PostgreSQL Database..." -ForegroundColor Yellow
& "C:\pgsql\bin\pg_ctl.exe" -D "C:\pgsql\data" -l "C:\pgsql\data\logfile.log" start
Start-Sleep -Seconds 2

# 2. Start Redis
Write-Host "[2/4] Starting Redis Server on port 6380..." -ForegroundColor Yellow
Start-Process "C:\redis5\redis-server.exe" -ArgumentList "--port 6380 --daemonize no --loglevel notice" -WindowStyle Minimized
Start-Sleep -Seconds 2

# 3. Start Backend
Write-Host "[3/4] Starting Express Backend & BullMQ Worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; npm run dev"
Start-Sleep -Seconds 3

# 4. Start Frontend
Write-Host "[4/4] Starting React Frontend App..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"
Start-Sleep -Seconds 2

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  All Services Started Successfully!" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor White
Write-Host "  Backend  : http://localhost:3001" -ForegroundColor White
Write-Host "========================================================`n" -ForegroundColor Green
