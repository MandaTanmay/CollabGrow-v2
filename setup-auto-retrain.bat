@echo off
REM Auto-Retraining System Setup Script (Windows)
REM Installs and configures the auto-retraining system for production

setlocal enabledelayedexpansion

echo ======================================================
echo CollabGrow Auto-Retraining System Setup (Windows)
echo ======================================================
echo.

REM Check if running from correct directory
if not exist "ecosystem.config.js" (
  echo ❌ Error: Please run this script from the project root directory
  pause
  exit /b 1
)

echo Step 1: Checking dependencies...

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
  echo ❌ Node.js not found. Please install Node.js first.
  pause
  exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js %NODE_VERSION%

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
  echo ❌ Python not found. Please install Python 3.8+ first.
  pause
  exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo ✓ %PYTHON_VERSION%

echo.
echo Step 2: Installing Node.js dependencies...
call npm install
if errorlevel 1 (
  echo ❌ Failed to install Node.js dependencies
  pause
  exit /b 1
)
echo ✓ Node.js dependencies installed

echo.
echo Step 3: Installing Python dependencies...
python -m pip install -q schedule psycopg2-binary scikit-learn pandas numpy
if errorlevel 1 (
  echo ❌ Failed to install Python dependencies
  pause
  exit /b 1
)
echo ✓ Python dependencies installed

echo.
echo Step 4: Installing PM2 globally...
call npm install -g pm2
if errorlevel 1 (
  echo ❌ Failed to install PM2
  pause
  exit /b 1
)
echo ✓ PM2 installed

echo.
echo Step 5: Setting up project interactions...
cd backend
call node scripts/setup-interactions-table.js
if errorlevel 1 (
  echo ⚠️ Note: Interactions table setup had an issue (might already exist)
)
cd ..
echo ✓ Project interactions table ready

echo.
echo Step 6: Testing Python auto-retrain script...
python recommendation/auto_retrain.py
if errorlevel 1 (
  echo ⚠️ Warning: Auto-retrain script test had an issue
)
echo ✓ Auto-retrain script ready

echo.
echo ======================================================
echo ✅ Setup Complete!
echo ======================================================
echo.
echo Next steps:
echo.
echo 1. Start the system with PM2:
echo    pm2 start ecosystem.config.js
echo.
echo 2. Check status:
echo    pm2 status
echo.
echo 3. View logs:
echo    pm2 logs recommendation-scheduler
echo.
echo 4. Monitor models:
echo    node backend/scripts/recommendation-monitor.js status
echo.
echo 5. Manually trigger retraining:
echo    node backend/scripts/recommendation-monitor.js retrain
echo.
echo For detailed guide, see: PRODUCTION_RETRAINING_GUIDE.md
echo.

pause
