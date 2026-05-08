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
