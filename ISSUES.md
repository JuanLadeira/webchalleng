# Issues & Backlog

Levantamento gerado por revisão de agentes de Design/UX e Frontend (2026-04-18).

---

## Crítico

### [UI-01] Labels sem `htmlFor`/`id` no RegisterPage
**Arquivo:** `frontend/src/pages/RegisterPage.tsx:37-56`
Nenhum dos três campos (Nome, E-mail, Senha) associa `<label>` ao `<input>` via `htmlFor`/`id`. Clicar no label não foca o campo. Leitores de tela não anunciam o label corretamente.
**Fix:** Adicionar `htmlFor="name"` / `id="name"` em cada par label+input.

---

### [UI-02] Modal sem focus trap
**Arquivo:** `frontend/src/pages/CalendarPage.tsx:77–159` (DetailModal)
Quando o modal abre, o foco não é movido para dentro dele. Usuários de teclado continuam interagindo com o calendário por trás do overlay. Tab pode sair do modal sem fechar.
**Fix:** `autoFocus` no botão de fechar + ciclo de Tab/Shift+Tab dentro do modal, ou usar `focus-trap-react`.

---

### [UI-03] Sidebar sem responsividade
**Arquivo:** `frontend/src/components/Layout.tsx:6-9`, `Sidebar.tsx:39`
`w-60` fixo. Em iPhone SE (375px), a sidebar ocupa 240px e o conteúdo fica com 135px — inutilizável. Não há breakpoint de colapso, drawer ou hamburguer.
**Fix:** Sidebar vira drawer em mobile com overlay + botão `☰` no topo do `<main>`.

---

### [UI-04] `window.confirm` no cancelamento de reserva
**Arquivo:** `frontend/src/pages/CalendarPage.tsx:58-59`
`confirm()` bloqueia a thread, não aceita estilo, é suprimido em PWA/iframes e é inconsistente com o design do restante da aplicação.
**Fix:** Substituir por estado `confirming` dentro do `DetailModal` com dois botões inline (Voltar / Confirmar cancelamento).

---

### [FE-01] Sem `ErrorBoundary` na aplicação
**Arquivo:** `frontend/src/App.tsx`
Qualquer erro não tratado em qualquer página derruba toda a árvore React sem fallback.
**Fix:** Criar `components/ErrorBoundary.tsx` e envolver `<App>` ou as rotas principais.

---

## Alto

### [UI-05] Sem validação client-side de datas no formulário
**Arquivo:** `frontend/src/components/BookingForm.tsx:88-95`
`end_at < start_at` só é validado no servidor (retorna 422). O campo `end_at` não tem `min` dinâmico.
**Fix:** Validar `end_at > start_at` no `onChange` e desabilitar o submit se inválido.

---

### [UI-06] 2 cliques para ver detalhe em MyBookingsPage
**Arquivo:** `frontend/src/pages/MyBookingsPage.tsx:83-85`
Para ver/cancelar uma reserva o usuário precisa: clicar → ser redirecionado ao calendário → localizar o evento → clicar novamente para abrir o modal.
**Fix:** Reutilizar `DetailModal` diretamente na `MyBookingsPage`. Manter link "Ver no calendário" dentro do modal como ação secundária.

---

### [UI-07] Loading sem skeleton — layout shift visível
**Arquivo:** `MyBookingsPage.tsx:104`, `AdminRoomsPage.tsx:47`, `AdminUsersPage.tsx:37`
Texto `"Carregando..."` desaparece abruptamente quando dados chegam.
**Fix:** Adicionar componentes `Skeleton` com `animate-pulse` para cada seção.

---

### [UI-08] Toggle de role sem confirmação
**Arquivo:** `frontend/src/pages/admin/AdminUsersPage.tsx:84-85`
Um clique acidental promove ou rebaixa um usuário sem aviso. O rótulo `"→ Owner"` não comunica claramente a ação.
**Fix:** Substituir por modal de confirmação com nome do usuário e mudança explícita, ou select de role com botão de salvar separado.

---

### [FE-02] `axios.isAxiosError` não usado — cast manual frágil
**Arquivo:** `frontend/src/pages/BookingFormPage.tsx:41`
`(err as { response?: { status?: number } })` é frágil. Se o erro for de rede (sem `.response`), silencia o problema real.
**Fix:** Usar `import axios from "axios"; if (axios.isAxiosError(err)) { ... }`.

---

### [FE-03] Interceptor 401 não limpa estado do `AuthContext`
**Arquivo:** `frontend/src/api/client.ts:18-21`
`window.location.href = "/login"` recarrega a página sem chamar `logout()`. O estado `user` fica obsoleto até o reload.
**Fix:** Disparar evento `auth:logout` via `window.dispatchEvent` e capturar no `AuthContext` para chamar `setUser(null)` antes de redirecionar.

---

### [FE-04] Calendário exibe apenas reservas do próprio usuário
**Arquivo:** `frontend/src/pages/CalendarPage.tsx:194`
O endpoint `GET /rooms/{id}/bookings` existe mas nunca é usado. Outros usuários não sabem que um horário já está ocupado.
**Fix:** Buscar reservas de todas as salas com `Promise.all` e exibi-las no calendário (com cor diferente para reservas de terceiros).

---

## Médio

### [UI-09] Badge de role exibe string crua da API
**Arquivo:** `Sidebar.tsx:73`, `AdminUsersPage.tsx:58-65`
Usuário vê `"SUPER_ADMIN"` com underscore, em caixa alta. Parece debug output.
**Fix:** Mapear para labels legíveis: `OWNER → "Administrador"`, `MEMBER → "Membro"`, `SUPER_ADMIN → "Super Admin"`.

---

### [UI-10] `setTimeout` de redirecionamento sem cleanup
**Arquivo:** `frontend/src/pages/BookingFormPage.tsx:39`
`setTimeout(() => navigate("/calendar"), 1200)` pode disparar após o componente ser desmontado. 1200ms não está sincronizado com a duração do Toast (4000ms).
**Fix:** Limpar o timer no cleanup do `useEffect`, ou navegar imediatamente e exibir o toast na `CalendarPage`.

---

### [UI-11] Tabelas admin sem `overflow-x-auto`
**Arquivo:** `AdminRoomsPage.tsx:51`, `AdminUsersPage.tsx:41`
Em mobile, colunas transbordam o viewport sem scroll horizontal.
**Fix:** Envolver `<table>` em `<div className="overflow-x-auto">` com `min-w-[600px]` na tabela.

---

### [UI-12] Sem validação de e-mail client-side no campo de participantes
**Arquivo:** `frontend/src/components/BookingForm.tsx:141-148`
Campo `type="text"` aceita qualquer string. E-mail inválido só é descoberto via resposta 422 da API.
**Fix:** Validar no `onBlur` com regex simples. Exibir erro inline antes do submit.

---

### [UI-13] Contraste insuficiente em textos de suporte
**Arquivo:** Todos os arquivos — `text-gray-500` em `text-sm`
`text-gray-500` sobre `bg-white` tem contraste de 4.6:1 — abaixo do mínimo WCAG AA de 4.5:1 para texto pequeno.
**Fix:** Substituir `text-gray-500` por `text-gray-600` em textos informativos de suporte.

---

### [FE-05] Sem `staleTime` global no QueryClient
**Arquivo:** `frontend/src/main.tsx`
Sem `staleTime`, React Query refetch imediatamente em toda troca de aba/foco, gerando requests desnecessários.
**Fix:** Configurar `defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } }` no `QueryClient`.

---

### [FE-06] `events` do FullCalendar sem `useMemo`
**Arquivo:** `frontend/src/pages/CalendarPage.tsx:215-229`
O mapeamento `bookings.map(...)` roda em todo re-render (mudança de `selected`, `toast`, `searchParams`).
**Fix:** Envolver com `useMemo([bookings, highlightId])`.

---

### [FE-07] `invalidate` recriada a cada render
**Arquivo:** `frontend/src/pages/CalendarPage.tsx:251-253`
Função `invalidate` é recriada em todo re-render sem `useCallback`.
**Fix:** `const invalidate = useCallback(() => queryClient.invalidateQueries(...), [queryClient])`.

---

### [FE-08] `DetailModal` chama API diretamente — lógica acoplada à UI
**Arquivo:** `frontend/src/pages/CalendarPage.tsx:57-67`
`bookingsApi.cancel` é chamado dentro do componente de modal. Dificulta teste unitário e duplica lógica já presente em `MyBookingsPage`.
**Fix:** Extrair `useCancelBooking` hook com `useMutation`.

---

### [FE-09] `User.role` e `Booking.status` tipados como `string`
**Arquivo:** `frontend/src/api/client.ts:48, 55`
Comparações como `=== "active"` e `=== "OWNER"` sem garantia de tipo.
**Fix:** Definir `type BookingStatus = "active" | "cancelled"` e `type UserRole = "USER" | "OWNER" | "SUPER_ADMIN"`.

---

## Baixo

### [UI-14] Ícones emoji sem `aria-hidden`
**Arquivo:** `Sidebar.tsx:22`, `MyBookingsPage.tsx:47`, `CalendarPage.tsx:106`
Emojis decorativos são lidos verbosamente por leitores de tela (`"Tear-off calendar"`, `"Door"`).
**Fix:** Adicionar `aria-hidden="true"` em todos os `<span>` de ícone emoji.

---

### [UI-15] `divide-gray-50` nas tabelas é invisível
**Arquivo:** `AdminRoomsPage.tsx:61`, `AdminUsersPage.tsx:51`
`gray-50` sobre branco tem contraste de ~1.04:1 — linha divisória imperceptível.
**Fix:** Substituir por `divide-gray-100`.

---

### [UI-16] Logo da sidebar sem identidade visual
**Arquivo:** `frontend/src/components/Sidebar.tsx:42-44`
`text-lg` para o nome da aplicação é fraco como âncora visual.
**Fix:** Adicionar avatar com iniciais `"MR"` em `bg-blue-600` ao lado do nome.

---

### [FE-10] Rotas admin sem lazy loading
**Arquivo:** `frontend/src/App.tsx`
`AdminRoomsPage` e `AdminUsersPage` estão no bundle inicial, mesmo para usuários `MEMBER`.
**Fix:** Usar `React.lazy` + `<Suspense>` nas rotas `/admin/*`.

---

### [FE-11] Bloco `<style>` do FullCalendar no render
**Arquivo:** `frontend/src/pages/CalendarPage.tsx:325-376`
CSS global re-injetado a cada render do componente.
**Fix:** Mover para `src/styles/calendar.css` e importar uma vez.

---

### [FE-12] `useToast` sem contexto global
**Arquivo:** `CalendarPage.tsx:183`, `BookingFormPage.tsx:14`
Cada página tem estado de toast isolado. Impossível disparar toast de fora do componente (ex.: do interceptor).
**Fix:** Criar `ToastContext` e prover via `<ToastProvider>` no topo da árvore.

---

## História: Temas Claro e Escuro

### [FEAT-01] Sistema de temas — modo claro e escuro

**Descrição:**
Implementar suporte a tema claro (padrão atual) e tema escuro, com persistência da preferência do usuário e respeito à configuração do sistema operacional (`prefers-color-scheme`).

**Critérios de aceitação:**
- Toggle de tema acessível na sidebar (próximo ao perfil do usuário)
- Preferência salva em `localStorage` para persistir entre sessões
- Respeita `prefers-color-scheme: dark` do SO como valor inicial (se não houver preferência salva)
- Todas as páginas e componentes adaptados: sidebar, modais, tabelas, formulários, calendário, toasts
- FullCalendar com tema escuro (variáveis CSS `--fc-*` sobrescritas)
- Transição suave entre temas (`transition-colors duration-200`)

**Abordagem técnica sugerida:**
- Usar a estratégia `class` do Tailwind (`darkMode: "class"` em `tailwind.config.js`)
- Adicionar/remover a classe `dark` no `<html>` via `ThemeContext`
- Criar `useTheme` hook: `{ theme, toggleTheme }` com `localStorage` sync
- Prefixar as classes sensíveis com `dark:` (ex.: `bg-white dark:bg-gray-900`, `text-gray-900 dark:text-gray-100`)

**Escopo de trabalho estimado:**
- `tailwind.config.js` — habilitar modo `class`
- `src/contexts/ThemeContext.tsx` — novo contexto + hook
- `src/components/Sidebar.tsx` — botão toggle + prefixos `dark:`
- `src/components/Layout.tsx` — prefixos `dark:`
- `src/pages/*` — prefixos `dark:` em todas as páginas
- `src/components/BookingForm.tsx`, `Toast.tsx` — prefixos `dark:`
- `src/styles/calendar.css` — variáveis `--fc-*` para o tema escuro

**Referência:** [Tailwind Dark Mode docs](https://tailwindcss.com/docs/dark-mode)
