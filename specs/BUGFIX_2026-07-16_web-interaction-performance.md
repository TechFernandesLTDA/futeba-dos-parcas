# BUGFIX: Performance segura das interações Web

> **Status:** `VERIFIED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-16
> **Issues:** #3792, #3797, #3802, #3804, #3806

---

## 1. Requisitos

O Web deve preservar a experiência atual e reduzir trabalho desnecessário no
thread principal durante scroll, atalhos globais e swipe-back:

- persistir a posição de scroll depois de uma pequena pausa, com flush ao sair
  da rota ou da página, em vez de acessar `sessionStorage` a cada evento;
- carregar o diálogo de atalhos somente na primeira abertura;
- manter os listeners globais estáveis quando os diálogos abrem ou fecham;
- sinalizar ao compositor `transform` e `opacity` apenas durante o arraste;
- reagir a alterações de `prefers-reduced-motion` durante a sessão.

Não há mudança de rota, contrato Firebase, copy ou regra de negócio.

## 2. UX/UI

O comportamento visível permanece o mesmo. A preferência de movimento reduzido
passa a valer imediatamente, e os gestos/scroll devem manter o estado correto em
navegação PUSH/POP, cancelamento, troca de rota e fechamento da aba.

## 3. Design técnico

- Reutilizar `useReducedMotion()` em `useSwipeBack`.
- Guardar os estados dos diálogos em refs atualizadas a cada render para que o
  efeito de listeners não dependa desses booleanos.
- Ativar `willChange` no toque inicial elegível e removê-lo no encerramento do
  gesto, antes de manter qualquer transformação no shell.
- Transformar `ShortcutsDialog` em import dinâmico protegido por `Suspense`.
- Debounce de 150 ms no scroll; o valor mais recente é persistido no timeout,
  no cleanup da rota, em `pagehide` e quando a aba fica oculta.

## 4. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Perder a última posição antes do debounce | Flush síncrono no cleanup, `pagehide` e `visibilitychange:hidden` |
| Atalho ler estado antigo | Ref atualizada em todo render |
| Chunk do diálogo causar flash | Montagem condicional com `Suspense fallback={null}` |
| Camada de composição ficar alocada | `willChange: auto` fora do arraste |
| Preferência reduzida mudar durante gesto | Hook reativo já coberto por listener de mídia |

## 5. Verificação

- `useScrollRestoration.test.ts`: debounce, última posição, cleanup, `pagehide` e background mobile.
- `useSwipeBack.test.ts`: promoção no toque e preferência alterada em runtime.
- `useGlobalShortcuts.test.ts`: listeners estáveis e leitura do estado atual.
- Testes direcionados: 16/16.
- Suíte Web completa: 1.333 testes passaram, 15 ignorados.
- `npm run lint`: passou sem warnings.
- `npm run build`: passou; `ShortcutsDialog` virou chunk independente de
  1.945 bytes (928 bytes gzip).

## Histórico

| Data | Autor | Alteração |
|---|---|---|
| 2026-07-16 | Codex | Spec criada e aprovada sob autorização administrativa do proprietário |
| 2026-07-16 | Codex | Implementação e verificações concluídas; status `VERIFIED` |
