# SPEC — Bump Compose BOM para line 2026 (desbloquear M3 Expressive) — #2681

- **Status:** APPROVED (autonomia ampla; mudança reversível via PR + revert)
- **Tipo:** Chore / Tech-debt (dependência transitiva de alto impacto)
- **Épico:** #2680 (Android — Material 3 Expressive, color engine e layouts adaptativos)
- **Desbloqueia:** #2692 (shape-morphing), #2728 (MotionScheme expressive), e de-risca #2683 (HCT)/#2686 (panes)
- **Data:** 2026-06-20

---

## 1. REQUIREMENTS

### Problema
O `:app` está pinado em `androidx.compose:compose-bom:2025.05.00` (`app/build.gradle.kts:165`), que resolve **material3 ~1.3.2** — linha **pré-Expressive**. As APIs do Material 3 Expressive (`MaterialShapes`, `RoundedPolygon`, `.morph`, `SplitButton`, `ButtonGroup`, `MotionScheme.expressive()`) só existem em **material3 1.4.x**, disponível a partir do **compose-bom 2025.06.00+**. Sem o bump, #2692 não compila e #2728 (critério MotionScheme) fica bloqueado.

### Critérios de aceite
1. `app/build.gradle.kts` em `compose-bom` da line 2026 que resolva material3 1.4.x estável.
2. `:app:compileDebugKotlin` + `:composeApp:compileDebugKotlinAndroid` verdes.
3. `:app:testDebugUnitTest` + `detekt` verdes.
4. `:app:lint` sem novos erros bloqueantes.
5. Sem regressão de macrobenchmark (gate de CI em runner macOS self-hosted — ver §5).
6. Nenhuma API Expressive precisa ser ADOTADA nesta PR (escopo é só o bump + correções de compilação); a adoção fica para #2692/#2728.

### Fora de escopo
- Adoção de shape-morphing (#2692), MotionScheme (#2728), HCT (#2683), panes (#2686). PRs próprias.
- composeApp NÃO consome o BOM AndroidX — usa `compose.material3` do plugin CMP 1.10.0. O bump do BOM **não** altera o material3 do composeApp; Expressive no composeApp é trilha separada (CMP version bump, follow-up).

---

## 2. TECHNICAL DESIGN

### Mudança central (1-2 arquivos)
- `app/build.gradle.kts:165`: `platform("androidx.compose:compose-bom:2025.05.00")` → `compose-bom:2025.06.00` (ou a versão estável validada mais recente da line 2026 que mapeie material3 1.4.x).
- `app/build.gradle.kts:172`: `material3-adaptive-navigation-suite:1.4.0` — manter pinado OU alinhar com a versão que o novo BOM gerencia (BOM moderno gerencia `material3-adaptive*`; remover o pin manual se o BOM cobrir, evitando divergência). Validar via `:app:dependencies`.

### Riscos de compilação esperados
- Mudanças de assinatura/deprecação em material3 1.4.x podem quebrar call-sites (ex.: `Divider`→`HorizontalDivider` já tratado; `SwipeRefresh`→`PullToRefreshBox`; mudanças em `Card`/`*Defaults`). Corrigir caso a caso.
- Possível necessidade de opt-in `@OptIn(ExperimentalMaterial3ExpressiveApi::class)` SOMENTE onde já houver uso experimental — não introduzir uso novo aqui.

### Compatibilidade
- Kotlin 2.2.10 / AGP 9.0.1 são compatíveis com a line 2026 (validado na triagem).
- minSdk 24 / compileSdk 36 — sem mudança.

---

## 3. TASKS

1. Branch isolado `chore/bump-compose-bom-2026-2681` a partir de master ATUALIZADO (após #2735/#2724 mergeados — o bump deve validar contra o código final).
2. Editar `app/build.gradle.kts` (BOM + pin adaptive).
3. `./gradlew :app:compileDebugKotlin` — corrigir erros de compilação iterativamente.
4. `./gradlew :composeApp:compileDebugKotlinAndroid` (sanity; não deve mudar, mas confirmar).
5. `./gradlew :app:testDebugUnitTest detekt` — corrigir regressões.
6. `./gradlew :app:dependencies --configuration debugRuntimeClasspath | grep material3` — confirmar material3 1.4.x resolvido.
7. PR isolada (NÃO em batch). Body documenta versão resolvida + saída do dependencies.

---

## 4. ROLLBACK
- Reverter o commit do BOM restaura 2025.05.00 instantaneamente (mudança de 1 linha + correções). Sem migração de dados. Risco operacional zero fora de build.

## 5. VERIFY (Mobile DoD)
- [ ] `:app:compileDebugKotlin` verde
- [ ] `:composeApp:compileDebugKotlinAndroid` verde
- [ ] `:app:testDebugUnitTest` verde
- [ ] `detekt` verde
- [ ] material3 1.4.x confirmado no classpath
- [ ] **Macrobenchmark sem regressão** — rodar `:macrobenchmark` em runner macOS self-hosted (skill `/futeba-runner`); se indisponível no momento do merge, documentar como follow-up de CI e validar no próximo ciclo de release antes de adotar Expressive (#2692).
- [ ] Smoke visual light/dark em telas-chave (Home, Games, Statistics) — mudança transitiva pode alterar defaults visuais sutis.

---

## NOTA DE EXECUÇÃO
Premissa central validada na triagem 2026-06-20: o corpo da issue #2681 está STALE (afirma BOM 2024.09.00; já está em 2025.05.00 desde PR #2760). O objetivo real (material3 1.4.x Expressive) NÃO foi atingido por aquele bump. Esta spec executa o bump remanescente até a line que entrega Expressive.
