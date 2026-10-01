@echo off
setlocal

set "BACKEND_PORT=7491"
set "FRONTEND_PORT=7492"
:: Mesmas variaveis do stop.sh - o botao Sair passa as portas da instancia que o chama
if defined JOCA_BACKEND_PORT set "BACKEND_PORT=%JOCA_BACKEND_PORT%"
if defined JOCA_FRONTEND_PORT set "FRONTEND_PORT=%JOCA_FRONTEND_PORT%"

echo Stopping JOCA OS...

:: Kill processes on backend port
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%BACKEND_PORT% " ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)

:: Kill processes on frontend port
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%FRONTEND_PORT% " ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)

echo JOCA OS stopped.
