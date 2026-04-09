#!/bin/bash
set -e

if [ ! -f ".env" ]; then
  echo "No .env file found. Creating one from template..."
  cp .env.template .env
  echo ""
  echo "  Edit .env and add your Anthropic API key, then run this script again."
  echo ""
  exit 1
fi

export $(grep -v '^#' .env | xargs)

if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "sk-ant-your-key-here" ]; then
  echo "Error: ANTHROPIC_API_KEY is not set in .env"
  echo "Edit .env and replace the placeholder with your actual key."
  exit 1
fi

if ! python3 -c "import flask, anthropic" 2>/dev/null; then
  echo "Installing dependencies..."
  pip3 install flask flask-cors anthropic -q
fi

PORT=${PORT:-7860}
echo ""
echo "  Socratic Tutor running at http://localhost:$PORT"
echo "  Press Ctrl+C to stop."
echo ""

python3 server.py
