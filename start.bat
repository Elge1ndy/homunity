@echo off
title Homeunity Launcher
cd /d "%~dp0backend"
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 goto open
start "" /min node server.js
timeout /t 15 /nobreak >nul
:open
start "" "http://localhost:5000"
exit /b