#!/bin/bash
# This script starts both the frontend and backend development servers.

echo "Starting backend server..."
(cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000) &
BACKEND_PID=$!

echo "Starting frontend server..."
# Assuming the Next.js app is in the root and uses pnpm
(pnpm dev) &
FRONTEND_PID=$!

# Function to clean up background processes on exit
cleanup() {
    echo "Shutting down servers..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit
}

# Trap SIGINT (Ctrl+C) and call cleanup
trap cleanup SIGINT

# Wait for both processes to exit
wait $BACKEND_PID
wait $FRONTEND_PID
