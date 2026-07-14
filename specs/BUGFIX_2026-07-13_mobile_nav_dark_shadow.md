# SDD — Sombras da navegação mobile em temas escuros

## Contexto

As barras mobile superior e inferior consumiam o mesmo token de sombra criado
para superfícies claras. A sombra composta apenas por preto desaparecia sobre
os fundos dark e OLED, eliminando a separação visual do conteúdo.

## Decisão

- Manter sombras como tokens semânticos do tema.
- Separar a direção da elevação em `navTop` e `navBottom`.
- Nos temas dark e OLED, combinar uma borda luminosa discreta com uma camada
  preta direcional; o OLED recebe contraste um pouco maior.
- Os componentes não escolhem cores: apenas consomem o token correspondente.

## Critérios de aceite

- Topbar e bottom nav usam sombras em direções opostas.
- Dark e OLED não reutilizam os tokens de navegação do tema claro.
- Os tokens escuros incluem uma borda clara perceptível.
- Build, lint e testes focados da Web permanecem verdes.
