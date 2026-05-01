#!/bin/bash
# Rosa Road Studio — start script
set -e
cd "$(dirname "$0")"

# Create venv if missing
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

# Install deps
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Copy example env if .env doesn't exist
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "Created .env from .env.example — edit it to add API keys."
fi

# Seed
echo "Seeding database..."
python seed.py

# Run
echo ""
echo "======================================"
echo "  Rosa Road Studio is starting..."
echo "  Open: http://localhost:8000"
echo "  Login: admin@rosaroad.agency / rosaroad123"
echo "======================================"
echo ""
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
