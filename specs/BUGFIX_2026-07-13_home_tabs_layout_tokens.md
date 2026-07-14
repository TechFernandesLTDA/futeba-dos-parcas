# BUGFIX: Padronizar largura e grid das abas Jogos e Grupos

> **Status:** `APPROVED`
> **Severidade:** `LOW`
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issues:** #3605, #3606, #3607
> **PR:** Pendente

---

## 1. Requisitos

### 1.1 Comportamento atual

- `GamesTab` e `GroupsTab` usam `Box` raiz com larguras numéricas próprias, fora do padrão `PageContainer` e dos tiers semânticos de `pageTokens.ts`.
- O grid de jogos declara `xs`, `md` e `xl`, mas omite `lg`; entre 1200 px e 1536 px continua com apenas duas colunas.
- A troca entre abas da Home apresenta limites de largura diferentes em desktop.

### 1.2 Comportamento esperado

- As duas abas usam `PageContainer maxWidth="dashboard"`, o mesmo tier semântico da Home.
- O grid de jogos escala explicitamente em `xs=12`, `md=6`, `lg=4` e `xl=3`.
- Loading, erro, vazio e sucesso existentes continuam dentro do container canônico, sem alteração dos hooks ou consultas.

### 1.3 Critérios de aceite

1. Não existem `maxWidth` numéricos no container raiz de `GamesTab` ou `GroupsTab`.
2. As duas abas renderizam dentro de `PageContainer` com tier `dashboard`.
3. Cards de jogos exibem 1 coluna em `xs`, 2 em `md`, 3 em `lg` e 4 em `xl`.
4. Busca, filtros, retry, empty state, FABs e navegação preservam o comportamento atual.
5. Testes automatizados protegem separadamente #3605, #3606 e #3607.

---

## 2. UX/UI

- **Assunto:** painel de organização de peladas para jogadores e organizadores.
- **Trabalho da tela:** permitir localizar rapidamente jogos ou grupos e agir sobre o item escolhido.
- **Direção:** preservar a identidade visual existente; esta correção é de ritmo e densidade, não um redesign.
- **Responsividade:** manter uma coluna no mobile e ganhar densidade progressiva no desktop sem saltos entre `lg` e `xl`.
- **Acessibilidade:** preservar rótulos, foco, alvos de toque e semântica existentes; o container não introduz controles novos.
- **Estados:** loading, erro com retry, vazio com ação e sucesso permanecem explícitos nas duas abas.

---

## 3. Design técnico

### 3.1 Abordagem

- Importar o `PageContainer` canônico em ambas as abas.
- Substituir o `Box` externo e remover o padding horizontal interno duplicado, preservando sticky header, espaçamentos de seção e `ScreenFab`.
- Usar o tier `dashboard`, pois as abas pertencem ao mesmo shell da Home e exibem grades densas de cards.
- Adicionar `lg={4}` e ajustar `xl={3}` no item do grid de jogos, alinhando-o ao padrão já usado por `GroupsTab`.

### 3.2 Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `web/src/pages/home/tabs/GamesTab.tsx` | Container canônico e breakpoints do grid |
| `web/src/pages/home/tabs/GroupsTab.tsx` | Container canônico |
| `web/src/pages/home/tabs/HomeTabsLayout.test.tsx` | Regressões das três issues |

### 3.3 Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Padding duplicado após a troca do wrapper | Remover `px` dos wrappers imediatos; `PageContainer` passa a ser a única fonte do padding externo |
| Alteração involuntária nos estados | Testes usam estados vazio e sucesso sem tocar nos hooks |
| Cards estreitos em desktop | Breakpoints explícitos seguem o padrão `cardsWide` documentado |

Não há decisão arquitetural nova: a implementação aplica o padrão já aprovado em `.claude/rules/web-react.md`.

---

## 4. Tarefas

- [x] REQUIREMENTS: documentar causa e critérios das três issues.
- [x] UX/UI: definir responsividade, estados e preservação visual.
- [x] TECHNICAL DESIGN: selecionar `PageContainer dashboard` e breakpoints.
- [x] TASKS: listar mudanças e verificações.
- [x] IMPLEMENTATION: alterar componentes e adicionar testes.
- [x] VERIFY: executar testes focados, build, lint e `git diff --check` com Node 22.

---

## 5. Release

Mudança visível de Web, elegível para as notas da próxima release consolidada. Este PR não deve alterar versão, bundles, changelog, tag ou deploy isoladamente; esses artefatos serão atualizados na release final do conjunto de issues.

---

## Histórico

| Data | Autor | Alteração |
|---|---|---|
| 2026-07-13 | Codex | Spec criada e aprovada para #3605, #3606 e #3607 |
| 2026-07-13 | Codex | Implementação concluída; 3 testes, lint e build validados com Node 22 |
