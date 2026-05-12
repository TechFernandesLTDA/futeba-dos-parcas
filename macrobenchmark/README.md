# Macrobenchmark — Futeba dos Parças

Módulo de benchmarks de performance para medir startup e scroll do app em condições realistas.
Usa a [Android Macrobenchmark Library](https://developer.android.com/topic/performance/benchmarking/macrobenchmark-overview).

## Por que Macrobenchmark?

- Detecta regressões de startup **antes** de chegarem aos usuários
- Mede jank real em LazyColumns pesadas (jogos, ranking, estatísticas)
- Complementa o `baselineprofile/` — enquanto o baseline *melhora* a performance, o macrobenchmark *detecta regressões*

## Benchmarks disponíveis

| Classe | O que mede |
|--------|------------|
| `StartupBenchmark` | Cold e warm startup do app (TTID via `StartupTimingMetric`) |
| `ScrollBenchmark` | Frame timing durante scroll na HomeScreen (lista de jogos) |
| `RankingBenchmark` | Frame timing durante scroll na RankingScreen (Liga) |
| `GameDetailBenchmark` | TTI ao navegar até a GameDetailScreen clicando em um jogo |

## Pré-requisitos

- Android SDK instalado com `ANDROID_SDK_ROOT` configurado
- Emulador ou dispositivo físico conectado com `adb devices`
- App do build type `benchmark` já instalado (ver abaixo)
- Android 7+ (minSdk 24)

## Rodar localmente

### 1. Build do APK de benchmark

```bash
# Build do :app no build type "benchmark" (baseado em release, assina com debug key)
./gradlew :app:assembleBenchmark
```

### 2. Executar todos os benchmarks

```bash
./gradlew :macrobenchmark:connectedBenchmarkAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.profiling.mode=None \
  -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.suppressErrors=EMULATOR,DEBUGGABLE
```

### 3. Executar um benchmark específico

```bash
# Apenas StartupBenchmark
./gradlew :macrobenchmark:connectedBenchmarkAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=com.futebadosparcas.macrobenchmark.StartupBenchmark \
  -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.profiling.mode=None \
  -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.suppressErrors=EMULATOR,DEBUGGABLE
```

### 4. Verificar compilação sem executar (CI/rápido)

```bash
# Verifica que o código Kotlin compila sem rodar os benchmarks
./gradlew :macrobenchmark:compileBenchmarkAndroidTestKotlin

# Verifica que o :app compila o build type benchmark
./gradlew :app:assembleBenchmark
```

## Interpretar os resultados

Os resultados ficam em:
```
macrobenchmark/build/outputs/connected_android_test_additional_output/
macrobenchmark/build/outputs/androidTest-results/
```

### No Android Studio

1. Abra o projeto no Android Studio
2. Vá em **Run → Open Profiler Results**
3. Selecione o arquivo `.perfetto-trace` ou `.json` gerado

### Métricas principais

| Métrica | Significado | Meta SLO (Issue #1094) |
|---------|-------------|------------------------|
| `timeToInitialDisplayMs` | Tempo até primeira frame (TTID) | < 1500ms P95 (cold) |
| `frameDurationCpuMs` | Duração de cada frame em CPU | < 16ms (60Hz) |
| `frameOverrunMs` | Quanto cada frame excedeu o deadline | 0ms = sem jank |
| `jankyFramePercent` | % de frames com jank | < 5% (scroll screens) |

### Exemplo de saída esperada

```
StartupBenchmark_coldStartup
  timeToInitialDisplayMs   min=  842.4, median=  901.2, max= 1023.8
```

## Em CI/CD

O workflow `.github/workflows/android-macrobenchmark.yml` executa automaticamente após:
- Merges para `master` que tocam `app/`, `shared/`, `composeApp/`, ou `macrobenchmark/`
- Disparos manuais via GitHub Actions

Os resultados são publicados como artifact `macrobenchmark-results-<sha>` com retenção de 30 dias.

**SLOs e gates de regressão** (Issue #1092): O workflow agora:
- Valida métricas contra baseline definido em `baseline.json`
- Falha se regressão > 20% do baseline
- Publica comentário no GitHub com resultados comparativos
- Consulte `SLO.md` para definição formal de thresholds e tolerâncias

**Nota**: O workflow roda apenas no `master` (não em PRs) por ser lento (~15-30min).
Tendências históricas e dashboard serão adicionados na Issue #1094.

## Avisos em emulador

Ao rodar em emulador, o benchmark exibe mensagens como:
```
EMULATOR: Results are not reliable. Running on Emulator.
```

Isso é esperado. Use `suppressErrors=EMULATOR,DEBUGGABLE` para não falhar o build.
Os números em emulador servem para **detectar regressões relativas**, não valores absolutos.
Para métricas absolutas de produção, use um Pixel físico em modo Release.

## Relacionado

- `baselineprofile/` — geração de Baseline Profiles para melhorar startup
- Issue #1078 — criação deste módulo
- Issue #1092 — SLOs formais e gates de regressão automáticos (implementado)
- Issue #1094 — Dashboard de tendências históricas (futuro)

## Nota sobre libs.versions.toml

Este projeto não usa Version Catalog (`libs.versions.toml`). As dependências de benchmark
são declaradas inline no `macrobenchmark/build.gradle.kts`, seguindo o mesmo padrão
do módulo `baselineprofile/`. Versões alinhadas com `baselineprofile/`:
- `androidx.benchmark:benchmark-macro-junit4:1.4.1`
- `androidx.test.uiautomator:uiautomator:2.3.0`
