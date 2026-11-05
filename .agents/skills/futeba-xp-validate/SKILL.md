---
name: futeba-xp-validate
description: Valida integridade do XP system Futeba — constants, calculations, season reset, MVP/Bola Murcha, double-counting prevention. Use quando o usuário tocar XP logic OU pedir "verificar XP", "auditar pontuação", "fix XP".
---

# Futeba XP Validate

XP é core do gamification — bugs causam pontuações erradas em produção (irreversível sem migration scripts).

## Constants (single source of truth)

`shared/xp-constants.json` (raiz, usado por KMP) + `functions/src/_constants/xp-constants.json` (cópia local pra build config — manter em sync).

```json
{
  "PARTICIPATION": 10,
  "GOAL": 5,
  "ASSIST": 3,
  "SAVE": 2,
  "MVP": 50,
  "WIN": 20,
  "STREAK_3": 10,
  "STREAK_7": 20,
  "STREAK_10": 30
}
```

Regras:
- Mudança em UM dos arquivos requer mudança no OUTRO (sem fallback)
- Usar PR via `futeba-pr-flow` com escopo `feat(xp)` ou `fix(xp)`
- Cuidado: bumps em produção afetam históricos? Revisar `xp_logs` antes

## XP processing flow

```
Game.status = LIVE
  ↓ (events: goal, assist, save)
  events armazenados em /games/{id}/events
  ↓
Game.status = FINISHED
  ↓
onGameFinished trigger (Cloud Function)
  ↓
1. MVP voting opens (24h)
2. Após votes:
   - concludeMvpVoting: identifica MVP + Bola Murcha
   - processXpBatch: calcula XP por jogador + grava xp_logs
3. recalculateLeagueRating
4. Badge unlock checks
```

Code paths:
- `functions/src/xp/processing.ts` — main XP calculation
- `functions/src/xp/parallel-processing.ts` — batch optimization
- `functions/src/voting/mvp-voting.ts` — MVP/Bola Murcha logic

## Validações obrigatórias antes de mudar XP logic

1. **Idempotência**: re-rodar `onGameFinished` no MESMO game não deve dobrar XP
   - Verificar `xp_logs` tem `gameId + userId` como compound key OU check existência antes de gravar
2. **Atomicity**: usar Firestore transactions/batches pra evitar partial writes
3. **Season scope**: XP `globalXp` (lifetime) vs `seasonXp` (mensal) — não confundir
4. **Reset season**: 1º do mês, monthly cron job zera `seasonXp` mas mantém `globalXp`

## Bugs históricos (cuidado em refactor)

- Double counting em retry de função (PR antigo) — use `transactionId` per game
- Session XP not resetting (cron timing) — mensal 1st 00:00 UTC
- MVP self-vote — voting validation no callable

## Test coverage

`functions/test/xp-processing.test.ts` + `functions/test/mvp-voting.test.ts` cobrem:
- XP cálculo correto por evento
- Idempotência (re-process)
- Edge cases: 0 goals, multiple MVPs (tie), no votes

```bash
cd functions
npx jest --testPathPattern="xp|voting" --no-coverage
```

## Migration scripts (se XP histórico precisa ajuste)

`scripts/`:
- `recalculate_xp.js` — re-process xp_logs
- `reset_season.js` — manual season reset
- `fix_xp_overflow.js` — corrige bug específico

NUNCA rodar em prod sem dry-run primeiro:
```bash
node scripts/<script>.js --dry-run --project futebadosparcas
# Inspecionar output
node scripts/<script>.js --project futebadosparcas
```

## Workflow para mudança em XP

1. **Spec primeiro** (`futeba-spec`) — XP changes afetam UX visível
2. **Test coverage** novo cenário em `functions/test/`
3. **Migration script** se mudança quebra históricos
4. **Validação local** com emulator + seed data:
   ```bash
   cd functions && npm run build
   firebase emulators:start --only firestore,functions
   # Trigger manual via gcloud OU via UI
   ```
5. **PR via `futeba-pr-flow`** com escopo `feat(xp)` ou `fix(xp)`
6. **Deploy via `futeba-deploy`** após merge
7. **Validação prod** — checar `xp_logs` + Activity feed

## Referência

- AGENTS.md "XP System Quick Reference" tabela
- `.Codex/rules/firestore.md` — patterns de query
- Spec template: `specs/_TEMPLATE_FEATURE_MOBILE.md`
