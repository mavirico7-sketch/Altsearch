#!/bin/bash
echo "Starting AltSearch with Nginx Proxy Manager..."
docker compose --profile npm up -d

echo ""
echo "====================================="
echo "   Server & Proxy Manager started!   "
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
