# SPEC: Paridade iOS via CMP Fase 3 — Port Android→composeApp + Frota DeepSeek

> **Status:** `APPROVED` (Renan 2026-05-16 — executar com máximo paralelismo)
> **Autor:** Claude (Opus 4.7)
> **Data:** 2026-05-16
> **PR:** múltiplos (1 por bucket) — preencher

---

## 0. Decisão-âncora

Arquitetura 4-alvos (ver `DECISIONS.md` 2026-05-16): **1 backend + 1 núcleo KMP +
2 UIs** (Compose-MP mobile · React web responsivo). Paridade iOS = **CMP Fase 3**:
portar a UI das telas Android (`:app`) para `composeApp/commonMain`, que iOS já
renderiza via `iosApp/iosApp/` (shell SwiftUI → `MainViewControllerKt`).

> SwiftUI nativo **rejeitado** (cemitério `iosApp/FutebaDosParcas-ios/` será deletado).
> DeepSeek gera **Kotlin Compose commonMain**, nunca Swift. Verify loop = **gradle**.

---

## 1. Requirements

### 1.1 Problema

`composeApp/commonMain` tem ~2 telas; Android tem ~56 `*Screen.kt` em `:app`
(Android-only, não compartilhado). iOS roda mas é quase vazio. `shared/iosMain`
tem 3 gaps que deixam telas sem dados no iOS.

### 1.2 Critérios de Aceite

- [ ] CA1: `iosApp/FutebaDosParcas-ios/` removido; 1 só `@main`; `xcodebuild` smoke verde.
- [ ] CA2: `shared/iosMain` sem `NotImplementedError`/TODO bloqueante (RepositoryFactory, MigrationContext, ImagePicker implementados ou explicitamente N/A documentado).
- [ ] CA3: Bucket **Core** portado p/ `composeApp/commonMain`, renderiza no iOS Simulator com dados reais (Firebase), Android segue verde.
- [ ] CA4: Cada bucket = 1 PR; `./gradlew :composeApp:linkDebugFrameworkIosSimulatorArm64` + `:app:compileDebugKotlin` + detekt verdes antes do merge.
- [ ] CA5: Paridade visual razoável com Android (mesma `App()`), tema/strings compartilhados.
- [ ] CA6: Onboarding Fase 1 (spec irmã) — **decisão (a)**: implementado AGORA em `:app` (Android) + `web/` (React) + estado KMP em `shared/commonMain` (valor Android/Web imediato). A UI do onboarding chega ao `composeApp/commonMain` quando o **bucket Core** portar a pasta `onboarding` (sem duplicar a camada de estado KMP — só a UI é re-renderizada em commonMain, que é o objetivo do CMP Fase 3). Sem double-write de lógica.
- [ ] CA7: Sem regressão Android (Android consome as telas migradas via `composeApp` ou mantém `:app` até migração explícita — ver §3.4).

### 1.3 Fora de Escopo

- TestFlight/App Store submission (bloqueado: Apple Dev account/signing — follow-up).
- Telas Android-only por natureza: `debug`, `devtools`, `developer`, `adaptive`, `base`, `components`, `util`, `theme`, `splash` interno, `game_experience`. Não portar.
- Reescrever ViewModels Android que já funcionam — mover para `composeApp/commonMain` preservando contrato.

---

## 2. Buckets (ordem de execução — north-star: time-to-value no iOS)

| Bucket | Telas (origem `app/.../ui/`) | Prioridade |
|--------|------------------------------|------------|
| **Core** | `auth`, `onboarding` (inclui Fase 1), `home`, `games` (lista+detalhe+criar), `groups` (lista+detalhe), `profile` | 1 — primeiro |
| **Gamification** | `badges`, `league`/season, `statistics`, `player`/`players`, ranking | 2 |
| **Discovery** | `locations`, `map`, `search`, `schedules` | 3 |
| **Power** | `livegame`, `payments` (cashbox), `tactical`, `notifications`, `settings`, `preferences`, `admin` | 4 |

Cada bucket: PR próprio, mergeável independente, smoke no iOS Simulator.

---

## 3. Technical Design

### 3.1 Pipeline de Port (DeepSeek-driven, por tela)

```
Para cada tela do bucket:
  1. EXTRACT ground truth:
     - app/.../ui/<f>/<F>Screen.kt + <F>ViewModel.kt + UiState
     - strings.xml relevantes + tema (já compartilháveis)
  2. EXTRACT contrato KMP disponível:
     - interfaces de repo em shared/commonMain (assinaturas)
     - models shared/commonMain
  3. DeepSeek (pro-think, cache-ordered):
     system  → regras de transform (Android Compose → CMP commonMain)
     stable  → contratos KMP + tema/strings (grande, estável no bucket)
     stable  → fonte Android da tela (estável por tela)
     variable→ "gere composeApp/commonMain/.../<F>Screen.kt + ViewModel"
  4. VERIFY: ./gradlew :composeApp:compileKotlinIosSimulatorArm64
            (ou :linkDebugFrameworkIosSimulatorArm64 no fim do bucket)
  5. Se erro: feed últimas ~50 linhas do log + arquivo falho de volta ao DeepSeek
  6. Loop máx 3; falhou 3x → escalar p/ agente Claude inline
  7. Commit por tela (verde) — branch do bucket
```

**Regras de transform (system prompt do DeepSeek):**
- `androidx.compose.*` Material3 → `org.jetbrains.compose.*` equivalentes (commonMain)
- Remover APIs Android-only (Context, Activity, Toast, painterResource Android) → expect/actual ou composables comuns
- ViewModel → mover p/ commonMain (`androidx.lifecycle.ViewModel` KMP ou ViewModel comum do projeto); injeção via Koin (já cross-platform)
- `stringResource` → mecanismo de strings compartilhado do composeApp (composeResources)
- Navegação → padrão de navegação do composeApp (não NavGraph Android)
- StateFlow/coroutines → inalterado (KMP)
- **Nunca** inventar API; se faltar contrato, gerar `TODO(...)` explícito + reportar

### 3.2 Gaps `shared/iosMain` (Foundation — antes da frota)

| Arquivo | Ação |
|---------|------|
| `domain/repository/RepositoryFactory.kt` | Implementar via GitLive Firebase SDK (já usado no projeto, CMP Phase 2) — mesmo padrão de `androidMain` |
| `data/migration/MigrationContext.kt` | Implementar com GitLive Firebase iOS ou marcar N/A documentado se migração não roda no client iOS |
| `platform/ImagePicker.ios.kt` | `UIImagePickerController`/`PHPickerViewController` via interop |

**Scaffolding `composeApp/commonMain` (metade da fundação — sem isto DeepSeek gera no vazio):**
Libs já presentes nos deps (`jetbrains navigation-compose 2.9.2`, `lifecycle-viewmodel-compose 2.9.6`, Coil3, `:shared`); tema + `composeResources` completos. Falta:
- **NavHost real** em commonMain (hoje `AppNavigation` actual é stub `HomeScreen()`) — grafo + rotas + back stack
- **Koin** wiring no commonMain (`startKoin`/`KoinApplication` + módulos de `:shared`); `koinViewModel()` KMP
- Padrão de **ViewModel compartilhado** (mover ViewModels de `:app` p/ commonMain usando `lifecycle-viewmodel-compose` já no dep)
- Limpar `iosApp/project.pbxproj.template` legado (não usado pelo fluxo xcodegen) se confirmado órfão

### 3.3 Foundation — cemitério

- Deletar `iosApp/FutebaDosParcas-ios/` inteiro (confirmado morto: não compila).
- Garantir 1 só `@main` (`iosApp/iosApp/FutebaApp.swift`).
- `xcodegen generate` + `pod install` + `xcodebuild` smoke verde.

### 3.4 Estratégia Android (sem regressão)

- Fase A (esta spec): telas vão para `composeApp/commonMain`. Android continua usando `:app` (não quebra). composeApp é validado via iOS.
- Fase B (follow-up, fora desta spec): `:app` passa a hospedar as telas de `composeApp` (UI única real). Migração incremental, 1 bucket por vez, com a tela Android antiga removida só quando a compartilhada estiver verde nas duas plataformas.
- Esta spec **não** remove telas de `:app` — só adiciona em `composeApp`. Zero regressão Android.

### 3.5 Verify / CI

- Por tela: `:composeApp:compileKotlinIosSimulatorArm64`
- Por bucket: `:composeApp:linkDebugFrameworkIosSimulatorArm64` + `:app:compileDebugKotlin` + `detekt` + `xcodebuild` smoke (iPhone 17 Pro sim)
- Self-hosted macOS runner p/ link iOS (Linux falha — comportamento conhecido)

### 3.6 Paralelismo (escolha do usuário: máximo)

Workstreams concorrentes em **worktrees isolados** (memória `feedback_agent_isolation_unreliable`):
- WS-A: Onboarding Fase 1 (agent team cross-layer) — worktree `wt-onboarding`
- WS-B1: Foundation iOS (cemitério + shared/iosMain) — worktree `wt-ios-foundation`
- WS-B2: Frota DeepSeek de telas (após B1 verde) — worktree `wt-ios-fleet`
- Ownership de arquivos estrito; commits frequentes; lead não implementa (delega).

---

## 4. Tasks

| # | Task | WS | Status |
|---|------|----|--------|
| 1 | Spec + DECISIONS + memória | — | ✅ |
| 2 | Pipeline DeepSeek (`/tmp/ios-port-pipeline.sh`) | B2 | ⬜ |
| 3 | Foundation: deletar cemitério + 1 `@main` + xcodebuild smoke | B1 | ⬜ |
| 4 | Foundation: shared/iosMain RepositoryFactory/Migration/ImagePicker | B1 | ⬜ |
| 5 | Onboarding Fase 1 (KMP state+repo, carousel, checklist, web, rules, analytics, tests) | A | ⬜ |
| 6 | Frota: bucket Core (port + verify + smoke) | B2 | ⬜ |
| 7 | Frota: bucket Gamification | B2 | ⬜ |
| 8 | Frota: bucket Discovery | B2 | ⬜ |
| 9 | Frota: bucket Power | B2 | ⬜ |
| 10 | Smoke iOS Simulator + cleanup worktrees + memória de aprendizados | — | ⬜ |

## 5. Verification

- iOS Simulator (iPhone 17 Pro): cada bucket renderiza, login Firebase real, navegação OK
- Android: `:app:assembleDebug` verde, sem regressão (telas `:app` intocadas)
- Por PR: build composeApp+app, detekt, smoke
- DoD mobile (responsividade/a11y) aplicável às telas compartilhadas

## 6. Notas

- Pipeline ref: advisor 2026-05-16 (header extraction não aplica — origem Android Compose É o ground truth; verify = gradle, mais robusto que xcodebuild blind)
- Cache DeepSeek: system→contratos→fonte Android→pedido (memória `reference_deepseek_v4_pro_parallel`)
- Calibração: DeepSeek infla ~50% / inventa API → verify loop é obrigatório, não opcional
- Relacionado: `CMP_MULTIPLATFORM_MIGRATION.md` (Phase 3), `feat-2026-05-16-modern-onboarding-tour.md`

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-16 | Claude (Opus 4.7) | Criação + APPROVED (decisão arquitetural do usuário) |
