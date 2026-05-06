# Session Handoff — Role Permissions + Group Bugs (2026-05-06)

> Documento durável para retomar trabalho em sessão futura sem perder contexto.

## O que foi feito (12 PRs, 1 dia)

| PR | Tipo | Issue | Mudança | Deploy |
|----|------|-------|---------|--------|
| #506 | docs | — | CLAUDE.md refresh (CMP Phase 2 done, skills index, ctx-mode) | — |
| #507 | spec | — | `specs/feat-2026-05-06-role-permissions-test-coverage.md` (DONE) | — |
| #508 | test | — | Layer 1 Kotlin: matriz 3 roles × 23 actions + UserExtensions (+56 tests) | — |
| #509 | test | — | Layer 2 Functions Jest: role gating em 4 callables (+29 tests) | — |
| #510 | test | — | Layer 3 Firestore Rules: pacote novo `firestore-rules-tests/` (+105 tests, 6 collections) | — |
| #512 | fix | #511 | groups read ADMIN bypass (rule + flip pinning test) | rules ✅ |
| #513 | ci | — | firestore-rules-ci.yml em self-hosted macOS (era ubuntu-latest, billing rejeitou) | — |
| #518 | fix | #515 | groups update parcial (validar name/desc só se no diff().affectedKeys()) (+8 tests) | rules ✅ |
| #519 | fix | #514 | rota `/join/:code` web + tela JoinByInviteScreen + rule da collection `invites/` (+13 tests) | rules + hosting ✅ |
| #520 | fix | #516 | groups hard-delete só admin; owner usa soft delete (+2 tests) | rules ✅ |
| #521 | feat | #517 P1 | Discovery de grupos públicos (web only) | hosting ✅ |

**Totais:** 213 tests novos, 4 issues fechadas (#511 #514 #515 #516), 1 issue ainda aberta (#517 com phases pendentes).

## Issues abertas relevantes

- **#517 OPEN** — public groups discovery + request to join. Phase 1 web feita; Phase 1.b Android e Phase 2 (request-to-join) pendentes. Detailed checklist no body.

## Fluxo de trabalho usado (validar antes de mudar)

1. Branch nomeado `<tipo>/<escopo>`
2. Edit + tests local
3. Run tests no layer afetado (`npm test` ou `./gradlew :app:testDebugUnitTest`)
4. `git commit` com Conventional Commits + Co-Authored-By
5. `git push -u origin <branch>`
6. `gh pr create` com body detalhado linkando issue
7. `gh pr merge <PR> --squash --admin --delete-branch` (admin merge OK pra docs/tests/fixes)
8. Se rule mudou: deploy via worktree isolado (`/tmp/futeba-deploy-<id>-$$`):
   ```
   git worktree add $DEPLOY_DIR origin/master
   firebase deploy --only firestore:rules --project futebadosparcas --non-interactive
   git worktree remove --force $DEPLOY_DIR
   ```
9. Se web mudou: `npm ci --legacy-peer-deps && npm run build` antes do `firebase deploy --only hosting`

## Bugs encontrados pelos próprios testes

- **#511 (groups read)** — Layer 3 detectou ADMIN sem read em grupo privado (isAdmin() ausente no bloco de visibilidade). Fixado em #512.
- **#514 (invites collection)** — investigação revelou collection sem rule + rota /join/:code ausente. Fixado em #519.
- **#515 (update parcial)** — investigação revelou rule rejeita update sem name+description. Fixado em #518.

## Decisões arquiteturais (registrar em DECISIONS.md se quiser permanecer)

1. **3 sistemas de invite divergentes:** `invites/` (web), `groups.invite_code` (Android), `group_invites/` (não usado). Ver memory `project_invite_systems_divergence.md`.
2. **Soft delete para groups via update:** owner faz `update({deleted_at, deleted_by, status})`. Hard delete só admin. Cascade pela Cloud Function `softDeleteGroup`.
3. **Pinning test pattern:** quando descobrir bug em rules, escrever assert documentando comportamento ATUAL (errado) e flipar quando fix mergear. Ver memory `feedback_pinning_test_pattern.md`.
4. **CI Firestore Rules em self-hosted macOS:** GitHub-hosted rejeita por billing. Pattern `runs-on: ${{ fromJSON(vars.RUNNER_LABELS || '["self-hosted","macOS","ARM64"]') }}`.
5. **Custom Claims case-sensitive:** `request.auth.token.role == 'ADMIN'` é literal. Diferente de `UserRole.fromString` (Kotlin) que usa `ignoreCase=true`.

## Próximos passos sugeridos (ordem por ROI)

1. **#517 Phase 1.b** (Android discovery, ~4h, mecânico)
2. **#517 Phase 2** (precisa spec própria, ~1-2 dias) — request to join + aprovação + notificação
3. Consolidar 3 sistemas de invite (refactor longo, baixa urgência)
4. Migrar Android `GroupRepository.deleteGroup` pra chamar callable `softDeleteGroup` (centraliza cascade)

## Referências rápidas

- Memory: `~/.claude/projects/-Users-renanlocatizfernandes-Code-personal-TechFernandesLTDA-futeba-dos-parcas/memory/MEMORY.md`
- Spec: `specs/feat-2026-05-06-role-permissions-test-coverage.md`
- Tests Kotlin: `app/src/test/java/com/futebadosparcas/domain/`
- Tests Functions: `functions/test/role-actions.test.ts`
- Tests Rules: `firestore-rules-tests/src/`
- CI workflow: `.github/workflows/firestore-rules-ci.yml`
