# Meeting Room Booking

Aplicação fullstack de reservas de salas de reunião com visualização em calendário e notificações assíncronas por e-mail.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 async, asyncpg |
| Banco | PostgreSQL 16 (btree_gist + EXCLUDE USING gist) |
| Worker | Celery 5 + Redis |
| E-mail (dev) | Mailpit |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + FullCalendar |
| Package manager | uv (backend) · npm (frontend) |
| Containers | Docker Compose |

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (para rodar testes e lint localmente)
- `make`

---

## Início rápido

```bash
git clone https://github.com/JuanLadeira/webchalleng.git
cd webchalleng

cp .env.example .env   # ajuste as variáveis se necessário
make up                # sobe todos os serviços
```

Aguarde os containers ficarem healthy e acesse:

| Serviço | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| Mailpit (e-mails dev) | http://localhost:8025 |

### Usuário administrador (dev)

Na primeira inicialização o `entrypoint.sh` cria automaticamente um usuário OWNER com as credenciais definidas no `.env`:

```env
SEED_ADMIN_NAME=Admin
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=admin123
```

---

## Comandos disponíveis (`make`)

### Containers

```bash
make up          # sobe todos os serviços em background
make down        # derruba todos os serviços
make rebuild     # rebuilda as imagens e sobe
make logs        # acompanha logs do backend em tempo real
```

### Banco de dados

```bash
make migrate     # aplica todas as migrations (alembic upgrade head)
make rollback    # reverte a última migration (alembic downgrade -1)
```

### Testes

```bash
make test        # roda todos os testes do backend
make test-cov    # testes com relatório de cobertura
make test-unit   # só testes unitários (sem banco)
make test-int    # só testes de integração
make test-fe     # roda testes do frontend (vitest)
```

### Qualidade de código

```bash
make lint        # verifica erros de estilo com ruff
make fmt         # formata o código automaticamente
make fmt-check   # checa formatação sem alterar arquivos
```

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste conforme necessário.

| Variável | Padrão | Descrição |
|---|---|---|
| `POSTGRES_USER` | `user` | Usuário do banco |
| `POSTGRES_PASSWORD` | `pass` | Senha do banco |
| `POSTGRES_DB` | `meetings` | Nome do banco |
| `POSTGRES_HOST` | `db` | Host do banco (`localhost` fora do Docker) |
| `POSTGRES_PORT` | `5432` | Porta do banco |
| `REDIS_HOST` | `redis` | Host do Redis |
| `REDIS_PORT` | `6379` | Porta do Redis |
| `JWT_SECRET_KEY` | `change-me` | Chave secreta para tokens JWT |
| `JWT_ALGORITHM` | `HS256` | Algoritmo JWT |
| `JWT_EXPIRATION_MINUTES` | `60` | Validade do token em minutos |
| `SMTP_HOST` | `mailpit` | Host SMTP |
| `SMTP_PORT` | `1025` | Porta SMTP |
| `SMTP_FROM` | `noreply@meetingrooms.local` | Remetente dos e-mails |
| `SMTP_TLS` | `false` | TLS no SMTP (true em produção) |
| `OUTBOX_POLL_INTERVAL_SECONDS` | `10` | Intervalo do worker de outbox |
| `SEED_ADMIN_NAME` | — | Nome do usuário admin criado no seed |
| `SEED_ADMIN_EMAIL` | — | E-mail do admin (seed idempotente) |
| `SEED_ADMIN_PASSWORD` | — | Senha do admin |

---

## Funcionalidades

### Calendário
- Visualização semanal, mensal e diária (estilo Google Calendar)
- Clicar em um horário vazio → cria reserva com datas pré-preenchidas
- Clicar em um evento → modal com detalhes e opção de cancelamento
- Navegação direta do "Minhas Reservas" para o calendário destacando a reserva

### Reservas
- Criação com título, horário e participantes (e-mail)
- **Sala criada automaticamente** — não é necessário gerenciar salas manualmente
- **Recorrência**: diária ou semanal, com número de ocorrências configurável
- Cancelamento com soft delete
- Proteção contra conflito de horário em três camadas (ver Arquitetura)

### Administração (role OWNER)
- Gerenciamento de salas: ativar/desativar
- Gerenciamento de usuários: alternar role MEMBER ↔ OWNER

---

## Endpoints da API

Documentação completa em http://localhost:8000/docs (Swagger UI).

### Autenticação

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/register` | Cria novo usuário |
| `POST` | `/api/auth/login` | Login — retorna JWT |
| `GET` | `/api/auth/me` | Dados do usuário autenticado |

### Salas

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/rooms` | Lista salas (param: `active_only`) |
| `GET` | `/api/rooms/{id}` | Detalhe da sala |
| `POST` | `/api/rooms` | Cria sala |
| `PATCH` | `/api/rooms/{id}` | Atualiza sala |
| `DELETE` | `/api/rooms/{id}` | Desativa sala (soft delete) |
| `GET` | `/api/rooms/{id}/bookings` | Reservas ativas de uma sala |

### Reservas

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/bookings` | Cria reserva (sala criada automaticamente; suporta recorrência) |
| `GET` | `/api/bookings` | Lista reservas do usuário autenticado |
| `GET` | `/api/bookings/{id}` | Detalhe da reserva |
| `PATCH` | `/api/bookings/{id}` | Atualiza reserva |
| `DELETE` | `/api/bookings/{id}` | Cancela reserva |

### Administração _(requer role OWNER)_

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/admin/users` | Lista todos os usuários |
| `PATCH` | `/api/admin/users/{id}/role` | Alterna role MEMBER ↔ OWNER |

---

## Arquitetura

O backend segue **Clean Architecture** com 4 camadas:

```
domain/          ← regras de negócio puras (sem framework)
application/     ← casos de uso + interfaces dos repositórios
infrastructure/  ← SQLAlchemy, bcrypt, SMTP, Celery
api/             ← routers FastAPI + dependencies
```

A regra central: dependências sempre apontam para dentro. O `domain/` não importa nada externo.

Documentação detalhada:

- [`docs/architecture.md`](docs/architecture.md) — visão geral, fluxos e topologia de serviços
- [`docs/decisions.md`](docs/decisions.md) — decisões técnicas relevantes
- [`docs/roadmap.md`](docs/roadmap.md) — fases de desenvolvimento

---

## Prevenção de conflito de reservas

Três camadas de proteção:

1. **Application layer** — query de overlap antes de inserir, retorna HTTP 409 amigável
2. **EXCLUDE USING gist no PostgreSQL** — garante atomicidade mesmo sob requisições concorrentes
3. **Transação atômica** — `booking` + `outbox_event` inseridos juntos; qualquer falha reverte tudo

```sql
EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
) WHERE (status = 'active')
```

---

## Notificações por e-mail (Outbox Pattern)

> ⚠️ **Em desenvolvimento (Fase 6)** — a infraestrutura do outbox está completa, mas o worker e o sender SMTP ainda não foram implementados.

Fluxo planejado:
1. Reserva criada/alterada/cancelada → evento persistido em `outbox_events` na mesma transação
2. Celery Beat dispara `process_pending_events` a cada 10 segundos
3. Worker busca eventos com `SELECT FOR UPDATE SKIP LOCKED`
4. Cada evento tem `idempotency_key` UUID único — reprocessamentos são ignorados
5. E-mail enviado e evento marcado como `processed`

Em desenvolvimento, os e-mails seriam capturados pelo **Mailpit** em http://localhost:8025.

---

## Testes

```
backend/tests/
├── conftest.py             ← fixtures: engine, db_session, async_client
├── test_health.py          ← smoke test
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

---

## Progresso do desenvolvimento

| Fase | Descrição | Status |
|---|---|---|
| 1 — Infraestrutura + CI | Docker Compose, Dockerfiles, GitHub Actions | ✅ Concluída |
| 2 — Domain + Models | Entidades, migrations, validators | ✅ Concluída |
| 3 — Autenticação | register, login, /me, JWT | ✅ Concluída |
| 4 — Salas | CRUD de salas | ✅ Concluída |
| 5 — Reservas | Overlap, outbox transacional, concorrência | ✅ Concluída |
| 6 — Outbox + Worker | Celery worker + e-mail SMTP | ⚠️ Parcial (infra pronta, worker stub) |
| 7 — Frontend | React + calendário + admin | ✅ Concluída |
| 8 — Polish + Docs | README, smoke test, CI 100% verde | 🔄 Em andamento |
