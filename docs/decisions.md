# Decisões Técnicas

Registro das decisões de arquitetura e de biblioteca tomadas ao longo do projeto, com contexto e motivação.

---

## 1. Hashing de senhas: `bcrypt` direto em vez de `passlib` ou `pwdlib`

**Data:** 2026-04-17
**Status:** Adotado

### Contexto

O app de autenticação original (`auth/`) usava `pwdlib`, que é uma biblioteca de alto nível e serve como wrapper moderno sobre backends de hashing (bcrypt, argon2 etc.). Durante a portagem para este projeto, a dependência `passlib[bcrypt]` foi tentada primeiro por ser o backend mais comum em tutoriais FastAPI.

### Problema encontrado

`passlib` tem dois problemas no Python 3.12 / bcrypt 5.x:

1. O módulo `crypt` da stdlib foi removido no Python 3.13 e deprecado no 3.12 — passlib gera `DeprecationWarning` ao importar.
2. O `bcrypt 5.x` removeu o atributo `__about__` que o passlib usava para detectar a versão do backend, causando `AttributeError` silencioso e posterior `ValueError: password cannot be longer than 72 bytes` mesmo para senhas curtas.

### Decisão

Usar `bcrypt` diretamente, sem wrapper:

```python
import bcrypt

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
```

### Alternativas consideradas

| Biblioteca | Motivo de não usar |
|---|---|
| `passlib[bcrypt]` | Incompatível com bcrypt 5.x, deprecated no Python 3.12 |
| `pwdlib[bcrypt]` | Funciona, mas adiciona uma camada de abstração desnecessária para um único algoritmo |
| `argon2-cffi` | Mais seguro que bcrypt, mas fora do padrão de mercado para FastAPI e sem ganho real no contexto do desafio |

### Consequências

- API de hashing exposta em `app/infrastructure/security/jwt.py`
- Dependência `bcrypt>=4.0.0` no `pyproject.toml` (4.x e 5.x são compatíveis com nossa implementação)
- Limite de 72 bytes por senha é inerente ao algoritmo bcrypt — documentar no futuro se houver validação de tamanho máximo de senha

---

## 2. Estratégia de concorrência para reservas: Exclusion Constraint + validação em app

**Data:** 2026-04-17
**Status:** Adotado

### Contexto

O sistema precisa impedir que duas reservas ativas ocupem a mesma sala no mesmo horário, mesmo sob requisições concorrentes.

### Decisão

Três camadas de proteção:

1. **Validação na Application Layer** — query prévia para checar overlap antes de inserir (retorna erro amigável ao usuário).
2. **Exclusion Constraint no PostgreSQL** (`EXCLUDE USING gist`) — garante atomicidade no banco. Mesmo que duas requisições passem pela validação da app simultaneamente, o banco rejeita a segunda com `ExclusionViolationError`.
3. **Transação atômica** — `booking` + `outbox_event` são inseridos na mesma transação. Qualquer falha faz rollback completo.

```sql
ALTER TABLE bookings
ADD CONSTRAINT no_booking_overlap
EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
) WHERE (status = 'active');
```

### Por que não só `SELECT FOR UPDATE`

`SELECT FOR UPDATE` serializa o acesso mas não garante atomicidade se a aplicação crashar entre o SELECT e o INSERT. A exclusion constraint age no nível do banco, independente do estado da aplicação.

---

## 3. Outbox Pattern para notificações por e-mail

**Data:** 2026-04-17
**Status:** Adotado

### Decisão

Ao criar/editar/cancelar uma reserva, o sistema persiste um evento na tabela `outbox_events` **na mesma transação** da operação de negócio. Um worker Celery processa esses eventos de forma assíncrona.

### Garantias

- **Consistência:** Se o INSERT do booking falhar, o evento não é criado (rollback atômico). Impossível enviar e-mail de uma reserva que não existe.
- **Idempotência:** Cada evento tem um `idempotency_key` UUID único com constraint `UNIQUE` no banco. O worker verifica o status antes de processar.
- **Resiliência:** `FOR UPDATE SKIP LOCKED` permite múltiplos workers sem duplicação. Retry automático com `attempts` e `max_attempts`.

---

## 4. Validação de conflito por usuário (além do conflito por sala)

**Data:** 2026-04-19
**Status:** Adotado

### Contexto

A constraint de exclusão do PostgreSQL (`EXCLUDE USING gist`) garante que a mesma sala não seja reservada duas vezes no mesmo horário. Porém, um usuário poderia criar duas reservas em salas diferentes exatamente no mesmo slot, o que é incoerente (ele não pode estar em dois lugares ao mesmo tempo).

### Decisão

Antes de inserir cada ocorrência, o `BookingService` executa `repo.find_user_overlap(user_id, start_at, end_at)`. Se já existe uma reserva ativa do mesmo usuário no período, retorna HTTP 409 com mensagem descritiva incluindo o título da reserva conflitante e o horário:

```
"Você já possui uma reserva nesse horário (19/04/2026 10:00): 'Daily Standup'."
```

A verificação ocorre também para séries recorrentes — cada ocorrência é validada individualmente antes de inserir.

### Consequência

A constraint de banco protege conflitos de sala (concorrência); a validação em app protege conflitos de usuário (lógica de negócio). O erro 409 também é tratado no frontend com `extractApiError()`.

---

## 5. Dark mode via Tailwind `darkMode: "class"` + ThemeContext

**Data:** 2026-04-19
**Status:** Adotado

### Contexto

O sistema precisava de um tema escuro que abrangesse toda a SPA, incluindo o FullCalendar (que não aceita variantes `dark:` do Tailwind porque seu DOM é gerado em runtime).

### Decisão

- `tailwind.config.js`: `darkMode: "class"` — a classe `dark` no `<html>` ativa todas as variantes `dark:`.
- `ThemeContext.tsx`: `ThemeProvider` gerencia o estado do tema, aplica/remove a classe `dark` em `document.documentElement` via `useEffect`, e persiste em `sessionStorage`.
- `Sidebar.tsx`: botão toggle ☀️/🌙 no rodapé.
- FullCalendar: `.dark .fc-*` no `calendar.css` (plain CSS, não variantes Tailwind) cobre os elementos gerados em runtime pelo calendário.

### Alternativa descartada

`darkMode: "media"` (respeita `prefers-color-scheme` automaticamente) não permite toggle manual — descartado pois o requisito é o usuário controlar o tema.

---

## 6. `sessionStorage` em vez de `localStorage` para tokens e preferências

**Data:** 2026-04-19
**Status:** Adotado

### Decisão

Todos os dados persistidos no browser (`access_token`, `theme`, `calendarSettings`) usam `sessionStorage` em vez de `localStorage`.

### Motivação

- `sessionStorage` é isolado por aba — uma aba comprometida não expõe dados de outras.
- Dados são limpos quando a aba/janela é fechada, reduzindo a janela de exposição de tokens.
- Para tokens JWT curtos (15 min por padrão neste projeto), a diferença de segurança é marginal, mas adotar `sessionStorage` é a prática mais defensiva sem custo real de UX para uma aplicação corporativa interna.

### Consequência

O usuário precisará fazer login novamente ao abrir uma nova aba ou reiniciar o browser. Preferências de tema e configurações do calendário também são resetadas por sessão.

---

## 7. Cor customizável por reserva — campo `color` com flag `update_color`

**Data:** 2026-04-19
**Status:** Adotado

### Contexto

O calendário usa `hashColor(title)` para atribuir cor às reservas. O usuário pediu a possibilidade de escolher a cor manualmente no modal de edição.

### Decisão

- Nova coluna `color VARCHAR(20) NULLABLE` em `bookings` (migração `0004`).
- `BookingUpdate` inclui `color: str | None = None`.
- O repositório recebe o flag `update_color: bool = False` para distinguir "campo não enviado" (não alterar) de "enviado como null" (limpar cor → voltar ao hash automático). O `BookingService` passa `update_color = "color" in data.model_fields_set`.
- Frontend: color picker com 10 swatches predefinidos + opção "A" (automático = null), visível apenas no modo de edição. O `CalendarPage` usa `b.color ?? hashColor(b.title)`.

### Por que `update_color` e não sentinel

Um sentinel `object()` ou `UNSET` é mais Pythônico mas vaza detalhes de implementação entre camadas. O flag booleano é explícito e trivial de testar.

---

## 8. Mudança de cor não dispara notificação por e-mail

**Data:** 2026-04-19
**Status:** Adotado

### Decisão

No `BookingService.update()`, o evento de outbox (que resulta em e-mail para participantes) só é criado se pelo menos um campo relevante foi alterado:

```python
_NOTIFY_FIELDS = {"title", "start_at", "end_at", "participant_emails", "notes"}
if data.model_fields_set & _NOTIFY_FIELDS:
    await self.outbox.create(...)
```

Alterações exclusivas de `color` não disparam notificação. O mesmo vale para futuras atualizações que não impactem o participante (ex.: campos internos de UI).

---

## 9. Configurações do calendário persistidas em `sessionStorage`

**Data:** 2026-04-19
**Status:** Adotado

### Decisão

Um painel ⚙️ no `CalendarPage` permite ao usuário configurar:

| Configuração | Prop FullCalendar | Default |
|---|---|---|
| Início / Fim visível | `slotMinTime` / `slotMaxTime` | 06:00 / 22:00 |
| Tamanho do slot | `slotDuration` | 30 min |
| Horário comercial (início/fim) | `businessHours.startTime/endTime` | 08:00 / 18:00 |
| Máx. eventos por dia (visão mês) | `dayMaxEvents` | 3 |
| Mostrar finais de semana | `weekends` | true |

O objeto `calendarSettings` é serializado como JSON em `sessionStorage["calendarSettings"]` e restaurado na próxima montagem do componente.

---

## 10. Clean Architecture: separação domain / application / infrastructure

**Data:** 2026-04-17
**Status:** Adotado

### Estrutura

```
domain/          # Regras de negócio puras (sem framework)
  entities/      # Dataclasses: User, Room, Booking, OutboxEvent
  exceptions.py  # DomainError e subclasses
  validators.py  # Validações de data/duração

application/     # Casos de uso (orquestra domain + infrastructure)
  interfaces/    # ABCs dos repositórios
  services/      # AuthService, RoomService, BookingService
  schemas/       # DTOs Pydantic (request/response)

infrastructure/  # Implementações concretas
  database/      # SQLAlchemy models + session
  repositories/  # Implementações SQLAlchemy dos ABCs
  security/      # JWT + bcrypt
  email/         # SMTP sender (Fase 6)

api/             # Camada HTTP (FastAPI)
  routers/       # Endpoints
  dependencies.py # get_current_user, get_db
```

### Benefício principal

As regras de negócio (domain) não dependem de FastAPI, SQLAlchemy ou qualquer outro framework. São testáveis com pytest puro, sem banco de dados.
