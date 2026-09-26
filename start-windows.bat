@echo off
rem Starts the database and the app. Keep this window open while you use the app.
cd /d "%~dp0"
docker compose up -d
echo Open http://localhost:3000 in your browser. Press Ctrl+C here to stop the app.
call npm start
