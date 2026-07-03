# SPEC: Antifraude por Evidencia no Ciclo Completo do Jogo

> **Status:** `DRAFT`
> **Autor:** Codex
> **Data:** 2026-07-03
> **PR:** #xxx
> **Epicos:** #3204, #3205, #3206
> **Issues:** #3207, #3208, #3209, #3210, #3211, #3212, #3213, #3214, #3215, #3216, #3217

---

## 1. Requirements

O app ja tem protecoes pontuais: check-in server-side com GPS/QR, App Check e
rate limit; votacao MVP server-side; transicoes de status em Firestore Rules;
processamento de XP server-side com idempotencia; e detector de overlap temporal.

O problema restante e que esses controles nao formam uma decisao unica sobre a
confiabilidade do jogo inteiro. Inicio/fim, presenca manual, eventos, stats e
recompensas precisam de validacao por evidencia antes de afetar XP, ranking,
badges, reputacao e historico competitivo.

### Objetivo

Criar uma camada server-side de validacao por evidencia com score explicavel,
sinais auditaveis e rollout:

1. `AUDIT_ONLY`: calcula score/sinais sem bloquear.
2. `SOFT_GATE`: retem recompensas em baixa confianca.
3. `HARD_GATE`: impede recompensas sem validacao aprovada.

### Criterios de aceite

- [ ] Jogos recebem `validation_score` e `validation_status` server-side.
- [ ] Campos de validacao sao server-only em Firestore Rules.
- [ ] `startGame` e `finishGame` viram callables com App Check e auditoria.
- [ ] XP/ranking/badges dependem de `VALIDATED` ou `APPROVED_MANUALLY`.
- [ ] Eventos, stats e votos criticos nao tem bypass client-side.
- [ ] Admin revisa jogos suspeitos com justificativa auditavel.
- [ ] Web/Android explicam pendencias sem erro tecnico cru.

---

## 2. Estado e Recompensas

Status de validacao planejados:

```text
NOT_EVALUATED
PENDING
AUDIT_ONLY
VALIDATED
LOW_CONFIDENCE
REVIEW_REQUIRED
APPROVED_MANUALLY
REJECTED
```

Recompensas automaticas:

| Status | XP/ranking/badges |
| --- | --- |
| `VALIDATED` | Sim |
| `APPROVED_MANUALLY` | Sim, idempotente |
| `AUDIT_ONLY` | Sim durante rollout audit-only |
| `PENDING` | Nao |
| `LOW_CONFIDENCE` | Nao em soft/hard gate |
| `REVIEW_REQUIRED` | Nao |
| `REJECTED` | Nao |

---

## 3. Technical Design

### Campos server-only em `games/{gameId}`

- `validation_status`
- `validation_score`
- `validation_version`
- `validation_updated_at`
- `validation_mode`
- `validation_reasons`
- `validation_signals_summary`
- `started_at`, `started_by`, `start_validation_score`
- `finished_at`, `finished_by`, `finish_validation_score`
- `reviewed_at`, `reviewed_by`, `review_reason`

### `validation_signals_summary`

```ts
interface ValidationSignalsSummary {
  confirmed_count: number;
  checked_in_count: number;
  checked_in_ratio: number;
  qr_checkin_count: number;
  gps_checkin_count: number;
  event_count: number;
  score_event_consistent?: boolean;
  suspicious_overlap_count: number;
  impossible_travel_count: number;
  manual_presence_count: number;
  low_confidence_presence_count: number;
}
```

### Score v1

| Sinal | Delta |
| --- | --- |
| Base | +60 |
| Check-in ratio >= 50% | +15 |
| QR + GPS por >= 2 jogadores | +5 |
| Evento registrado | +5 |
| Placar consistente | +5 |
| Sem overlap | +5 |
| Sem deslocamento impossivel | +5 |
| Sem check-ins | -25 |
| Presenca manual alta | -20 |
| Overlap | -15 cada, max -45 |
| Deslocamento impossivel | -25 cada, max -50 |
| Finalizacao cedo | -20 |
| Evento/placar inconsistente | -20 |

Thresholds:

- `>= 75`: `VALIDATED`
- `50..74`: `LOW_CONFIDENCE`
- `< 50`: `REVIEW_REQUIRED`

### Callables planejadas

- `startGame`: owner/co-organizer/admin, jogo `CONFIRMED`, janela temporal,
  score parcial, auditoria, status `LIVE`.
- `finishGame`: owner/co-organizer/admin, jogo `LIVE`, score final,
  `VALIDATED` ou `REVIEW_REQUIRED`.
- `reviewGameValidation`: admin only, justificativa obrigatoria,
  `APPROVED_MANUALLY` ou `REJECTED`.

### Privacidade

- Sem coordenada precisa em sinais antifraude.
- Usar buckets de distancia, precisao e tempo.
- Device/app signals devem ser hashados e nao reversiveis.

---

## 4. UX

Estados esperados:

- jogo pronto para iniciar;
- faltam evidencias;
- localizacao/check-in insuficiente;
- recompensas retidas temporariamente;
- fila admin para revisar e aprovar/rejeitar.

Mensagens devem ser acionaveis:

- "Faltam check-ins suficientes para validar este jogo."
- "O jogo foi finalizado e esta em revisao antes de liberar XP."
- "Um ou mais jogadores tem conflito de horario com outro jogo."

---

## 5. Rollout

1. Audit-only: coleta score/sinais sem bloqueio.
2. Soft gate: recompensas retidas para `REVIEW_REQUIRED`.
3. Hard gate: start/finish via callable e writes criticos bloqueados.

Rollback por `app_settings/game_validation`:

- `mode = AUDIT_ONLY | SOFT_GATE | HARD_GATE`
- `rewards_gate_enabled = boolean`
- `direct_status_write_grace_enabled = boolean`

---

## 6. Verification

Comandos esperados:

```bash
cd functions
npm run build
npm run lint
npx jest --no-coverage

cd ../firestore-rules-tests
npm test

cd ../web
npm run lint
npm run build

./gradlew :app:compileDebugKotlin
```

---

## 7. Branch Progress Snapshot

Status observado na branch `feat/evidence-game-antifraud` nesta iniciativa:

Entregue ate agora:

- `validation_score`, `validation_status`, `validation_reasons` e resumo de sinais
  calculados server-side.
- gate de recompensas: jogos `REVIEW_REQUIRED` ficam com
  `xp_reward_status = HELD_FOR_REVIEW` ate revisao administrativa.
- revisao admin server-side com auditoria de:
  - decisao;
  - admin;
  - motivo;
  - status anterior/novo;
  - timestamp.
- MVP voting via Cloud Function e bloqueio de escrita client-side direta em
  `mvp_votes`.
- inicio/fim de jogo via callables no web e Android/shared.
- rules endurecidas para bloquear transicoes diretas client-side para `LIVE`
  e `FINISHED`.
- eventos criticos/live score/live stats movidos para fluxo server-side com
  callables e atualizacao transacional.
- `scoreEventConsistent` alimentando o score de validacao.
- sinais complementares de antifraude em check-in:
  - deslocamento impossivel por distancia/tempo;
  - late check-in;
  - trilha em `game_validation_signals`.
- auto-close orientado por evidencia com `auto_close_review_required` e
  metadados de validacao.
- UX web:
  - fila admin `/admin/game-reviews`;
  - banners de estado no detalhe do jogo.
- UX Android:
  - detalhe do jogo exibe estados de validacao/recompensa retida, aprovada,
    rejeitada, baixa confianca e revisao necessaria.

Ainda precisa de fechamento para review final do PR:

- consolidar comentarios nas issues/PR com o recorte final entregue;
- validar se ainda existe algum caminho legado restante para escrita indireta
  ou bypass operacional em score/eventos/fechamento;
- alinhar o estado final do PR remoto, pois parte dos commits locais pode
  depender de permissao de push/autenticacao GitHub.

---

## Referencias

- #3204, #3205, #3206, #3207, #3208, #3209, #3217
- `functions/src/voting/check-in.ts`
- `functions/src/voting/mvp-voting.ts`
- `functions/src/voting/temporal-overlap.ts`
- `functions/src/games/auto-close-past-games.ts`
- `functions/src/index.ts`
- `firestore.rules`
- `docs/xp_audit/XP_SPEC.md`
- `docs/xp_audit/XP_INVARIANTS.md`
- `docs/BUSINESS_RULES.md`

---

## Historico

| Data | Autor | Alteracao |
| --- | --- | --- |
| 2026-07-03 | Codex | Criacao inicial |
