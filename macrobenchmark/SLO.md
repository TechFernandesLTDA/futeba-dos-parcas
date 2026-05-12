# SLOs (Service Level Objectives) — Macrobenchmark Futeba dos Parças

Definição formal dos objetivos de performance para o app Android, medidos via Macrobenchmark.

## Objetivo

Prevenir regressões de performance em operações críticas antes que cheguem aos usuários em produção. Os SLOs abaixo representam o **P95 (percentil 95)** de todas as medições em emulador API 34, com tolerância de 20% para variações ocasionais do dispositivo.

## SLOs Definidos

| Métrica | Threshold | Benchmark | Critério de Falha | Impacto Utilizador |
|---------|-----------|-----------|-------------------|-------------------|
| **Cold Startup (TTID)** | < 1500ms P95 | `StartupBenchmark` | Regressão > 20% do baseline | App demora > 1.5s para primeira frame |
| **HomeScreen Scroll Jank** | < 5% de frames com jank | `ScrollBenchmark` | Jank > 5% OU regressão > 20% | Movimento choppy na lista de jogos |
| **RankingScreen Scroll Jank** | < 5% de frames com jank | `RankingBenchmark` | Jank > 5% OU regressão > 20% | Movimento choppy na Liga |
| **GameDetailScreen TTI** | < 3000ms P95 | `GameDetailBenchmark` | Regressão > 20% do baseline | Demora ao abrir detalhe do jogo |

## Definições

### Cold Startup (TTID)
- **Métrica:** `timeToInitialDisplayMs`
- **Como mede:** Tempo desde `ActivityManager.startActivity()` até primeira frame desenhada (TTID via `StartupTimingMetric`)
- **Condição:** App deve estar completamente desinstalado antes do teste (reboot do emulador)
- **Threshold:** < 1500ms no P95
- **Tolerância:** Regressão até 20% é aceitável em uma medição; acima disso falha o CI

### Jank em Scroll (HomeScreen e RankingScreen)
- **Métrica:** `jankyFramePercent` (frames que excederam o deadline de 16.67ms @ 60Hz)
- **Como mede:** Duração de frame em ms coletada durante scroll suave de ~50 frames
- **Threshold:** < 5% de frames com jank
- **Tolerância:** Regressão até 20% do baseline é aceitável; acima disso falha o CI

### Time to Interact (GameDetailScreen)
- **Métrica:** `timeToInitialDisplayMs` (similar ao startup, mas após navegação)
- **Como mede:** Tempo desde clique no jogo até renderização completa da GameDetailScreen
- **Threshold:** < 3000ms no P95
- **Tolerância:** Regressão até 20% do baseline é aceitável; acima disso falha o CI

## Baseline

O baseline de referência está em `baseline.json` e é capturado do `master` no primeiro run após aprovação desta PR. Todos os SLOs subsequentes são comparados relativamente a este baseline.

**Captura do baseline:**
```bash
git checkout master
./gradlew :macrobenchmark:connectedBenchmarkAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.profiling.mode=None \
  -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.suppressErrors=EMULATOR,DEBUGGABLE
# Extrair métricas do resultado → macrobenchmark/baseline.json
```

## Ações de Violação

Quando um SLO é violado no CI:

1. **Workflow falha** com mensagem clara indicando qual SLO foi violado
2. **GitHub comment** é postado na PR com:
   - Tabela comparativa baseline vs. medição atual
   - % de regressão por métrica
   - Sugestão de próximos passos (profile, investigar mudança recente, etc.)
3. **PR não pode fazer merge** enquanto SLO for violado
4. **Desenvolvedor pode:**
   - Corrigir regressão (volta ao baseline)
   - Ou atualizar baseline intencionalmente com aprovação de code reviewer (melhor design trade-off)

## Exemplo de Violação

```
❌ SLO VIOLATION: Cold Startup regressed by 35%
   Baseline: 1200ms P95
   Current:  1620ms P95
   Threshold: 1500ms (tolerance: 20%)
   
Commit que causou: abc1234...
Sugestão: Rever Application.onCreate() por operações síncronas de I/O
```

## Próximos Passos

- Issue #1093: Integrar comparação de baseline no workflow CI
- Issue #1094: Publicar dados históricos em dashboard (trend analysis)
- Roadmap: Adicionar SLOs para outras operações críticas (grupo details, MVP voting, etc.)

## Referências

- [Android Macrobenchmark Library](https://developer.android.com/topic/performance/benchmarking/macrobenchmark-overview)
- [Baseline Profile Overview](https://developer.android.com/topic/performance/baselineprofiles)
- [Material 3 Performance Guidelines](https://m3.material.io/)
- Issue #1078: Criação do módulo macrobenchmark
- Issue #1092: Este documento (SLOs)
