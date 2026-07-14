# BUGFIX: Estatísticas de MVP e Bola Murcha no fechamento da votação

> **Status:** APPROVED
> **Severidade:** HIGH
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issues:** #3587, #3588, #3596

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

`onGameStatusUpdate` atualiza `currentMvpStreak`, `bestMvpStreak`,
`bestPlayerCount` e `worstPlayerCount` na transição do jogo para `FINISHED`.
Nesse instante a votação pós-jogo ainda não foi concluída e `mvp_id` e
`worst_player_id` normalmente não existem. O trigger zera o streak de todos os
participantes antes da apuração, prende sequências de MVP em 1 e deixa o
contador de Bola Murcha sem incremento real.

`applyVotingXpDelta` corrige parcialmente o MVP depois da votação, mas não
incrementa `worstPlayerCount` e não zera o streak dos participantes que não
venceram.

### 1.2 Comportamento Esperado (Correto)

- `concludeMvpVoting` é a única fonte de verdade para os contadores e streaks
  derivados da votação.
- Ao concluir uma votação, exatamente uma vez:
  - o MVP recebe `bestPlayerCount + 1`, `currentMvpStreak + 1` e atualização de
    `bestMvpStreak`;
  - o Bola Murcha recebe `worstPlayerCount + 1`;
  - todo participante elegível que não foi MVP recebe
    `currentMvpStreak = 0`;
  - se não houver MVP, todos os participantes elegíveis têm o streak zerado.
- Repetir o callable depois de `voting_status = CONCLUDED` não altera nenhum
  contador.
- O cálculo de milestones usa os valores de estatísticas já persistidos pelo
  fechamento da votação, sem incrementar o MVP novamente.

### 1.3 Cenários de Reprodução

1. Eleger o mesmo jogador MVP em três jogos consecutivos.
2. Observar que o trigger de `FINISHED` zera o streak antes de cada apuração.
3. Eleger outro jogador no jogo seguinte e observar que o antigo MVP não é
   zerado no caminho de votação atual.
4. Eleger um Bola Murcha e observar `worstPlayerCount` inalterado.
5. Reexecutar o fechamento e verificar o risco de fontes concorrentes de
   contagem.

### 1.4 Contexto

A janela de votação termina depois da transição para `FINISHED`. Portanto,
estatísticas dependentes do resultado da votação não podem ser derivadas no
trigger de finalização do jogo.

## 2. Análise de Causa Raiz

### 2.1 Investigação

- `functions/src/index.ts`: o trigger principal calcula MVP/Bola Murcha cedo
  demais e grava streaks de forma absoluta.
- `functions/src/voting/mvp-voting.ts`: a transação de conclusão já possui a
  guarda atômica `voting_status = CONCLUDED`, os participantes elegíveis e os
  vencedores, mas delega parte das estatísticas ao caminho posterior de XP.

### 2.2 Causa Raiz

Existem duas fontes de verdade com tempos diferentes: finalização do jogo e
conclusão da votação. A primeira não dispõe do resultado necessário; a segunda
não cobre todo o lifecycle das estatísticas.

### 2.3 Arquivos Afetados

- `functions/src/index.ts`
- `functions/src/voting/mvp-voting.ts`
- `functions/test/mvp-voting.test.ts`
- testes do trigger de finalização que afirmem os campos removidos

## 3. Solução Aprovada

### 3.1 Abordagem

1. Dentro da transação de `concludeMvpVoting`, ler a estatística atual do MVP
   antes de qualquer write.
2. Na mesma transação que marca a votação como concluída, atualizar os docs
   `statistics` de todos os participantes elegíveis:
   - incremento e streak do MVP;
   - incremento do Bola Murcha;
   - reset dos demais.
3. Fazer `applyVotingXpDelta` consumir as estatísticas canônicas já atualizadas
   para milestones, sem incrementar contadores/streaks.
4. Remover do trigger de `FINISHED` as escritas mortas de
   `bestPlayerCount`, `worstPlayerCount`, `currentMvpStreak` e
   `bestMvpStreak`.

### 3.2 Atomicidade e Idempotência

A guarda e as escritas de estatística pertencem à mesma transação. Duas
conclusões concorrentes observam o mesmo estado, uma vence, e a outra repete a
transação lendo `CONCLUDED`, retornando sem incrementar. O replay posterior
também é no-op para estatísticas; os deltas de XP continuam protegidos pelos
IDs determinísticos de `xp_logs`.

### 3.3 Riscos e Mitigações

- **Mais writes por conclusão:** um write de estatística por participante
  elegível. Partidas reais ficam muito abaixo do limite de 500 operações; o
  fechamento já escreve uma confirmação por participante.
- **Milestones duplicados:** `applyVotingXpDelta` deixa de somar 1 localmente e
  usa o documento já persistido; o `xp_log` determinístico mantém o replay
  idempotente.
- **Dados históricos incorretos:** esta correção evita novos desvios, mas não
  reconstrói streaks/contadores antigos. Eventual backfill deve ser uma tarefa
  separada, auditável e explicitamente aprovada.

## 4. Verificação

### 4.1 Testes Adicionados/Ajustados

- três MVPs consecutivos alcançam streak/best streak 3;
- participante que não vence o jogo seguinte tem streak zerado;
- Bola Murcha incrementa `worstPlayerCount`;
- replay de conclusão não incrementa estatísticas;
- fechamento sem vencedor zera streaks dos elegíveis;
- o caminho de XP não repete o incremento de MVP.

### 4.2 Regressão

- testes focados de `mvp-voting`;
- `npm run build`;
- `npm run lint`;
- suíte Functions completa, se o ambiente permitir;
- `git diff --check`.

## 5. Prevenção Futura

### 5.1 Por que não foi pego antes?

Os testes cobriam o delta individual de XP e helpers de badge, mas não a
sequência temporal completa `FINISHED -> CONCLUDED` para vários jogos.

### 5.2 Ações

- manter teste de lifecycle com múltiplas conclusões;
- concentrar estatísticas derivadas de votação na transação de conclusão;
- exigir marcador idempotente/guarda atômica em novos contadores pós-jogo.

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-13 | Codex | Análise, design e aprovação da correção |
| 2026-07-13 | Codex | Implementação verificada com 97 suítes de Functions |
