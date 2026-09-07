@echo off
setlocal
title Clinic System Launcher
color 0A

set "ROOT=%~dp0"

where dotnet >nul 2>&1 || (
  echo [ERROR] .NET SDK was not found in PATH.
  pause
  exit /b 1
)
where npm >nul 2>&1 || (
  echo [ERROR] Node.js/npm was not found in PATH.
  pause
  exit /b 1
)

sc query MSSQLSERVER | find "RUNNING" >nul
if errorlevel 1 (
  echo [*] Starting SQL Server...
  net start MSSQLSERVER >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] SQL Server could not be started. Run this file as Administrator or start MSSQLSERVER manually.
    pause
    exit /b 1
  )
)
echo [OK] SQL Server is running.

echo [*] Starting Backend API...
start "Clinic Backend" /D "%ROOT%src\ClinicSystem.API" cmd /k "dotnet run --urls http://localhost:5000"

echo [*] Starting Frontend...
start "Clinic Frontend" /D "%ROOT%frontend" cmd /k "npm run dev"

echo [*] Waiting for the frontend...
powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(60); do { try { $r=Invoke-WebRequest -UseBasicParsing http://localhost:3000 -TimeoutSec 2; if($r.StatusCode -lt 500){exit 0} } catch {}; Start-Sleep -Seconds 1 } while((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 (
  echo [WARN] Services were started, but the frontend did not become ready within 60 seconds. Check the two service windows.
) else (
  start "" "http://localhost:3000"
)

echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:5000/swagger
echo Login:    09120000000 / Admin@12345
echo.
pause
