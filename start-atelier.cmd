@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed or not on your PATH.
  echo.
  echo 1. Open https://nodejs.org in your browser
  echo 2. Download the big green "LTS" button ^(22.x^)
  echo 3. Run the installer ^(keep all default options^)
  echo 4. Close this window, open a NEW Command Prompt, and double-click this file again.
  echo.
  pause
  exit /b 1
)

echo Node: 
node -v
echo npm:
call npm -v
echo.
echo Installing packages ^(first time can take a few minutes^)...
call npm install
if errorlevel 1 (
  echo.
  echo npm install failed. Copy the red error text and send it to Cursor.
  pause
  exit /b 1
)

echo.
echo Starting Atelier at http://localhost:8080/
echo Leave this window open while you use the app. Press Ctrl+C to stop.
echo.
call npm run dev
pause
