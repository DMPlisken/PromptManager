#!/bin/bash
set -e

echo "=== PromptManager Prerequisites Check ==="
echo ""

ERRORS=0

# Check Docker
if command -v docker &>/dev/null; then
    echo "✓ Docker: $(docker --version | head -1)"
else
    echo "✗ Docker: NOT FOUND — Install Docker Desktop from https://docker.com"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker Compose
if docker compose version &>/dev/null; then
    echo "✓ Docker Compose: $(docker compose version --short 2>/dev/null || echo 'available')"
else
    echo "✗ Docker Compose: NOT FOUND — Update Docker Desktop or install docker-compose"
    ERRORS=$((ERRORS + 1))
fi

# Check Python
if command -v python3 &>/dev/null; then
    PY_VERSION=$(python3 --version 2>&1)
    echo "✓ Python: $PY_VERSION"
else
    echo "✗ Python 3: NOT FOUND — Install Python 3.12+ from python.org"
    ERRORS=$((ERRORS + 1))
fi

# Check Node.js (optional, for Claude CLI)
if command -v node &>/dev/null; then
    echo "✓ Node.js: $(node --version)"
else
    echo "! Node.js: NOT FOUND — Needed for Claude Code CLI"
fi

# Check Claude CLI
if command -v claude &>/dev/null; then
    echo "✓ Claude CLI: $(claude --version 2>/dev/null || echo 'available')"
else
    echo "! Claude CLI: NOT FOUND — Install with: npm install -g @anthropic-ai/claude-code"
    echo "  (Required for orchestrator features, not for basic PromptManager)"
fi

# Check ports
echo ""
echo "=== Port Availability ==="
for PORT in 3000 5432 8000 9100; do
    if lsof -i :$PORT &>/dev/null 2>&1; then
        echo "! Port $PORT: IN USE"
    else
        echo "✓ Port $PORT: Available"
    fi
done

# Create .env if needed
echo ""
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
else
    echo ".env already exists"
fi

echo ""
if [ $ERRORS -gt 0 ]; then
    echo "=== $ERRORS required prerequisite(s) missing ==="
    exit 1
else
    echo "=== All prerequisites met ==="
    echo "Run 'make setup' to install dependencies, then 'make dev' to start"
fi
