# Web React — Padrões Obrigatórios

Padrões descobertos em auditoria 2026-05-08 (#601). **NÃO REPETIR.**

---

## Pattern 1: `onSnapshot` com 3º argumento de erro

Todo `onSnapshot` do Firestore DEVE ter 3 argumentos: query/ref, callback de sucesso, **e callback de erro**.

**ERRADO** — engole erros Firestore silenciosamente:
```ts
const unsub = onSnapshot(q, (snap) => {
  // processa snap
});
```

**CORRETO**:
```ts
const unsub = onSnapshot(
  q,
  (snap) => {
    // processa snap
  },
  (err) => {
    logger.error('Erro no listener:', err);
    showError('Falha ao carregar dados em tempo real');
  }
);
```

ESLint: `no-restricted-syntax` — selector `CallExpression[callee.name='onSnapshot']:not([arguments.2])` — nível `warn`.

---

## Pattern 2: `catch` com `logger.error` + feedback UI

Todo `catch` que chama `logger.error` DEVE também fornecer feedback ao usuário via `showError`, `setError`, ou re-`throw`.

**ERRADO** — erro invisível pro usuário:
```ts
catch (err) {
  logger.error('Falha ao salvar:', err);
}
```

**CORRETO** (qualquer uma das opções):
```ts
// Opção A: showError (UI toast/snackbar)
catch (err) {
  logger.error('Falha ao salvar:', err);
  showError('Não foi possível salvar. Tente novamente.');
}

// Opção B: setError (state do componente)
catch (err) {
  logger.error('Falha ao salvar:', err);
  setError(err instanceof Error ? err.message : 'Erro desconhecido');
}

// Opção C: throw (deixa o caller tratar)
catch (err) {
  logger.error('Falha ao salvar:', err);
  throw err;
}
```

ESLint: `no-restricted-syntax` — selector com `:has()` em `CatchClause` — nível `warn`.

---

## Outros padrões web (vide CLAUDE.md seção Web App)

- Firebase writes: sempre `serverTimestamp()` para `createdAt`/`updatedAt`
- Hooks: todos antes de qualquer `if`/early return
- Theme: sempre `theme.palette.*` — nunca `#000`/`#fff` hardcode
- Toast: `useToast()` hook — nunca singleton direto
- Estados: toda tela precisa de `loading`, `empty`, `error`, `success`

---

## Pattern 3: Sizing & Layout — PageContainer + tokens

**NUNCA** usar `<Container maxWidth>` raw em páginas. O padrão canônico é `<PageContainer>` com tiers semânticos de `web/src/theme/pageTokens.ts`.

### Tiers de largura

| Tier | maxWidth MUI | Usar em |
|---|---|---|
| `focused` | `xs` (~444px) | auth, onboarding, welcome — fluxos centrados **sem** shell; NÃO alargar |
| `form` | `md` (~900px) | formulários de criação/edição, texto/leitura |
| `list` | `lg` (~1200px) | listas |
| `detail` | `lg` (~1200px) | detalhe de 1 entidade |
| `dashboard` | `xl` (~1536px) | home, estatísticas, dashboards densos |

### Uso correto

```tsx
import PageContainer from '../../components/common/PageContainer';

<PageContainer maxWidth="dashboard">
  <Grid container spacing={3}>
    <Grid xs={12} md={6} lg={4} xl={3}>
      ...
    </Grid>
  </Grid>
</PageContainer>
```

```tsx
// ERRADO — Container raw, maxWidth fixo, ternario, numerico
<Container maxWidth="sm">...</Container>
<Container maxWidth={isMd ? 'md' : 'sm'}>...</Container>
<Box maxWidth={{ xs: '100%', lg: 1200, xl: 1536 }}>...</Box>
```

### Grid que escala colunas (dinâmico à resolução)

Todo grid de múltiplos itens DEVE escalar colunas do `xs` até `xl`:

```tsx
// CORRETO (Grid v2 — Unstable_Grid2 no MUI 5)
<Grid xs={12} sm={6} md={4} lg={3} xl={2}>

// ERRADO — grid travado (não aproveita telas largas)
<Grid item xs={4}>
```

Usar as variantes pré-definidas em `gridLayout` quando possível:
- `gridLayout.cards`: `{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }`
- `gridLayout.cardsWide`: `{ xs: 12, sm: 12, md: 6, lg: 4, xl: 3 }`

### Grid v2 — Unstable_Grid2 (MUI 5)

`<Grid item xs={n}>` é deprecado. No MUI 5 usar `Unstable_Grid2` com props diretas:

```tsx
// CORRETO (Unstable_Grid2)
import Grid from '@mui/material/Unstable_Grid2';

<Grid container spacing={3}>
  <Grid xs={12} md={6}>

// ERRADO
<Grid item xs={12} md={6}>
```

### Padding

Sempre usar os tokens de `pageSpacing`; nunca `py:2`/`pb:4` ad-hoc:

```tsx
// PageContainer ja aplica padding automaticamente
<PageContainer maxWidth="list">
  {content}
</PageContainer>

// Para padding interno de seções
<Box sx={{ mt: pageSpacing.sectionSpacing }}>
```

### Componentes

- Ícones e avatares: usar `iconSizes`/`avatarSizes` de `web/src/theme/iconSizes.ts`
- `maxWidth: 320` repetido → `componentMaxWidth.stateMessage`
- `maxWidth: 480` → `componentMaxWidth.bottomBar`

ESLint: `no-restricted-syntax` Rules 3 e 4 — nível `warn`. Epic #2581.
