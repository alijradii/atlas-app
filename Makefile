BUN ?= $(if $(wildcard .tools/bun),$(CURDIR)/.tools/bun,bun)
export PATH := $(CURDIR)/.tools:$(PATH)
export UV_CACHE_DIR := $(CURDIR)/.cache/uv
export PLAYWRIGHT_BROWSERS_PATH := $(CURDIR)/.cache/ms-playwright

.PHONY: bootstrap dev dev-full infra-up infra-down migrate check audit build prod-config prod-up
bootstrap:
	$(BUN) scripts/bootstrap.ts
dev:
	$(BUN) scripts/dev.ts
dev-full:
	$(BUN) scripts/dev.ts --full
infra-up:
	docker compose -f infra/compose.dev.yaml up -d --wait
infra-down:
	docker compose -f infra/compose.dev.yaml --profile full down
migrate:
	uv run --frozen alembic upgrade head
check:
	$(BUN) run check
	uv run --frozen ruff check .
	uv run --frozen ruff format --check .
	uv run --frozen pytest

audit:
	$(BUN) audit
	uv export --quiet --frozen --all-groups --no-emit-project --format requirements-txt -o .cache/audit-requirements.txt
	uv run --frozen pip-audit --no-deps --disable-pip -r .cache/audit-requirements.txt --cache-dir .cache/pip-audit
build:
	$(BUN) run build
prod-config:
	docker compose --env-file .env.production -f infra/compose.prod.yaml config --quiet
prod-up:
	$(BUN) scripts/release-gate.ts
	docker compose --env-file .env.production -f infra/compose.prod.yaml up -d --wait

create-user:
	uv run --frozen python -m school2036.operator create-user --login "$(LOGIN)" --name "$(NAME)"
browser-test:
	$(BUN) --bun playwright test
browser-test-production:
	SCHOOL_E2E_PRODUCTION=1 $(BUN) --bun playwright test
backup:
	uv run --frozen python -m school2036.backup backup --key-file "$(KEY_FILE)" --file "$(BACKUP_FILE)" --compose infra/compose.dev.yaml
restore:
	uv run --frozen python -m school2036.backup restore --key-file "$(KEY_FILE)" --file "$(BACKUP_FILE)" --database "$(RESTORE_DATABASE)" --output "$(RESTORE_DIR)" --compose infra/compose.dev.yaml
deploy:
	$(BUN) scripts/deploy.ts "$(RELEASE)"

rag-install:
	$(BUN) run scripts/rag-dev.ts --install
rag-dev:
	$(BUN) run scripts/rag-dev.ts
