# SPEC XP — jogo com menos de 6 confirmados não gera XP mas UI diz que gerou (#4629 item 8)

> **Status:** `IN_PROGRESS`
> **Severidade:** `HIGH` (dinheiro/XP errado em produção)
> **Autor:** opencode
> **Data:** 2026-11-25
> **PR:** (a abrir)
> **Issue:** #4629 (item 8)

---

## 1. Diagnóstico (auditoria 25/11/2026)

### O que existe hoje
- `functions/src/xp/on-game-status-update.ts:38` (`const MIN_PLAYERS = 6`): se `validConfirmations.length < MIN_PLAYERS`, grava `xp_processed: true, xp_processing: false, xp_processed_at` **sem tocar `xp_reward_status`** — o status continua `ELIGIBLE`.
- `game-validation-gate.ts` decide `xp_reward_status` entre HELD_FOR_REVIEW/ELIGIBLE (gate).
- `post-game-effects.ts`: finaliza com `xp_reward_status: "PROCESSED"`.
- `validation/index.ts:90`: `MIN_PLAYERS_FOR_XP: 6` (const duplicada).
- Web (`GameDetailScreen.tsx:184`, `ELIGIBLE`) mostra "Recompensas liberadas para processamento" para um jogo que nunca pagará; Android mostra "Jogo validado" (`validation_banner_title_validated`).
- Votação MVP paga +50 independentemente do mínimo → num 2x2 só o MVP sobe (inconsistência ABERTA — mudança de payout fora desta spec).
- Auto-cancel do jogo (`reminders.ts:1299` + `games/auto-close-past-games.ts:26`) já usa o `min_players` do documento para cancelar, com fallback 6 — semântica diferente do piso de XP (jogo pode existir com <6; XP não paga).

### Por que o número 6 duplica
- `on-game-status-update.ts` (XP payout) — dono do piso.
- `validation/index.ts` (`MIN_PLAYERS_FOR_XP`) — espelho para gate/validação.
- `reminders.ts:1194` + `auto-close-past-games.ts:26` — fallback de cancelamento (lee `min_players` do doc quando presente).

## 2. decisão (esta spec)

| # | Decisão | Justificativa |
|---|---------|---------------|
| D1 | Novo `xp_reward_status = "INELIGIBLE_MIN_PLAYERS"` quando `< minPlayersForXp` no finalizer | Distingue "processado sem XP" de "aguardando processamento" (ELIGIBLE). Status é server-only (rules já bloqueiam o cliente). |
| D2 | Centralizar em `shared/xp-constants.json` → `minPlayersForXp: 6` (+ espelho em `functions/src/_constants/xp-constants.json`, sync test) | Source of truth único (REGRA #5); o CI já impõe o sync. |
| D3 | `xp_reward_hold_reasons: ["MIN_PLAYERS"]` junto com o status | Expõe o motivo; revisão administrativa (`reward-review.ts`) continua só sobre HELD_FOR_REVIEW (sem fila nova). |
| D4 | Banners web + Android com texto honesto | "Sem XP por jogo incompleto" em vez de "liberadas/validado". |
| D5 | Aviso na criação quando `maxPlayers < min` | Evita o jogo condenado desde a criação (item 8: "avisar na criação"). |
| D6 | Math de votação MVP INALTERADA | Mudança de payout é decisão de produto: MVP sozinho pagando +50 em 2x2 continua — ao menos a UI já diz que o jogo não rendeu. |

iOS: não há banner infra no detalhe do jogo → status novo cai no `else` (sem card); follow-up junto com "iOS não mostra análise".

## 3. Tarefas

- [ ] `shared/xp-constants.json` + `functions/src/_constants/xp-constants.json` + `constants.ts` accessor + enxame nos 2 sites (trigger + validation)
- [ ] `on-game-status-update.ts`: piso via constante + status/motivo no ramo `< min`
- [ ] `GameDetailScreen.tsx`: case `INELIGIBLE_MIN_PLAYERS` (banner info)
- [ ] `GameDetailScreen.kt` (Android): case + strings pt/en/es
- [ ] Aviso na criação (web `CreateGameScreen` quando maxPlayers < min)
- [ ] Testes: functions (xp-constants-sync já cobre), web (banner), Android unit
- [ ] Pipeline `backend-validator` (functions/rules/sync)

## 4. Fora

- `dateTime` Android não grava (auditoria de rules).
- Estender auto-cancel para respeitar `min_players` já funciona (doc).
- 2x2 MVP: decisão de produto pendente (D6).
