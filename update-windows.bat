@echo off
rem Gets the latest version and rebuilds. Stop the app first (Ctrl+C in its window).
cd /d "%~dp0"
git pull || goto :error
call npm install || goto :error
docker compose up -d
call npm run db:deploy || goto :error
call npm run build || goto :error
echo Updated. Start the app again with start-windows.bat
pause
exit /b 0
:error
echo Update stopped because of the error above.
pause
exit /b 1
