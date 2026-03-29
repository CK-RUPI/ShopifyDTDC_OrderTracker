@echo off
:: Navigate to project root
cd /d "%~dp0.."

echo ============================================
echo   Urban Naari Order Tracker - Setup
echo ============================================
echo.

:: --- Install Node.js if missing ---
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [INSTALLING] Node.js not found. Installing via winget...
    echo.
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    if %errorlevel% neq 0 (
        echo [ERROR] Auto-install failed. Opening download page...
        start https://nodejs.org/
        echo Please install Node.js from the website, then run this setup again.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Node.js installed. Restarting setup to pick up new PATH...
    echo.
    :: Refresh PATH and restart
    start "" "%~f0"
    exit /b 0
)

for /f "tokens=*" %%i in ('node -v') do echo [OK] Node.js %%i found

:: --- Install dependencies ---
echo.
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.

:: --- Check .env.local ---
echo.
if not exist ".env.local" (
    echo [WARNING] .env.local not found!
    echo.
    echo Create a file called .env.local in this folder with:
    echo.
    echo   # Shopify
    echo   SHOPIFY_STORE_URL=your-store.myshopify.com
    echo   SHOPIFY_CLIENT_ID=your_client_id
    echo   SHOPIFY_CLIENT_SECRET=your_client_secret
    echo   NEXT_PUBLIC_SHOPIFY_STORE_URL=your-store.myshopify.com
    echo.
    echo   # Notion
    echo   NOTION_API_KEY=your_notion_api_key
    echo   NOTION_PAGE_ID=your_notion_page_id
    echo.
    echo   # SMTP
    echo   SMTP_HOST=smtp.gmail.com
    echo   SMTP_PORT=587
    echo   SMTP_USER=your_email
    echo   SMTP_PASS=your_password
    echo   SMTP_FROM=your_from_address
    echo.
    echo Fill in your values, then run this setup again.
    pause
    exit /b 1
) else (
    echo [OK] .env.local found.
)

:: --- Notion database setup ---
echo.
set /p SETUP_NOTION="Set up Notion database? (y/n): "
if /i "%SETUP_NOTION%"=="y" (
    echo Running Notion setup...
    call npx tsx src/lib/notion-setup.ts
    if %errorlevel% neq 0 (
        echo [WARNING] Notion setup had issues. Check your NOTION_API_KEY and NOTION_PAGE_ID.
    ) else (
        echo [OK] Notion database created.
    )
)

echo.
echo ============================================
echo   Setup complete! Double-click start.bat
echo   to launch the dashboard.
echo ============================================
pause
