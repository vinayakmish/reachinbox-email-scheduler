@echo off
title ReachInbox Email Scheduler - Stop All Services
echo ========================================================
echo   Stopping ReachInbox Email Scheduler (All Services)
echo ========================================================
echo.

echo Stopping Node.js & TypeScript servers...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM tsx.exe >nul 2>&1

echo Stopping Redis Server...
taskkill /F /IM redis-server.exe >nul 2>&1

echo Stopping PostgreSQL Database...
"C:\pgsql\bin\pg_ctl.exe" -D "C:\pgsql\data" stop >nul 2>&1

echo.
echo All services have been stopped.
echo.
pause
