#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Node.js is not installed."
  echo "Install Node 22 LTS from https://nodejs.org then run this script again."
  echo ""
  exit 1
fi

echo "Node: $(node -v)"
echo "npm: $(npm -v)"
echo ""
echo "Installing packages (first time can take a few minutes)..."
npm install

echo ""
echo "Starting Atelier at http://localhost:8080/"
echo "Leave this terminal open. Press Ctrl+C to stop."
echo ""
npm run dev
