# BUGFIX: Lista de espera acessível no detalhe do jogo Web

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issue:** #3586
> **PR:** pendente

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

`GameDetailScreen` consulta e exibe a lista de espera, mas não conecta `myEntry`,
`acting`, `joinWaitlist` e `leaveWaitlist` de `useWaitlist`. Quando o jogo atinge
`maxPlayers`, o CTA de presença fica desabilitado com “Lista cheia” e o jogador
não consegue entrar ou sair da fila por essa tela.

### 1.2 Comportamento Esperado (Correto)

Em jogos `SCHEDULED` ou `CONFIRMED` lotados, um usuário ainda não confirmado
deve poder entrar na lista de espera. Se já estiver na fila, deve ver sua posição
e poder sair. As ações devem existir no CTA principal e na aba da lista de espera,
com estado de progresso, bloqueio durante a mutação, textos traduzidos e feedback
do `ToastProvider`. Jogadores já confirmados preservam o fluxo de cancelamento e
nunca recebem um CTA duplicado de lista de espera.

### 1.3 Passos para Reproduzir

1. Abrir o detalhe de um jogo agendado ou confirmado com todas as vagas ocupadas.
2. Acessar com um jogador que ainda não confirmou presença.
3. Observar o botão “Lista cheia” desabilitado.
4. Abrir a aba “Espera” e observar que ela só lista participantes.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Plataforma | Web responsiva |
| Versão | 1.53.12 (antes da release consolidada) |
| Frequência | Sempre |
| Impacto | Jogadores sem caminho de entrada na fila pelo detalhe do jogo |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

O hook já implementa listener, idempotência, escrita/remoção, loading e toasts. A
Home conecta todas essas operações, enquanto `GameDetailScreen` destrutura apenas
os dados de leitura e repassa somente a lista ao `GamePlayersSection`.

### 2.2 Causa Raiz

A integração Web da waitlist foi concluída no card da Home, mas o detalhe do jogo
ficou com uma integração apenas de leitura.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `web/src/pages/game/GameDetailScreen.tsx` | Conectar o hook e substituir o CTA lotado |
| `web/src/pages/game/GamePlayersSection.tsx` | Expor a mesma ação na aba de espera |
| `web/src/pages/game/GameWaitlistAction.tsx` | Centralizar estado/CTA sem duplicar UI |
| `web/src/pages/game/gameWaitlistEligibility.ts` | Centralizar a regra de elegibilidade testável |
| `web/src/pages/game/GameWaitlistAction.test.tsx` | Cobrir entrada, posição, saída e loading |
| `web/src/pages/game/GamePlayersSection.test.tsx` | Cobrir a ação na aba de espera |

---

## 3. Solução Aprovada

### 3.1 Abordagem

1. Criar um componente de apresentação reutilizável para entrar/sair da fila.
2. Destruturar `myEntry`, `acting`, `joinWaitlist` e `leaveWaitlist` na tela.
3. Encapsular as chamadas em handlers `try/catch`, mantendo os toasts do hook e
   um fallback do `ToastProvider` caso uma implementação futura volte a lançar.
4. Renderizar a ação apenas quando o jogo estiver lotado, ainda aceitar presença
   e o usuário não estiver confirmado.
5. Reusar a mesma ação no CTA inferior e no painel da aba de espera.

### 3.2 Regras de Elegibilidade

- Somente jogos `SCHEDULED` ou `CONFIRMED`.
- Somente quando `playersCount >= maxPlayers`.
- Nunca para usuário já confirmado.
- `useWaitlist` permanece responsável por autenticação, idempotência, persistência,
  feedback de sucesso/erro e regras de escrita.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| CTA duplicado divergir entre rodapé e aba | Componente único compartilhado |
| Duplo clique criar duas entradas | `disabled`/progress via `acting` + idempotência do hook |
| Confirmado entrar indevidamente na fila | Elegibilidade calculada uma vez na tela e testada por integração |
| Erro sem feedback | Toast do hook e fallback no handler da tela |

---

## 4. Verificação

- [x] Teste do CTA de entrada e dos estados `loading`/`acting`.
- [x] Teste da posição e do CTA de saída.
- [x] Teste da ação dentro da aba de espera.
- [x] Testes Web relevantes passam em Node 22: 44 testes em 8 arquivos.
- [x] `npm run build` passa (Vite build em 7,91 s).
- [x] `npm run lint` passa sem warnings.
- [x] `git diff --check` passa.

---

## 5. Release

Correção user-visible de Web. O bump, release note, changelog, bundle e deploy serão
consolidados no fluxo final de release; esta branch não altera versão isoladamente.

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-13 | Codex | Spec criada e aprovada conforme autorização do owner para executar #3586 |
| 2026-07-13 | Codex | Implementação e verificação concluídas |
