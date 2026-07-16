# BUGFIX: Gestos e feedback tátil consistentes no Web mobile

> **Status:** `VERIFIED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-16
> **Issues:** #3803, #3768, #3765, #3764, #3762

## 1. Requisitos

- Navegações pela barra inferior e pela sidebar devem emitir haptic leve quando
  a Vibration API estiver disponível, preservando o opt-out de movimento reduzido.
- Swipe-back deve ficar totalmente desativado com `prefers-reduced-motion: reduce`.
- Swipe-back não deve iniciar em uma área marcada com
  `data-swipe-back-ignore` nem dentro de um contêiner que realmente role no eixo X.
- Restauração de scroll deve observar `window` em xs/sm e `#main-content` em md+.
- iOS Safari não deve exibir o tap highlight cinza; elementos interativos sem
  ripple MUI devem manter feedback visual imediato em `:active`.

Não há mudança de rotas, Firebase, dados, permissões ou regra de negócio.

## 2. UX/UI

- O haptic é leve (10 ms), silenciosamente ignorado por browsers sem suporte e
  nunca executado sob movimento reduzido.
- Movimento reduzido não recebe navegação surpresa após um swipe sem feedback.
- Carrosséis, tabs e listas horizontais continuam respondendo ao gesto nativo.
- Links e botões HTML não-MUI recebem redução instantânea de opacidade enquanto
  pressionados, compensando a remoção do highlight proprietário do Safari.

## 3. Design técnico

- Reutilizar `useReducedMotion()` dentro de `useSwipeBack` e não registrar os
  listeners quando a preferência estiver ativa.
- Na origem do toque, percorrer os ancestrais até o documento. Ignorar opt-out
  explícito, `touch-action` que reserva pan horizontal e overflow X `auto` ou
  `scroll` quando `scrollWidth > clientWidth`.
- Selecionar o contêiner de scroll pela mesma fronteira md do layout (900 px),
  reagindo a mudanças de viewport com `useMediaQuery`.
- Centralizar no componente da sidebar um callback `navigateWithHaptic` para
  evitar divergência entre rail, popover e drawer.
- Aplicar `WebkitTapHighlightColor: transparent` no documento e feedback ativo
  apenas em apontadores coarse, fora de componentes `MuiButtonBase`.

## 4. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Conflito com a PR #3811 | Não editar `App.tsx`; rebase simulado sobre a cabeça da PR e resolução preservando debounce/will-change |
| Falso positivo de área horizontal | Exigir overflow apropriado e conteúdo maior que a largura visível; oferecer opt-out explícito |
| Perder restauração ao cruzar breakpoint | `useMediaQuery` reativo rebinda o listener |
| Remover todo feedback de toque | Preservar ripple MUI e adicionar estado `:active` para controles nativos |

## 5. Verificação

- Testes direcionados de swipe-back, scroll restoration, haptic de navegação e
  contrato de tema: 37/37 passaram.
- Suíte Web sob carga: 1.324 passaram, 15 ignorados e 22 timeouts. Todos os 13
  arquivos externos afetados foram repetidos com um worker: 83/83 passaram; o
  único teste deste lote foi corrigido e repetido: 9/9 passaram.
- `npm run lint` e `npm run build`: passaram.
- Integração com a PR #3811: verificada em clone temporário antes do handoff.

## Histórico

| Data | Autor | Alteração |
|---|---|---|
| 2026-07-16 | Codex | Spec criada e aprovada sob autorização administrativa do proprietário |
| 2026-07-16 | Codex | Implementação e verificações concluídas; status `VERIFIED` |
