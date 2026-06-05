#!/bin/bash
echo "Starting AltSearch..."
docker compose up -d

echo ""
echo "====================================="
echo "   Server successfully started!      "
echo "   Access URL: http://localhost:3000 "
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
