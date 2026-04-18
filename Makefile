BACKEND_DIR := backend
FRONTEND_DIR := frontend

# ── Containers ────────────────────────────────────────────────────────────────
.PHONY: up down rebuild logs

up:
	docker compose up -d

down:
	docker compose down

rebuild:
	docker compose up -d --build

logs:
	docker compose logs -f backend

# ── Banco ─────────────────────────────────────────────────────────────────────
.PHONY: migrate rollback

migrate:
	cd $(BACKEND_DIR) && uv run alembic upgrade head

rollback:
	cd $(BACKEND_DIR) && uv run alembic downgrade -1

# ── Testes ────────────────────────────────────────────────────────────────────
.PHONY: test test-cov test-unit test-int test-fe

# Variáveis para rodar testes localmente (fora do Docker)
TEST_ENV := POSTGRES_HOST=localhost POSTGRES_PORT=5432 \
            POSTGRES_USER=user POSTGRES_PASSWORD=pass POSTGRES_DB=meetings \
            REDIS_HOST=localhost REDIS_PORT=6379 \
            JWT_SECRET_KEY=test-secret-key

test:
	cd $(BACKEND_DIR) && $(TEST_ENV) uv run pytest -v

test-cov:
	cd $(BACKEND_DIR) && $(TEST_ENV) uv run pytest -v --cov=app --cov-report=term-missing

test-unit:
	cd $(BACKEND_DIR) && uv run pytest tests/unit -v

test-int:
	cd $(BACKEND_DIR) && $(TEST_ENV) uv run pytest tests/integration -v

test-fe:
	cd $(FRONTEND_DIR) && npm test

# ── Qualidade ─────────────────────────────────────────────────────────────────
.PHONY: lint fmt fmt-check

lint:
	cd $(BACKEND_DIR) && uv run ruff check app tests

fmt:
	cd $(BACKEND_DIR) && uv run ruff format app tests

fmt-check:
	cd $(BACKEND_DIR) && uv run ruff format --check app tests

# ── Utilitários ───────────────────────────────────────────────────────────────
.PHONY: install help

install:
	cd $(BACKEND_DIR) && uv sync --extra dev

help:
	@echo ""
	@echo "Comandos disponíveis:"
	@echo ""
	@echo "  Containers"
	@echo "    make up         Sobe todos os serviços em background"
	@echo "    make down       Derruba todos os serviços"
	@echo "    make rebuild    Rebuilda e sobe todos os serviços"
	@echo "    make logs       Acompanha logs do backend"
	@echo ""
	@echo "  Banco"
	@echo "    make migrate    Aplica todas as migrations"
	@echo "    make rollback   Reverte a última migration"
	@echo ""
	@echo "  Testes"
	@echo "    make test       Roda todos os testes do backend"
	@echo "    make test-cov   Testes com cobertura"
	@echo "    make test-unit  Só testes unitários"
	@echo "    make test-int   Só testes de integração"
	@echo "    make test-fe    Roda testes do frontend (vitest)"
	@echo ""
	@echo "  Qualidade"
	@echo "    make lint       Verifica estilo e erros (ruff)"
	@echo "    make fmt        Formata o código"
	@echo "    make fmt-check  Checa formatação sem alterar"
	@echo ""
	@echo "  Outros"
	@echo "    make install    Instala dependências de dev"
	@echo ""
