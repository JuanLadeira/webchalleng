# Roadmap — Meeting Room Booking System
## Fases de Desenvolvimento + Integração dos Apps Existentes

---

## Mapeamento dos Apps Existentes → Nova Arquitetura

### `auth/` — o que aproveitar
| Arquivo original | Destino no projeto |
|---|---|
| `auth/security.py` | `app/infrastructure/security/jwt.py` (create_token, verify, hash) |
| `auth/current_user.py` | `app/api/dependencies.py` (get_current_user, CurrentUser) |
| `auth/router.py` | `app/api/routers/auth.py` (simplificar: login, register, /me) |
| `auth/totp.py` | Descartar (2FA não é requisito do desafio) |

Adaptações: trocar `docagent.*` pelas importações locais; trocar `pwdlib` por `passlib[bcrypt]`; remover audit e rate_limit.

### `usuario/` — o que aproveitar
| Arquivo original | Destino no projeto |
|---|---|
| `usuario/models.py` | `app/infrastructure/database/models.py` — pk UUID, sem tenant_id |
| `usuario/services.py` | `app/infrastructure/repositories/sqlalchemy_user_repo.py` |
| `usuario/schemas.py` | `app/application/schemas/auth.py` |
| `usuario/router.py` | Descartar — roteamento vai em `auth.py` |

### `tenant/` — padrões internos (sem API visível)
| O que reaproveitar | Onde aplicar |
|---|---|
| `TenantService(session)` + `Annotated[..., Depends()]` | Padrão para todos os services |
| `TenantServiceDep = Annotated[...]` | `RoomServiceDep`, `BookingServiceDep`, etc. |
| `session.flush()` + `await session.refresh(entity)` | Todos os repositórios async |
| `model_validator(mode="before")` em schemas | OutboxEvent public schema |

---

## Modelo de Branches

```
main
├── feature-1-architecture-ci       ✓ merged
├── feature-2-domain-models         ✓ merged
├── feature-3-auth                  ✓ merged
├── feature-4-rooms                 ✓ merged
├── feature-5-bookings              ✓ merged
├── feature-6-outbox-worker         ✓ merged (PR #8)
├── feature-6c-booking-modal-dnd    ✓ merged (PR #9)
├── feature-dark-mode               ✓ merged (PR #10)
└── feature-10-live-meetings        🔲 planejada
```

---

---

## Status por Fase

| Fase | Branch | Status |
|---|---|---|
| 1 — Infraestrutura + CI | `feature-1-architecture-ci` | ✅ Concluída |
| 2 — Domain + Models | `feature-2-domain-models` | ✅ Concluída |
| 3 — Auth | `feature-3-auth` | ✅ Concluída |
| 4 — Rooms | `feature-4-rooms` | ✅ Concluída |
| 5 — Bookings | `feature-5-bookings` | ✅ Concluída |
| 6 — Outbox + Worker | `feature-6-outbox-worker` | ✅ Concluída |
| 7 — Frontend | `feature-7-frontend` | ✅ Concluída |
| 8 — UX Polish + DnD | `feature-6c-booking-modal-dnd` | ✅ Concluída |
| 9 — Dark Mode + Cor | `feature-dark-mode` | ✅ Concluída |
| 10 — Live Meetings | `feature-10-live-meetings` | 🔲 Planejada |

---

## Fase 1 — Arquitetura + CI (`feature-1-architecture-ci`)

**Objetivo:** Repo com estrutura completa, todos os containers subindo, CI verde com health check.

### Estrutura skeleton
```
desafio-mailerweb/
├── .github/workflows/
│   ├── backend-tests.yml    ← pytest com postgres/redis como services
│   └── frontend-tests.yml  ← vitest (sem containers)
├── docker-compose.yml       ← 7 serviços: db, redis, mailpit, backend, worker, beat, frontend
├── docker-compose.test.yml  ← overrides para test
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml       ← fastapi, sqlalchemy[asyncio], asyncpg, alembic,
│   │                           pydantic-settings, python-jose, passlib[bcrypt],
│   │                           celery[redis], pytest, pytest-asyncio, httpx
│   ├── alembic.ini
│   ├── alembic/versions/
│   └── app/
│       ├── main.py          ← FastAPI app factory + GET /health
│       ├── config.py        ← pydantic-settings lendo .env
│       └── infrastructure/database/session.py  ← async_engine + get_db()
├── tests/
│   ├── conftest.py          ← fixtures: async_session, async_client, override get_db
│   └── test_health.py       ← GET /health → 200
├── frontend/
│   ├── Dockerfile
│   └── package.json         ← Vite + React + TS + Vitest + RTL
└── worker/
    └── Dockerfile
```

### CI — backend-tests.yml (GitHub Actions)
```yaml
services:
  postgres:
    image: postgres:16
    env: POSTGRES_DB=test_db, POSTGRES_USER=test, POSTGRES_PASSWORD=test
    options: --health-cmd pg_isready
  redis:
    image: redis:7
steps:
  - pip install -e ".[dev]"
  - alembic upgrade head
  - pytest --asyncio-mode=auto -v
```

### Checklist
- [ ] Estrutura de pastas skeleton
- [ ] `docker-compose.yml` com 7 serviços
- [ ] Dockerfiles para backend, worker, frontend
- [ ] `pyproject.toml` com todas as dependências
- [ ] `app/config.py` com pydantic-settings
- [ ] `app/infrastructure/database/session.py` com async engine + `get_db()`
- [ ] Alembic configurado em modo async (`env.py` com `run_async_migrations`)
- [ ] `tests/conftest.py` com fixtures async
- [ ] `.github/workflows/backend-tests.yml` + `frontend-tests.yml`
- [ ] CI verde com `test_health.py`

---

## Fase 2 — Domain + Models (`feature-2-domain-models`)

**Objetivo:** Camada de domínio e ORM completa. Nenhum endpoint novo (exceto health).

### Checklist
- [ ] `app/domain/entities/` — User, Room, Booking, BookingParticipant, OutboxEvent (dataclasses)
- [ ] `app/domain/exceptions.py` — DomainError, OverlapError, InvalidDateError, BookingDurationError
- [ ] `app/domain/validators.py` — `validate_booking_dates()`, `validate_duration()`
- [ ] `app/infrastructure/database/models.py` — 5 SQLAlchemy models (UUID pks)
- [ ] Alembic migration inicial:
  - Todas as tabelas
  - `CREATE EXTENSION IF NOT EXISTS btree_gist`
  - `EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status = 'active')`
- [ ] `tests/unit/test_booking_validators.py`
- [ ] `tests/unit/test_domain_rules.py`
- [ ] CI verde

---

## Fase 3 — Auth (`feature-3-auth`)

**Objetivo:** Portar `auth/` + `usuario/` à clean architecture. Endpoints register, login, /me funcionando.

### Mapeamento detalhado
- `auth/security.py` → `app/infrastructure/security/jwt.py`
  - Manter: `create_access_token()`, `get_password_hash()`, `verify_password()`
  - Remover: reset/temp token helpers
- `auth/current_user.py` → `app/api/dependencies.py`
  - Manter: `get_current_user()`, `CurrentUser`
  - Adaptar: usar `UserRepository` ao invés de `UsuarioServiceDep`
- `usuario/services.py` → `app/infrastructure/repositories/sqlalchemy_user_repo.py`
  - Manter: `get_by_email()`, `get_by_id()`, `create()`
- `auth/router.py` → `app/api/routers/auth.py`
  - Manter: POST /auth/login, POST /auth/register, GET /auth/me
  - Remover: forgot/reset/change-password

### Checklist
- [ ] `app/application/interfaces/user_repository.py` (ABC)
- [ ] `app/infrastructure/repositories/sqlalchemy_user_repo.py`
- [ ] `app/infrastructure/security/jwt.py`
- [ ] `app/application/services/auth_service.py`
- [ ] `app/application/schemas/auth.py`
- [ ] `app/api/dependencies.py`
- [ ] `app/api/routers/auth.py`
- [ ] `tests/integration/test_auth_api.py`
- [ ] CI verde

---

## Fase 4 — Rooms (`feature-4-rooms`)

**Objetivo:** CRUD de salas seguindo o padrão de service do tenant app.

### Padrão (de tenant/services.py)
```python
class RoomService:
    def __init__(self, session: AsyncSession): ...
    # session.flush() + await session.refresh(obj)

RoomServiceDep = Annotated[RoomService, Depends(get_room_service)]
```

### Checklist
- [ ] `app/application/interfaces/room_repository.py`
- [ ] `app/infrastructure/repositories/sqlalchemy_room_repo.py`
- [ ] `app/application/services/room_service.py`
- [ ] `app/application/schemas/room.py`
- [ ] `app/api/routers/rooms.py` — POST/GET /rooms, GET /rooms/{id}
- [ ] `tests/integration/test_rooms_api.py`
- [ ] CI verde

---

## Fase 5 — Bookings (`feature-5-bookings`)

**Objetivo:** Core do desafio — reservas com overlap, concorrência, transação atômica booking + outbox.

### Checklist
- [ ] `app/application/interfaces/booking_repository.py`
- [ ] `app/infrastructure/repositories/sqlalchemy_booking_repo.py` (overlap query)
- [ ] `app/application/services/booking_service.py`
  - `create()` — valida datas + overlap + INSERT booking + outbox na mesma transação
  - `update()` — idem
  - `cancel()` — soft delete + outbox BOOKING_CANCELED
- [ ] `ExclusionViolation` (asyncpg) → HTTP 409
- [ ] `app/application/schemas/booking.py`
- [ ] `app/api/routers/bookings.py` — 5 endpoints
- [ ] `tests/integration/test_bookings_api.py`
- [ ] `tests/integration/test_booking_overlap.py`
- [ ] `tests/integration/test_outbox_creation.py`
- [ ] CI verde

---

## Fase 6 — Outbox + Worker (`feature-6-outbox-worker`)

### Checklist
- [ ] `app/application/interfaces/outbox_repository.py`
- [ ] `app/infrastructure/repositories/sqlalchemy_outbox_repo.py` (`SELECT FOR UPDATE SKIP LOCKED`)
- [ ] `app/worker/celery_app.py`
- [ ] `app/worker/tasks.py` — `process_pending_events` + Celery Beat 10s
- [ ] `app/infrastructure/email/smtp_sender.py` — envia via Mailpit
- [ ] Retry: attempts + max_attempts, `mark_failed()`, `mark_processed()`
- [ ] Idempotência: check status + UNIQUE idempotency_key
- [ ] `tests/worker/test_outbox_processing.py`
- [ ] `tests/worker/test_idempotency.py`
- [ ] CI verde

---

## Fase 7 — Frontend (`feature-7-frontend`)

### Checklist
- [ ] React 18 + Vite + TypeScript + Tailwind CSS
- [ ] `src/api/client.ts` — axios + interceptors JWT
- [ ] `src/contexts/AuthContext.tsx`
- [ ] React Query provider
- [ ] Pages: LoginPage, RegisterPage, RoomsPage, RoomDetailPage, BookingFormPage
- [ ] Components: Layout, PrivateRoute, RoomCard, BookingList, BookingForm, FeedbackToast
- [ ] UX: loading, toasts, feedback de conflito
- [ ] `tests/LoginPage.test.tsx`, `tests/BookingForm.test.tsx`, `tests/RoomsPage.test.tsx`
- [ ] CI verde

---

## Fase 8 — Polish + Docs (`feature-8-polish`)

### Checklist
- [ ] `README.md`: rodar backend, frontend, worker; variáveis; decisões técnicas
- [ ] `docs/DECISIONS.md`: concorrência (3 camadas), outbox, clean arch, reuso dos apps
- [ ] `.env.example` completo
- [ ] Smoke test end-to-end (`docker-compose up`)
- [ ] Linting final (ruff + eslint)
- [ ] PR final para main com CI 100% verde

---

## Arquivos Críticos por Fase

| Fase | Arquivos Principais | Fonte |
|------|---|---|
| 1 | `docker-compose.yml`, `pyproject.toml`, `app/main.py`, `app/config.py`, `session.py`, `.github/workflows/` | — |
| 2 | `app/domain/`, `app/infrastructure/database/models.py`, `alembic/versions/` | — |
| 3 | `app/api/routers/auth.py`, `app/application/services/auth_service.py`, `app/infrastructure/security/jwt.py`, `app/api/dependencies.py` | `auth/security.py`, `auth/current_user.py`, `auth/router.py`, `usuario/services.py` |
| 4 | `app/api/routers/rooms.py`, `app/application/services/room_service.py` | padrão `tenant/services.py` |
| 5 | `app/api/routers/bookings.py`, `app/application/services/booking_service.py`, `sqlalchemy_booking_repo.py` | — |
| 6 | `app/worker/celery_app.py`, `app/worker/tasks.py`, `smtp_sender.py` | — |
| 7 | `frontend/src/` | — |
| 8 | `README.md`, `docs/DECISIONS.md` | — |

---

## Critérios de Conclusão por Fase

| Fase | Critério |
|---|---|
| 1 | `docker-compose up` → todos healthy. CI verde com `test_health.py` |
| 2 | `alembic upgrade head` sem erro. Testes unit passando |
| 3 | register + login + /me funcionando no CI com banco real |
| 4 | CRUD de salas, nome único, auth requerida |
| 5 | Overlap → 409, outbox gerado na mesma transação |
| 6 | E-mail aparece no Mailpit. Retry e idempotência testados |
| 7 | `npm run test` verde. Fluxo completo no browser |
| 8 | `docker-compose up` completo → end-to-end funciona. CI 100% verde |
