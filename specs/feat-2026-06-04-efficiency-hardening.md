# Spec — Efficiency Hardening (versionamento + sinal de testes + CI)

- **Status:** APPROVED (autorizado pelo PO em 2026-06-04 — "faça todas as recomendações")
- **Tipo:** Feature (infra / DevEx)
- **Data:** 2026-06-04
- **Autor:** Claude (Opus 4.8) + Renan (PO)
- **Decisões relacionadas:** `specs/DECISIONS.md` (#efficiency-versioning, #efficiency-test-signal, #efficiency-ci-cache)

---

## 1. Contexto & Motivação

Auditoria de convenções (2026-06-04) cruzando o estado real do repo com as práticas
de mercado em 2026. Achados que fundamentam esta spec:

- **Testes:** ~2.700 casos reais (44 unit Android + 12 instrumentados + 19 shared +
  47 functions + 94 web unit + 4 E2E web). Volume **saudável** e de **alto sinal**
  (boundary-value parametrizado, asserções comportamentais). NÃO há bloat nem
  sub-testagem. O salto de qualidade é em **sinal medível**, não em quantidade.
- **Versionamento:** `versions.json` é SSOT (Android 1.29.0 / Web 1.26.0 / iOS 1.6.0 /
  Functions 1.0.0), mas as tags git são repo-wide (`v1.30.0`) e rastreiam **apenas o
  Android** — Web/iOS/Functions não têm tag. A tag "mente".
- **CI:** gargalo é **compilação a frio** (build cache desligado desde 2026-01-14 por
  corrupção de KSP) em 2 runners Mac propensos a OOM — não é o volume de testes.

Referências (Tech Radar Vol 34 abr/2026; Meta JiTTests; Gradle 9.x config cache;
GitHub merge queue GA) consolidadas na conversa de origem.

## 2. Objetivos

1. Tags git com **escopo de plataforma** (`android-v*`, `web-v*`, `functions-v*`, `ios-v*`).
2. **Mutation testing** medindo sinal no domínio core (PIT p/ Kotlin, Stryker p/ TS).
3. **Diff-coverage gate** nos PRs (linhas alteradas), substituindo meta global.
4. **Reativar Gradle build cache + configuration cache** (raiz KSP resolvida/escopada).
5. **Semgrep** como guardrail barato contra pontos cegos de código gerado por IA.
6. **Affected-only CI** estendido + paralelismo Playwright + suporte a merge queue.
7. Preencher o **buraco de E2E web** na jornada crítica.

## 3. Não-objetivos

- Remote build cache **distribuído** (exige backend Develocity/HTTP cache node —
  diferido até haver infra; cache local + config cache primeiro).
- Migrar de `bump-version.js` p/ release-please (o custom funciona; só se a
  manutenção doer).
- Trocar SemVer por CalVer (SemVer + Conventional Commits está correto).
- Lockstep/unified versioning (errado p/ cadências de deploy distintas).

## 4. Fases (sequenciadas por risco)

| # | Frente | Arquivos-chave | Risco | Verificação |
|---|--------|----------------|-------|-------------|
| 0 | Spec + DECISIONS | `specs/*`, `DECISIONS.md` | — | review |
| 1 | Tags por plataforma | `scripts/bump-version.js`, `version-bump.yml`, `release.yml` | médio | dry-run local do script |
| 2a | Stryker (functions) | `functions/stryker.conf.json`, `functions/package.json`, `functions-ci.yml` | baixo | `npx stryker run` |
| 2b | Stryker (web) | `web/stryker.conf.json`, `web/package.json`, `web-ci.yml` | baixo | `npx stryker run` (scoped) |
| 2c | PIT (Android/shared) | `app/build.gradle.kts`, `shared/build.gradle.kts`, version catalog, `android-ci.yml` | baixo-médio | CI nightly |
| 3 | Diff-coverage gate | `functions-ci.yml`, `web-ci.yml`, `pr-check.yml` | baixo | PR de teste |
| 4 | Build cache + config cache | `gradle.properties`, version catalog (KSP), setup-gradle | **ALTO** | clean+incremental parity na CI |
| 5 | Semgrep | `.semgrep.yml`, novo workflow | baixo | `semgrep --config` |
| 6 | Affected-only + Playwright + merge_group | workflows `paths:`, `playwright.config.ts`, `merge_group` triggers | médio | PR routing |
| 7 | E2E web (jornada crítica) | `web/e2e/*.spec.ts` | baixo-médio | Playwright local c/ emulador |

**Ordem de entrega:** 0 → (1, 2a, 2b, 4, 5 em paralelo) → 2c, 3, 6 → 7.
Risco ALTO (fase 4) é feito pelo lead com verificação empírica, nunca "flip cego".

## 5. Decisões de produto/infra

- **Modelo de versão:** independente por plataforma + tags escopadas. Tags `v*`
  legadas permanecem (history); novas são escopadas. `release.yml` passa a disparar
  em `android-v*` (mantém `v*` por retrocompat durante transição).
- **Mutation score alvo:** 60–80% no core (`domain/ranking`, `domain/gamification`,
  `domain/validation`, `domain/authorization`, `functions/src/xp`, `functions/src/voting`,
  `functions/src/group-league`). Roda **nightly** (caro) + scoped-no-diff em PR.
- **Diff-coverage:** linhas novas/alteradas ≥ 80% cobertas (gate de PR), não meta global.
- **Build cache:** reabilitar com KSP1 (atual) após provar paridade clean/incremental;
  se algum task de KSP corromper, marcá-lo `outputs.cacheIf { false }` em vez de
  desligar o cache global.
- **Merge queue:** adicionar suporte (`merge_group` trigger) aos workflows, mas
  **não forçar** o gate (2 runners → fila pode atrasar; opt-in documentado).

## 6. Rollback

Cada fase é um PR isolado e reversível. Fase 4 (cache) tem maior risco: rollback =
reverter `gradle.properties` p/ `caching=false`. Tags escopadas não apagam as `v*`
existentes (aditivo).

## 7. DoD

- [ ] Cada fase em PR próprio, CI substantivo verde (build/lint/test).
- [ ] Mutation/Stryker rodando e reportando score (não só configurado).
- [ ] Build cache reativado COM evidência de paridade (sem codegen stale).
- [ ] Tags escopadas validadas por dry-run + 1 release real de cada plataforma.
- [ ] Sem strings/cores hardcoded em código novo; comentários PT-BR.
## 8. Progresso de entrega (atualizado 2026-06-05)

| Fase | Estado | PR | Nota |
|------|--------|----|------|
| 0 Spec + DECISIONS | ✅ **LANDED** | — | spec estava presa no branch de tags (#2509); desacoplada para master |
| 1 Tags por plataforma | ✅ **MERGED** | #2509 | tags escopadas `android-v*` em `version-bump.yml` + `release.yml`; **gap fechado neste PR**: `deploy-production.yml` (Play Store) passou a disparar em `android-v*.*.*` também — sem isso o bump geraria android-v* e o deploy nunca rodaria. `v*.*.*` mantido como legado. Validar no próximo release Android real |
| 2a Stryker functions | ✅ **MERGED** | #2508 | 90% mutation score em `group-league.ts`; job nightly+manual |
| 2b Stryker web | ✅ **MERGED** | #2510 | vitest-runner, `inPlace:true`; mutation só nightly |
| 2c PIT (Android/shared) | ⏸️ **DEFERRED** | — | `:shared` é KMP sem target `jvm()`; PIT (bytecode JVM) sobre KMP é finicky. Exige decisão de design (adicionar `jvm()` target só p/ domínio puro) — sondado, não implementado neste ciclo |
| 3 Diff-coverage gate | ✅ **MERGED** | #2513 | gate `diff-cover --fail-under=80` no job `test` do `functions-ci.yml` (linhas novas/alteradas, só em `pull_request`). **Web/Android = follow-up** |
| 4 Build cache | ✅ **MERGED** | #2514 | `org.gradle.caching=true` + `scripts/verify-build-cache.sh`; verify empírico OK (paridade de codegen, hits de cache confirmados) |
| 5 Semgrep | ✅ **MERGED** | #2507 | fix PEP 668 (venv isolado no runner); guarda `hashFiles(semgrep.sarif)` |
| 6 Affected-only + Playwright + merge_group | ✅ **F6a MERGED** | #2511 | CodeQL escopado p/ JS/TS (cron semanal = safety net). Playwright workers e `merge_group` **diferidos** (merge_group é config morta sem merge queue, que exige required status checks) |
| 7 E2E web (jornada crítica) | ✅ **MERGED** | #2512 | jornada login→games-tab em `web/e2e/jornada-jogos.spec.ts` |

**Nota de tooling (2026-06-04):** o modelo local `gemma4:12b-mlx` foi testado como
motor de análise para a F6. Veredito: forte em prosa PT-BR e em sumarização, mas
**confident-and-wrong** em raciocínio de CI/segurança — inverteu o achado do CodeQL e
não levantou a interação com branch protection. **Não rotear raciocínio de
CI/segurança para ele sob confiança.** Decisão final da F6a foi do lead, verificada.
