@echo off
setlocal

set "DIR=%~dp0"
set BACKEND_PORT=7361
set FRONTEND_PORT=7362
set "URL=http://localhost:%FRONTEND_PORT%"

:: Detect sibling JOCA_Logic
if exist "%DIR%..\JOCA_Logic\.claude" (
    pushd "%DIR%..\JOCA_Logic"
    set "JOCA_LOGIC_PATH=%CD%"
    popd
    echo JOCA_Logic detected: %JOCA_LOGIC_PATH%
) else (
    echo WARNING: JOCA_Logic not found — running in standalone mode
)

echo Starting JOCA UI...

:: Backend
cd /d "%DIR%backend"
call npm run build >nul 2>&1
start /b "" node dist/server.js
echo Backend started on port %BACKEND_PORT%

:: Wait for backend
timeout /t 2 /nobreak >nul

:: Frontend
cd /d "%DIR%frontend"
start /b "" npx vite --host 127.0.0.1 --port %FRONTEND_PORT%
echo Frontend started on port %FRONTEND_PORT%

echo.
echo JOCA UI running at %URL%
echo Press Ctrl+C to stop.

timeout /t 3 /nobreak >nul
start "" "%URL%"
