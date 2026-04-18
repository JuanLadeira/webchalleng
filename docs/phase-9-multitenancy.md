# Fase 9 — Multitenancy

## Visão Geral

Transformar o sistema single-tenant em multi-tenant real. Cada inquilino (empresa/organização) terá seu próprio ambiente isolado: usuários, salas e reservas separados. Um super admin (dono da plataforma) gerencia os inquilinos.

---

## Arquitetura de Roles

```
SUPER_ADMIN  → sem tenant → gerencia todos os tenants via /superadmin
OWNER        → pertence a um tenant → gerencia salas e usuários do seu tenant
MEMBER       → pertence a um tenant → cria/edita/cancela reservas
```

---

## Backend

### Novo modelo `TenantModel`

```python
class TenantModel(Base):
    __tablename__ = "tenants"
    id: UUID
    name: str
    slug: str  # único, usado no registro
    is_active: bool = True
    created_at: datetime
```

### Mudanças nos modelos existentes

- `UserModel`: adicionar `tenant_id` FK nullable (super admin tem NULL)
- `RoomModel`: adicionar `tenant_id` FK not-null
- `BookingModel`: adicionar `tenant_id` para queries eficientes
- Constraint de unicidade de sala: `UNIQUE(name)` → `UNIQUE(name, tenant_id)`

### Enum de roles

```python
class UserRoleEnum(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    OWNER = "OWNER"
    MEMBER = "MEMBER"
```

### Nova migration: `0003_multitenancy.py`

- Criar tabela `tenants`
- Adicionar `tenant_id` FK nas tabelas `users`, `rooms`, `bookings`
- Atualizar constraint unique de `rooms.name`

### Dependências de autenticação

- `require_owner` — verifica `user.role in (OWNER, SUPER_ADMIN)`
- `require_superadmin` — verifica `user.role == SUPER_ADMIN`
- `get_tenant_id` — extrai `user.tenant_id`, lança 403 se super admin acessar rota de tenant

### Novos routers

**Super Admin** (`/superadmin/*`):
```
POST   /superadmin/tenants              → criar tenant
GET    /superadmin/tenants              → listar todos os tenants
PATCH  /superadmin/tenants/{id}         → ativar/desativar
POST   /superadmin/tenants/{id}/users   → criar primeiro admin do tenant
GET    /superadmin/tenants/{id}/users   → listar usuários do tenant
```

**Admin de Tenant** (`/admin/*`):
```
GET    /admin/users                     → listar usuários do meu tenant
PATCH  /admin/users/{id}/role           → promover/rebaixar
POST   /admin/users                     → criar usuário no tenant
```

### Isolamento por tenant nos repositories

Todos os métodos de lista/busca passam a receber e filtrar por `tenant_id`.

### Self-registration

`/auth/register` exige `tenant_slug` no payload — valida tenant ativo e cria usuário como `MEMBER`.

### Seed do super admin

`seed_admin.py`: super admin com `role=SUPER_ADMIN` e `tenant_id=None`.

---

## Frontend

### Sidebar

Item "Super Admin" visível apenas para `SUPER_ADMIN`.
Item "Admin" visível apenas para `OWNER`.

### Painel Super Admin (`/superadmin`)

- `TenantsPage` → `/superadmin/tenants`: listar, criar, ativar/desativar tenants
- `TenantDetailPage` → `/superadmin/tenants/:id`: ver e criar usuários do tenant

### Painel Admin de Tenant (`/admin`)

- `AdminUsersPage` → `/admin/users`: listar, criar, promover/rebaixar usuários
- `AdminRoomsPage` → `/admin/rooms`: ver todas as salas (ativas e inativas), ativar/desativar

### Proteção de rotas

- `OwnerRoute` — requer `OWNER` ou `SUPER_ADMIN`
- `SuperAdminRoute` — requer `SUPER_ADMIN`

### Register

Adicionar campo "Código da empresa" (tenant slug) ao formulário de registro.

---

## Arquivos Críticos

### Backend
| Arquivo | Ação |
|---|---|
| `app/infrastructure/database/models.py` | Adicionar TenantModel + tenant_id |
| `alembic/versions/0003_multitenancy.py` | Nova migration |
| `app/api/dependencies.py` | require_owner, require_superadmin |
| `app/api/routers/superadmin.py` | Novo |
| `app/api/routers/admin.py` | Novo |
| `app/api/routers/auth.py` | /register aceita tenant_slug |
| `app/infrastructure/repositories/sqlalchemy_room_repo.py` | Filtrar por tenant_id |
| `app/infrastructure/repositories/sqlalchemy_booking_repo.py` | Filtrar por tenant_id |
| `app/infrastructure/repositories/sqlalchemy_user_repo.py` | list_by_tenant |
| `app/application/services/room_service.py` | Passar tenant_id |
| `app/application/services/booking_service.py` | Validar tenant |
| `app/scripts/seed_admin.py` | role=SUPER_ADMIN, tenant_id=None |
| `app/main.py` | Incluir routers superadmin e admin |

### Frontend
| Arquivo | Ação |
|---|---|
| `src/components/OwnerRoute.tsx` | Novo |
| `src/components/SuperAdminRoute.tsx` | Novo |
| `src/pages/admin/AdminUsersPage.tsx` | Novo |
| `src/pages/admin/AdminRoomsPage.tsx` | Novo |
| `src/pages/superadmin/TenantsPage.tsx` | Novo |
| `src/pages/superadmin/TenantDetailPage.tsx` | Novo |
| `src/api/client.ts` | Adicionar adminApi, superAdminApi |
| `src/App.tsx` | Novas rotas |
| `src/pages/RegisterPage.tsx` | Campo tenant_slug |

---

## Verificação

1. Super admin loga → cria tenant "Acme" (slug: "acme")
2. Super admin cria primeiro OWNER para a Acme
3. OWNER da Acme loga → vê apenas salas/reservas da Acme
4. Usuário registra com slug "acme" → MEMBER da Acme
5. Usuário de outro tenant NÃO vê dados da Acme
6. `make test` verde, `npm test` verde
