@echo off
REM Display Tracker - starts the dashboard at http://localhost:3000
REM Builds the app first if it has never been built (or after an update, run: npm run build).
cd /d "%~dp0\..\.."
if not exist ".next\BUILD_ID" (
  echo Building the dashboard for the first time, please wait...
  call npm run build || exit /b 1
)
call npm start
