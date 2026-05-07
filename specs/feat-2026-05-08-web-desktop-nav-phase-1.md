# SPEC: UX Phase 1 — Desktop Navigation Improvements (Web)

**Status:** `APPROVED`
**Tipo:** Feature (UX/Structural)
**Plataforma:** Web (React 18 + MUI 5)
**Prioridade:** P1+P2
**Autor:** Claude (web-frontend-dev agent)
**Data:** 2026-05-08
**Issue relacionada:** (a criar)

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-08 | Claude | Criação inicial (DRAFT) |

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

**Queixa direta do usuário:** "CreateGame não tem botão home ou X, só tem voltar."

Auditoria UX (4 agentes) convergiu em 6 problemas críticos divididos em P1 (experiência imediata) e P2 (estrutural):

**P1 — Falhas de navegação imediata:**
1. AppBar sem logo clicável e sem atalho "home" em telas detail/form
2. `navigate(-1)` quebra em deep-links (URL direta → back esvazia o histórico e leva pra fora do app)
3. Formulários sem botão X/close: `CreateGameScreen`, `CreateGroupScreen`, `GroupEditScreen`, `EditProfileScreen`, `InvitePlayersScreen`

**P2 — Déficit estrutural:**
4. Sidebar persistente (NavigationRail md / Drawer lg+) existe apenas em `HomeScreen`; telas detail e form usam `MobileShell` sem nav
5. Dirty guard usa `window.confirm` (modal nativo, não MUI) só em `CreateGameScreen`; ausente nos outros 4 formulários
6. Ausência de breadcrumbs em `GameDetailScreen` e `GroupDetailScreen`

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado Esperado |
|----|------|------|--------------------|
| UC-01 | Usuário | Acessa `/game/create` via URL direta (deep-link compartilhado) | Vê o form com X/close que leva para `/games`, não fica preso sem rota de saída |
| UC-02 | Usuário | Clica X/close em formulário com dados preenchidos | Dialog MUI de confirmação (não `window.confirm` nativo) antes de descartar |
| UC-03 | Usuário | Está em `GroupDetailScreen` em desktop (md+) | Sidebar persistente à esquerda continua visível, logo clicável no topo |
| UC-04 | Usuário | Usa navegação do browser (botão voltar) em tela de detalhe | Volta para a tela correta (lista), não sai do app |
| UC-05 | Usuário | Está em `GameDetailScreen` | Vê breadcrumb "Jogos / Nome do Jogo" e pode clicar para retornar à lista |
| UC-06 | Usuário | Acessa qualquer tela autenticada em desktop (lg+) | Drawer permanente com logo do app no topo, sempre visível |

### 1.3 Critérios de Aceite

**P1:**
- [ ] AC-01: Todo header de formulário (Create/Edit) tem ícone X ou ArrowBack + logo/título; X fecha e redireciona para `closeDestination` (nunca `navigate(-1)` sem fallback)
- [ ] AC-02: `closeDestination` é uma rota explícita (ex: `/games`, `/groups/:id`); se histórico tiver entrada anterior, usa `navigate(-1)`, senão usa a rota explícita
- [ ] AC-03: Logo "Futeba dos Parças" em toda AppBar clica e navega para `/`
- [ ] AC-04: Dirty guard implementado com `useBlocker` (React Router 6) + Dialog MUI em todos os 5 formulários

**P2:**
- [ ] AC-05: `AppLayout` envolve todas as rotas autenticadas, exibindo sidebar persistente em md+ independente da rota
- [ ] AC-06: `AppBreadcrumbs` exibido em `GameDetailScreen` e `GroupDetailScreen` em md+ (oculto em xs/sm)
- [ ] AC-07: `FormScaffold` padroniza header (X + logo), body (scroll) e footer (Cancel/Save) dos 5 formulários
- [ ] AC-08: `MobileShell` em App.tsx não é mais necessário para prover contexto visual de nav — `AppLayout` assume esse papel em md+

### 1.4 Fora de Escopo (P3 — viram issues separadas)

- Animações de transição entre rotas
- Drawer collapsível via gesto em tablet
- Onboarding tooltips de navegação
- Telas de ranking, settings, locations (não têm formulário nem detail crítico)
- Redesign do BottomNavigation mobile (xs/sm permanece como está)

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
[URL direta /game/create]
        ↓
  AppLayout renderiza
        ↓
   Sidebar visível (md+)
        ↓
  FormScaffold (CreateGame)
   [X] → closeDestination=/games
   [Logo] → /
        ↓
  Usuário edita campos
  isDirty = true
        ↓
  Clica [X] ou browser back
        ↓
  useBlocker intercepta
        ↓
  Dialog MUI "Descartar alterações?"
  [Continuar editando] | [Descartar]
        ↓
  Descartar → navigate(closeDestination)
```

### 2.2 Mockups ASCII

#### `AppLayout` — estrutura global (md+)

```
┌──────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────────────────────────────────────────┐│
│ │          │ │                                              ││
│ │  [Logo]  │ │         <Outlet /> — conteúdo da rota       ││
│ │  ──────  │ │                                              ││
│ │  Início  │ │  (AppBar own, FormScaffold, etc.)            ││
│ │  Jogos   │ │                                              ││
│ │  Grupos  │ │                                              ││
│ │  Liga    │ │                                              ││
│ │  Perfil  │ │                                              ││
│ │          │ │                                              ││
│ │ [80px]   │ │                                              ││
│ │ md=icon  │ │                                              ││
│ │ lg=full  │ │                                              ││
│ └──────────┘ └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
                        (md: 800px total)

Em xs/sm: sidebar oculta (layout mobile existente inalterado)
```

#### `FormScaffold` — header de formulário

```
┌──────────────────────────────────────────────────────────────┐
│ [X]  [Logo Futeba dos Parças]           Criar Jogo           │  ← AppBar
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  <children> — campos do formulário com scroll               │
│                                                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│             [Cancelar]          [Salvar / Próximo]           │  ← footer fixo
└──────────────────────────────────────────────────────────────┘
```

Variante "detail" (back ao invés de X, sem footer):
```
┌──────────────────────────────────────────────────────────────┐
│ [←]  [Logo]         Nome do Jogo                            │
│      Jogos / Nome do Jogo                    (breadcrumb)   │
└──────────────────────────────────────────────────────────────┘
```

#### `AppBreadcrumbs` — telas de detalhe (md+)

```
Jogos  /  Pelada de Quinta — 08/05            (em GameDetailScreen)
Grupos /  Parças da Várzea                    (em GroupDetailScreen)
```

#### Dialog de dirty guard (MUI)

```
┌──────────────────────────────────┐
│  Descartar alterações?           │
│                                  │
│  Você tem alterações não salvas. │
│  Se sair agora, elas serão       │
│  perdidas.                       │
│                                  │
│  [Continuar editando]  [Descartar]│
└──────────────────────────────────┘
```

### 2.3 Responsividade

| Breakpoint | Sidebar | AppBar | Breadcrumbs | Dirty Dialog |
|------------|---------|--------|-------------|--------------|
| xs (< 600px) | oculta | X + título | oculto | sim |
| sm (600–900px) | oculta | X + título | oculto | sim |
| md (900–1200px) | NavigationRail 80px (ícone) | X + logo + título | sim | sim |
| lg+ (≥ 1200px) | Drawer 240px (ícone + label) | X + logo + título | sim | sim |

### 2.4 Acessibilidade

- Logo: `aria-label="Ir para página inicial"`
- X/close: `aria-label="Fechar formulário"`
- Sidebar `<nav>` com `aria-label="Navegação principal"`
- Breadcrumbs: elemento `<nav aria-label="Localização">` com `<ol>`
- Dialog de dirty guard: foco gerenciado pelo MUI Dialog (já acessível)
- Touch targets mínimos: 48×48px (IconButton padrão MUI)

### 2.5 Micro-interações

- Sidebar: highlight do item ativo via `selected` prop (cor `primary.main`)
- X/close: ripple padrão MUI
- Breadcrumbs: underline on hover nos links
- Dirty dialog: anima com `TransitionComponent` padrão MUI Dialog

---

## 3. Technical Design

### 3.1 Arquitetura

```
web/src/
├── components/
│   └── layout/                          ← NOVO diretório
│       ├── AppLayout.tsx                ← NOVO: sidebar global + outlet
│       ├── AppSidebar.tsx               ← NOVO: extraído/adaptado do HomeScreen
│       ├── FormScaffold.tsx             ← NOVO: header/footer padronizado
│       ├── AppBreadcrumbs.tsx           ← NOVO: breadcrumbs para detail screens
│       └── index.ts                     ← NOVO: barrel export
├── hooks/
│   └── useDirtyGuard.ts                ← NOVO: useBlocker wrapper + Dialog state
└── App.tsx                              ← MODIFICADO: plug AppLayout nas rotas auth
```

### 3.2 Componentes — props e responsabilidades

#### `AppLayout`

```tsx
// Envolve todas as rotas autenticadas.
// Renderiza sidebar (md+) + <Outlet />.
// Em xs/sm: sem sidebar, só <Outlet />.

interface AppLayoutProps {
  // sem props — usa useLocation internamente para active item
}

// Uso em App.tsx:
<Route element={<AppLayout />}>
  <Route path="/" element={<HomeScreen />} />
  <Route path="/games" element={<GamesScreen />} />
  <Route path="/game/:gameId" element={<GameDetailScreen />} />
  ...
</Route>

// HomeScreen: sidebar própria removida; passa a herdar a do AppLayout.
// Mas HomeScreen ainda controla as 5 abas internamente (tab=0..4) via <Outlet> aninhado.
// Alternativa: manter HomeScreen com sidebar própria e excluí-la do AppLayout wrapper
//   → decisão recomendada: HomeScreen fica FORA do AppLayout (já tem sidebar perfeita)
//   → AppLayout cobre: /game/*, /group/*, /profile/*, /settings/*, etc.
```

#### `AppSidebar`

```tsx
// Extraído de HomeScreen. Sem dependência de tab index.
// Navegação entre rotas (não tabs).

interface AppSidebarProps {
  variant: 'rail' | 'drawer';  // rail=md, drawer=lg+
}

const NAV_ITEMS = [
  { icon: <HomeIcon />, label: 'Início', route: '/' },
  { icon: <SportsSoccer />, label: 'Jogos', route: '/games' },
  { icon: <Groups />, label: 'Grupos', route: '/groups' },
  { icon: <EmojiEvents />, label: 'Liga', route: '/?tab=3' },
  { icon: <Person />, label: 'Perfil', route: '/?tab=4' },
];
// Active: pathname.startsWith(item.route) ou exact match para '/'
```

#### `FormScaffold`

```tsx
interface FormScaffoldProps {
  title: string;
  closeDestination: string;         // rota fallback quando histórico vazio
  isDirty?: boolean;                // ativa dirty guard
  onClose?: () => void;             // callback extra (ex: reset form)
  children: React.ReactNode;
  footer?: React.ReactNode;         // botões Cancel/Save — opcional
  showBreadcrumbs?: boolean;        // false para create forms, true para edit
  breadcrumbItems?: BreadcrumbItem[]; // se showBreadcrumbs=true
}

// Internamente usa useDirtyGuard(isDirty, closeDestination)
// Header: IconButton Close/Back + Logo (clicável → '/') + Typography title
// Body: Box com overflow-y: auto, flex: 1
// Footer: Box sticky-bottom com os botões passados via prop
```

#### `AppBreadcrumbs`

```tsx
interface BreadcrumbItem {
  label: string;
  href?: string;  // undefined = item corrente (não clicável)
}

interface AppBreadcrumbsProps {
  items: BreadcrumbItem[];
}

// Exibe apenas em md+ (sx={{ display: { xs: 'none', md: 'block' } }})
// Usa MUI <Breadcrumbs> com <Link> (react-router) e <Typography>
// Separador: '/'
```

#### `useDirtyGuard` hook

```tsx
// Centraliza lógica de dirty guard usando React Router 6 useBlocker.

interface UseDirtyGuardReturn {
  dialogOpen: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
}

function useDirtyGuard(
  isDirty: boolean,
  closeDestination: string
): UseDirtyGuardReturn {
  const navigate = useNavigate();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  const confirmLeave = () => {
    blocker.proceed?.();
  };

  const cancelLeave = () => {
    blocker.reset?.();
  };

  return {
    dialogOpen: blocker.state === 'blocked',
    confirmLeave,
    cancelLeave,
  };
}
```

#### `closeDestination` pattern — fallback seguro

```tsx
// Substitui navigate(-1) cego.
// Utilitário para usar em form screens:

function useSmartBack(fallback: string) {
  const navigate = useNavigate();
  return () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  };
}
```

### 3.3 Arquivos Afetados

| Arquivo | Ação | Motivo |
|---------|------|--------|
| `web/src/App.tsx` | Modificar | Plug `<AppLayout />` como Route wrapper para rotas autenticadas (exceto `/` HomeScreen e auth) |
| `web/src/components/layout/AppLayout.tsx` | Criar | Layout global sidebar md+ |
| `web/src/components/layout/AppSidebar.tsx` | Criar | Sidebar extraída/adaptada do HomeScreen |
| `web/src/components/layout/FormScaffold.tsx` | Criar | Header/footer padronizado para forms |
| `web/src/components/layout/AppBreadcrumbs.tsx` | Criar | Breadcrumbs para telas detail |
| `web/src/components/layout/index.ts` | Criar | Barrel export |
| `web/src/hooks/useDirtyGuard.ts` | Criar | useBlocker wrapper + dialog state |
| `web/src/pages/game/CreateGameScreen.tsx` | Modificar | Trocar header ad-hoc + `window.confirm` por `<FormScaffold>` + `useDirtyGuard` |
| `web/src/pages/group/CreateGroupScreen.tsx` | Modificar | Trocar `navigate(-1)` por `<FormScaffold closeDestination="/groups">` |
| `web/src/pages/group/GroupEditScreen.tsx` | Modificar | Trocar `navigate(-1)` por `<FormScaffold closeDestination={/group/${groupId}}>` + dirty guard |
| `web/src/pages/profile/EditProfileScreen.tsx` | Modificar | Trocar `navigate(-1)` por `<FormScaffold closeDestination="/profile">` + dirty guard |
| `web/src/pages/groups/InvitePlayersScreen.tsx` | Modificar | Trocar `navigate(-1)` por `<FormScaffold closeDestination={/group/${groupId}}>` |
| `web/src/pages/game/GameDetailScreen.tsx` | Modificar | Adicionar `<AppBreadcrumbs>` |
| `web/src/pages/group/GroupDetailScreen.tsx` | Modificar | Adicionar `<AppBreadcrumbs>` |
| `web/src/pages/home/HomeScreen.tsx` | Avaliar | Sidebar própria pode coexistir ou ser substituída por AppSidebar — ver task T-02 |

### 3.4 Decisão de Escopo do AppLayout

**Problema:** `HomeScreen` já tem sidebar correta (tabs 0-4). Se `AppLayout` envolver HomeScreen, haverá duas sidebars sobrepostas.

**Solução recomendada:** `AppLayout` envolve apenas rotas de "detalhe e formulário":

```tsx
// App.tsx — estrutura de rotas
<Route path="/" element={<ProtectedRoute><HomeScreen /></ProtectedRoute>} />
{/* AppLayout wrapper para telas sem sidebar própria */}
<Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
  <Route path="/game/:gameId" element={<GameDetailScreen />} />
  <Route path="/game/create" element={<CreateGameScreen />} />
  <Route path="/group/:groupId" element={<GroupDetailScreen />} />
  <Route path="/group/create" element={<CreateGroupScreen />} />
  <Route path="/group/:groupId/edit" element={<GroupEditScreen />} />
  <Route path="/profile/edit" element={<EditProfileScreen />} />
  <Route path="/group/:groupId/players/invite" element={<InvitePlayersScreen />} />
  {/* ... outras telas detail */}
</Route>
```

`HomeScreen` fica fora do `AppLayout` e mantém sua sidebar de tabs.

### 3.5 Backward Compatibility

- Rotas existentes não mudam (apenas o wrapper muda)
- `navigate(-1)` legado em telas fora do escopo (settings, stats, etc.) não é alterado nesta phase
- `MobileShell` em App.tsx permanece (garante max-width e shadow box)
- `HomeScreen` sidebar própria permanece intacta

### 3.6 Performance

- `AppSidebar` nunca re-renderiza ao mudar conteúdo da rota (estado isolado)
- `AppLayout` usa `<Outlet />` (React Router), sem prop drilling
- `useDirtyGuard` só ativa `useBlocker` quando `isDirty=true` (sem custo em tela limpa)

---

## 4. Tasks (Breakdown)

| ID | Tarefa | Estimativa | Dependências |
|----|--------|------------|--------------|
| T-01 | Criar `web/src/components/layout/` com `index.ts` barrel | 15min | — |
| T-02 | Extrair `AppSidebar` do `HomeScreen` (sem quebrar HomeScreen) | 45min | T-01 |
| T-03 | Criar `AppLayout` usando `AppSidebar` + `<Outlet />` | 30min | T-02 |
| T-04 | Criar `useDirtyGuard` hook com `useBlocker` + dialog state | 30min | — |
| T-05 | Criar `FormScaffold` (header X/logo/title + body + footer) | 45min | T-01, T-04 |
| T-06 | Criar `AppBreadcrumbs` (MUI Breadcrumbs + display md+) | 20min | T-01 |
| T-07 | Plugar `AppLayout` em App.tsx nas rotas detail/form | 30min | T-03 |
| T-08 | Migrar `CreateGameScreen` → `FormScaffold` + `useDirtyGuard` | 45min | T-05 |
| T-09 | Migrar `CreateGroupScreen` → `FormScaffold` | 30min | T-05 |
| T-10 | Migrar `GroupEditScreen` → `FormScaffold` + `useDirtyGuard` | 30min | T-05 |
| T-11 | Migrar `EditProfileScreen` → `FormScaffold` + `useDirtyGuard` | 30min | T-05 |
| T-12 | Migrar `InvitePlayersScreen` → `FormScaffold` | 20min | T-05 |
| T-13 | Adicionar `AppBreadcrumbs` em `GameDetailScreen` | 20min | T-06 |
| T-14 | Adicionar `AppBreadcrumbs` em `GroupDetailScreen` | 20min | T-06 |
| T-15 | Build check + lint + smoke test visual (ver seção 5) | 30min | T-07..T-14 |

**Estimativa total:** ~7h de implementação.

**Ordem sugerida:** T-01 → T-02 → T-03+T-04 (paralelo) → T-05 → T-06+T-07 (paralelo) → T-08..T-12 (paralelo por tela) → T-13+T-14 → T-15

---

## 5. Verification (Verificação)

### 5.1 Testes Visuais por Breakpoint

Para cada tela abaixo, verificar nos breakpoints 375px / 768px / 1024px / 1440px:

| Tela | 375px | 768px | 1024px | 1440px |
|------|-------|-------|--------|--------|
| `/game/create` | sem sidebar, tem X | sem sidebar, tem X | rail + X + logo | drawer + X + logo |
| `/game/:id` | sem sidebar, tem ← | sem sidebar, tem ← | rail + ← + breadcrumb | drawer + ← + breadcrumb |
| `/group/:id/edit` | sem sidebar, tem X | sem sidebar, tem X | rail + X + logo | drawer + X + logo |
| `/profile/edit` | sem sidebar, tem X | sem sidebar, tem X | rail + X + logo | drawer + X + logo |
| `/` (HomeScreen) | bottom nav | rail próprio HomeScreen | rail próprio | drawer próprio |

### 5.2 Teste de Deep-Link

```
1. Limpar histórico do browser (aba anônima)
2. Navegar diretamente para /game/create
3. Preencher qualquer campo
4. Clicar X (ou botão Cancelar)
5. Esperado: dialog dirty guard → Descartar → redireciona para /games
6. NÃO esperado: sair do app / página em branco / erro de navegação
```

### 5.3 Teste de Dirty Guard

```
1. Abrir /group/{id}/edit
2. Alterar qualquer campo (isDirty = true)
3. Clicar no logo (→ /)
   Esperado: Dialog "Descartar alterações?" com [Continuar editando] e [Descartar]
4. Clicar [Continuar editando] → dialog fecha, permanece no form
5. Clicar [Descartar] → navega para /
6. Repetir com: botão X, botão Cancelar, botão browser back, link da sidebar
```

### 5.4 Checklist de Build

- [ ] `cd web && npm run build` sem erros TypeScript
- [ ] `npm run lint` sem warnings
- [ ] `navigate(-1)` não aparece em nenhum dos 5 formulários migrados (grep)
- [ ] `window.confirm` não aparece em nenhum arquivo web/src (grep)
- [ ] Sidebar ativa destaca item correto em `/game/:id` (ícone Jogos) e `/group/:id` (ícone Grupos)

### 5.5 Testes Automatizados (opcionais nesta phase)

- Vitest: `useDirtyGuard` — testar estados `dialogOpen`, `confirmLeave`, `cancelLeave`
- Playwright (smoke): navegar para `/game/create` em viewport 1440×900, verificar sidebar visível

---

## 6. Notas e Referências

- **Código a reutilizar:** `HomeScreen.tsx` linhas 37–182 — sidebar implementação (RAIL_WIDTH=80, DRAWER_WIDTH=240)
- **Código a eliminar:** `window.confirm` em `CreateGameScreen.tsx:258`
- **`useBlocker` docs:** React Router 6.17+ — `import { useBlocker } from 'react-router-dom'`
- **MUI Breadcrumbs:** `import { Breadcrumbs } from '@mui/material'`
- **Decisão de escopo:** `HomeScreen` fora do `AppLayout` wrapper (sidebar própria de tabs)
- **Decisão registrada em:** `/specs/DECISIONS.md` (a adicionar após aprovação)
- **P3 issues a criar:** animações de transição, drawer gesture, remaining screens nav(-1)
