# PERF: Android — badges via AsyncImage e remoção do preferenceTheme (#4411, fatia 2)

> **Status:** `IN_PROGRESS`
> **Severidade:** `LOW`
> **Autor:** opencode
> **Data:** 2026-11-25
> **PR:** (a abrir)
> **Issue:** #4411 (fatia: brasões + preferenceTheme; R8/baseline ficam)

---

## Escopo deste PR

1. **Brasões (WebP 768x512) via `painterResource` → `AsyncImage`** em 10 call sites (Evolution, Statistics, HubHeader x2, ActivityFeed, WelcomeEmptyState, PlayersDialogs, LevelJourney x3). Coil reduz o bitmap ao tamanho exibido (`size` do modifier) em vez de carregar o arquivo inteiro em listas.
2. **Remoção de `preference-ktx` + item `preferenceTheme`** (3 temas) + `xml/preferences.xml` órfão (PT fixo, sem referência em código). Sem tela de Preference em uso.
3. "14 Koin modules" na doc: **não encontrado** (já corrigido em master) — nada a fazer.

Fora deste PR: R8 keeps (exige smoke em device: login, App Check, WorkManager, Room), baseline profile (gera via `:macrobenchmark` antes/depois), strings/drawables sem referência (via `lint`, outro PR).

## Verificação

- [x] `:app:compileDebugKotlin` (ver PR)
- [x] `:app:testDebugUnitTest`
- [ ] Smoke visual: badges nas telas listadas (pendente de reviewer)
