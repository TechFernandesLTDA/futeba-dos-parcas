# Session Handoff — Auditoria Permissões + Fix Lote + Runner Recovery (2026-06-08/09)

> Complementa handoffs anteriores. Sessão fechou 0 PRs/issues abertos, CI enfileirado (10 jobs, 2 runners processando).

## Big picture

**Auditoria completa Firestore rules + Cloud Functions + Web + Android** — 5 agentes paralelos, 41 bugs encontrados, 25 arquivos alterados, 7 issues abertas e fechadas, 2 PRs merged. Sessão também recuperou infra de runners (Colima corrompido, 4 macOS offline, 1 Linux Docker quebrado).

## PRs entregues

| PR | Tipo | Conteúdo |
|----|------|----------|
| [#2601](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/2601) | fix(audit) | 41 bugs — firestore.rules, Cloud Functions, web hooks, CPF Kotlin, XP docs, storage.rules |
| [#2602](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/2602) | fix(test) | `resetDb()` export + notifications.test.ts:446 fix — 48 suites, 849 tests, 0 fails |

## Issues resolvidas

| Issue | Severity | Tema |
|-------|----------|------|
| [#2594](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/2594) | CRITICAL | Subcollections sem regras (league_standings, league_seasons, badges) |
| [#2595](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/2595) | CRITICAL | Error leak em HttpsError + App Check ausente em callables |
| [#2596](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/2596) | HIGH | Timestamps client-side (`new Date()`) em vez de `serverTimestamp()` |
| [#2597](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/2597) | HIGH | Uso ad-hoc de `getFirestore()` ao invés do singleton `db` |
| [#2598](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/2598) | MEDIUM | `xp-constants.json` stale + CHUNK_SEND_DELAY_MS dead code |
| [#2599](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/2599) | MEDIUM | Web hooks sem contratos loading/error + useEffect sem cleanup |
| [#2600](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/2600) | HIGH | CPF `mask()` Kotlin retornava CPF real em vez de `"***"` |

## Decisões importantes

### `resetDb()` em `_db.ts` (PR #2602)
- **Problema:** Cache singleton de `admin.firestore()` quebrava mock do Jest. Teste `notifications.test.ts:446` chamava `admin.firestore.mockReturnValue(...)` mas `_db` já estava cacheado → mock antigo → `getUserFcmTokensWithMapping()` vazio → `sendNotificationToUsers` retornava 0 em vez de 2.
- **Solução:** `export const resetDb = () => { _db = undefined; }` em `functions/src/_db.ts`, chamado no `beforeEach`.
- **Por que não remover o cache?** Firebase-admin v13 exige singleton para evitar `app/no-app`.

### Timestamps client-side (PR #2601)
- **Decisão:** NÃO substituir por `serverTimestamp()` nos hooks web.
- **Razão:** Drift de clock é aceitável para janelas de 7 dias de expiração de convite. Adicionado comentário `// AUDIT:` documentando.
- **Exceção:** Writes continuam usando `serverTimestamp()` (regra geral).

### `CHUNK_SEND_DELAY_MS` e `xp-constants.json`
- Removido como dead code (zero consumidores). Teste que referenciava também removido.
- `functions/shared/xp-constants.json` deletado (stale partial copy — fonte da verdade é `functions/src/xp/constants.ts`).

### CPF `mask()` Kotlin
- `return cpf` → `return "***"` — sincronizado com TypeScript. Teste adicionado para CPF inválido.

### storage.rules — feedback_screenshots
- `allow write: if false` → `allow write: if isOwner(userId) && isImage() && isUnderSize(5)`

## Arquivos alterados (25)

| Caminho | Mudança |
|---------|---------|
| `firestore.rules` | +3 subcollections, +badges subcollection |
| `functions/src/_db.ts` | +`resetDb()` export |
| `functions/src/index.ts` | Error leak sanitizado, pre-fetch corrigido |
| `functions/src/notifications/batch-sender.ts` | App Check restaurado, CHUNK_SEND_DELAY_MS removido |
| `functions/src/notifications/helpers.ts` | getDb → db singleton |
| `functions/src/activities.ts` | getDb() consolidado |
| `functions/src/reminders.ts` | getDb() consolidado |
| `functions/src/user-management.ts` | getDb() consolidado |
| `functions/src/notifications/*.ts` | getDb() consolidado |
| `functions/src/voting/mvp-voting.ts` | getDb() consolidado |
| `functions/src/badges/game-badges.ts` | getDb() consolidado |
| `functions/src/groups/join-requests.ts` | getDb() consolidado |
| `functions/shared/xp-constants.json` | DELETED |
| `functions/test/batch-sender.test.ts` | Teste CHUNK_SEND_DELAY_MS removido |
| `functions/test/notifications.test.ts` | +`resetDb()` no beforeEach |
| `shared/.../CpfValidator.kt` | `return cpf` → `return "***"` |
| `shared/.../CpfValidatorTest.kt` | +teste mask() CPF inválido |
| `storage.rules` | feedback_screenshots upload permitido |
| `docs/xp_audit/XP_RULES.md` | 6 valores corrigidos |
| `web/src/hooks/useGroups.ts` | Timestamps, loading/error, cleanup |
| `web/src/hooks/useDreamTeam.ts` | Timestamps, loading/error, cleanup |
| `web/src/hooks/useGroupChallenges.ts` | Timestamps, loading/error, cleanup |
| `web/src/hooks/useOfflineQueue.ts` | Timestamps, loading/error, cleanup |
| `web/src/pages/group/JoinByInviteScreen.tsx` | Timestamps read-side |
| `web/src/pages/groups/InvitePlayersScreen.tsx` | Timestamps read-side |

## Infra — Runners (debug prolongado)

### Colima/Docker
- VM corrompida (vz driver stale após sleep do Mac) → `colima delete --force` + `colima start` → reinstanciada.

### Runner bv2-linux-mac-docker
- Container com config quebrada → removido do GitHub (ID 41), recriado com token novo → online.

### Runners macOS offline
- Mac, Mac2, brazuka-mac, brazuka-mac-2 com conexão stale → `svc.sh stop/start` nos 4 → todos online.

### CI re-trigger
- 3 workflows re-executados após correção: Cloud Functions CI, CodeQL, Lighthouse.

## Estado do CI neste momento

- **0 issues abertas**, **0 PRs abertos**
- **Fila:** 10 jobs (Validate Patterns x2, Functions Integration CI x2, Cloud Functions CI x2, PR Check, Semgrep, Claude Code Review, Auto Version Bump)
- **Rodando:** CodeQL + Lighthouse (Mac ocupado, Mac2 ocupado)
- **Tempo estimado pra limpar:** ~1-2h (2 runners macOS, ~5-30 min por job)
- **Causa:** 2 pushes master (#2601 + #2602) geraram duplicatas de cada workflow

## Runners ativos

| Runner | Repo | Status |
|--------|------|--------|
| Mac | futeba | online, busy |
| Mac2 | futeba | online, busy |
| brazuka-mac | brazuka-v2 | online, idle |
| brazuka-mac-2 | brazuka-v2 | online, busy |
| bv2-linux-mac-docker | brazuka-v2 | online, idle |
| bv2-windows-local (x10) | brazuka-v2 | online, idle |

## Lições aprendidas

1. **`_db.ts` singleton + Jest mock** são incompatíveis sem `resetDb()` — o cache sobrevive ao `jest.resetModules()`.
2. **Colima com vz driver** corrompe após o Mac dormir. Usar `colima delete --force && colima start` como recovery padrão.
3. **Runners launchd (`svc.sh`)** precisam de stop/start para reconectar após perda de rede — o daemon não faz reconnect automático.
4. **Firebase-admin v13 `app/no-app`** só aparece se criar múltiplas instâncias de Firestore — o cache singleton é necessário.

## Próximos passos

- Monitorar CI — esperar a fila de 10 jobs terminar (~1-2h)
- Nenhuma ação necessária, tudo merged e limpo
