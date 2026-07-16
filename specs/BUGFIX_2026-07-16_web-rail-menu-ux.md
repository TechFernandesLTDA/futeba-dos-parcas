# BUGFIX: Navegação acessível e descobrível no rail web

> **Status:** `VERIFIED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-16
> **Issues:** #3755, #3754, #3753, #3752, #3750, #3748

## 1. Requisitos

No breakpoint intermediário (`md`), o menu “Mais” declara semântica de menu sem
implementar o contrato de teclado, pode ultrapassar viewports baixos e não oferece
acesso descobrível aos atalhos. As notificações ficam escondidas atrás do botão
genérico “Mais” e não recebem o mesmo destaque visual do drawer expandido. No
desktop, a dica de busca informa `Ctrl+K` inclusive em plataformas Apple.

## 2. UX/UI aprovada

- Promover Notificações a item próprio do rail `md`, com badge, nome acessível,
  estado ativo e animação condicionada à preferência de movimento reduzido.
- Remover a contagem do botão genérico “Mais”, evitando ambiguidade e navegação
  duplicada para Notificações.
- Substituir `Popover + List` por `Menu + MenuItem` do MUI para obter foco inicial,
  setas, Home/End e Escape conforme o padrão ARIA.
- Limitar o papel do menu a `min(70vh, 480px)` e permitir rolagem vertical.
- Incluir “Atalhos de teclado” no menu e fechá-lo antes de abrir o diálogo.
- Localizar a dica da busca e escolher `⌘K` em plataformas Apple ou `Ctrl+K` nas
  demais plataformas.

## 3. Design técnico e tarefas

1. Derivar o item de Notificações e os demais itens diretamente de
   `MORE_NAV_ITEMS`, preservando a fonte única de navegação e os tokens de
   `AppSidebar.styles.ts`.
2. Usar `Menu`/`MenuItem` sem handler manual de teclado.
3. Adicionar somente as chaves de tradução necessárias em pt-BR, en e es.
4. Cobrir descoberta, navegação, abertura de atalhos, contrato do menu e seleção
   do rótulo de plataforma com testes de componente/unitários.

## 4. Critérios de aceitação

- Notificações ficam visíveis no rail e não aparecem duplicadas em “Mais”.
- A contagem não lida é anunciada no item de Notificações e não no botão “Mais”.
- O menu suporta setas, Home/End e Escape pelo comportamento nativo do MUI.
- O menu permanece utilizável em viewport de 600 px de altura.
- O diálogo de atalhos pode ser aberto pelo rail `md`.
- A dica exibe `⌘K` em Apple e `Ctrl+K` nas demais plataformas nos três idiomas.
- Movimento reduzido desativa a animação de notificações.
- Testes direcionados, paridade i18n, lint e build passam.

## 5. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Conflito com o polish do AppSidebar | Preservar `appSidebarLayoutTokens` e `appSidebarStyles` |
| Drift entre rail e drawer | Derivar ambos de `MORE_NAV_ITEMS` |
| Regressão de foco | Delegar foco e teclado ao `Menu` oficial do MUI |
| Traduções divergentes | Executar testes de paridade i18n |

## 6. Verificação

- [x] 32 testes direcionados e de paridade i18n passam.
- [x] Suíte web completa passa com dois workers.
- [x] `npm run lint` passa sem warnings.
- [x] `npm run build` passa.
- [x] `git diff --check` passa.
- [x] Snapshot estático visual executado; nenhum achado novo pertence a este lote.
