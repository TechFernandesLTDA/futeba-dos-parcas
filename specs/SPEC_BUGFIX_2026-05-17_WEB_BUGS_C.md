# BUGFIX: Web Bugs C — bolaMurchaName Firestore read, FilterIcon sem onClick, LeagueScreen reload

> **Status:** `APPROVED`
> **Severidade:** `HIGH` (#1272) | `MEDIUM` (#1273) | `LOW` (#1275)
> **Autor:** Claude Code (web-frontend-dev)
> **Data:** 2026-05-17
> **PR:** fix/web-bugs-1272-1273-1275

---

## 1. Descrição dos Bugs

### Bug #1272 (HIGH) — bolaMurchaName nunca buscado do Firestore

#### 1.1 Comportamento Atual (Errado)
`PostGameReportScreen` busca o nome do MVP do Firestore (`mvpName`), mas ignora completamente `bolaMurchaId`/`bolaMurchaName`. O campo `bolaMurchaName` sempre aparece vazio/undefined na tela, e nenhum card "Bola Murcha" é exibido.

#### 1.2 Comportamento Esperado (Correto)
O nome do jogador "Bola Murcha" deve ser buscado do Firestore (coleção `users`, usando `bolaMurchaId` do documento do jogo), e exibido em um card dedicado — espelhando o padrão já usado para o MVP.

#### 1.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `web/src/pages/games/PostGameReportScreen.tsx` | Falta leitura Firestore de `bolaMurchaId` + `bolaMurchaName`, e falta card de renderização |

---

### Bug #1273 (MEDIUM) — FilterIcon sem onClick em GamesScreen

#### 1.1 Comportamento Atual (Errado)
O botão `FilterIcon` em `GamesScreen.tsx` (linha 94) não possui handler `onClick`. Clicar no ícone não faz nada, tornando o elemento interativo não-funcional.

#### 1.2 Comportamento Esperado (Correto)
Clicar no ícone de filtro deve abrir um menu compacto com as opções de status (Todos, Agendados, Confirmados, Ao Vivo, Finalizados), equivalentes às abas já existentes. Selecionar uma opção deve atualizar `tabValue` e fechar o menu.

#### 1.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `web/src/pages/games/GamesScreen.tsx` | FilterIcon sem onClick; menu de filtro ausente |

---

### Bug #1275 (LOW) — LeagueScreen retry usa window.location.reload()

#### 1.1 Comportamento Atual (Errado)
O botão "Tentar novamente" no estado de erro de `LeagueScreen` chama `window.location.reload()`, que recarrega a página inteira. Isso destrói o estado da SPA, perde o contexto de navegação e causa flash de tela branca.

#### 1.2 Comportamento Esperado (Correto)
O retry deve re-executar a query via `queryClient.invalidateQueries({ queryKey: ['league'] })`, sem recarregar a página.

#### 1.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `web/src/pages/league/LeagueScreen.tsx` | Retry usa `window.location.reload()` em vez de invalidação de cache |

---

## 2. Análise de Causa Raiz

### #1272
- `PostGameStats.bolaMurchaId` e `PostGameStats.bolaMurchaName` são declarados na interface mas nunca populados.
- O bloco de fetch do MVP (linha 129-135) não foi replicado para `bolaMurchaId`.
- O `setStats({...})` (linhas 139-150) não inclui `bolaMurchaId`/`bolaMurchaName`.
- Nenhum card de renderização para Bola Murcha existe na JSX.

### #1273
- O `<IconButton aria-label="Filtrar jogos">` foi adicionado sem `onClick`, provavelmente planejado para futura implementação e esquecido.

### #1275
- `window.location.reload()` foi usado como atalho rápido. Em uma SPA com TanStack Query, o correto é invalidar o cache para disparar o refetch.

---

## 3. Solução Proposta

### #1272 — Leitura Firestore de bolaMurchaName

Imediatamente após o bloco de fetch do MVP (linhas 130-135), adicionar leitura análoga para `bolaMurchaId`. Incluir `bolaMurchaId` e `bolaMurchaName` no `setStats({...})`. Adicionar card de renderização após o card do MVP.

```tsx
// APÓS fetch do mvpName:
let bolaMurchaName = '';
if (data.bolaMurchaId) {
  const bolaMurchaDoc = await getDoc(doc(db, 'users', data.bolaMurchaId));
  if (cancelled) return;
  if (bolaMurchaDoc.exists()) {
    bolaMurchaName = (snakeToCamel(bolaMurchaDoc.data()) as Record<string, any>).name || '';
  }
}

// Em setStats:
bolaMurchaId: data.bolaMurchaId,
bolaMurchaName,

// Card de renderização (após card do MVP):
{stats.bolaMurchaName && (
  <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.error.main, 0.05) }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: theme.palette.error.main }}>
          <SoccerIcon />
        </Avatar>
        <Box>
          <Typography variant="caption" color="error" fontWeight={600}>
            Bola Murcha
          </Typography>
          <Typography variant="h6">{stats.bolaMurchaName}</Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
)}
```

### #1273 — onClick no FilterIcon

Adicionar `useState` para `filterAnchorEl` e `<Menu>` com as 5 opções de status. O `onClick` do FilterIcon define o anchor; cada item do menu chama `setTabValue(N)` e fecha.

### #1275 — Soft retry na LeagueScreen

Usar `useQueryClient` do TanStack Query. O onClick do botão retry chama `queryClient.invalidateQueries({ queryKey: ['league'] })`.

---

## 4. Verificação

### 4.1 Checklist Web

- [x] #1272: `bolaMurchaName` buscado do Firestore; card renderizado
- [x] #1272: `bolaMurchaId` incluso no `setStats({...})`
- [x] #1273: FilterIcon possui `onClick`; Menu abre com 5 opções
- [x] #1273: Seleção de opção atualiza `tabValue` e fecha menu
- [x] #1275: Retry invoca `queryClient.invalidateQueries` sem reload de página
- [x] `npm run build` passa sem erros
- [x] `npx vitest run` passa
- [x] `npm run lint` sem warnings novos
- [x] Sem cores hardcoded; todos os hooks antes de early-returns
- [x] Todos os `catch` com `logger.error` fornecem feedback UI

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-17 | Claude Code (web-frontend-dev) | Spec criada e aprovada |
