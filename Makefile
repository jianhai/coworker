# Makefile for cowork chat application

# Settings file path
SETTINGS_FILE := $(HOME)/.cowork/settings.json

# Default values
BACKEND_ADDR := 127.0.0.1:3000
FRONTEND_PORT := 5173

# Read from settings.json if exists
ifneq ($(wildcard $(SETTINGS_FILE)),)
    BACKEND_ADDR := $(shell grep -A1 '"bind_address"' $(SETTINGS_FILE) 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+' || echo "127.0.0.1:3000")
    FRONTEND_PORT := $(shell grep -o '"port":[[:space:]]*[0-9]+' $(SETTINGS_FILE) 2>/dev/null | grep -oE '[0-9]+' || echo "5173")
endif

.PHONY: all build backend frontend run-backend run-frontend clean dev help

# Default target
all: build

# Build both backend and frontend
build: backend frontend

# Build backend
backend:
	@echo "Building backend..."
	cargo build --manifest-path=backend/Cargo.toml --release

# Build frontend
frontend:
	@echo "Building frontend..."
	cd frontend && npm run build

# Run backend
run-backend:
	@echo "Starting backend on $(BACKEND_ADDR)..."
	cargo run --manifest-path=backend/Cargo.toml

# Run frontend dev server
run-frontend:
	@echo "Starting frontend on port $(FRONTEND_PORT)..."
	cd frontend && npm run dev

# Development mode (run both in background)
dev:
	@echo "Starting development server..."
	@make -j2 run-backend run-foreground

# Run backend in foreground (for dev mode)
run-foreground:
	cargo run --manifest-path=backend/Cargo.toml

# Install frontend dependencies
install-frontend:
	cd frontend && npm install

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	cargo clean --manifest-path=backend/Cargo.toml
	rm -rf frontend/dist
	rm -rf frontend/node_modules/.vite

# Init config file
init-config:
	@mkdir -p $(HOME)/.cowork
	@if [ ! -f $(SETTINGS_FILE) ]; then \
		echo "Creating default config at $(SETTINGS_FILE)"; \
		echo '{' > $(SETTINGS_FILE); \
		echo '  "backend": {' >> $(SETTINGS_FILE); \
		echo '    "url": "http://127.0.0.1:3000",' >> $(SETTINGS_FILE); \
		echo '    "bind_address": "127.0.0.1:3000"' >> $(SETTINGS_FILE); \
		echo '  },' >> $(SETTINGS_FILE); \
		echo '  "frontend": {' >> $(SETTINGS_FILE); \
		echo '    "port": 5173,' >> $(SETTINGS_FILE); \
		echo '    "host": "0.0.0.0"' >> $(SETTINGS_FILE); \
		echo '  },' >> $(SETTINGS_FILE); \
		echo '  "ai": {' >> $(SETTINGS_FILE); \
		echo '    "api_key": "your-api-key-here",' >> $(SETTINGS_FILE); \
		echo '    "api_url": "https://api.deepseek.com/v1/chat/completions"' >> $(SETTINGS_FILE); \
		echo '  }' >> $(SETTINGS_FILE); \
		echo '}' >> $(SETTINGS_FILE); \
	else \
		echo "Config file already exists at $(SETTINGS_FILE)"; \
	fi

# Show config
show-config:
	@echo "Backend Address: $(BACKEND_ADDR)"
	@echo "Frontend Port: $(FRONTEND_PORT)"
	@echo "Config File: $(SETTINGS_FILE)"

help:
	@echo "Available targets:"
	@echo "  all            - Build both backend and frontend"
	@echo "  build          - Build both backend and frontend"
	@echo "  backend        - Build backend only"
	@echo "  frontend       - Build frontend only"
	@echo "  run-backend    - Run backend server"
	@echo "  run-frontend   - Run frontend dev server"
	@echo "  dev            - Start development mode"
	@echo "  clean          - Clean build artifacts"
	@echo "  init-config    - Create default config file"
	@echo "  show-config    - Show current configuration"
	@echo "  install-frontend - Install frontend dependencies"
	@echo "  help           - Show this help message"
