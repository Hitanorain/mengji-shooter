@echo off
title Chick Shooter
cd /d "%~dp0"
start "Chick Game server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8767
timeout /t 2 >nul
start "" "http://localhost:8767/"
