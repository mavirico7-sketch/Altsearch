#!/bin/bash
echo "=========================================================="
echo "                       WARNING                            "
echo "  You are about to start the server in Proxy Mode.        "
echo "  This will enable third-party subscriptions.             "
echo "  Do NOT use this unless you explicitly intend to share   "
echo "  your AI API keys through the proxy system!              "
echo "=========================================================="
echo ""
echo "Starting AltSearch with Nginx Proxy Manager AND Proxy Mode (PROXY_ENABLED=true)..."
PROXY_ENABLED=true docker compose --profile npm --profile proxy up -d

echo ""
echo "====================================="
echo "   All Services started!             "
echo "   App URL: http://localhost:3000    "
echo "   NPM Admin: http://localhost:81    "
echo "====================================="
echo ""
echo "Available Authentication Methods:"

if grep -q "allow_local_login: true" config.yaml; then
  echo "- Local User (allow_local_login is enabled in config.yaml)"
fi

if [ -f .env ]; then
  if grep -q "AUTH_GOOGLE_ID" .env; then
    echo "- Google (AUTH_GOOGLE_ID is configured in .env)"
  fi
  if grep -q "AUTH_GITHUB_ID" .env; then
    echo "- GitHub (AUTH_GITHUB_ID is configured in .env)"
  fi
fi
echo ""
