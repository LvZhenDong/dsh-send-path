@echo off
rem dsh drop-resolver: stop the loopback helper (uses its pid file).
set "PIDFILE=%USERPROFILE%\.dsh\drop-resolver\resolver.pid"
if exist "%PIDFILE%" (
  set /p PID=<"%PIDFILE%"
  taskkill /PID %PID% /F >nul 2>&1
  del "%PIDFILE%" >nul 2>&1
  echo dsh drop-resolver stopped (pid %PID%).
) else (
  echo No pid file; resolver may not be running.
)
