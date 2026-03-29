#!/bin/bash
# Navigate to project root
cd "$(dirname "$0")/.."

echo "============================================"
echo "  Urban Naari Order Tracker - Starting..."
echo "============================================"
echo

# Auto-run setup if node_modules missing
if [ ! -d "node_modules" ]; then
    echo "[INFO] Dependencies not installed. Running setup first..."
    echo
    bash "$(dirname "$0")/setup.command"
    if [ ! -d "node_modules" ]; then
        echo "[ERROR] Setup failed. Please run setup.command first."
        echo
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# Check .env.local
if [ ! -f ".env.local" ]; then
    echo "[ERROR] .env.local not found. Run setup.command first."
    echo
    read -p "Press Enter to exit..."
    exit 1
fi

echo "[OK] All checks passed. Starting server..."
echo
echo "Dashboard will open at http://localhost:3000"
echo "Press Ctrl+C to stop the server."
echo

# Open browser (works on Mac and Linux)
if command -v open &> /dev/null; then
    (sleep 3 && open http://localhost:3000) &
elif command -v xdg-open &> /dev/null; then
    (sleep 3 && xdg-open http://localhost:3000) &
fi

# Start the dev server
npm run dev
