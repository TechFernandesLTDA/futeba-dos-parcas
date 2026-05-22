# BUGFIX: GamesTab e GroupsTab sem maxWidth no desktop

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** AI Assistant
> **Data:** 2026-05-22
> **Issue:** #1507

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

GamesTab e GroupsTab não possuem `maxWidth` no container principal, causando conteúdo esticado em telas 1440px+.

### 1.2 Comportamento Esperado (Correto)

Container principal com `maxWidth` adequado (referência: RankingsTab usa `Container maxWidth="md"/"sm"`).

### 1.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `web/src/pages/home/tabs/GamesTab.tsx` | Container sem maxWidth |
| `web/src/pages/home/tabs/GroupsTab.tsx` | Container sem maxWidth |

---

## 2. Solução

Adicionar `maxWidth` e `mx: 'auto'` no container externo de cada tab, seguindo padrão responsivo.

---

## 3. Verificação

- [ ] `npm run build` passa
- [ ] `npm run lint` passa
- [ ] Conteúdo centralizado e legível em telas 1920px
- [ ] Sem regressão em mobile
