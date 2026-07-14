# BUGFIX: Ranking semanal operável por teclado

> **Status:** `VERIFIED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issue:** #3623

## Problema e aceite

As linhas do ranking eram `Stack` clicáveis sem semântica nem foco. Cada jogador
deve ser alcançável por Tab, anunciar o destino com o nome do jogador e abrir o
perfil por Enter/Espaço, preservando clique/touch e foco visível.

## Solução

O conteúdo de cada `Card` passa a ser envolvido pelo `CardActionArea` canônico,
que fornece semântica de botão e ativação por teclado. O nome acessível usa uma
chave localizada em PT-BR, inglês e espanhol. Um contorno com token do tema
reforça o foco visível sem introduzir cor hardcoded na produção.

## Verificação

- Teste de papel/nome acessível e ativação por Enter.
- Build, lint, teste focado e `git diff --check`.
- Estados loading, vazio e sucesso permanecem inalterados.

Mudança visível Web: incluir na próxima release consolidada; sem bump/deploy
isolado.
