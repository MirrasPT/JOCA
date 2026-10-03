@echo off
setlocal enabledelayedexpansion

set "DIR=%~dp0"
:: Portas configuraveis, como no start.sh: uma segunda instalacao arranca noutras portas.
::   set JOCA_BACKEND_PORT=7591
::   set JOCA_FRONTEND_PORT=7592
::   start.bat
:: (PORT generico nao serve de fallback de proposito - ver start.sh.)
if not defined JOCA_BACKEND_PORT set "JOCA_BACKEND_PORT=7491"
if not defined JOCA_FRONTEND_PORT set "JOCA_FRONTEND_PORT=7492"
set "BACKEND_PORT=%JOCA_BACKEND_PORT%"
set "FRONTEND_PORT=%JOCA_FRONTEND_PORT%"
set "URL=http://localhost:%FRONTEND_PORT%"
:: Logs e launchers por porta - senao duas instalacoes reescrevem os mesmos ficheiros.
set "LOG_DIR=%TEMP%\joca-os-%BACKEND_PORT%"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: Detect sibling JOCA_Brain
if exist "%DIR%..\JOCA_Brain\.claude" (
    pushd "%DIR%..\JOCA_Brain"
    set "JOCA_LOGIC_PATH=!CD!"
    popd
    echo JOCA_Brain detected: !JOCA_LOGIC_PATH!
) else (
    echo WARNING: JOCA_Brain not found — running in standalone mode
)

:: Check if already running
netstat -ano 2>nul | findstr ":%BACKEND_PORT% " | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    netstat -ano 2>nul | findstr ":%FRONTEND_PORT% " | findstr "LISTENING" >nul 2>&1
    if !errorlevel! equ 0 (
        echo JOCA OS already running at %URL%
        start "" "%URL%"
        exit /b 0
    )
)

echo Starting JOCA OS...

:: Build backend
cd /d "%DIR%backend"
call npm run build >"%LOG_DIR%\backend-build.log" 2>&1
if !errorlevel! neq 0 (
    echo ERROR: Backend build failed. See %LOG_DIR%\backend-build.log
    exit /b 1
)

:: Start backend (write launcher to avoid nested quoting)
set "BACKEND_LAUNCHER=%LOG_DIR%\run-backend.bat"
rem O backend abre processos `claude`. Arrancado de dentro de uma sessao Claude Code, estas
rem variaveis herdadas fazem cada `claude` filho julgar-se sub-sessao dessa: herda o orcamento
rem dela e acaba a recusar arrancar. Limpar antes de o lancar (ver o mesmo bloco no start.sh).
> "!BACKEND_LAUNCHER!" echo @set "CLAUDECODE="
>>"!BACKEND_LAUNCHER!" echo @set "CLAUDE_CODE_ENTRYPOINT="
>>"!BACKEND_LAUNCHER!" echo @set "CLAUDE_CODE_CHILD_SESSION="
>>"!BACKEND_LAUNCHER!" echo @set "CLAUDE_CODE_SESSION_ID="
>>"!BACKEND_LAUNCHER!" echo @set "CLAUDE_CODE_EXECPATH="
>>"!BACKEND_LAUNCHER!" echo @set "CLAUDE_PID="
>>"!BACKEND_LAUNCHER!" echo @set "CLAUDE_EFFORT="
>>"!BACKEND_LAUNCHER!" echo @set PORT=%BACKEND_PORT%
>>"!BACKEND_LAUNCHER!" echo @set JOCA_LOGIC_PATH=!JOCA_LOGIC_PATH!
>>"!BACKEND_LAUNCHER!" echo @cd /d "%DIR%backend"
>>"!BACKEND_LAUNCHER!" echo @node dist/server.js ^>^>"!LOG_DIR!\backend.log" 2^>^&1
start /b "" cmd /c "!BACKEND_LAUNCHER!"
echo Backend started on port %BACKEND_PORT%

:: Wait for backend to be ready
timeout /t 2 /nobreak >nul

:: Start frontend
set "FRONTEND_LAUNCHER=%LOG_DIR%\run-frontend.bat"
rem O proxy do vite le JOCA_BACKEND_PORT (vite.config.ts); sem ela cai na 7491.
> "!FRONTEND_LAUNCHER!" echo @set JOCA_BACKEND_PORT=%BACKEND_PORT%
>>"!FRONTEND_LAUNCHER!" echo @set JOCA_FRONTEND_PORT=%FRONTEND_PORT%
>>"!FRONTEND_LAUNCHER!" echo @cd /d "%DIR%frontend"
>>"!FRONTEND_LAUNCHER!" echo @npx vite --host 127.0.0.1 --port %FRONTEND_PORT% ^>^>"!LOG_DIR!\frontend.log" 2^>^&1
start /b "" cmd /c "!FRONTEND_LAUNCHER!"
echo Frontend started on port %FRONTEND_PORT%

echo.
echo JOCA OS running at %URL%
echo Logs: %LOG_DIR%
echo To stop: stop.bat

timeout /t 3 /nobreak >nul
start "" "%URL%"
