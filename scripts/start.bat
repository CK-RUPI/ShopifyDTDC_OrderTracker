@echo off
:: Navigate to project root
cd /d "%~dp0.."

echo ============================================
echo   Urban Naari Order Tracker - Starting...
echo ============================================
echo.

:: Auto-run setup if node_modules missing
if not exist "node_modules" (
    echo [INFO] Dependencies not installed. Running setup first...
    echo.
    call "%~dp0setup.bat"
    if not exist "node_modules" (
        echo [ERROR] Setup failed. Please run setup.bat first.
        pause
        exit /b 1
    )
)

:: Check .env.local
if not exist ".env.local" (
    echo [ERROR] .env.local not found. Run setup.bat first.
    pause
    exit /b 1
)

echo [OK] All checks passed. Starting server...
echo.
echo Dashboard will open at http://localhost:3000
echo Press Ctrl+C to stop the server.
echo.

:: Open browser after short delay
start "" http://localhost:3000

:: Start the dev server
call npm run dev
