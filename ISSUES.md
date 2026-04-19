# Issues & Backlog

Levantamento gerado por revisão de agentes de Design/UX e Frontend (2026-04-18).
Última atualização: 2026-04-19 — feature-dark-mode.

Legenda: ✅ resolvido | 🔲 backlog

---

## Crítico

### ✅ [UI-01] Labels sem `htmlFor`/`id` no RegisterPage
**Arquivo:** `frontend/src/pages/RegisterPage.tsx`
Nenhum dos três campos (Nome, E-mail, Senha) associava `<label>` ao `<input>`. Clicar no label não focava o campo.
**Fix aplicado (6c):** `htmlFor`/`id` adicionados em todos os pares label+input.

---

### ✅ [UI-02] Modal sem focus trap
**Arquivo:** `frontend/src/pages/CalendarPage.tsx` (DetailModal, BookingModal)
Quando o modal abre, o foco não é movido para dentro dele. Usuários de teclado continuam interagindo com o calendário por trás do overlay.
**Fix aplicado (6c):** `useFocusTrap` hook em `BookingModal` e `DetailModal` — foca o primeiro elemento ao abrir, cicla Tab/Shift+Tab dentro do container.

---

### ✅ [UI-03] Sidebar sem responsividade
**Arquivo:** `frontend/src/components/Layout.tsx`, `Sidebar.tsx`
`w-60` fixo. Em iPhone SE (375px), a sidebar ocupa 240px e o conteúdo fica com 135px — inutilizável.
**Fix aplicado (6c):** Layout.tsx com estado `open` — sidebar é drawer fixo no mobile com overlay escuro e botão `☰`. No desktop (≥ lg) permanece no flow normal.

---

### ✅ [UI-04] `window.confirm` no cancelamento de reserva
**Arquivo:** `frontend/src/pages/CalendarPage.tsx` (DetailModal)
`confirm()` bloqueava a thread, não aceita estilo, é suprimido em PWA/iframes.
**Fix aplicado (6c):** Substituído por estado `confirming` com botões inline "Voltar" / "Confirmar cancelamento".

---

### ✅ [FE-01] Sem `ErrorBoundary` na aplicação
**Arquivo:** `frontend/src/App.tsx`
Qualquer erro não tratado em qualquer página derruba toda a árvore React sem fallback.
**Fix sugerido:** Criar `components/ErrorBoundary.tsx` e envolver `<App>` ou as rotas principais.

---

## Alto

### 🔲 [UI-05] Sem validação client-side de datas no formulário
**Arquivo:** `frontend/src/components/BookingForm.tsx`
`end_at < start_at` só é validado no servidor (retorna 422). O campo `end_at` não tem `min` dinâmico.
**Fix sugerido:** Validar `end_at > start_at` no `onChange` e desabilitar o submit se inválido.

---

### ✅ [UI-06] 2 cliques para ver detalhe em MyBookingsPage
**Arquivo:** `frontend/src/pages/MyBookingsPage.tsx`
Para ver/cancelar uma reserva o usuário navega ao calendário e clica novamente.
**Fix sugerido:** Reutilizar `DetailModal` diretamente na `MyBookingsPage` com link "Ver no calendário" como ação secundária.

---

### ✅ [UI-07] Loading sem skeleton — layout shift visível
**Arquivo:** `MyBookingsPage.tsx`, `AdminRoomsPage.tsx`, `AdminUsersPage.tsx`
Texto `"Carregando..."` desaparece abruptamente quando dados chegam.
**Fix sugerido:** Componentes `Skeleton` com `animate-pulse` para cada seção.

---

### ✅ [UI-08] Toggle de role sem confirmação
**Arquivo:** `frontend/src/pages/admin/AdminUsersPage.tsx`
Um clique acidental promove ou rebaixa um usuário sem aviso.
**Fix sugerido:** Modal de confirmação com nome do usuário e mudança explícita, ou select de role com botão de salvar separado.

---

### ✅ [FE-02] `axios.isAxiosError` não usado — cast manual frágil
**Arquivo:** `frontend/src/components/BookingModal.tsx`
Cast manual `(err as { response? ... })` silenciava erros de rede.
**Fix aplicado (6c):** Substituído por `axios.isAxiosError(err)` com bloco else para erros inesperados.

---

### ✅ [FE-03] Interceptor 401 não limpa estado do `AuthContext`
**Arquivo:** `frontend/src/api/client.ts`
`window.location.href = "/login"` recarrega sem chamar `logout()`. O estado `user` fica obsoleto.
**Fix sugerido:** Disparar evento `auth:logout` via `window.dispatchEvent` e capturar no `AuthContext`.

---

### 🔲 [FE-04] Calendário exibe apenas reservas do próprio usuário
**Arquivo:** `frontend/src/pages/CalendarPage.tsx`
Outros usuários não sabem que um horário já está ocupado.
**Fix sugerido:** Buscar reservas de todas as salas e exibi-las com cor diferente.

---

## Médio

### ✅ [UI-09] Badge de role exibe string crua da API
**Arquivo:** `Sidebar.tsx`, `AdminUsersPage.tsx`
Usuário via `"SUPER_ADMIN"` com underscore.
**Fix aplicado (6c):** Mapeamento `ROLE_LABELS` — `OWNER → "Administrador"`, `MEMBER → "Membro"`, `SUPER_ADMIN → "Super Admin"`.

---

### 🔲 [UI-10] `setTimeout` de redirecionamento sem cleanup
**Arquivo:** `frontend/src/pages/BookingFormPage.tsx`
Nota: `BookingFormPage` agora redireciona para `/calendar` (rota `/bookings/new` foi substituída pelo modal). O `setTimeout` não é mais acessado no fluxo principal — issue irrelevante após 6c.

---

### ✅ [UI-11] Tabelas admin sem `overflow-x-auto`
**Arquivo:** `AdminRoomsPage.tsx`, `AdminUsersPage.tsx`
Em mobile, colunas transbordavam o viewport sem scroll horizontal.
**Fix aplicado (6c):** `<div className="overflow-x-auto">` + `min-w-[600px]` na tabela.

---

### ✅ [UI-12] Sem validação de e-mail client-side no campo de participantes
**Arquivo:** `frontend/src/components/BookingForm.tsx`
Campo `type="text"` aceitava qualquer string.
**Fix aplicado (6c):** Campo substituído por `EmailTagInput` — valida formato de e-mail on-Enter/blur com feedback inline.

---

### ✅ [UI-13] Contraste insuficiente em textos de suporte
**Arquivo:** Todos os arquivos — `text-gray-500` em `text-sm`
`text-gray-500` sobre `bg-white` tem contraste de 4.6:1 — abaixo do mínimo WCAG AA.
**Fix sugerido:** Substituir `text-gray-500` por `text-gray-600` em textos informativos de suporte.

---

### ✅ [FE-05] Sem `staleTime` global no QueryClient
**Arquivo:** `frontend/src/main.tsx`
Já havia `staleTime: 30_000` — issue não reproduzida, fechada.

---

### ✅ [FE-06] `events` do FullCalendar sem `useMemo`
**Arquivo:** `frontend/src/pages/CalendarPage.tsx`
O mapeamento rodava em todo re-render.
**Fix aplicado (6c):** `useMemo([bookings, highlightId, user?.id])`.

---

### ✅ [FE-07] `invalidate` recriada a cada render
**Arquivo:** `frontend/src/pages/CalendarPage.tsx`
**Fix aplicado (6c):** `useCallback([queryClient])`.

---

### ✅ [FE-08] `DetailModal` chama API diretamente — lógica acoplada à UI
**Arquivo:** `frontend/src/pages/CalendarPage.tsx`
`bookingsApi.cancel` é chamado dentro do componente de modal.
**Fix sugerido:** Extrair `useCancelBooking` hook com `useMutation`.

---

### ✅ [FE-09] `User.role` e `Booking.status` tipados como `string`
**Arquivo:** `frontend/src/api/client.ts`
Comparações sem garantia de tipo.
**Fix aplicado (6c):** `type BookingStatus = "active" | "cancelled"` e `type UserRole = "MEMBER" | "OWNER" | "SUPER_ADMIN"`.

---

## Baixo

### ✅ [UI-14] Ícones emoji sem `aria-hidden`
**Arquivo:** `Sidebar.tsx`, `MyBookingsPage.tsx`, `CalendarPage.tsx`
Emojis decorativos eram lidos por leitores de tela.
**Fix aplicado (6c):** `aria-hidden="true"` em todos os `<span>` de ícone emoji.

---

### ✅ [UI-15] `divide-gray-50` nas tabelas é invisível
**Arquivo:** `AdminRoomsPage.tsx`, `AdminUsersPage.tsx`
Linha divisória imperceptível.
**Fix aplicado (6c):** Substituído por `divide-gray-100`.

---

### ✅ [UI-16] Logo da sidebar sem identidade visual
**Arquivo:** `frontend/src/components/Sidebar.tsx`
`text-lg` para o nome é fraco como âncora visual.
**Fix sugerido:** Avatar com iniciais `"MR"` em `bg-blue-600` ao lado do nome.

---

### ✅ [FE-10] Rotas admin sem lazy loading
**Arquivo:** `frontend/src/App.tsx`
`AdminRoomsPage` e `AdminUsersPage` estão no bundle inicial mesmo para `MEMBER`.
**Fix sugerido:** `React.lazy` + `<Suspense>` nas rotas `/admin/*`.

---

### ✅ [FE-11] Bloco `<style>` do FullCalendar no render
**Arquivo:** `frontend/src/pages/CalendarPage.tsx`
CSS global re-injetado a cada render.
**Fix sugerido:** Mover para `src/styles/calendar.css` e importar uma vez.

---

### ✅ [FE-12] `useToast` sem contexto global
**Arquivo:** `CalendarPage.tsx`, `BookingFormPage.tsx`
Cada página tem estado de toast isolado.
**Fix sugerido:** Criar `ToastContext` prover via `<ToastProvider>` no topo da árvore.

---

## ✅ História: Temas Claro e Escuro

### ✅ [FEAT-01] Sistema de temas — modo claro e escuro
**Implementado em:** `feature-dark-mode` (2026-04-19)

**Critérios de aceitação:**
- ✅ Toggle de tema acessível na sidebar (botão ☀️/🌙 acima do perfil)
- ✅ Preferência salva em `sessionStorage` (decisão técnica: mais seguro que `localStorage`)
- ✅ Todas as páginas e componentes adaptados: sidebar, modais, tabelas, formulários, calendário
- ✅ FullCalendar com tema escuro via `.dark .fc-*` em `calendar.css` (plain CSS, pois FullCalendar gera DOM em runtime — variantes `dark:` do Tailwind não alcançam esses elementos)
- ✅ Espaçamento entre botões do toolbar do calendário
- ✅ Maior visibilidade das reservas na visão de mês (opacidade e peso da fonte)

**O que mudou na implementação:**
- `prefers-color-scheme` **não** foi adotado como fallback — o padrão inicial é sempre claro para consistência da experiência.
- Persistência via `sessionStorage` em vez de `localStorage` (mesma decisão aplicada ao token JWT e às configurações do calendário).

---

## ✅ História: Configurações do Calendário

### ✅ [FEAT-02] Painel de configurações do calendário
**Implementado em:** `feature-dark-mode` (2026-04-19)

Botão ⚙️ no header do `CalendarPage` abre painel com:
- Range de horas visíveis (`slotMinTime` / `slotMaxTime`)
- Tamanho do slot (15 min / 30 min / 1 h)
- Horário comercial (início e fim do destaque cinza)
- Máx. eventos por dia na visão mês
- Toggle para ocultar finais de semana

Configurações persistidas em `sessionStorage["calendarSettings"]`.

---

## ✅ História: Cor Customizada de Reserva

### ✅ [FEAT-03] Cor por reserva no calendário
**Implementado em:** `feature-dark-mode` (2026-04-19)

- Nova coluna `color VARCHAR(20)` (nullable) em `bookings` — migração `0004`.
- Color picker com 10 swatches predefinidos + opção "A" (automático) no modal de **edição**.
- Calendário usa `booking.color ?? hashColor(title)` — fallback mantém comportamento anterior.
- Alterar apenas a cor **não dispara e-mail** para os participantes (verificação via `model_fields_set`).
