@echo off
REM TransportePeru Backend - Windows Start Script
cd /d "%~dp0"

REM Activate virtual environment
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

echo Starting TransportePeru API on port 8000...
uvicorn server:app --host 0.0.0.0 --port 8000 --workers 2 --log-level info
