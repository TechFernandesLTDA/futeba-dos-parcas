# PERF: Baseline Profile gerado (fatia #4411)

> **Status:** `IN_PROGRESS`
> **Severidade:** `LOW`
> **Autor:** opencode
> **Data:** 2026-11-25
> **PR:** (a abrir)
> **Issue:** #4411

---

## Escopo

Ordem de trabalho do #4411 após web splash/rede (#4649), badges/preferenceTheme (#4655):

1. ✅ Descompressão OkHttp + splash (fatia 1 — #4649)
2. ✅ Badges AsyncImage + preferenceTheme (fatia 2 — #4655)
3. **Aqui**: baseline profile (`app/src/release/generated/baselineProfiles/` estava vazio)
4. ⚠️ R8 keeps: pendente de smoke em device (login/App Check/WorkManager/Room)
5. ⚠️ Orfãs via lint (PR próprio)

## Geração (reproduzível)

```bash
keytool -genkeypair -keystore /tmp/futeba-test.jks -alias futeba ...   # só p/ benchmark local
# local.properties com STORE_FILE=/tmp/futeba-test.jks (gitignored)
./gradlew :baselineprofile:pixel6Api34BenchmarkAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.enabledRules=BaselineProfile
```

O profile é integrado aos APKs de release/benchmark via ProfileInstaller: o merged ART profile saltou de **10.131 → 55.459** métodos após a cópia (conferido em `app/build/intermediates/merged_art_profile`).

## Efeito esperado

Perfil pré-compila métodos de startup/navegação → startup ~30% mais rápido, menos jank. Sem mudança de comportamento; fallback seguro (profile ignorado em builds que não o contêm).
