# Session Handoff — Continuação 2026-05-06 (issue #517 + Play Store setup)

> Sessão continuou do handoff anterior em `.claude/agent-memory/role-permissions/SESSION_HANDOFF.md` (PR #522).

## O que foi feito (2 PRs)

| PR | Tipo | Issue | Status | Mudança |
|----|------|-------|--------|---------|
| [#523](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/523) | feat | #517 P1.b | ✅ MERGED | Discovery Android (espelha PR #521 web): VM + Compose Screen + GroupRepository.getPublicGroupsFlow + Nav + Koin + 9 tests |
| [#524](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/524) | chore | — | ⏸️ OPEN (intencional) | Spec + 7 scripts pra ativar pipeline Play Store. Aguarda owner executar. |

## Estado das issues abertas

- **#517** — ainda OPEN. Phase 1 web (PR #521) + Phase 1.b Android (PR #523) DONE. Falta Phase 2 (request-to-join, precisa spec própria). Phase 1.c iOS pendente.

## PRs abertos pra revisão/ação

- **#524** — Setup Play Store pipeline. Não mergeei porque exige ações manuais do owner (Play Console UI + custo + keystore irreversível). Mergeie quando quiser usar.

## Próximos passos sugeridos (ordem ROI)

1. **Ativar Play Store pipeline** (~1-2h) — merge PR #524, seguir scripts 00→06
2. **#517 Phase 2** (~1-2 dias) — spec `specs/feat-public-groups-join-requests.md` antes de codar (request-to-join + aprovação + notificação)
3. **#517 Phase 1.c iOS** (depende reativar trabalho iOS, ~2-3h após shared/FirebaseDataSource update)
4. **Consolidar 3 sistemas de invite** (refactor longo, baixa urgência) — ver memory `project_invite_systems_divergence.md`
5. **Migrar Android `GroupRepository.deleteGroup` → callable `softDeleteGroup`** (centraliza cascade)

## Decisões tomadas nesta continuação

1. **Discovery Android usa `data.repository.GroupRepository`** (Android-only) ao invés de shared/KMP — caminho mais curto. Migração KMP fica pra Phase 1.c iOS.
2. **`data.model.Group`** (com @PropertyName + deletedAt) preferido sobre `domain.model.Group` (KMP, sem @SerialName útil pro Firestore Android SDK).
3. **PR #524 não mergear automaticamente** — gates de segurança: keystore irreversível, ações manuais Play Console exigem owner.

## Referências rápidas

- Memory: `~/.claude/projects/-Users-renanlocatizfernandes-Code-personal-TechFernandesLTDA-futeba-dos-parcas/memory/MEMORY.md`
- Handoff anterior: `.claude/agent-memory/role-permissions/SESSION_HANDOFF.md`
- Spec Phase 1.b: spec implícita na issue #517 body
- Spec Play Store: `specs/feat-2026-05-06-activate-play-store-pipeline.md`
- Scripts Play Store: `scripts/setup/play-store/`
- Tests Discovery: `app/src/test/java/com/futebadosparcas/ui/groups/DiscoverGroupsViewModelTest.kt` (9/9 pass)
