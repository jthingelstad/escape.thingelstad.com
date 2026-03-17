#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pulling latest from GitHub..."
git pull --ff-only

echo ""
echo "==> Syncing from Airtable..."
python3 scripts/sync_airtable.py

# Check if there are any changes to commit
if git diff --quiet && git diff --quiet --cached && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    echo ""
    echo "==> No changes detected. Everything is up to date."
    exit 0
fi

echo ""
echo "==> Committing changes..."
git add src/_data/rooms.json src/images/rooms/
git commit -m "Update room data."

echo ""
echo "==> Pushing to GitHub..."
git push

echo ""
echo "==> Done! Site will deploy via GitHub Actions."
