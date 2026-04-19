# Arquitetura do Sistema — Meeting Room Booking

Documento de referência da arquitetura adotada no projeto, cobrindo camadas de código, topologia de serviços, fluxos de dados e decisões estruturais.

---

## 1. Visão Geral

O sistema é uma aplicação fullstack de reservas de reunião com calendário interativo. O backend segue **Clean Architecture**, o frontend é uma SPA em React com FullCalendar, e as notificações por e-mail são processadas de forma assíncrona via **Outbox Pattern + Celery Worker**.

```
┌──────────────────────────────────────────────────────┐
│              Browser / SPA (React 18)                │
│     Calendário · Reservas · Admin · Auth             │
└─────────────────────────┬────────────────────────────┘
                          │ HTTP / JSON (JWT Bearer)
┌─────────────────────────▼────────────────────────────┐
│                    FastAPI Backend                    │
│     api/ → application/ → domain/ ← infrastructure/ │
└──────┬─────────────────────────────┬─────────────────┘
       │ asyncpg                     │ Redis (broker)
┌──────▼──────┐              ┌───────▼───────┐
│ PostgreSQL  │              │ Celery Worker │
│   (dados)   │◄─outbox─────►│  (e-mails)    │
└─────────────┘              └───────┬───────┘
                                     │ SMTP
                                ┌────▼─────┐
                                │ Mailpit  │
                                │ (dev)    │
                                └──────────┘
```

---

## 2. Camadas do Backend (Clean Architecture)

```
backend/app/
├── domain/              ← Regras de negócio puras (sem framework)
│   ├── entities/        ← Dataclasses: User, Room, Booking, OutboxEvent
│   ├── exceptions.py    ← DomainError, OverlapError, InvalidDateError
│   └── validators.py    ← validate_booking(), validate_duration()
│
├── application/         ← Casos de uso (orquestra domain + infra)
│   ├── interfaces/      ← ABCs dos repositórios (contratos)
│   ├── services/        ← AuthService, RoomService, BookingService
│   └── schemas/         ← DTOs Pydantic (request / response)
│
├── infrastructure/      ← Implementações concretas
│   ├── database/        ← SQLAlchemy models + sessão async
│   ├── repositories/    ← Implementações SQLAlchemy dos ABCs
│   ├── security/        ← JWT (python-jose) + bcrypt
│   └── email/           ← SMTP sender (smtp_sender.py)
│
├── api/                 ← Camada HTTP (FastAPI)
│   ├── routers/         ← auth, rooms, bookings, admin
│   └── dependencies.py  ← get_current_user, CurrentUser, OwnerUser, get_db
│
├── worker/              ← Celery app + tasks
└── scripts/             ← seed_admin.py (criado no entrypoint)
```

### Regra de dependência

```
api/ ──→ application/ ──→ domain/
              ▲
infrastructure/ (implementa as interfaces de application/)
```

O `domain/` não importa nada externo — é testável com pytest puro, sem banco nem FastAPI.

---

## 3. Topologia de Serviços (Docker Compose)

| Serviço | Imagem / Build | Porta | Função |
|---|---|---|---|
| `db` | postgres:16 | 5432 | Banco de dados principal |
| `redis` | redis:7-alpine | 6379 | Broker Celery + cache de resultados |
| `mailpit` | axllent/mailpit | 1025 / 8025 | SMTP local para dev (UI em :8025) |
| `backend` | compose/development/backend | 8000 | API FastAPI · migrations · seed admin |
| `worker` | compose/development/worker | — | Celery worker (processa outbox_events) |
| `beat` | compose/development/worker | — | Celery beat (agenda task a cada 10s) |
| `frontend` | compose/development/frontend | 5173 | Vite dev server (React SPA) |

### Startup do backend (`entrypoint.sh`)

```
alembic upgrade head  →  python -m app.scripts.seed_admin  →  uvicorn
```

---

## 4. Modelo de Dados

```
users
  id (UUID PK)
  email (UNIQUE)
  name
  password_hash
  role (OWNER | MEMBER)
  is_active
  created_at · updated_at

rooms
  id (UUID PK)
  name (UNIQUE)        ← auto-gerado internamente: "booking-<uuid>"
  capacity
  location
  description
  is_active
  created_at

bookings
  id (UUID PK)
  room_id (FK rooms)   ← uma sala por reserva, criada automaticamente
  user_id (FK users)   ← organizador
  title
  start_at (timestamptz)
  end_at (timestamptz)
  notes (TEXT nullable)
  color (VARCHAR(20) nullable)   ← cor customizada no calendário; null = hash automático
  status (active | cancelled)
  created_at · updated_at
  ── EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
     WHERE (status = 'active')

booking_participants
  id (UUID PK)
  booking_id (FK bookings)
  email
  name (nullable)

outbox_events
  id (UUID PK)
  event_type (BOOKING_CREATED | BOOKING_UPDATED | BOOKING_CANCELED)
  booking_id (FK bookings)
  payload (JSONB)
  status (pending | processed | failed)
  idempotency_key (UUID UNIQUE)
  attempts · max_attempts
  created_at · processed_at
```

> **Salas são transparentes ao usuário.** Cada reserva (ou série recorrente) cria automaticamente uma sala com nome interno `"<título> [<uuid8>]"` (garante unicidade mesmo com títulos repetidos). O utilizador apenas vê título, horário e participantes. Salas podem também ser criadas manualmente pelo admin via `RoomFormPage`.

---

## 5. Fluxo: Criação de Reserva

```
POST /api/bookings  { title, start_at, end_at, participant_emails,
                      recurrence, recurrence_count }
       │
       ▼
BookingService.create()
  1. validate_booking_dates()        ← domain/validators.py
  ── BEGIN TRANSACTION ──────────────────────────────────────
  2. INSERT rooms (nome auto "booking-<uuid>")
  3. Para cada ocorrência (1 ou N se recorrente):
       INSERT bookings
       INSERT outbox_events (BOOKING_CREATED, pending)
  ── COMMIT ─────────────────────────────────────────────────
       │
       ▼ (assíncrono, ~10s depois)
Celery Beat → process_pending_events
  → OutboxRepository.get_pending()  (SELECT FOR UPDATE SKIP LOCKED)
  → SMTPSender.send()               (aiosmtplib → Mailpit)
  → outbox_event.status = 'processed'
```

### Recorrência

Ao criar com `recurrence: "daily"` ou `"weekly"` e `recurrence_count: N`, são criados N registros de `bookings` todos compartilhando a mesma sala. O endpoint retorna a primeira ocorrência; as demais aparecem automaticamente no calendário.

---

## 6. Fluxo: Autenticação

```
POST /api/auth/login  (OAuth2PasswordRequestForm)
  → AuthService.login()
      → UserRepository.get_by_email()
      → bcrypt.checkpw()
      → create_access_token()  (HS256)
  ← { access_token, token_type: "bearer" }

Requisições autenticadas:
  Authorization: Bearer <token>
  → get_current_user()  (api/dependencies.py)
      → decode_access_token()
      → UserRepository.get_by_id()
      → injeta UserModel nas rotas

Rotas OWNER-only:
  → require_owner()  (api/dependencies.py)
      → verifica user.role == "OWNER"
      → HTTP 403 caso contrário
```

---

## 7. Prevenção de Conflitos de Reserva (3 camadas)

```
Requisição A                  Requisição B (simultânea)
     │                               │
     ▼                               ▼
overlap_check query            overlap_check query
  (sem overlap ainda)            (sem overlap ainda — race!)
     │                               │
     ▼                               ▼
INSERT booking A               INSERT booking B
     │                               │
     ▼                               ▼
COMMIT ✓                  EXCLUSION VIOLATION ✗
                           asyncpg.ExclusionViolationError
                           → handler converte em HTTP 409
```

Como cada reserva tem sua própria sala auto-criada, a exclusion constraint atua principalmente para proteger **séries recorrentes** (múltiplas ocorrências na mesma sala) contra sobreposição acidental.

---

## 8. Frontend (React SPA)

```
frontend/src/
├── api/client.ts             ← axios + interceptors JWT (sessionStorage)
├── contexts/
│   ├── AuthContext.tsx        ← autenticação global; token em sessionStorage
│   ├── ThemeContext.tsx       ← tema claro/escuro; persiste em sessionStorage
│   └── ToastContext.tsx       ← notificações globais
├── hooks/
│   └── useFocusTrap.tsx       ← acessibilidade: foco dentro de modais
├── components/
│   ├── Layout.tsx             ← Sidebar (drawer mobile) + área de conteúdo
│   ├── Sidebar.tsx            ← nav por role + toggle de tema ☀️/🌙
│   ├── BookingForm.tsx        ← formulário de reserva: recorrência, tag input
│   │                             de e-mails, color picker (modo edit)
│   ├── BookingModal.tsx       ← modal criar/editar reserva + confirmação passado
│   ├── BookingList.tsx        ← lista de reservas com ações inline
│   ├── DetailModal.tsx        ← detalhe de reserva com confirmação de cancelamento
│   ├── RoomCard.tsx           ← card de sala para RoomsPage
│   ├── Skeleton.tsx           ← loading placeholders com animate-pulse
│   ├── ErrorBoundary.tsx      ← fallback para erros React não tratados
│   ├── PrivateRoute.tsx       ← redireciona para /login se não autenticado
│   ├── OwnerRoute.tsx         ← redireciona para /rooms se não for OWNER
│   └── Toast.tsx              ← notificações in-app
└── pages/
    ├── CalendarPage.tsx       ← FullCalendar + DnD/resize + painel ⚙️ configurações
    ├── MyBookingsPage.tsx     ← lista com DetailModal inline + link para calendário
    ├── RoomsPage.tsx          ← listagem de salas disponíveis
    ├── RoomDetailPage.tsx     ← detalhe da sala + BookingModal inline
    ├── RoomFormPage.tsx       ← criação manual de sala (admin/OWNER)
    ├── LoginPage.tsx
    ├── RegisterPage.tsx
    └── admin/
        ├── AdminRoomsPage.tsx ← ativar/desativar salas
        └── AdminUsersPage.tsx ← toggle de role com confirmação inline
```

### Fluxo do calendário

```
MyBookingsPage (clica numa reserva)
  → DetailModal abre inline
  → botão "Ver no calendário"
  → navigate("/calendar?highlight=<id>&date=<YYYY-MM-DD>")
       │
       ▼
CalendarPage
  → useQuery(["bookings"])     ← GET /api/bookings
  → useEffect: lê ?highlight, navega para a data, abre DetailModal
  → Clicar em slot vazio → BookingModal (create)
  → Clicar em evento    → DetailModal → botão Editar → BookingModal (edit)
  → Drag & Drop / resize → PATCH /api/bookings/{id} { start_at, end_at }
```

### Configurações do calendário

Painel ⚙️ acessível no header do `CalendarPage`. Configurações salvas em `sessionStorage["calendarSettings"]`: range de horas visíveis, tamanho do slot, horário comercial, máx. eventos/dia (visão mês), toggle de finais de semana.

---

## 9. Gerenciamento de Sessão SQLAlchemy

O `get_db()` (dependency FastAPI) faz commit automático ao final de cada request bem-sucedido e rollback em caso de exceção:

```python
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

Os repositórios usam `session.flush()` para obter IDs gerados pelo banco dentro da transação, sem commitar prematuramente.

---

## 10. Estratégia de Branches

```
main
├── feature-1-architecture-ci       ← infraestrutura + CI           ✓ merged
├── feature-2-domain-models         ← entidades + migrations        ✓ merged
├── feature-3-auth                  ← autenticação                  ✓ merged
├── feature-4-rooms                 ← CRUD de salas                 ✓ merged
├── feature-5-bookings              ← reservas + overlap            ✓ merged
├── feature-6-outbox-worker         ← worker + e-mail               ✓ merged (PR #8)
├── feature-6c-booking-modal-dnd    ← modal, DnD, UX polish         ✓ merged (PR #9)
├── feature-dark-mode               ← dark mode + cor de reserva    ✓ merged (PR #10)
└── docs/update-documentation       ← atualização de docs           🔄 em progresso
```

---

## 11. Estrutura de Testes

```
backend/tests/
├── conftest.py                  ← engine, db_session, async_client
├── test_health.py
├── unit/
│   ├── test_booking_validators.py
│   └── test_domain_rules.py
├── integration/
│   ├── test_auth_api.py
│   ├── test_rooms_api.py
│   ├── test_bookings_api.py
│   ├── test_booking_overlap.py
│   └── test_outbox_creation.py
└── worker/
    ├── test_outbox_processing.py
    └── test_idempotency.py

frontend/src/test/
├── LoginPage.test.tsx
├── BookingForm.test.tsx
└── RoomsPage.test.tsx
```
