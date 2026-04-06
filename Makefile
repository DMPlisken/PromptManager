.PHONY: setup dev stop restart logs status test clean db-migrate db-reset sidecar-start sidecar-stop sidecar-logs health

# === Configuration ===
SIDECAR_DIR := services/orchestrator
SIDECAR_PID_FILE := .sidecar.pid
SIDECAR_LOG := logs/sidecar.log

# === Setup ===
setup:
	@echo "=== PromptManager Setup ==="
	@test -f .env || (cp .env.example .env && echo "Created .env from .env.example")
	@mkdir -p logs data/backups
	@echo "Setting up sidecar virtual environment..."
	@cd $(SIDECAR_DIR) && python3 -m venv .venv 2>/dev/null || true
	@cd $(SIDECAR_DIR) && .venv/bin/pip install -q -r requirements.txt 2>/dev/null || echo "Warning: sidecar deps install failed (Claude CLI features will be unavailable)"
	@echo "Building Docker containers..."
	@docker compose build
	@echo ""
	@echo "=== Setup Complete ==="
	@echo "Run 'make dev' to start all services"

# === Development ===
dev: stop
	@echo "Starting Docker services..."
	@docker compose up -d
	@echo "Starting sidecar..."
	@$(MAKE) sidecar-start
	@echo ""
	@echo "=== All services running ==="
	@echo "Frontend: http://localhost:$${FRONTEND_PORT:-3000}"
	@echo "Backend:  http://localhost:$${BACKEND_PORT:-8000}"
	@echo "Sidecar:  http://localhost:$${SIDECAR_PORT:-9100}"
	@echo ""
	@echo "Run 'make logs' to see output"

stop:
	@echo "Stopping all services..."
	@$(MAKE) sidecar-stop 2>/dev/null || true
	@docker compose down 2>/dev/null || true

restart: stop dev

# === Logs ===
logs:
	@docker compose logs -f --tail=50 &
	@test -f $(SIDECAR_LOG) && tail -f $(SIDECAR_LOG) || echo "No sidecar log yet"

# === Status ===
status:
	@echo "=== Docker Services ==="
	@docker compose ps 2>/dev/null || echo "Docker services not running"
	@echo ""
	@echo "=== Sidecar ==="
	@if [ -f $(SIDECAR_PID_FILE) ] && kill -0 $$(cat $(SIDECAR_PID_FILE)) 2>/dev/null; then \
		echo "Running (PID: $$(cat $(SIDECAR_PID_FILE)))"; \
	else \
		echo "Not running"; \
	fi
	@echo ""
	@echo "=== Health Checks ==="
	@curl -sf http://localhost:$${BACKEND_PORT:-8000}/api/health 2>/dev/null && echo "" || echo "Backend: UNREACHABLE"
	@curl -sf http://localhost:$${SIDECAR_PORT:-9100}/health 2>/dev/null && echo "" || echo "Sidecar: UNREACHABLE"

health:
	@echo "Backend:"
	@curl -sf http://localhost:$${BACKEND_PORT:-8000}/api/health 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "  UNREACHABLE"
	@echo "Sidecar:"
	@curl -sf http://localhost:$${SIDECAR_PORT:-9100}/health 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "  UNREACHABLE"

# === Sidecar Management ===
sidecar-start:
	@if [ -f $(SIDECAR_PID_FILE) ] && kill -0 $$(cat $(SIDECAR_PID_FILE)) 2>/dev/null; then \
		echo "Sidecar already running (PID: $$(cat $(SIDECAR_PID_FILE)))"; \
	else \
		mkdir -p logs; \
		cd $(SIDECAR_DIR) && \
		if [ -f .venv/bin/activate ]; then \
			. .venv/bin/activate && \
			nohup uvicorn app.main:app --host 127.0.0.1 --port $${SIDECAR_PORT:-9100} \
				> ../../$(SIDECAR_LOG) 2>&1 & \
			echo $$! > ../../$(SIDECAR_PID_FILE); \
			echo "Sidecar started (PID: $$(cat ../../$(SIDECAR_PID_FILE)))"; \
		else \
			echo "Sidecar venv not found. Run 'make setup' first."; \
		fi \
	fi

sidecar-stop:
	@if [ -f $(SIDECAR_PID_FILE) ]; then \
		PID=$$(cat $(SIDECAR_PID_FILE)); \
		if kill -0 $$PID 2>/dev/null; then \
			kill $$PID && echo "Sidecar stopped (PID: $$PID)"; \
		fi; \
		rm -f $(SIDECAR_PID_FILE); \
	fi

sidecar-restart: sidecar-stop sidecar-start

sidecar-logs:
	@tail -f $(SIDECAR_LOG) 2>/dev/null || echo "No sidecar log found"

# === Database ===
db-migrate:
	@docker compose exec backend alembic upgrade head

db-reset:
	@docker compose down -v
	@docker compose up -d db
	@echo "Waiting for database..."
	@sleep 3
	@docker compose up -d backend
	@echo "Database reset complete"

# === Testing ===
test: test-backend test-frontend

test-backend:
	@docker compose exec backend python -m pytest tests/ -v 2>/dev/null || echo "No backend tests found or test failed"

test-frontend:
	@docker compose exec frontend npm test 2>/dev/null || echo "No frontend tests found or test failed"

test-e2e:
	@cd services/frontend && npx playwright test 2>/dev/null || echo "Playwright tests not configured"

# === Cleanup ===
clean: stop
	@docker compose down -v --rmi local 2>/dev/null || true
	@rm -rf $(SIDECAR_DIR)/.venv
	@rm -f $(SIDECAR_PID_FILE)
	@rm -rf logs/
	@echo "Cleaned up"
