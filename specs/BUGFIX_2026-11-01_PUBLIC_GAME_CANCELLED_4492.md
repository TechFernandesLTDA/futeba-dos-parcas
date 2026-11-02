# BUGFIX: Visão pública de jogo cancelado diz "Aberto para novos jogadores"

> **Status:** `APPROVED`
> **Severidade:** `LOW`
> **Autor:** Claude (autonomia ampla autorizada pelo dono para bugfixes)
> **Data:** 2026-11-01
> **PR:** a definir (issue #4492; follow-up da #4408 / PR #4485)

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
Em `/game/:gameId` sem login, um jogo `CANCELLED` (ou `FINISHED`/`LIVE`) mostra o chip **Cancelado** junto do chip **Aberto para novos jogadores**, e a linha de vagas diz "1 de 25 confirmados · 24 vagas abertas". O bloco "Quer jogar?" já diz que o jogo não recebe confirmações, então a tela se contradiz.

### 1.2 Comportamento Esperado (Correto)
Quando o status não aceita confirmação (`isAcceptingPlayers` falso):
- o chip de modo de entrada (`joinMode`) não aparece;
- a linha de vagas mostra só os confirmados, sem "vagas abertas" nem "Lista cheia".

### 1.3 Passos para Reproduzir
1. Abrir `https://futebadosparcas.com.br/game/3dW31QIsxEIbuis4216x` sem login (jogo cancelado, `PUBLIC_OPEN`).
2. Ver os dois chips e "24 vagas abertas".

---

## 2. Análise de Causa Raiz

`PublicGameScreen` renderiza o chip de `joinMode` e o rótulo de `spotsLeft` sem olhar o status. Só o CTA consultava `isAcceptingPlayers`.

| Arquivo | Motivo |
|---------|--------|
| `web/src/pages/game/PublicGameScreen.tsx` | Condicionar chip e vagas a `accepting` |
| `web/src/pages/game/PublicGameScreen.test.tsx` | Teste de regressão |

---

## 3. Solução

Reusar o `accepting` já calculado: esconder o chip de `joinMode` e anular `spotsLabel` quando falso. A barra de progresso continua (mostra confirmados). Sem mudança na function nem no texto OG, que já diz "Jogo encerrado".

## 4. Verificação

- Vitest: novo caso `jogo cancelado não mostra modo de entrada nem vagas abertas (#4492)`.
- Pós-deploy: abrir o jogo do passo 1.1 e conferir que só o chip **Cancelado** aparece e não há "vagas abertas".

## 5. DoD mobile

Só web; sem mudança de layout responsivo, acessibilidade ou estados (o card de sucesso apenas perde informação contraditória).
