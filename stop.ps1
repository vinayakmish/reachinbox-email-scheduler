# PowerShell stop script for ReachInbox Email Scheduler
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Stopping ReachInbox Email Scheduler (All Services)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

Write-Host "`nStopping Node.js & TypeScript servers..." -ForegroundColor Yellow
Stop-Process -Name "node", "tsx" -Force -ErrorAction SilentlyContinue

Write-Host "Stopping Redis Server..." -ForegroundColor Yellow
Stop-Process -Name "redis-server" -Force -ErrorAction SilentlyContinue

Write-Host "Stopping PostgreSQL Database..." -ForegroundColor Yellow
& "C:\pgsql\bin\pg_ctl.exe" -D "C:\pgsql\data" stop

Write-Host "`nAll services have been stopped.`n" -ForegroundColor Green
