# SPEC: Otimizações de performance do app Android (31/10/2026)

> **Status:** `APPROVED`
> **Autor:** Renan Locatiz Fernandes (com Claude Code)
> **Data:** 2026-10-31
> **PR:** a preencher (épico #4400)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O APK release do Android tinha 55,13 MB, 79% disso em `res/`: os 21 brasões
de nível (`ic_level_badge_0..20`) eram PNGs de 1536x1024 com 1,1 a 3 MB cada
(6,3 MB por bitmap decodificado), e os brasões 0 a 10 estavam duplicados em
`drawable/` e `drawable-xxhdpi/`. O build também carregava
dependências da era XML que nenhum código usa mais (MPAndroidChart, Lottie,
Shimmer, SwipeRefreshLayout, CircleImageView, Navigation Fragment/UI, Safe Args,
Accompanist). No startup, o `Application` montava o OkHttp do Coil e o logger do
Koin em nível ERROR mesmo em release, e a splash esperava 800 ms com o brasão
ainda invisível. O relatório do compilador Compose apontava 178 parâmetros
instáveis nos composables, quase todos `List<...>` e modelos de
`domain.model`, que são imutáveis mas vêm de outro módulo.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador | Instala o app pela Play Store | APK release universal 73,8% menor; o download real via AAB (splits por densidade) não foi medido |
| UC2 | Jogador | Abre o app a frio | Splash sem a espera de 800 ms invisível; menos trabalho no `Application.onCreate` |
| UC3 | Jogador | Rola listas com brasões | Bitmaps de 768x512 em vez de 1536x1024 (1/4 da memória por brasão) |
| UC4 | Dev | Investiga recomposição | Relatórios Compose sob demanda com `-PcomposeCompilerReports=true` |

### 1.3 Critérios de Aceite

- [x] CA1: APK release menor, medido antes e depois no mesmo comando.
- [x] CA2: Nenhuma mudança visível de comportamento, exceto a splash 800 ms mais curta.
- [x] CA3: `:app:compileDebugKotlin :app:testDebugUnitTest detekt` verdes ou com falhas explicadas.
- [x] CA4: Flag de relatório Compose desligada por padrão (não fica ligada no commit).
- [x] CA5: Nada fora de `app/`, `baselineprofile/`, `gradle/`, `build.gradle.kts` e `specs/`.

### 1.4 Fora de Escopo

- `shared/`, `composeApp/`, `iosApp/`, `web/`, `functions/`, `firestore.rules`.
- Tema (há WIP de cores de divisão pendente): `preferenceTheme` dos themes.xml fica.
- Remover as regras keep amplas do R8 (Firebase, GMS, Compose, Room, Work): exige smoke test em device.
- Gerar baseline profile do app: exige device ou emulador gerenciado.
- A espera de 800 ms em `SplashScreen.kt` e a splash dupla (decisão de UX).

---

## 2. UX/UI Design

Sem mudança de tela. Os brasões continuam em `R.drawable.ic_level_badge_N`
(mesmos nomes), agora WebP com alfa em `drawable-nodpi/`, 768x512. Inspeção
visual lado a lado (antes x depois) sem diferença perceptível no tamanho em que
aparecem (no máximo ~200 dp).

A splash Activity deixa de esperar 800 ms antes de navegar. Durante essa espera
o brasão ainda estava com alpha 0 (`userChecked=false`), então o usuário só via
o fundo. A animação de entrada do `SplashScreen.kt` continua igual.

---

## 3. Technical Design

### 3.1 Frentes e mudanças

| Frente | Mudança |
|--------|---------|
| Startup | Coil com `SingletonImageLoader.setSafe` lazy e OkHttp lazy; o primeiro `AsyncImage` monta o loader. Koin `androidLogger` em `NONE` no release e `INFO` no debug. `CacheCleanupWorker.schedule` sai do main looper e vai para uma corrotina em `Dispatchers.IO`. StrictMode (thread + VM) só em debug, `penaltyLog`. |
| Startup | App Check por source set: `src/debug` usa `DebugAppCheckProviderFactory`, `src/nonDebug` (release e benchmark) usa Play Integrity. `firebase-appcheck-debug` vira `debugImplementation`. |
| Startup | `ImageKoinModule` apagado: criava um segundo `ImageLoader` nunca injetado, com o mesmo diretório `image_cache` do Coil e outro teto (100 MB x 200 MB). |
| Splash | `delay(800)` removido de `SplashActivityCompose`. |
| Compose | `app/compose-stability.conf`: `domain.model.**`, `List/Set/Map` do Kotlin, `java.time.*`, `kotlinx.datetime.*`. Relatórios via `-PcomposeCompilerReports=true`. |
| Build | Remove 12 dependências mortas, a duplicata de `:shared`, o plugin Safe Args e as regras keep de Hilt e MPAndroidChart. `navigation-compose` passa a ser declarada (antes vinha transitiva). `preference-ktx` fica por causa do `preferenceTheme` nos themes. |
| Imagens | 21 brasões convertidos para WebP 768x512 (`cwebp -q 90 -alpha_q 100 -m 6`) em `drawable-nodpi/`; PNGs e duplicatas por densidade removidos. Lottie órfão `raw/badge_unlock_anim.json` removido. |
| Código morto | `SwipeRefreshLayout.setDebouncedRefreshListener` (sem chamador) removida de `Extensions.kt`. |

### 3.2 Critério do arquivo de estabilidade

Com strong skipping (padrão no Kotlin 2.x), parâmetro instável é comparado por
referência (`===`) e estável por `equals`. Marcar como estável só é seguro para
tipos que nunca mudam depois de criados:

- `domain.model`: 97 data classes, 0 `var` (medido em 31/10/2026).
- `data.model` **não** entra: tem `var`.
- `List/Set/Map`: o app não muta coleções recebidas como parâmetro de composable.

O número de composables skippable não muda (strong skipping já torna todos
skippable). O ganho é trocar comparação por referência por `equals` nos
parâmetros listados, o que evita recomposição quando o ViewModel emite uma cópia
igual do mesmo dado.

### 3.3 Cache e Offline

Sem mudança. O disk cache do Coil continua em `image_cache` com 200 MB.

### 3.4 Segurança

- [x] Nenhum token/secret hardcoded.
- [x] O provider debug do App Check não entra mais no APK release (antes era `implementation`).
- [x] `local.properties` e `google-services.json` continuam fora do git.

### 3.5 Performance (medidas)

Comando dos dois lados: `./gradlew :app:assembleRelease :app:dependencies
--configuration releaseRuntimeClasspath -PcomposeCompilerReports=true
--max-workers=3`, keystore de debug só no `local.properties` local.

| Métrica | Antes (966ab168) | Depois | Delta |
|---------|------------------|--------|-------|
| APK release | 55,13 MB | 14,46 MB | -40,68 MB (-73,8%) |
| `res/` no APK | 43,55 MB | 2,99 MB | -93% |
| `res/` descompactado | 44,26 MB | 3,71 MB | -92% |
| dex no APK | 8,16 MB | 8,05 MB | -0,11 MB |
| Classes no dex | 23.992 | 23.753 | -239 |
| Method refs | 144.927 | 142.566 | -2.361 |
| Artefatos no `releaseRuntimeClasspath` | 456 | 440 | -16 |
| Brasões no fonte | 72 MB (PNG) | 1,77 MB (WebP) | -97,5% |
| Parâmetros `unstable` em composables | 178 | 24 | -86,5% |
| `knownUnstableArguments` | 478 | 306 | -36% |
| `inferredUnstableClasses` | 337 | 297 | -40 |
| `effectivelyStableClasses` | 694 | 773 | +79 |
| Skippable / restartable | 3408 / 5279 | 3408 / 5279 | = (strong skipping) |

Os 24 parâmetros instáveis restantes são `NumberFormat`, `Date?`, `Uri?`,
`Intent?` e afins: tipos mutáveis da plataforma, que não devem entrar no
arquivo de estabilidade.

Tempo de startup a frio não foi medido: exige device físico ou emulador com
macrobenchmark (`baselineprofile/`). Fica como proposta.

---

## 4. Tasks (Breakdown)

| # | Task | Status |
|---|------|--------|
| 1 | Baseline: APK, mapping, dependências e relatório Compose em 966ab168 | ✅ |
| 2 | Startup: Coil lazy, Koin logger, StrictMode debug, App Check por source set, worker fora do main | ✅ |
| 3 | Splash: remover espera invisível de 800 ms | ✅ |
| 4 | Compose: arquivo de estabilidade + relatórios por flag | ✅ |
| 5 | Build: dependências mortas, Safe Args, regras keep de Hilt/MPAndroidChart | ✅ |
| 6 | Imagens: brasões WebP 768x512 em nodpi | ✅ |
| 7 | Medir depois e verificar (`compileDebugKotlin`, `testDebugUnitTest`, `detekt`) | ✅ |

---

## 5. Verification (Verificação)

### 5.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Unit | `LevelBadgeHelperTest` cobre o mapeamento nível → `R.drawable.ic_level_badge_N` | ✅ |
| Build release | `assembleRelease` com R8 full mode (inclui `lintVitalAnalyzeRelease`) | ✅ |
| Outras variantes | `compileBenchmarkKotlin`, `compileBenchmarkReleaseKotlin`, `compileNonMinifiedReleaseKotlin` | ✅ |
| Lint completo | `./gradlew lint` | ⬜ (não rodado; só o lint vital do release) |
| Smoke em device | App Check, Coil lazy, brasões | ⬜ (sem device nesta sessão) |

### 5.2 Checklist de Revisão

- [x] Build passa
- [x] Testes unitários passam
- [x] Sem strings ou cores hardcoded novas
- [ ] Testado em device (pendente: revisor)

---

## 6. Notas e Referências

- Épico: #4400
- Decisão: `specs/DECISIONS.md` → "[2026-10-31] Otimizações de performance do Android"
- Propostas não implementadas: listadas no PR (keep de `domain.model` no R8,
  remoção das keeps amplas, baseline profile, splash dupla, `Accept-Encoding`
  manual no OkHttp, brasões via `AsyncImage` com tamanho).

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-10-31 | Renan Locatiz Fernandes (Claude Code) | Criação, medidas de antes e depois |
