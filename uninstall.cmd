@echo off
rem One-click uninstaller for dsh-send-path.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
echo.
pause
