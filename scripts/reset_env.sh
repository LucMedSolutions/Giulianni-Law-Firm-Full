#!/bin/bash
# WARNING: This script will remove existing .env files in the frontend and backend.
# It is intended for testing a fresh environment setup. Use with caution.

echo "This script will remove the following .env files:"
echo "  - frontend/.env.local"
echo "  - backend/.env"
echo ""
read -p "Are you sure you want to continue? (y/N): " confirmation

if [[ "$confirmation" != "y" && "$confirmation" != "Y" ]]; then
  echo "Operation cancelled."
  exit 0
fi

echo "Removing frontend/.env.local..."
rm -f frontend/.env.local

echo "Removing backend/.env..."
rm -f backend/.env

echo "Done. You can now set up your environment from the .example files."
