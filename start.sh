#!/bin/bash
# DocuCollab – start all services
# Usage: ./start.sh
# Requires: tmux (brew install tmux / apt install tmux)

set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║        DocuCollab Startup            ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Check .env files exist
if [ ! -f backend/.env ]; then
  echo "⚠️  backend/.env not found."
  echo "   Run: cp backend/.env.example backend/.env  and fill in your credentials."
  exit 1
fi

if [ ! -f frontend/.env ]; then
  echo "Creating frontend/.env from example..."
  cp frontend/.env.example frontend/.env
fi

# Check tmux is available
if command -v tmux &> /dev/null; then
  echo "Starting with tmux (3 panes)..."
  tmux new-session -d -s docucollab -x 220 -y 50

  # Pane 0: Strapi
  tmux send-keys -t docucollab "cd backend && npm run dev" Enter

  # Pane 1: Socket.IO
  tmux split-window -h -t docucollab
  tmux send-keys -t docucollab "cd backend && sleep 5 && node src/socket/server.js" Enter

  # Pane 2: Vite
  tmux split-window -v -t docucollab
  tmux send-keys -t docucollab "cd frontend && npm run dev" Enter

  tmux attach-session -t docucollab
else
  echo "tmux not found — starting in background processes..."

  # Start Strapi
  (cd backend && npm run dev) &
  STRAPI_PID=$!

  # Start Socket.IO (after 5s delay for Strapi to init)
  (sleep 5 && cd backend && node src/socket/server.js) &
  SOCKET_PID=$!

  # Start frontend
  (cd frontend && npm run dev) &
  VITE_PID=$!

  echo ""
  echo "Services started:"
  echo "  Strapi:    http://localhost:1337/admin  (PID $STRAPI_PID)"
  echo "  Socket.IO: http://localhost:3001        (PID $SOCKET_PID)"
  echo "  Frontend:  http://localhost:5173        (PID $VITE_PID)"
  echo ""
  echo "Press Ctrl+C to stop all services."

  trap "kill $STRAPI_PID $SOCKET_PID $VITE_PID 2>/dev/null; echo 'All services stopped.'" INT
  wait
fi
