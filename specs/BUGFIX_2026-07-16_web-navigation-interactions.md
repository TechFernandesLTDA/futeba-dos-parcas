# BUGFIX: Interações e listeners da navegação web

> **Status:** `VERIFIED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-16
> **Issues:** #3807, #3801, #3798, #3796, #3793, #3791

## 1. Requisitos

- Exibir a top bar autenticada tanto na raiz quanto em rotas secundárias; nestas,
  manter botão Voltar, título e breadcrumbs.
- Eliminar o segundo listener Firestore de notificações no mobile sem perder a
  atualização em tempo real no desktop ou no mobile.
- Evitar qualquer atualização de estado React por `touchmove` durante swipe-back.
- Preservar feedback visual, movimento reduzido reativo, fallback de navegação e
  limpeza completa dos listeners/estilos adicionados no PR #3811.
- Reproduzir a transição de rota sem remontar toda a árvore por causa de `key`.
- Remover memoização sem benefício no bottom nav e evitar recriar seus ícones.
- Aplicar prefetch atrasado em hover/foco às superfícies de navegação, sem chamar
  hooks dentro de loops, condições ou `map`.

## 2. UX/UI aprovada

1. Extrair `MobileShell` para um componente testável e renderizar `MobileTopBar`
   sempre que houver usuário.
2. Compartilhar `{ unreadCount, loading, error }` por um provider único, montado
   dentro de `AuthProvider`; shell e sidebar serão apenas consumidores.
3. O swipe escreverá `transform`, `opacity`, `transition` e `will-change`
   diretamente no shell, agrupado por `requestAnimationFrame`; finalizar,
   cancelar, desmontar ou ativar movimento reduzido removerá todos os estilos.
4. `PageTransition` receberá uma chave lógica como prop, mas reiniciará somente
   a animação DOM; a prop React `key` será removida.
5. O prefetch usará um único `usePrefetchOnHover()` por componente. Os handlers
   lerão a rota de `data-prefetch-route`, permitindo reutilização dentro dos maps.

## 3. Critérios de aceitação

- Top bar visível em `/` e `/game/:id`, com `showBack` correto.
- Exatamente uma assinatura de `useUnreadNotificationCount` atende sidebar e shell.
- Nenhum `setState` ocorre durante `touchmove`; o DOM recebe feedback no frame.
- Mudança runtime de `prefers-reduced-motion` interrompe e limpa o feedback.
- Mudança de rota reinicia a animação sem desmontar um filho estável.
- Bottom nav não usa `React.memo` nem clona ícones por render.
- Hover aguarda 100 ms, mouseleave cancela e foco antecipa imediatamente.
- Rotas frequentes de sidebar têm importadores de prefetch.
- Testes direcionados, suíte completa, lint, build e `git diff --check` passam.

## 4. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Estilo inline permanecer após gesto | Cleanup único usado em end/cancel/unmount/reduced-motion |
| Provider fora da autenticação | Montar explicitamente dentro de `AuthProvider` |
| Prefetch excessivo | atraso de 100 ms, cancelamento e respeito a save-data/2G |
| Transição perder acessibilidade | manter `useReducedMotion` reativo e foco após a duração atual |
| Hook em loop | handlers baseados em `data-*`, hook único antes do retorno |

## 5. Verificação

- [x] 41 testes direcionados em 7 arquivos passaram.
- [x] Suíte Web completa passou com dois workers (1.365 testes, 15 ignorados).
- [x] `npm run lint` passou sem warnings.
- [x] `npm run build` passou.
- [x] `AuthContext` permaneceu em chunk separado (41,96 kB) e o entry ficou em
  127,19 kB, praticamente estável contra os 127,17 kB do head de origem.
- [x] Snapshot estático visual executado sem achado novo pertencente ao lote.
- [x] `git diff --check` passou.

## Histórico

| Data | Alteração |
| --- | --- |
| 2026-07-16 | Spec aprovada sob autorização administrativa do proprietário |
| 2026-07-16 | Implementação e verificação concluídas; status `VERIFIED` |
