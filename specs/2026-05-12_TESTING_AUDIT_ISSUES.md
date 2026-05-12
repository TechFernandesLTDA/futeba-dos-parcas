# Testing & Access Audit — 16 Issues (2026-05-12)

Gerado a partir de auditoria contra `specs/PERMISSION_MATRIX.md` (2026-05-11).
Gaps #1–#6 já corrigidos em #1026, #1039, #1072. Issues abaixo cobrem lacunas restantes + infraestrutura de testes.

---

## Issue 1: GAP #7 — Adicionar VerifiedRoute em `/game/create`

**Labels:** `bug`, `area:web`, `priority:P1`, `type:bug`
**Scope estimate:** 0.5 dias

### Context
`/game/create` está dentro de `<ProtectedRoute><AppLayout/>` em `web/src/App.tsx:388` sem gate de verificação. Usuário não-verificado vê o formulário, mas o submit falha silenciosamente pelas Firestore rules. `VerifiedRoute` já existe em `web/src/App.tsx:204`.

### Acceptance criteria
- [ ] `<CreateGameScreen />` é envolvido por `<VerifiedRoute>` em `web/src/App.tsx`
- [ ] Usuário não-verificado que acessa `/game/create` é redirecionado para `/profile/setup` ou tela de verificação
- [ ] Playwright: teste em `access-matrix.spec.ts` confirma redirect para PLAYER não-verificado
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `web/src/App.tsx:388` — envolver `<CreateGameScreen />` com `<VerifiedRoute>`
- `web/src/App.tsx:204` — referência da implementação existente de `VerifiedRoute`

### Verification
`npx playwright test web/e2e/access-matrix.spec.ts` — teste de usuário não-verificado em `/game/create` deve retornar redirect, não status 200 com formulário.

---

## Issue 2: GAP #8 — Consolidar FieldOwnerRoute e FieldOwnerOrAdminRoute

**Labels:** `enhancement`, `area:web`, `priority:P2`, `type:enhancement`
**Scope estimate:** 0.5 dias

### Context
`FieldOwnerRoute` (linha 247) e `FieldOwnerOrAdminRoute` (linha 300) em `web/src/App.tsx` possuem lógica idêntica: permitem FIELD_OWNER ou ADMIN. A duplicação cria risco de divergência futura.

### Acceptance criteria
- [ ] Apenas um componente de rota permanece: `FieldOwnerOrAdminRoute`
- [ ] Todas as ocorrências de `FieldOwnerRoute` substituídas por `FieldOwnerOrAdminRoute`
- [ ] JSDoc explica semântica do componente unificado
- [ ] Nenhuma rota existente muda comportamento de acesso
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `web/src/App.tsx:247` — definição de `FieldOwnerRoute` (remover)
- `web/src/App.tsx:300` — definição de `FieldOwnerOrAdminRoute` (manter, adicionar JSDoc)

### Verification
`grep -n "FieldOwnerRoute" web/src/App.tsx` deve retornar apenas ocorrências de `FieldOwnerOrAdminRoute`.

---

## Issue 3: GAP #9 — Alinhar MANAGE_GROUP_CASHBOX entre Android, Web e Rules

**Labels:** `bug`, `area:android`, `area:web`, `area:rules`, `priority:P1`, `type:bug`
**Scope estimate:** 2 dias (1ª etapa: decisão; 2ª etapa: implementação)

### Context
`UserPermissions.kt` (KMP shared) restringe `MANAGE_GROUP_CASHBOX` a FIELD_OWNER/ADMIN globalmente, enquanto Firestore rules permitem qualquer membro do grupo (ou group admin para certas ops). Web não tem gate de UI. `specs/PERMISSION_MATRIX.md` row #9. **Bloqueia outras issues:** decisão precisa ser tomada antes da implementação.

### Acceptance criteria
- [ ] **P0**: Decisão de produto documentada em `specs/DECISIONS.md` ANTES de qualquer código: apertar rules (requer `isGroupAdmin`) OU afrouxar Android (depender de role de grupo). Sem decisão, issue fica bloqueada.
- [ ] `UserPermissions.kt` (KMP) alinhado com a decisão
- [ ] `firestore.rules` `cashbox` collection reflete a decisão
- [ ] Web: botões de cashbox condicionais ao role correto (`CashboxScreen.tsx`)
- [ ] `firestore-rules-tests/src/cashbox.test.ts` cobre o cenário (ver Issue 11)
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `shared/src/commonMain/kotlin/com/futebadosparcas/domain/authorization/UserPermissions.kt:77` — `MANAGE_GROUP_CASHBOX` ação
- `firestore.rules` — bloco `match /groups/{groupId}/cashbox/{entryId}`
- `web/src/pages/groups/CashboxScreen.tsx` — adicionar gate UI
- `specs/DECISIONS.md` — registrar decisão

### Verification
Rules test `cashbox.test.ts` e UI manual: usuário PLAYER sem role de grupo não consegue acessar cashbox.

---

## Issue 4: GAP #10 — UI gate nos botões de edição em location detail

**Labels:** `bug`, `area:web`, `priority:P2`, `type:bug`
**Scope estimate:** 0.5 dias

### Context
`/location/:locationId` permite qualquer usuário autenticado. A página mostra botões de editar/deletar para todos, mas a navegação para `/location/:locationId/edit` (que usa `FieldOwnerOrAdminRoute`) falha silenciosamente para não-proprietários.

### Acceptance criteria
- [ ] Botões editar/deletar em `LocationDetailScreen` apenas visíveis se `user.role === 'ADMIN'` ou `user.uid === location.owner_id` ou `location.managers?.includes(user.uid)`
- [ ] Usuário sem permissão não vê os botões (sem alteração nas rules)
- [ ] Playwright: teste confirma ausência dos botões para PLAYER sem ownership
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `web/src/pages/location/LocationDetailScreen.tsx` — adicionar render condicional nos botões de ação
- `web/src/contexts/AuthContext.tsx` — referência para `user.uid` e `user.role`

### Verification
Logar como PLAYER sem ownership e acessar qualquer location detail — botões editar/deletar não devem aparecer no DOM.

---

## Issue 5: Setup Lighthouse CI para web

**Labels:** `enhancement`, `area:web`, `area:ci`, `priority:P1`, `type:feature`
**Scope estimate:** 1.5 dias

### Context
Nenhum `.lighthouserc.cjs` ou workflow Lighthouse existe. Sem budget de performance, regressões passam despercebidas. Self-hosted macOS runner disponível. `web/playwright.config.ts` já configura build preview como referência.

### Acceptance criteria
- [ ] `@lhci/cli` adicionado como devDependency em `web/package.json`
- [ ] `.lighthouserc.cjs` criado na raiz de `web/` com budgets: LCP < 2500ms, INP < 200ms, CLS < 0.1, score performance >= 85
- [ ] `.github/workflows/web-lighthouse-ci.yml` executa em PRs que tocam `web/`
- [ ] Workflow roda `npm run build && npm run preview` antes do LHCI collect
- [ ] CI fails (warn) se budget for violado
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `web/package.json` — adicionar `@lhci/cli`
- `web/.lighthouserc.cjs` — criar (novo arquivo)
- `.github/workflows/web-lighthouse-ci.yml` — criar (novo arquivo)

### Verification
Abrir PR com regressão artificial de performance — workflow deve falhar com relatório LHCI.

---

## Issue 6: Criar módulo Android Macrobenchmark

**Labels:** `enhancement`, `area:android`, `area:ci`, `priority:P2`, `type:feature`
**Scope estimate:** 2 dias

### Context
Existe `baselineprofile/` mas nenhum módulo `macrobenchmark/`. Sem benchmarks, regressões de startup e scroll só são detectadas por usuários em produção. Referência: [Android Macrobenchmark docs](https://developer.android.com/topic/performance/benchmarking/macrobenchmark-overview).

### Acceptance criteria
- [ ] Módulo `macrobenchmark/` criado com `build.gradle.kts` adequado
- [ ] Benchmarks iniciais: cold startup, scroll HomeScreen, scroll RankingScreen, TTI GameDetailScreen
- [ ] Benchmarks executam em emulador API 34 (`-Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.profiling.mode=None`)
- [ ] `.github/workflows/android-benchmark.yml` roda em push para `master` (não em PRs)
- [ ] Resultados publicados como artifact no workflow
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `macrobenchmark/build.gradle.kts` — criar (novo módulo)
- `settings.gradle.kts` — incluir `:macrobenchmark`
- `.github/workflows/android-benchmark.yml` — criar (novo arquivo)

### Verification
`gh run list --workflow=android-benchmark.yml` mostra execução bem-sucedida. Artifact contém JSON de resultados.

---

## Issue 7: Cloud Functions p95 latency monitoring

**Labels:** `enhancement`, `area:functions`, `priority:P2`, `type:feature`
**Scope estimate:** 1.5 dias

### Context
`functions/src/monitoring/` existe (`alerting.ts`, `collect-metrics.ts`) mas não há rastreamento de latência por callable. Com ~30 callables em produção, não há visibilidade de regressões de p95. Problemas são detectados via reclamações de usuários.

### Acceptance criteria
- [ ] `functions/src/monitoring/collect-latency-metrics.ts` criado como scheduled function (diária)
- [ ] Agrega `executionTime` de Cloud Logging para cada callable
- [ ] Escreve resumo diário em `metrics/{date}_callable_latency` no Firestore
- [ ] Alerta via `alerting.ts` quando qualquer callable p95 > 2000ms
- [ ] Testes unitários em `functions/test/monitoring/collect-latency-metrics.test.ts`
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `functions/src/monitoring/collect-latency-metrics.ts` — criar (novo arquivo)
- `functions/src/monitoring/alerting.ts` — integrar alerta p95
- `functions/src/index.ts` — registrar scheduled function
- `functions/test/monitoring/collect-latency-metrics.test.ts` — criar testes

### Verification
Deploy em staging, aguardar execução scheduled, verificar documento `metrics/{today}_callable_latency` no Firestore.

---

## Issue 8: Playwright role-based fixtures (Page Object Model)

**Labels:** `enhancement`, `area:web`, `area:testing`, `priority:P1`, `type:feature`
**Scope estimate:** 1 dia

### Context
Os 9 testes Playwright existentes em `web/e2e/` não têm helpers de login por role. Para a matrix de acesso (Issue 9) e testes futuros, fixtures reutilizáveis são necessárias. Emulador Firebase com test users documentados em `reference_test_users_authorized.md`.

### Acceptance criteria
- [ ] `scripts/seed-e2e-users.ts` cria 3 test users no emulador (PLAYER/FIELD_OWNER/ADMIN) com Custom Claims setados via Admin SDK
- [ ] `web/e2e/fixtures/auth.ts` com `loginAsPlayer()`, `loginAsFieldOwner()`, `loginAsAdmin()` usando emulador
- [ ] Credenciais lidas de `web/.env.test` (não hardcoded, não commitar valores reais — apenas `.env.test.example`)
- [ ] `web/e2e/fixtures/index.ts` exporta fixtures para `test.extend<>()`
- [ ] `web/e2e/README.md` documenta: setup do emulador, comando seed, `.env.test` vars, como rodar
- [ ] `playwright.config.ts` tem `globalSetup` rodando o seed antes do test run
- [ ] Fixtures usados em pelo menos 1 spec existente (smoke test)
- [ ] CI passes (CI roda emulador + seed antes dos testes)
- [ ] PR follows Conventional Commits

### File pointers
- `scripts/seed-e2e-users.ts` — criar (script Node que cria users via Admin SDK no emulador)
- `web/e2e/fixtures/auth.ts` — criar (novo arquivo)
- `web/e2e/fixtures/index.ts` — criar (novo arquivo)
- `web/e2e/README.md` — criar (novo arquivo)
- `web/.env.test.example` — criar (template sem valores reais)
- `web/playwright.config.ts` — adicionar `globalSetup`

### Verification
`cd web && npx playwright test web/e2e/auth.spec.ts` passa sem credenciais hardcoded. README descreve setup completo.

---

## Issue 9: Playwright E2E access matrix (3 roles × 10 rotas)

**Labels:** `enhancement`, `area:web`, `area:testing`, `priority:P1`, `type:feature`
**Scope estimate:** 2 dias

### Context
9 testes em 2 specs cobrem apenas happy paths de auth e navegação. Nenhum teste valida que rotas restritas bloqueiam corretamente os roles errados. Depende de Issue 8 (fixtures). Matrix definida em `specs/PERMISSION_MATRIX.md`.

### Acceptance criteria
- [ ] `web/e2e/access-matrix.spec.ts` criado com mínimo 30 testes
- [ ] Rotas testadas: `/`, `/games`, `/game/create`, `/groups`, `/group/create`, `/locations`, `/location/create`, `/admin/users`, `/settings/gamification`, `/owner/dashboard`
- [ ] Roles testados: PLAYER, FIELD_OWNER, ADMIN (usando fixtures de Issue 8)
- [ ] Cada teste asserta: navegação OK OU redirect para `/` OU componente `AccessDenied` visível
- [ ] Spec executa em CI (PR + master)
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `web/e2e/access-matrix.spec.ts` — criar (novo arquivo)
- `web/e2e/fixtures/` — depende de Issue 8

### Verification
`cd web && npx playwright test web/e2e/access-matrix.spec.ts` reporta 30+ testes passing. `npx playwright show-report` mostra matrix visual.

---

## Issue 10: Android Compose semantics tests para top 15 telas

**Labels:** `enhancement`, `area:android`, `area:testing`, `priority:P1`, `type:feature`
**Scope estimate:** 3 dias

### Context
56 telas existem no app; apenas 3 têm `ScreenTest.kt` (Home, Login, Games). Sem testes de semântica, estados de loading/error/empty/success podem regredir silenciosamente. Baseado em cobertura de UI Compose por tela de uso.

### Acceptance criteria
- [ ] Testes criados para: GamesScreen (done), GameDetailScreen, LiveGameScreen, GroupsScreen, GroupDetailScreen, RegisterScreen, ProfileScreen, RankingScreen, LeagueScreen, MVPVoteScreen, CreateGameScreen, LocationDetailScreen, FieldOwnerDashboardScreen
- [ ] Cada teste verifica 4 estados via `composeTestRule.onNodeWithTag(...)`: loading (shimmer), error (retry button), empty (action present), success (conteúdo principal)
- [ ] Tags semânticas adicionadas nas telas sem tag (`testTag("loading_state")`, `testTag("error_state")`, etc.)
- [ ] Todos os novos testes passam em `./gradlew :app:testDebugUnitTest`
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `app/src/test/java/com/futebadosparcas/ui/` — adicionar `*ScreenTest.kt` por tela
- `app/src/main/java/com/futebadosparcas/ui/components/states/LoadingState.kt` — referência para tags existentes

### Verification
`./gradlew :app:testDebugUnitTest` reporta 15+ test classes. `grep -r "ScreenTest" app/src/test/ | wc -l` >= 15.

---

## Issue 11: Rules tests para coleções de alta prioridade ausentes

**Labels:** `enhancement`, `area:rules`, `area:testing`, `priority:P1`, `type:feature`
**Scope estimate:** 2 dias

### Context
`firestore-rules-tests/src/` cobre 8 coleções (~160 testes). ~42 coleções não têm cobertura. Prioridade: coleções financeiras e de estado de jogo ao vivo que têm maior risco de fraude.

### Acceptance criteria
- [ ] `firestore-rules-tests/src/cashbox.test.ts` criado (~20 testes: CRUD por role)
- [ ] `firestore-rules-tests/src/mvp-votes.test.ts` criado (~15 testes: voting window, double vote prevention)
- [ ] `firestore-rules-tests/src/live-games.test.ts` criado (~15 testes: only ADMIN/owner writes)
- [ ] `firestore-rules-tests/src/xp-logs.test.ts` criado (~15 testes: read-only para user, write apenas CF)
- [ ] `firestore-rules-tests/src/schedules.test.ts` criado (~15 testes)
- [ ] Todos os novos testes executam em `firestore-rules-ci.yml`
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `firestore-rules-tests/src/groups.test.ts` — padrão de referência (34 testes)
- `firestore-rules-tests/src/cashbox.test.ts` — criar (novo arquivo)
- `firestore-rules-tests/src/mvp-votes.test.ts` — criar (novo arquivo)
- `firestore-rules-tests/src/live-games.test.ts` — criar (novo arquivo)
- `firestore-rules-tests/src/xp-logs.test.ts` — criar (novo arquivo)
- `firestore-rules-tests/src/schedules.test.ts` — criar (novo arquivo)

### Verification
`cd firestore-rules-tests && npm test` reporta 240+ testes (160 existentes + ~80 novos). Sem skips.

---

## Issue 12: Rules tests para coleções de gamificação e atividades

**Labels:** `enhancement`, `area:rules`, `area:testing`, `priority:P2`, `type:feature`
**Scope estimate:** 2 dias

### Context
Coleções de gamificação (`badges`, `rankings`, `season_participation`, `user_badges`, `ranking_deltas`, `activities`) não têm testes de rules. `ranking_deltas` é especialmente crítica: issue #584 identifica risco de fraude de XP via escrita direta do cliente.

### Acceptance criteria
- [ ] `firestore-rules-tests/src/activities.test.ts` criado (~15 testes)
- [ ] `firestore-rules-tests/src/badges.test.ts` criado (~15 testes: ADMIN-only write)
- [ ] `firestore-rules-tests/src/season-participation.test.ts` criado (~15 testes)
- [ ] `firestore-rules-tests/src/user-badges.test.ts` criado (~15 testes)
- [ ] `firestore-rules-tests/src/ranking-deltas.test.ts` criado (~15 testes: cliente NÃO pode escrever — fix #584)
- [ ] `ranking_deltas` rule em `firestore.rules` bloqueia writes de client (se ainda não corrigido)
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `firestore.rules` — verificar/corrigir seção `ranking_deltas`
- `firestore-rules-tests/src/ranking-deltas.test.ts` — criar (novo arquivo, foco em fraud prevention)
- `firestore-rules-tests/src/` — demais arquivos novos

### Verification
`cd firestore-rules-tests && npm test` passa com 300+ testes. Teste de escrita direta em `ranking_deltas` por PLAYER falha (== regra bloqueou corretamente).

---

## Issue 13: KMP shared module — cobertura de testes (4 → 30+ testes)

**Labels:** `enhancement`, `area:kmp`, `area:testing`, `priority:P2`, `type:feature`
**Scope estimate:** 2 dias

### Context
`shared/src/commonTest/kotlin/` tem apenas 4 testes. Domain models, use cases de XP/MVP/streak e wrappers de Result não têm cobertura. Erros em lógica compartilhada afetam Android e iOS simultaneamente.

### Acceptance criteria
- [ ] Testes de domain models: `User`, `Game`, `Group` (validação, igualdade, defaults)
- [ ] Testes de XP: cálculo com caps anti-cheat (GOALS=15, ASSISTS=10, SAVES=30), streaks (3/5/7/10), MVP bonus
- [ ] Testes de MVP eligibility: usuário sem participação não pode votar, double vote rejeitado
- [ ] Testes de Result wrappers: `Result.success`, `Result.failure`, transformações
- [ ] `./gradlew :shared:testDebugUnitTest` passa com 30+ testes
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `shared/src/commonTest/kotlin/` — adicionar arquivos de teste por domínio
- `shared/xp-constants.json` — referência para valores esperados nos testes de XP
- `shared/src/commonMain/kotlin/` — referência das classes a testar

### Verification
`./gradlew :shared:testDebugUnitTest` reporta 30+ testes. `grep -r "@Test" shared/src/commonTest/ | wc -l` >= 30.

---

## Issue 14: Web Vitals tracking em produção

**Labels:** `enhancement`, `area:web`, `priority:P2`, `type:feature`
**Scope estimate:** 1 dia

### Context
Não há instrumentação de Web Vitals em produção. Sem dados de LCP/INP/CLS reais, decisões de performance são baseadas em Lighthouse local (Issue 5) mas não em usuários reais. Firebase Analytics já configurado.

### Acceptance criteria
- [ ] `web-vitals` adicionado como dependency em `web/package.json`
- [ ] `web/src/utils/vitals.ts` criado: coleta LCP, INP, CLS, FCP, TTFB e envia via `logEvent('web_vital', {name, value, rating})`
- [ ] Chamado em `web/src/main.tsx` ou equivalente entry point
- [ ] Documentação em `web/src/utils/vitals.ts`: como consultar no BigQuery (Firebase Analytics export)
- [ ] Não afeta bundle size em > 5KB (web-vitals é tree-shakeable)
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `web/package.json` — adicionar `web-vitals`
- `web/src/utils/vitals.ts` — criar (novo arquivo)
- `web/src/main.tsx` — chamar `reportWebVitals()` no boot

### Verification
Abrir app em produção, inspecionar Network tab → Firebase Analytics endpoint → evento `web_vital` presente com `name: "LCP"` e `value` numérico.

---

## Issue 15: Android SLO de startup e scroll via Macrobenchmark

**Labels:** `enhancement`, `area:android`, `area:ci`, `priority:P2`, `type:feature`
**Scope estimate:** 1 dia

### Context
Depende de Issue 6 (módulo macrobenchmark). Com benchmarks estabelecidos, esta issue define SLOs formais e gates de release. Sem SLOs, benchmarks são informativos mas não preventivos.

### Acceptance criteria
- [ ] SLOs definidos em `macrobenchmark/SLO.md`: cold startup < 1500ms P95, scroll jank HomeScreen < 5%, scroll jank RankingScreen < 5%
- [ ] `android-benchmark.yml` atualizado: falha se regressão > 20% comparada ao baseline do commit anterior
- [ ] Baseline do `master` atual capturado e commitado como `macrobenchmark/baseline.json`
- [ ] Relatório de violação publicado como GitHub comment no PR
- [ ] CI passes
- [ ] PR follows Conventional Commits

### File pointers
- `macrobenchmark/SLO.md` — criar (novo arquivo com definição de SLOs)
- `macrobenchmark/baseline.json` — criar (gerado pelo primeiro run)
- `.github/workflows/android-benchmark.yml` — adicionar comparação e gate (depende de Issue 6)

### Verification
Introduzir regressão artificial de startup (sleep em Application.onCreate) → PR deve ter comment de falha de SLO no workflow.

---

## Issue 16: Firestore query performance suite com emulador

**Labels:** `enhancement`, `area:functions`, `area:testing`, `priority:P2`, `type:feature`
**Scope estimate:** 2 dias

### Context
Não existe suite de performance para queries Firestore. Queries `whereIn` (limite 10), paginação com `startAfter`, e listeners sem cleanup podem degradar silenciosamente. Emulador Firebase já usado em `functions/test/`.

### Acceptance criteria
- [ ] `functions/test/performance/` diretório criado
- [ ] `functions/test/performance/homescreen-queries.test.ts`: simula carga de HomeScreen, asserta < 500ms e < 100 doc reads
- [ ] `functions/test/performance/ranking-queries.test.ts`: simula RankingScreen load
- [ ] `functions/test/performance/gamedetail-queries.test.ts`: simula GameDetailScreen open
- [ ] `functions/test/performance/whereIn-batching.test.ts`: valida que queries com >10 IDs são batched em chunks de 10
- [ ] Testes executam contra Firebase emulator (`FIRESTORE_EMULATOR_HOST` set)
- [ ] CI passes (integrado em `functions-ci.yml` ou novo workflow)
- [ ] PR follows Conventional Commits

### File pointers
- `functions/test/performance/` — criar diretório e arquivos de teste
- `functions/test/` — padrão de referência para setup do emulador
- `.github/workflows/functions-ci.yml` — adicionar step de performance tests

### Verification
`cd functions && npx jest functions/test/performance/ --no-coverage` passa em < 60s. Nenhum teste reporta > 500ms ou > 100 reads.

---

*Total: 16 issues | Gerado em 2026-05-12 | Auditor: claude-sonnet-4-6*
