@echo off
cd /d "%~dp0"
npm.cmd run electron
if errorlevel 1 pause
