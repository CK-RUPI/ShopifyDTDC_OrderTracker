#!/bin/bash
# Navigate to project root
cd "$(dirname "$0")/.."

# Fix permissions for all .command scripts
chmod +x "$(dirname "$0")"/*.command 2>/dev/null
# Remove quarantine flag if present
xattr -d com.apple.quarantine "$(dirname "$0")"/*.command 2>/dev/null

echo "============================================"
echo "  Urban Naari Order Tracker - Setup"
echo "============================================"
echo

# --- Load nvm if installed (needed for .command files which skip shell profile) ---
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# --- Also check Homebrew paths ---
if [ -f "/opt/homebrew/bin/brew" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -f "/usr/local/bin/brew" ]; then
    eval "$(/usr/local/bin/brew shellenv)"
fi

# --- Install Node.js if missing ---
if ! command -v node &> /dev/null; then
    echo "[INSTALLING] Node.js not found. Installing via nvm..."
    # Install nvm if not present
    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    fi
    if command -v nvm &> /dev/null; then
        nvm install --lts
    else
        echo "[ERROR] nvm installation failed. Install Node.js manually:"
        echo "  https://nodejs.org"
        echo
        read -p "Press Enter to exit..."
        exit 1
    fi
    if ! command -v node &> /dev/null; then
        echo "[ERROR] Node.js installation failed."
        echo
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo "[OK] Node.js $(node -v) installed."
else
    echo "[OK] Node.js $(node -v) found."
fi

# --- Install dependencies ---
echo
echo "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "[ERROR] npm install failed."
    echo
    read -p "Press Enter to exit..."
    exit 1
fi
echo "[OK] Dependencies installed."

# --- Check .env.local ---
echo
if [ ! -f ".env.local" ]; then
    echo "[WARNING] .env.local not found!"
    echo
    echo "Create a file called .env.local in this folder with:"
    echo
    echo "  # Shopify"
    echo "  SHOPIFY_STORE_URL=your-store.myshopify.com"
    echo "  SHOPIFY_CLIENT_ID=your_client_id"
    echo "  SHOPIFY_CLIENT_SECRET=your_client_secret"
    echo "  NEXT_PUBLIC_SHOPIFY_STORE_URL=your-store.myshopify.com"
    echo
    echo "  # Notion"
    echo "  NOTION_API_KEY=your_notion_api_key"
    echo "  NOTION_PAGE_ID=your_notion_page_id"
    echo
    echo "  # SMTP"
    echo "  SMTP_HOST=smtp.gmail.com"
    echo "  SMTP_PORT=587"
    echo "  SMTP_USER=your_email"
    echo "  SMTP_PASS=your_password"
    echo "  SMTP_FROM=your_from_address"
    echo
    echo "Fill in your values, then run setup again."
    echo
    read -p "Press Enter to exit..."
    exit 1
else
    echo "[OK] .env.local found."
fi

# --- Notion database setup ---
echo
read -p "Set up Notion database? (y/n): " SETUP_NOTION
if [ "$SETUP_NOTION" = "y" ] || [ "$SETUP_NOTION" = "Y" ]; then
    echo "Running Notion setup..."
    npx tsx src/lib/notion-setup.ts
    if [ $? -ne 0 ]; then
        echo "[WARNING] Notion setup had issues. Check your NOTION_API_KEY and NOTION_PAGE_ID."
    else
        echo "[OK] Notion database created."
    fi
fi

echo
echo "============================================"
echo "  Setup complete! Double-click start.command"
echo "  to launch the dashboard."
echo "============================================"
echo
read -p "Press Enter to exit..."
