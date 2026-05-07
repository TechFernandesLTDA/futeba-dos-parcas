# Session Handoff — Overnight 2026-05-07 (continuação)

> Doc durável da segunda metade da sessão de 2026-05-07. Parte 1 em `SESSION_HANDOFF_2026-05-07_PLAY_STORE.md`.

## Big picture

**iOS reativação completa** + **4 issues UX P3 resolvidas** + **Frente C: 4 repos legados Firebase Android SDK migrados pra GitLive**. 9 PRs merged em sequência, todos verdes em CI.

## Snapshot final

- **PRs abertos:** 0
- **Issues abertas:** 0
- **Dependabot alerts:** 0
- **Working tree:** clean
- **Master HEAD:** 287efde (PR #555 merged)

## PRs entregues (9 nesta sessão noturna)

| PR | Frente | Conteúdo |
|----|--------|----------|
| [#547](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/547) | E3/#541 | Side-sheet desktop em CreateGame/CreateGroup |
| [#548](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/548) | E1/#539 | Split-pane responsivo em GameDetail/GroupDetail |
| [#549](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/549) | A | 3 repos refactor java→kotlinx + shared |
| [#550](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/550) | E2/#540 | Cmd+K command palette |
| [#551](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/551) | B | iOS Phase 1.c — Discovery + JoinRequest no shared |
| [#552](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/552) | E4/#542 | InteractiveCard + context menus |
| [#553](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/553) | C parte 1 | GameTeam + GameRequest → GitLive |
| [#554](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/554) | C parte 2 | GameExperience + GameSummon → GitLive |
| [#555](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/555) | D | iOS xcodegen + smoke test BUILD SUCCEEDED |

## Issues fechadas

- [#539](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/539) maxWidth split-pane → PR #548
- [#540](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/540) Cmd+K palette → PR #550
- [#541](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/541) Side-sheet desktop → PR #547
- [#542](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/542) Hover + right-click → PR #552
- [#543](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/543) Epic UX modernization (closed)

## iOS reativação — status detalhado

### Antes (início da sessão)
- 16 repositórios Android-only em `androidMain/`
- 8 repos shared em `nativeAndAndroidMain/` (após PRs anteriores)
- Sem .xcodeproj
- iOS framework só compilava parcial

### Depois (fim da sessão)
- **13 repos shared Android+iOS** em `nativeAndAndroidMain/` (era 6 → 13)
- iOS framework `linkDebugFrameworkIosSimulatorArm64` BUILD SUCCESSFUL
- iOS app `iosApp.xcodeproj` gerado via XcodeGen
- `xcodebuild` simulator BUILD SUCCEEDED com smoke screen

### Repos shared agora (13)
Activity, Auth, Cashbox, GameEvents, **GameExperience**, **GameRequest**, **GameSummon**, **GameTeam**, Gamification, Group, Notification, Ranking, Statistics

### Mantidos em androidMain (não migráveis sem refactor)
- AddressRepositoryImpl (usa `android.os.Build`)
- LocationRepositoryImpl (versão iOS divergente em `iosMain/`)

## Frente A — refactor java.* → kotlinx.datetime

**3 repos** (Gamification, Ranking, Statistics):
- `SimpleDateFormat("yyyy-MM-dd")` → `LocalDate.parse()`
- `Calendar.getInstance().add(...)` → `LocalDate.minus(N, DateTimeUnit.MONTH)`
- `Date(epochMs)` + `Calendar` → `Instant.fromEpochMilliseconds().toLocalDateTime()`
- `System.currentTimeMillis()` → `Clock.System.now().toEpochMilliseconds()` (System é JVM-only)
- `synchronized(userCache)` removido (não disponível em K/Native; cache LRU best-effort)

## Frente B — iOS Phase 1.c

**Novo model commonMain:** `GroupJoinRequest` + `GroupJoinRequestStatus` enum (timestamps em epoch ms para cross-platform).

**`GroupRepository` interface estendida:**
- `searchPublicGroups(query, limit)` — Discovery
- `createJoinRequest`, `cancelMyJoinRequest`, `approveJoinRequest`, `rejectJoinRequest`
- `observeMyJoinRequest`, `observePendingJoinRequests` (Flows)

**`FirebaseDataSource` ganhou métodos correspondentes** em commonMain expect + nativeAndAndroidMain actual.

**Discovery strategy:** scan paginado (limit 200) + filter in-memory por nome/descrição. Aceitável até hundreds de grupos. Para escalar: plugar Algolia/MeiliSearch.

## Frente C — 4 repos GitLive

Migração mecânica mas substancial (~1300 linhas):

| Padrão Android SDK | → GitLive |
|---|---|
| `whereEqualTo("k", v)` | `where { "k" equalTo v }` |
| `.get().await()` | `.get()` (suspend nativo) |
| `addSnapshotListener` callback | `.snapshots.collect` |
| `callbackFlow` | `flow { ... }` |
| `Query.Direction.ASCENDING` | `Direction.ASCENDING` |
| `FieldValue.serverTimestamp()` | `FieldValue.serverTimestamp` |
| `firestore.batch()...commit().await()` | `firestore.batch().apply{}.commit()` |
| `runTransaction { transaction -> ... }.await()` | `runTransaction { ... }` lambda receiver |

**Cleanup:** removido `FirebaseDataSourceAndroidCompat.kt` (extension `getFirestore()` não é mais usada).

## Frente D — iOS Xcode setup

**Solução escolhida:** XcodeGen + CocoaPods (versionar `project.yml` + `Podfile`, `.xcodeproj` é gerado).

**Smoke flow funcional:**
```bash
brew install xcodegen
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64
cd iosApp && xcodegen generate
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
xcodebuild -workspace iosApp.xcworkspace -scheme iosApp \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -configuration Debug build CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO
```

`ContentView.swift` é placeholder: importa `shared` direto (não `ComposeApp`), mostra `Platform().name`. Substituir por `composeApp/MainViewController` quando Phase 3 CMP destrava.

## Frente E — UX desktop (4 issues)

Implementadas via agentes especialistas em paralelo, todas mergeadas:

| Issue | Componente | PR |
|---|---|---|
| #539 | Split-pane md/lg em GameDetail+GroupDetail | #548 |
| #540 | `<CommandPalette>` Cmd+K (modal) + `useKeyboardShortcut` | #550 |
| #541 | `<AdaptiveFormSheet>` (drawer right em md+, fullscreen mobile) | #547 |
| #542 | `<InteractiveCard>` + `useContextMenu` (right-click + Shift+F10) | #552 |

## Próximas frentes sugeridas

### Curto prazo (ROI alto)
- **Phase 3 CMP UI compartilhada**: `composeApp/iosMain/MainViewController` para substituir ContentView placeholder
- **Configurar signing team** no Xcode para device builds
- **TestFlight smoke**: archive + upload via fastlane ou Xcode Organizer

### Médio prazo
- Migrar `JoinRequestRepository.kt` Android (`app/data/repository/`) para usar nova `GroupRepository.observeMyJoinRequest()` etc., e deletar versão Android-specific
- Refactor LocationRepositoryImpl (eliminar versão iOS divergente — convergir pra única impl shared)
- Refactor AddressRepositoryImpl (extrair uso de `android.os.Build` para Platform expect/actual)

### Maintenance
- Promover Internal → Production no Play Console (deploy stage anterior funcionando)
- Considerar migrar `app/JoinRequestRepository.kt` ViewModels para usar a interface shared

## Padrões aprendidos

### KMP shared sourcesets
- `commonMain` — interfaces + models cross-platform
- `nativeAndAndroidMain` — implementações Android+iOS via GitLive Firebase SDK
- `androidMain` — apenas código Android-specific (java.util.* uses, android.os.*, Hilt antes da migração Koin)
- `iosMain` — apenas iOS-specific quando diverge

### Substituições obrigatórias para shared
- `java.util.Date` / `Calendar` / `SimpleDateFormat` → `kotlinx.datetime`
- `System.currentTimeMillis()` → `Clock.System.now().toEpochMilliseconds()`
- `synchronized` (K/Native não suporta) → mutex/atomic ou aceitar race em cache LRU
- Firebase Android SDK direto → GitLive Firebase Kotlin SDK

### Workarounds CI/CD descobertos
- **Ruby 4.x + CocoaPods**: `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install` (Unicode bug)
- **XcodeGen**: melhor que manter `.xcodeproj` versionado (merge conflicts)
- **gh pr merge --admin**: warning sobre worktree principal mas funciona

## Refs rápidas

- Memory: `~/.claude/projects/-Users-renanlocatizfernandes-Code-personal-TechFernandesLTDA-futeba-dos-parcas/memory/MEMORY.md`
- Spec CMP: `specs/CMP_MULTIPLATFORM_MIGRATION.md`
- iOS SETUP: `iosApp/SETUP.md` (atualizado)
- Handoff anterior: `.claude/agent-memory/SESSION_HANDOFF_2026-05-07_PLAY_STORE.md`
