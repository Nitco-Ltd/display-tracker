@echo off
REM Display Tracker - scheduled daily job (RMI sync -> SAP sync -> monthly reports).
REM Task Scheduler runs this file. Output goes to logs\daily-YYYY-MM.log.
cd /d "%~dp0\..\.."
call npm run daily
exit /b %ERRORLEVEL%
