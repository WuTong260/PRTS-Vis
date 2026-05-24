@echo off
setlocal

REM Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"

REM Start CLI server in background
echo [PRTS] Starting server...
start /b cmd /c "cd /d "%SCRIPT_DIR%" && node src/main/cliServer.js"

REM Wait for server to initialize
timeout /t 2 /nobreak > nul

REM Run CLI client
node "%SCRIPT_DIR%bin\prts-cli.js" %*