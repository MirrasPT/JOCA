@echo off
setlocal enabledelayedexpansion

set "DIR=%~dp0"
set "BACKEND_PORT=7361"
set "FRONTEND_PORT=7362"
set "URL=http://localhost:%FRONTEND_PORT%"

:: Detect sibling JOCA_Logic
if exist "%DIR%..\JOCA_Logic\.claude" (
    pushd "%DIR%..\JOCA_Logic"
    set "JOCA_LOGIC_PATH=!CD!"
    popd
    echo JOCA_Logic detected: !JOCA_LOGIC_PATH!
) else (
    echo WARNING: JOCA_Logic not found — running in standalone mode
)

:: Check if already running
netstat -ano 2>nul | findstr ":%BACKEND_PORT% " | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    netstat -ano 2>nul | findstr ":%FRONTEND_PORT% " | findstr "LISTENING" >nul 2>&1
    if !errorlevel! equ 0 (
        echo JOCA UI already running at %URL%
        start "" "%URL%"
        exit /b 0
    )
)

echo Starting JOCA UI...

:: Build backend
cd /d "%DIR%backend"
call npm run build >nul 2>&1
if !errorlevel! neq 0 (
    echo ERROR: Backend build failed
    exit /b 1
)

:: Start backend
set "PORT=%BACKEND_PORT%"
start /b "" cmd /c "set PORT=%BACKEND_PORT%&& set JOCA_LOGIC_PATH=!JOCA_LOGIC_PATH!&& node dist/server.js >nul 2>&1"
echo Backend started on port %BACKEND_PORT%

:: Wait for backend to be ready
timeout /t 2 /nobreak >nul

:: Start frontend
cd /d "%DIR%frontend"
start /b "" cmd /c "npx vite --host 127.0.0.1 --port %FRONTEND_PORT% >nul 2>&1"
echo Frontend started on port %FRONTEND_PORT%

echo.
echo JOCA UI running at %URL%
echo To stop: stop.bat

timeout /t 3 /nobreak >nul
start "" "%URL%"
