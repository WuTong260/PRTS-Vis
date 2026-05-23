@echo off
setlocal

REM Start CLI server in background using PowerShell job
powershell -NoProfile -Command "Start-Job -ScriptBlock { Set-Location '%~dp0'; Start-Process node -ArgumentList 'src/main/cliServer.js' -NoNewWindow }" > nul 2>&1

REM Wait for server to start
timeout /t 2 /nobreak > nul

REM Run CLI client
node "%~dp0bin\prts-cli.js" %*