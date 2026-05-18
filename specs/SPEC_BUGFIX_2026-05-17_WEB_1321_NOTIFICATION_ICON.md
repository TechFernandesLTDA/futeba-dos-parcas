# BUGFIX: Ícone de notificações com posicionamento inconsistente entre telas no web app mobile

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Autor:** Claude (web-frontend-dev)
> **Data:** 2026-05-17
> **Issue:** #1321
> **PR:** (a ser preenchido)

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

O ícone de notificações (sino) é renderizado de **duas formas distintas** dependendo da tela:

- **HomeScreen**: sino renderizado dentro de um `<AppBar position="sticky">` no topo da tela — âncora no fluxo normal do DOM, sem sobreposição.
- **Todas as outras telas** (e.g. Games Detail, Group Detail, Settings, Statistics): sino renderizado pelo `MobileShell` em `App.tsx` como `position: fixed, top: 56, right: 8, zIndex: 1100` — flutua sobre o conteúdo, sem relação com o layout de cada tela.

Adicionalmente, em `HomeScreen.tsx` linha 262-264, o `<NotificationBell>` (que internamente já é um `<IconButton>`) está aninhado dentro de outro `<IconButton>`, criando botões interativos aninhados no DOM — comportamento inválido em HTML + conflito de `onClick` (o `handleTabChange(5)` nunca dispara pois o `navigate('/notifications')` interno intercepta o evento).

### 1.2 Comportamento Esperado (Correto)

- Sino sempre na **topbar/AppBar**, âncora consistente (topo-direita) em todas as telas mobile.
- **Única fonte de verdade**: `MobileTopBar` centralizado em `components/layout/`.
- Sem `position: fixed` flutuante que sobrepõe conteúdo de telas com headers próprios.
- Sem botões interativos aninhados.
- Touch target ≥ 48px. Safe-area `env(safe-area-inset-top)` respeitada.

### 1.3 Passos para Reproduzir

1. Abrir o web app em viewport mobile (375px).
2. Navegar para qualquer tela que não seja a Home (e.g. `/game/:id`, `/groups`, `/settings`).
3. Observar: sino flutua fixo no topo-direita sobrepondo conteúdo da tela.
4. Navegar de volta para Home.
5. Observar: sino aparece ancorado dentro da topbar — âncora diferente da etapa 3.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Plataforma | Web (React) |
| Viewport | Mobile ≤ 480px |
| Frequência | Sempre |
| Impacto | Todas as telas não-Home para usuários autenticados |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

Grep completo em `web/src/` revelou dois pontos de renderização do sino funcional:

1. `App.tsx:487-498` — `MobileShell` renderiza `<NotificationBell>` com `position: fixed, top: 56, right: 8` para todas as rotas exceto `/`.
2. `HomeScreen.tsx:245-266` — `HomeScreen` renderiza seu próprio `<AppBar>` com `<NotificationBell>` aninhado dentro de um `<IconButton>`.

As demais ocorrências de `NotificationsIcon` nos arquivos `settings/*.tsx`, `GroupDetailScreen.tsx` etc. são ícones decorativos em listas, **não** o componente sino de navegação.

### 2.2 Causa Raiz

O sino foi adicionado em dois momentos diferentes:
- PR #1214 adicionou o sino no `HomeScreen` (sticky AppBar dentro do scroll container).
- `MobileShell` foi adicionado depois como solução genérica para outras telas, usando `position: fixed` sem considerar conflito de posicionamento com headers existentes das telas.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `web/src/App.tsx` | Remove overlay `position: fixed` do MobileShell; adiciona `<MobileTopBar>` para rotas não-Home |
| `web/src/components/layout/MobileTopBar.tsx` | **Novo** — componente canônico da topbar mobile com sino |
| `web/src/pages/home/HomeScreen.tsx` | Substitui `<IconButton><NotificationBell/></IconButton>` por uso direto de `<NotificationBell>` (remove botão aninhado) |

---

## 3. Solução Proposta

### 3.1 Abordagem

1. Criar `components/layout/MobileTopBar.tsx`: `<AppBar position="sticky">` com `<NotificationBell>` no lado direito. Aceita `title` opcional (para telas não-Home) ou mostra logo do app (para Home se reutilizado). Props: `unreadCount`, `onNotificationClick?`.

2. Em `App.tsx` (`MobileShell`): substituir o overlay `position: fixed` pelo `<MobileTopBar>` sticky — aparece apenas em mobile (`xs`, oculto em `md+`) e apenas quando `user && !isHomeScreen`.

3. Em `HomeScreen.tsx`: substituir o `<IconButton>` aninhando `<NotificationBell>` pelo próprio `<NotificationBell>` diretamente no `<Toolbar>` — remove DOM inválido.

### 3.2 Componente MobileTopBar

```tsx
// NOVO: web/src/components/layout/MobileTopBar.tsx
// Topbar mobile canônica — âncora sticky, visível apenas em xs/sm
<AppBar position="sticky" elevation={0} sx={{ display: { xs: 'flex', md: 'none' }, ... }}>
  <Toolbar variant="dense">
    <SportsSoccer sx={{ color: 'primary.main', mr: 1 }} />
    <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ flex: 1 }}>
      {title ?? t('common.appName')}
    </Typography>
    <NotificationBell unreadCount={unreadCount} />
  </Toolbar>
</AppBar>
```

### 3.3 MobileShell — antes/depois

```tsx
// ANTES (bugado)
{user && !isHomeScreen && (
  <Box sx={{ position: 'fixed', top: 56, right: 8, zIndex: 1100, display: { xs: 'block', md: 'none' } }}>
    <NotificationBell unreadCount={unreadCount} />
  </Box>
)}

// DEPOIS (corrigido)
{user && !isHomeScreen && (
  <MobileTopBar unreadCount={unreadCount} />
)}
```

### 3.4 HomeScreen — antes/depois

```tsx
// ANTES (botão aninhado — DOM inválido)
<IconButton onClick={() => handleTabChange(5)} aria-label="Notificações" size="small">
  <NotificationBell unreadCount={unreadCount} />
</IconButton>

// DEPOIS (uso direto — onClick interno de NotificationBell navega para /notifications)
<NotificationBell unreadCount={unreadCount} />
```

---

## 4. Tarefas

- [x] Criar `web/src/components/layout/MobileTopBar.tsx`
- [x] Atualizar `web/src/App.tsx` (MobileShell): substituir overlay por `<MobileTopBar>`
- [x] Atualizar `web/src/pages/home/HomeScreen.tsx`: remover `<IconButton>` aninhado
- [x] Rodar `npm run build && npx vitest run && npm run lint`
- [x] Playwright: capturar 9 screenshots a 375px (Home, Games, Groups, Profile, Game Detail, Group Detail, League, Statistics, Settings)
- [x] Abrir PR com `Closes #1321`

---

## 5. Critérios de Aceite

- [ ] Sino aparece na topbar sticky (não flutuante) em todas as telas mobile autenticadas
- [ ] Âncora visualmente idêntica entre Home e demais telas
- [ ] Sem botões interativos aninhados no DOM
- [ ] Touch target do sino ≥ 48px
- [ ] `npm run build` verde
- [ ] `npm run lint` verde
- [ ] `npx vitest run` verde
- [ ] 9 screenshots Playwright a 375px evidenciando consistência
