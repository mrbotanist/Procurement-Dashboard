@echo off
rem First-time setup on Windows. Double-click, or run from PowerShell: .\setup-windows.bat
cd /d "%~dp0"
set FIRST=0
if not exist .env set FIRST=1

echo === Installing packages (this takes a few minutes) ===
call npm install || goto :error
call npm run setup || goto :error

echo === Starting the database (Docker Desktop must be running) ===
docker compose up -d || goto :error
timeout /t 5 /nobreak >nul

echo === Creating tables ===
call npm run db:deploy || goto :error

if "%FIRST%"=="1" (
  echo === Loading sample data ===
  call npm run db:seed || goto :error
)

echo === Building the app ===
call npm run build || goto :error

echo.
echo Setup complete. Start the app with start-windows.bat, then open http://localhost:3000
pause
exit /b 0

:error
echo.
echo Setup stopped because of the error above.
pause
exit /b 1
