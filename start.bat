@echo off
title ReachInbox Email Scheduler - All Services
echo ========================================================
echo   Starting ReachInbox Email Scheduler (All Services)
echo ========================================================
echo.

:: 1. Start PostgreSQL if not already running
echo [1/4] Starting PostgreSQL Database...
"C:\pgsql\bin\pg_ctl.exe" -D "C:\pgsql\data" -l "C:\pgsql\data\logfile.log" start >nul 2>&1
timeout /t 2 /nobreak >nul

:: 2. Start Redis 5 on port 6380 in background
echo [2/4] Starting Redis Server on port 6380...
start "Redis Server" /min "C:\redis5\redis-server.exe" --port 6380 --daemonize no --loglevel notice
timeout /t 2 /nobreak >nul

:: 3. Start Backend Server & BullMQ Worker in a new terminal window
echo [3/4] Starting Express Backend & BullMQ Worker (Port 3001)...
start "ReachInbox Backend" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 3 /nobreak >nul

:: 4. Start Frontend React Vite App in a new terminal window
echo [4/4] Starting React Frontend App (Port 5173)...
start "ReachInbox Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ========================================================
echo   All Services Started Successfully!
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:3001
echo ========================================================
echo.
pause
