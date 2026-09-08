# BUGFIX: tema nativo, contraste da Liga, badge e motion

**Status:** APPROVED
**Issues:** #4099, #4108, #4114, #4115
**Autorização de escopo:** solicitação do usuário em 2026-09-08 para desenvolver todas as issues abertas. Esta spec registra a solução antes da implementação; não representa uma revisão humana separada do texto.

## 1. Requisitos e comportamento atual

- #4114: `body`/`#root` recebem color-scheme claro apesar de documento dark/OLED; controles de data/hora ficam ilegíveis.
- #4108: badge de 16dp recorta `9+` com fonte ampliada; componente antigo FutebaTopBar não tem consumidores.
- #4099: foreground das divisões considera apenas light/dark e falha sobre superfícies de alto contraste.
- #4115: easing emphasized duplica standard e o gate compara presença de valores sem conferir seus nomes.

## 2. UX/UI e desenho técnico

- Herdar color-scheme do documento em body/root, preservando override clara da landing e tema explícito do usuário.
- Badge continua `9+`, cresce ao conteúdo com dimensões mínimas/padding e preserva toque/ícone.
- Resolver foreground da divisão com base nas superfícies reais do ColorScheme e manter tokens existentes quando já atendem AA.
- Escolha (b) de #4115: remover o alias emphasized, migrar consumidores para standard sem mudar a animação existente. Não introduzir curva sem fonte verificada. O gate passa a casar nome e curva, com teste que troca valores entre tokens.

## 3. Arquivos e tarefas

- Web: `web/src/theme/index.ts`, testes de ThemeContext/landing e regressão de color-scheme no navegador.
- Android: `ui/components/design/AppTopBars.kt`, remoção de `ui/components/FutebaTopBar.kt`, `ui/theme/DivisionColors.kt` e testes Compose/contraste.
- Motion: `shared/design-tokens.json`, `ui/theme/AppMotion.kt`, `composeApp/.../theme/Motion.kt`, `web/src/theme/motion.ts`, consumidores Android e `scripts/check-design-tokens-parity.js`/testes.
- Coordenador consolida decisões em `specs/DECISIONS.md` e release após integração das demais frentes.

## 4. Verificação

- Color-scheme computado light/dark/OLED e landing em html/body/root; indicadores visíveis em dark/OLED.
- Badge renderizado com 15 notificações em fontScale 1.3 e 2.0, sem overflow do texto.
- Matriz quatro divisões × light/dark × NORMAL/HIGH × todos os fundos reais, incluindo o badge sólido de PlayerEvolutionCard com foreground próprio; contraste >=4.5, sem regressão dos tokens normais.
- Gate de paridade passa no projeto e falha ao trocar easing entre nomes; nenhuma referência ao alias removido.
- Lint/build web, compile/testes Android e validação CMP coordenada com agente iOS.

## 5. Riscos e mitigação

Preservar estado público da landing e preferência persistida. Resolver cores por ColorScheme para também acompanhar futuros contrastes. Não editar os arquivos de estabilização CI do PR #4116. Testes mobile são serializados com a frente iOS.
