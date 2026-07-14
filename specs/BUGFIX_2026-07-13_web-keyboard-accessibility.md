# BUGFIX: operação por teclado em fotos, nível e favorito de local

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Data:** 2026-07-13
> **Issues:** #3625, #3626, #3628

## Problema

As fotos de grupo/jogo e o card de nível respondem apenas a clique, sem elemento
semântico focável. O favorito do local é um botão de ícone sem nome acessível e
sua lista é memorizada apenas na montagem, impedindo que nome/estado acompanhem
o clique imediatamente.

## Invariantes

- Enter, Espaço, clique e toque executam a mesma ação exatamente uma vez.
- Fechar o lightbox por botão ou Escape restaura foco ao thumbnail que o abriu.
- O botão de excluir foto continua independente; não pode ficar aninhado em
  outro botão nem abrir o lightbox ao excluir.
- Nomes acessíveis usam os catálogos PT-BR/en/es e descrevem ação/contexto.
- Favorito expõe `aria-pressed` coerente com o ícone e atualiza sem reload.
- Persistência de favoritos continua no mesmo `localStorage`, limitada a 10.
- Upload, exclusão, reactions, navegação e layout responsivo permanecem iguais.

## Solução aprovada

1. Usar `ButtonBase` para thumbnails. Na grade do jogo, separar o botão de abrir
   do `IconButton` de exclusão como irmãos sobrepostos semanticamente válidos.
2. Manter o `Dialog` MUI, que gerencia trap e restauração de foco, e fornecer
   nome acessível derivado do mesmo `photoAlt` da imagem.
3. Usar `CardActionArea` no card de nível, com `profile.viewLevelJourneyAria`.
4. Tornar favoritos reativos em `useRecentLocations`, expondo `toggleFavorite`
   que sincroniza estado com o armazenamento após a operação.
5. Adicionar ao formulário `aria-label`, `aria-pressed`, tooltip e toast
   traduzidos para adicionar/remover favorito.

## Critérios de aceitação

- Thumbnails aparecem como botões na ordem de Tab e abrem com Enter/Espaço.
- Clique/touch ainda abre o lightbox e Escape devolve o foco ao thumbnail.
- Excluir foto não aciona o lightbox.
- Card de nível é focável, tem nome acessível e navega por Enter/Espaço.
- Favorito anuncia ação e estado corretos antes/depois do clique nos 3 locales.
- Catálogos continuam válidos e os testes cobrem teclado e foco.

## Verificação

- `cd web && npm run test -- src/pages/group/GroupPhotosPanel.keyboard.test.tsx src/pages/game/GamePhotosTab.keyboard.test.tsx src/pages/home/tabs/ProfileTab.test.tsx src/pages/game/CreateGameScreen.test.tsx src/hooks/useRecentLocations.test.ts`
- `cd web && npm run build`
- `cd web && npm run lint`
- `git diff --check`

## Risco e release

Mudança somente Web. O principal risco é conflito entre o botão do thumbnail e
o botão de exclusão; a separação como irmãos e testes negativos mitigam isso.
Não há mudança de schema/backend. Incluir na próxima release Web e no deploy
consolidado de Hosting.
