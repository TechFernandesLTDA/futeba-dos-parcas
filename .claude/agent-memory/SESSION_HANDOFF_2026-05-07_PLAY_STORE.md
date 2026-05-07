# Session Handoff — Play Store Deploy + Phase 2 Full-Stack (2026-05-07)

> Doc durável pra retomar sem perder contexto. Complementa handoffs anteriores em `.claude/agent-memory/`.

## Big picture

**Issue #517 RESOLVIDA full-stack** + **Pipeline Play Store 100% operando** + **3 skills novas**. Sessão fechou em 0 PRs/issues abertos, todos CI verdes, deploy production OK.

## PRs entregues (15 nesta sessão)

| PR | Tipo | Conteúdo |
|----|------|----------|
| [#523](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/523) | feat | Discovery Android (issue #517 P1.b) — 9 tests |
| [#524](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/524) | chore | Spec + 7 scripts setup pipeline Play Store |
| [#525](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/525) | docs | Handoff continuação |
| [#526](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/526) | **feat** | **Phase 2 full-stack request-to-join (issue #517) — 39 tests novos** |
| [#527](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/527) | fix(ci) | Shell injection workflow pr-review-to-issues |
| [#528](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/528) | chore | Bump firebase 10→12 (16 alerts → 0) |
| [#529](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/529) | fix | Peer dep rules-unit-testing |
| [#530](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/530) | fix(ci) | Deploy workflows shell injection (google-services malformed) |
| [#531](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/531) | fix(ci) | Keystore path hardcoded em $RUNNER_TEMP |
| [#532](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/532) | debug | SHA8 do KEYSTORE_PASSWORD |
| [#533](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/533) | **fix(ci)** | **Senhas via base64 (root cause `$1` expansion)** |
| [#534-#536](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pulls?q=534+535+536) | debug | Iterações de diagnóstico password |
| [#537](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/537) | fix(ci) | `--no-configuration-cache --rerun-tasks` Gradle |

## Issue resolvida

- [#517](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/517) — "grupo público não tem discovery — outros não conseguem pedir entrada"
  - ✅ Phase 1 web (PR #521 sessão anterior)
  - ✅ Phase 1.b Android (PR #523)
  - ✅ Phase 2 full-stack (PR #526)
  - ⏸️ Phase 1.c iOS — aguarda reativação iOS

## Play Store Deploy — STATUS

**Run [25473394288](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/runs/25473394288) ✅ — pipeline funcionando.**

### O que está configurado

- 8 GitHub Secrets corretos (KEYSTORE_BASE64, KEYSTORE_PASSWORD_B64, KEY_ALIAS, KEY_PASSWORD_B64, GOOGLE_SERVICES_JSON, PLAY_STORE_SERVICE_ACCOUNT_JSON, ...)
- SHA-1 release cadastrado no Firebase
- Google Play Android Developer API habilitada
- Service Account com Release Manager no Play Console
- App `com.futebadosparcas` com 1+ release publicado

### Como fazer próximo release

```bash
# Opção 1 — manual via gh CLI
gh workflow run deploy-production.yml -R TechFernandesLTDA/futeba-dos-parcas --ref master

# Opção 2 — tag (recomendado)
git tag v1.22.0
git push origin v1.22.0
```

Track inicial: `internal`. Promoção pra production: `cd fastlane && bundle exec fastlane production` (10% rollout).

### Skills relevantes
- `/futeba-play-store` — guia completo
- `/futeba-gh-secrets` — workarounds setar secrets
- `/futeba-ci-triage` — debug se quebrar

## Skills novas (`.claude/skills/`)

3 skills novas (gitignored mas auto-discovered):
- **futeba-play-store** — deploy Android
- **futeba-gh-secrets** — secrets gotchas
- **futeba-fullstack-feature** — pattern PR #526

`futeba-ci-triage` ganhou 9 entradas novas (shell injection patterns).

## Bugs descobertos pelo caminho

1. **`$digit` em senhas expande no shell** — `gh secret set --body "$VAR"` perdia tudo após o `$1`
2. **Paths como secrets ficam mascarados** pelo GH em logs
3. **`echo '${{ secrets.JSON }}'`** quebra com chars especiais
4. **Gradle config cache** reusa valores antigos
5. **Drive `google-services.json` estava vazio** (0 bytes) — usei o do worktree main
6. **Play Console moveu API access em 2026** — agora é via "Usuários e permissões"

## Estado final do repo

- **Branch**: `claude/elated-shamir-94750e` em sync com origin/master
- **PRs abertos**: 0
- **Issues abertas**: 0
- **Dependabot alerts**: 0 (era 16)
- **Working tree**: clean

## Próximos passos sugeridos

### Curto prazo (ROI alto)
- Próximo release Android: criar tag v1.22.0 → deploy automático ✅
- Considerar criar secret dedicado `PLAY_STORE_DEPLOY_SA` (atualmente reaproveitando Firebase Admin SA — funciona mas longterm é melhor separar)

### Médio prazo
- **iOS Phase 1.c** — quando reativar trabalho iOS, replicar Discovery + JoinRequest no shared/FirebaseDataSource
- **Consolidar 3 sistemas de invite divergentes** — `invites/` (web) vs `groups.invite_code` (Android) vs `group_invites/` (não usado)
- **Migrar Android `GroupRepository.deleteGroup` → callable `softDeleteGroup`** — centralizar cascade

### Manutenção
- Promover release Internal → Production no Play Console quando confiante
- Monitorar deploy-production runs (deve ficar verde com setup atual)

## Refs rápidas

- Memory: `~/.claude/projects/-Users-renanlocatizfernandes-Code-personal-TechFernandesLTDA-futeba-dos-parcas/memory/MEMORY.md`
- Skills: `.claude/skills/` (gitignored)
- Spec Phase 2: `specs/feat-public-groups-join-requests.md`
- Spec Play Store: `specs/feat-2026-05-06-activate-play-store-pipeline.md`
- Workflows: `.github/workflows/deploy-production.yml`, `deploy-beta.yml`
- Drive credentials: `~/Library/CloudStorage/GoogleDrive-renankakinho69@gmail.com/Meu Drive/Projetos/Futeba/`
