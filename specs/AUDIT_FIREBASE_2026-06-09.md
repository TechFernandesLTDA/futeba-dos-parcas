# Auditoria Firebase/Functions/Triggers/GCloud — 2026-06-09

> **Status**: COMPLETED — 70 achados, issues #2605–#2653 abertas
> **Escopo**: Cloud Functions (~31,5k linhas TS, ~115 functions), triggers Firestore, scheduled jobs,
> firestore.rules (2505 linhas), storage.rules, firestore.indexes.json, firebase.json, dependências npm.
> **Método**: 4 auditorias paralelas (triggers/XP core · rules/config · auth/middleware/notificações ·
> scheduled/infra/GCloud) + validação de build/lint/testes.
> **Tracking**: Épico #2653

---

## Saúde da base (verificações que passaram)

| Verificação | Resultado |
|---|---|
| Build TypeScript (`tsc`) | ✅ sem erros |
| ESLint | ✅ sem erros |
| Jest | ✅ 48 suítes, 849 testes (13 skipped) |
| Região functions vs Firestore | ✅ 100% `southamerica-east1` |
| Timezone dos 26 schedulers ativos | ✅ `America/Sao_Paulo` |
| maxInstances global | ✅ `setGlobalOptions({maxInstances: 10})` |
| Rate limiter (`middleware/rate-limiter.ts`) | ✅ sliding window transacional, fail-closed |
| `setUserRole` | ✅ ADMIN + App Check + rate limit + audit |
| FCM batches/limpeza de tokens | ✅ chunks de 500, tokens inválidos removidos |
| Custom Claims FASE 2 | ✅ `isAdmin()` 0 reads, sem fallback Firestore |
| `constants.ts` vs `shared/xp-constants.json` | ✅ valores idênticos |
| Default deny catch-all (Firestore + Storage) | ✅ presente |
| Coleções server-only (xp_logs, statistics, etc.) | ✅ bloqueadas para client write |
| Secrets hardcoded | ✅ nenhum encontrado |
| retry-with-backoff | ✅ exponencial + jitter + DLQ (nits em #2651) |
| npm audit | ⚠️ 2 moderadas (qs via typed-rest-client) → #2652 |

---

## Sumário de achados

| Severidade | Qtde | Issues |
|---|---|---|
| CRITICAL | 2 | #2605, #2606 |
| HIGH | 10 | #2607–#2616 |
| MEDIUM | 31 | #2617–#2647 |
| LOW | 27 (5 lotes) | #2648–#2652 |
| **Total** | **70** | Épico: #2653 |

---

## CRITICAL

### #2605 — `onGroupDeleted`: cascade delete 100% inoperante
`functions/src/index.ts:1900-1917` — collection group query com `FieldPath.documentId() == groupId`
(ID de 1 segmento) lança exceção no SDK Admin **antes** de qualquer commit. Nenhum documento
relacionado (members, cashbox, invites, schedules) é jamais deletado; a função re-falha em todo retry.

### #2606 — `checkSeasonEnd` grava `undefined` → poison pill mensal
`functions/src/season/index.ts:222-236` — standing grava `final_division: p.division` sem fallback,
mas `division` nunca é escrita para jogador com 1 jogo (ver #2613). Sem `ignoreUndefinedProperties`,
`batch.set()` lança e o fechamento da season aborta — todo dia.

## HIGH

| Issue | Achado | Local |
|---|---|---|
| #2607 | Update de `games` pelo owner sem whitelist — backdating, MVP self-award (+30 XP), `owner_id` mutável | firestore.rules:636-660 |
| #2608 | Confirmado seta `is_mvp`/`is_best_gk`/`is_worst_player`; `group-league.ts:132` e `weekly-ranking.ts:191` consomem sem revalidar | firestore.rules:864-866 |
| #2609 | ADMIN de grupo pode setar `status: BANNED` no doc do OWNER (guard #1491 só protege self-update) | firestore.rules:1512-1515 |
| #2610 | `maintainStreaksData` (job mensal `0 4 1 * *`) nunca exportada no index.ts — nunca deployada | maintenance/compact-streaks.ts |
| #2611 | `runtimeOptions` no firebase.json é chave inválida — `startNewSeason`/`archiveSeason`/etc. rodam com 256MiB/60s | firebase.json:136-139 |
| #2612 | `@google-cloud/storage@5.20.5` (EOL 2022) direta, duplicada com a v7 transitiva do firebase-admin | functions/package.json:26 |
| #2613 | `recalculateLeagueRating` é `onDocumentUpdated` — não dispara no CREATE do `season_participation` (alimenta #2606) | index.ts:1277-1283 |
| #2614 | `bestPlayerCount`/`currentMvpStreak` nunca avançam no fluxo de votação — milestones MVP_5..50 e badge `mvp_streak_3` inalcançáveis | index.ts + mvp-voting.ts |
| #2615 | `game-badges.ts` lê `statistics.wins` e `users.{total_games,...}` que nenhuma function escreve — badges `wins_10`, `mvp_*`, `goals_10`, etc. mortos | badges/game-badges.ts:42-137 |
| #2616 | `onConfirmationWrite`: branch de troca de posição FIELD↔GOALKEEPER é dead code — `goalkeepers_count` deriva | index.ts:2057, 2078-2086 |

## MEDIUM

**XP/Triggers core** (#2617–#2626): race de milestone XP duplicado entre jogos concorrentes do mesmo
jogador; double-pay de MVP quando `mvp_id` vem na transição FINISHED; `monthKey` UTC vs season BRT;
janela com duas seasons `is_active`; throw no loop de seasons; `applyVotingXpDelta` engole erro
(XP perdido com `success: true`); cashbox recompute não transacional; league lock skip silencioso;
split de batch perde badges em retry; fórmula Android `/200` vs `/500`.

**Rules/Config** (#2627–#2636): `challenge_progress` client-writable; notificações arbitrárias
(spam/phishing); spoofing de `user_id` em activities; PII completa em users searchable (LGPD);
counters de games sem delta ±1; `mvp_votes` list quebra anonimato; storage `isGroupAdmin` sem
status ACTIVE; CSP `unsafe-inline`/`unsafe-eval`; **índice COLLECTION_GROUP da waitlist faltante
(query falha em prod)**; **`cancellations` collection-group sem rule nem fieldOverride
(updateAttendanceRate quebrado em prod)**.

**Auth/Notificações** (#2637–#2641): fila FCM reenvia a tokens já entregues + loop sem teto;
`markReminderSent` engole erro (lembretes duplicados, quebra FIX #2501); `requiredRole` fail-open
latente no `secureCallable`; SMS OTP rate limit apenas consultivo (SMS pumping); callables de
migração em massa sem lock/rate limit.

**Infra/GCloud** (#2642–#2647): sharp `.withMetadata()` **preserva** EXIF/GPS em thumbnails
(efeito oposto à intenção — LGPD); keep-warm.ts dead code zumbi; `migrateAllUsersToCustomClaims` e
`seedOfficialGroups` (não idempotente) deployadas; compact-streaks acumula coleção inteira em
256MiB; 4 cleanups sem cursor/loop (`cleanupOldMetrics`, `cleanupExpiredRateLimits`,
`cleanupDeadLetterQueue`, `cleanupOldAlerts`); weekly-ranking fan-out sem teto + doc rumo a 1MiB.

## LOW (lotes)

- **#2648** XP/core (6): `clampStat` NaN; `created_at` sobrescrito; `unlocked_at` sobrescrito;
  lock legado nunca expira; catch vazio em `resetXpRateLimit`; `was_present` vs `CONFIRMED`.
- **#2649** Rules/storage/índices (10): grace de verificação até 2026-08-03; `saves` sem bound;
  live events sem whitelist de type; índices redundantes; `hashCpf` fraco; DDDs inválidos;
  hard-delete de jogo FINISHED; perf de fallbacks; storage filename livre; predeploy sem lint.
- **#2650** Auth/notificações (7): invite codes `Math.random()`; `invited_by` não validado;
  callables sem rate limit; enumeração de CPF por código de erro; achievement triggers sem
  `claimOnce`; telefone em claro em `rate_limits`; `batchSize` sem clamp.
- **#2651** Infra/docs (4): colisões de horário de schedulers; comentários/docs divergentes
  (Node 20 vs 22 no CLAUDE.md, TTL 90 vs 30, "UTC" vs Sao_Paulo); nits do retry-with-backoff;
  split de codebases.
- **#2652** npm audit: `qs` moderado via `typed-rest-client`.

---

## Ordem de ataque sugerida

1. **Quebrado em produção hoje**: #2605, #2606 (+#2613), #2635, #2636, #2610 (+#2645)
2. **Integridade da gamificação**: #2614, #2615, #2616, #2607, #2608
3. **Segurança/LGPD**: #2609, #2642, #2630, #2628, #2629
4. **Confiabilidade**: #2637, #2638, #2611, demais MEDIUMs
5. **Lotes LOW**: #2648–#2652

⚠️ Conforme Regra #1 (SDD), mudanças em security rules e no pipeline de XP requerem spec
aprovada em `/specs/` antes da implementação.
