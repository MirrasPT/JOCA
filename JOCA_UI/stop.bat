@echo off
setlocal

set "BACKEND_PORT=7371"
set "FRONTEND_PORT=7372"

echo Stopping JOCA UI...

:: Kill processes on backend port
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%BACKEND_PORT% " ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)

:: Kill processes on frontend port
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%FRONTEND_PORT% " ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)

echo JOCA UI stopped.
