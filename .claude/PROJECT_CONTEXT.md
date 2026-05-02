# 📋 Futeba dos Parças - Contexto Consolidado do Projeto

> **Última Atualização:** 2026-03-27
> **Versão:** 1.21.0 (Build 42)
> **Propósito:** Contexto otimizado para Claude Code e outros LLMs

---

## 🎯 Resumo Executivo

**Futeba dos Parças** é um app Android/iOS multiplataforma (Kotlin Multiplatform) para gerenciamento de peladas com gamificação completa. Pense em **Duolingo meets Futebol Amador**.

### Stack Principal
- **Android:** Jetpack Compose + Kotlin 2.2.10 (KMP)
- **Web:** React 18 + TypeScript + Material UI 5 + Vite 8
- **Backend:** Firebase (Firestore, Auth, Storage, Cloud Functions v2)
- **Arquitetura:** MVVM + Clean Architecture + Koin 4.1.1 DI
- **Linguagem:** Kotlin 2.2.10 (KMP ~95% código compartilhado)
- **Web:** React 18 + TypeScript + Material UI 5 + Vite 8

### Status Atual
- ✅ Android: **PRODUÇÃO** (Play Store v1.21.0)
- ✅ Web: **PRODUÇÃO** (React app - PR #194 merged, Vite 8)
- 🚧 iOS: **CMP Phase 2** (GitLive Firebase SDK migration in progress)
- ✅ Backend: Firebase Functions v2 (TypeScript, 30+ functions)
- ✅ CI/CD: GitHub Actions (Android CI, Functions CI, iOS Build, CodeQL, Dependabot)

---

## 📂 Estrutura do Projeto

```
futeba-dos-parcas/
├── app/                          # Android app (Compose UI)
│   ├── src/main/java/com/futebadosparcas/
│   │   ├── ui/                   # Screens (Compose)
│   │   ├── data/                 # Repositories impl
│   │   ├── domain/               # Use Cases
│   │   └── di/                   # Koin modules
│   └── build.gradle.kts
│
├── shared/                       # Kotlin Multiplatform
│   ├── commonMain/               # Cross-platform business logic
│   ├── androidMain/              # Android-specific code
│   └── iosMain/                  # iOS-specific code
│
├── composeApp/                   # Compose Multiplatform UI
│   ├── commonMain/               # Shared UI components
│   ├── androidMain/              # Android UI entry
│   └── iosMain/                  # iOS UI entry
│
├── iosApp/                       # iOS native (Swift + KMP)
│   ├── iosApp/                   # SwiftUI app
│   └── Pods/                     # CocoaPods (Firebase iOS)
│
├── functions/                    # Cloud Functions (TypeScript)
│   └── src/
│       ├── index.ts              # Main entry
│       ├── league.ts             # League/ranking logic
│       ├── notifications.ts      # FCM push
│       └── badges/               # Badge unlock system
│
├── firestore.rules               # Security rules
├── firestore.indexes.json        # Composite indexes
├── storage.rules                 # Storage security
│
├── .github/
│   ├── workflows/                # CI/CD
│   │   ├── android-ci.yml        # Lint, Test, Build
│   │   ├── ios-build.yml         # iOS Simulator build
│   │   ├── codeql.yml            # Security scanning
│   │   └── release.yml           # Automated releases
│   ├── ISSUE_TEMPLATE/           # Bug/Feature templates
│   └── pull_request_template.md
│
├── specs/                        # Spec-Driven Development
│   ├── _TEMPLATE_FEATURE_MOBILE.md
│   ├── _TEMPLATE_BUGFIX_MOBILE.md
│   └── DECISIONS.md              # Architecture decisions
│
├── .claude/
│   ├── rules/                    # Coding patterns
│   │   ├── compose-patterns.md
│   │   ├── material3-compose-reference.md
│   │   ├── viewmodel-patterns.md
│   │   ├── firestore.md
│   │   └── kotlin-style.md
│   └── PROJECT_CONTEXT.md        # Este arquivo
│
├── web/                          # React Web Application
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   ├── contexts/             # Auth, Theme, Toast contexts
│   │   ├── hooks/                # Custom React hooks
│   │   ├── pages/                # Page components by feature
│   │   ├── services/             # Firebase services
│   │   ├── theme/                # MUI theme config
│   │   └── types/                # TypeScript definitions
│   ├── e2e/                      # Playwright E2E tests
│   └── package.json
│
├── CLAUDE.md                     # Developer guide
├── README.md                     # Public README
├── CONTRIBUTING.md               # Contribution guide
└── CHANGELOG.md                  # Version history
```

---

## 🏗️ Arquitetura em Camadas

```
┌─────────────────────────────────────────────┐
│           UI Layer (Compose)                │
│  - Screens, Components, Theme               │
│  - Observa StateFlow<UiState>               │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         ViewModel Layer                     │
│  - Koin-injected ViewModels                │
│  - StateFlow management                     │
│  - viewModelScope                           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│        Use Cases (Domain)                   │
│  - Business logic                           │
│  - Validation                               │
│  - Orchestration                            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Repository Layer (Data)                │
│  - Interface (shared/commonMain)            │
│  - Implementation (androidMain/iosMain)     │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│       Data Sources                          │
│  - Firebase (Firestore, Auth, Storage, FCM)│
│  - Room (local cache)                       │
└─────────────────────────────────────────────┘
```

---

## 🔥 Firebase - Estrutura de Dados

### Collections Principais

#### `users` (Perfis de Usuário)
```kotlin
data class User(
    val id: String,                    // UID do Firebase Auth
    val name: String,
    val email: String,
    val photoUrl: String?,
    val role: UserRole,                // PLAYER, FIELD_OWNER, ADMIN
    val level: Int = 1,                // Nível baseado em XP
    val xp: Int = 0,                   // XP global (nunca reseta)
    val streak: Int = 0,               // Jogos consecutivos
    val createdAt: Timestamp,
    val settings: UserSettings
)
```

#### `games` (Partidas)
```kotlin
data class Game(
    val id: String,
    val groupId: String,
    val locationId: String,
    val dateTime: Timestamp,
    val status: GameStatus,            // SCHEDULED, CONFIRMED, LIVE, FINISHED
    val maxPlayers: Int = 20,
    val teams: Teams?,                 // Após confirmação
    val score: Score?,                 // Durante/após partida
    val mvpVotes: Map<String, Int>,    // userId -> votes
    val createdBy: String,             // userId do organizador
)

enum class GameStatus {
    SCHEDULED,    // Criado, aguardando confirmações
    CONFIRMED,    // Lista fechada, times formados
    LIVE,         // Jogo em andamento
    FINISHED      // Finalizado, XP processado
}
```

#### `groups` (Grupos de Pelada)
```kotlin
data class Group(
    val id: String,
    val name: String,
    val description: String,
    val members: List<String>,         // userIds
    val admins: List<String>,          // userIds
    val settings: GroupSettings
)
```

#### `statistics` (Estatísticas por Grupo)
```kotlin
data class Statistics(
    val userId: String,
    val groupId: String,
    val totalGames: Int,
    val wins: Int,
    val goals: Int,
    val assists: Int,
    val saves: Int,                    // Goleiros
    val yellowCards: Int,
    val redCards: Int,
    val mvpCount: Int,
    val winRate: Double
)
```

#### `season_participation` (Rankings Mensais)
```kotlin
data class SeasonParticipation(
    val userId: String,
    val groupId: String,
    val seasonId: String,              // "2026-02"
    val seasonXp: Int,                 // XP acumulado no mês
    val division: Division,            // BRONZE, SILVER, GOLD, DIAMOND
    val rank: Int,                     // Posição no ranking
    val gamesPlayed: Int
)
```

#### `xp_logs` (Histórico de XP)
```kotlin
data class XpLog(
    val id: String,
    val userId: String,
    val gameId: String,
    val xpAmount: Int,
    val reason: XpReason,              // PARTICIPATION, GOAL, MVP, WIN, etc.
    val timestamp: Timestamp
)
```

#### `user_badges` (Conquistas)
```kotlin
data class UserBadge(
    val userId: String,
    val badgeId: String,               // "first_goal", "hat_trick", "mvp_x3"
    val unlockedAt: Timestamp,
    val level: Int = 1                 // Alguns badges têm níveis
)
```

### Cloud Functions (TypeScript)

| Function | Trigger | Descrição |
|----------|---------|-----------|
| `onUserCreate` | Auth onCreate | Cria documento inicial em `users` |
| `onGameFinished` | Firestore onUpdate | Processa XP, badges, estatísticas |
| `processXp` | Callable | Calcula e atribui XP de um jogo |
| `recalculateLeagueRating` | Scheduled (diário) | Atualiza divisões e rankings |
| `sendGameCreatedNotification` | Firestore onCreate | Push FCM para membros do grupo |
| `sendMvpNotification` | Callable | Notifica MVP eleito |
| `monthlySeasonReset` | Scheduled (dia 1) | Reseta XP de temporada, promove/rebaixa |
| `cleanupOldGames` | Scheduled (semanal) | Remove jogos antigos (>6 meses) |

---

## 🎮 Sistema de Gamificação

### XP System

| Ação | XP | Observações |
|------|-----|-------------|
| Participação | +10 | Apenas por comparecer |
| Gol | +5 | Por gol marcado |
| Assistência | +3 | Passe que gera gol |
| Defesa (GK) | +2 | Goleiros apenas |
| MVP | +50 | Eleito melhor da partida |
| Vitória | +20 | Time vencedor |
| Streak 3+ jogos | +10 | Bônus de consistência |
| Streak 7+ jogos | +20 | Bônus maior |
| Streak 10+ jogos | +30 | Bônus máximo |
| Bola Murcha | -20 | Penalidade (pior jogador) |

### Níveis e Divisões

**Níveis (Global - Nunca Reseta):**
- XP acumulado ao longo da vida
- Fórmula: `level = floor(sqrt(xp / 100))`
- Exemplo: 10.000 XP = Nível 10

**Divisões (Mensal - Reseta dia 1):**
- **Bronze:** 0-499 XP/mês
- **Prata:** 500-1499 XP/mês
- **Ouro:** 1500-2999 XP/mês
- **Diamante:** 3000+ XP/mês

**Promoção/Rebaixamento:**
- Top 30% de cada divisão → Promovido
- Bottom 20% de cada divisão → Rebaixado

### Badges (Conquistas)

#### Progressão
- `first_game` - Primeiro jogo
- `veteran_10` - 10 jogos
- `veteran_50` - 50 jogos
- `veteran_100` - 100 jogos
- `legend` - 500 jogos

#### Performance
- `first_goal` - Primeiro gol
- `hat_trick` - 3 gols em um jogo
- `striker` - 50 gols na carreira
- `playmaker` - 50 assistências
- `mvp_x1` - Primeiro MVP
- `mvp_x5` - 5 MVPs
- `mvp_x10` - 10 MVPs

#### Consistência
- `iron_man_7` - Streak de 7 jogos
- `iron_man_30` - Streak de 30 jogos
- `monthly_hero` - Divisão Ouro ou superior

#### Especiais
- `no_yellow` - 50 jogos sem cartão
- `comeback_king` - Virou 5 jogos perdendo
- `perfect_month` - 100% presença no mês

---

## 🎨 Design System (Material 3)

### Cores Principais

```kotlin
// Theme.kt - ColorScheme
val primaryLight = Color(0xFF58CC02)       // Verde Duolingo
val onPrimaryLight = Color(0xFFFFFFFF)
val primaryContainerLight = Color(0xFFD0FFB3)
val onPrimaryContainerLight = Color(0xFF0E3600)

val secondaryLight = Color(0xFFFF9600)     // Laranja
val tertiaryLight = Color(0xFF6200EA)      // Roxo

// Gamificação (cores fixas)
object GamificationColors {
    val Gold = Color(0xFFFFD700)
    val Silver = Color(0xFFE0E0E0)
    val Bronze = Color(0xFFCD7F32)
    val Diamond = Color(0xFFB9F2FF)
    val XpGreen = Color(0xFF00C853)
}
```

### Tipografia

```kotlin
val AppTypography = Typography(
    // Títulos principais
    displayLarge = TextStyle(fontSize = 57.sp, fontWeight = FontWeight.Normal),
    headlineLarge = TextStyle(fontSize = 32.sp, fontWeight = FontWeight.SemiBold),
    titleLarge = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.SemiBold),

    // Corpo do texto
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),

    // Labels
    labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
)
```

### Componentes Reutilizáveis

| Componente | Localização | Uso |
|------------|-------------|-----|
| `GameCard` | `ui/components/GameCard.kt` | Card de jogo (lista/detalhes) |
| `PlayerCard` | `ui/components/PlayerCard.kt` | Card de jogador |
| `XpProgressBar` | `ui/components/XpProgressBar.kt` | Barra de XP animada |
| `BadgeIcon` | `ui/components/BadgeIcon.kt` | Ícone de badge |
| `DivisionBadge` | `ui/components/DivisionBadge.kt` | Badge de divisão |
| `EmptyState` | `ui/components/EmptyState.kt` | Tela vazia com ação |
| `LoadingShimmer` | `ui/components/LoadingShimmer.kt` | Skeleton loading |

---

## 🔑 Regras de Desenvolvimento

### Spec-Driven Development (SDD)

**OBRIGATÓRIO:**
1. Toda feature/bugfix DEVE ter spec em `/specs/` **antes** de codificar
2. Copiar template: `_TEMPLATE_FEATURE_MOBILE.md` ou `_TEMPLATE_BUGFIX_MOBILE.md`
3. Status da spec = `APPROVED` antes de implementar
4. Registrar decisões importantes em `/specs/DECISIONS.md`

### Fases Obrigatórias
```
REQUIREMENTS → UX/UI → TECHNICAL DESIGN → TASKS → IMPLEMENTATION → VERIFY
```

### Definition of Done (DoD)

- [ ] Código compila sem erros
- [ ] Testes unitários passam
- [ ] Lint passa (Detekt)
- [ ] Funciona em portrait/landscape/tablet
- [ ] `contentDescription` em ícones/botões
- [ ] Touch targets >= 48dp
- [ ] Estados tratados: Loading, Empty, Error, Success
- [ ] Offline/erros com fallback definido
- [ ] Sem cores hardcoded (usar `MaterialTheme.colorScheme.*`)
- [ ] Sem strings hardcoded (usar `strings.xml`)
- [ ] Comentários em **Português (PT-BR)**

### Padrões de Código

#### ViewModels
```kotlin
class FeatureViewModel(
    private val repository: Repository
) : ViewModel() {

    private val _uiState = MutableStateFlow<UiState>(UiState.Loading)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private var loadJob: Job? = null

    fun loadData() {
        loadJob?.cancel()  // Sempre cancelar job anterior
        loadJob = viewModelScope.launch {
            repository.getData()
                .catch { e -> _uiState.value = UiState.Error(e.message) }
                .collect { data -> _uiState.value = UiState.Success(data) }
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }
}

sealed class UiState {
    object Loading : UiState()
    object Empty : UiState()
    data class Error(val message: String) : UiState()
    data class Success(val data: Data) : UiState()
}
```

#### Compose Screens
```kotlin
@Composable
fun FeatureScreen(
    viewModel: FeatureViewModel = koinViewModel(),
    onNavigate: (destination: String) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    FeatureContent(
        state = uiState,
        onAction = { action -> viewModel.handleAction(action) }
    )
}

@Composable
private fun FeatureContent(
    state: UiState,
    onAction: (Action) -> Unit
) {
    when (state) {
        is UiState.Loading -> LoadingShimmer()
        is UiState.Empty -> EmptyState(message = "Sem dados")
        is UiState.Error -> ErrorState(message = state.message)
        is UiState.Success -> SuccessContent(data = state.data)
    }
}
```

### Proibições

❌ **NUNCA:**
- `!!` operator (usar `?.let {}` ou `?: return`)
- `LiveData` (usar `StateFlow`)
- `findViewById()` (usar ViewBinding ou Compose)
- Hardcoded colors/strings
- Lógica de negócio na UI
- Nested `LazyColumn` (usar `FlowRow`)
- Mutable collections expostas (usar `toList()`)

✅ **SEMPRE:**
- Koin para DI (`koinViewModel()`, `by inject()`)
- Coroutines para async (`viewModelScope`, `lifecycleScope`)
- `Result<T>` para operações que podem falhar
- `Flow<T>` para dados em tempo real
- Try-catch em operações de rede/Firestore
- Cancelar jobs em `onCleared()`

---

## 📊 Comandos Úteis

### Android

```bash
# Build & Install
./gradlew assembleDebug
./gradlew installDebug

# Testes
./gradlew :app:testDebugUnitTest
./gradlew :app:testDebugUnitTest --tests "*.FeatureViewModelTest"

# Quality
./gradlew lint
./gradlew detekt
./gradlew clean

# Compile check (rápido)
./gradlew compileDebugKotlin
```

### iOS (KMP)

```bash
# Build shared framework
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64  # Simulator
./gradlew :shared:linkDebugFrameworkIosArm64           # Device

# Compile check
./gradlew :composeApp:compileDebugKotlinIosSimulatorArm64
```

### Firebase

```bash
cd functions

# Local development
npm install
npm run build
firebase emulators:start

# Deploy
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage
```

### Git (Conventional Commits)

```bash
# Formato
<type>(<scope>): <description>

# Exemplos
feat(games): add MVP voting screen
fix(auth): resolve login crash on Android 14
docs(readme): update installation instructions
refactor(profile): simplify stats calculation
test(games): add unit tests for GameViewModel
chore(deps): bump Compose to 1.7.3
```

---

## 🔗 Referências Rápidas

### Documentação Interna
- **CLAUDE.md** - Guia completo para desenvolvimento
- **.claude/rules/** - Padrões de código (Compose, ViewModels, Firestore, etc.)
- **specs/** - Especificações de features
- **CONTRIBUTING.md** - Guia de contribuição

### Documentação Externa
- [Jetpack Compose Samples](https://github.com/android/compose-samples)
- [Material Design 3](https://m3.material.io/)
- [Kotlin Multiplatform Docs](https://kotlinlang.org/docs/multiplatform.html)
- [Firebase Android Docs](https://firebase.google.com/docs/android/setup)

### Links Importantes
- [GitHub Repository](https://github.com/TechFernandesLTDA/futeba-dos-parcas)
- [Play Store](https://play.google.com/store/apps/details?id=com.futebadosparcas)
- [Firebase Console](https://console.firebase.google.com/project/futebadosparcas)
- [GitHub Actions](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions)

---

## 🚀 Roadmap 2026

### Q1 (Jan-Mar)
- ✅ iOS FASE 1 (KMP infrastructure)
- ✅ GitHub repository professionalization
- ✅ CMP Phase 0 (CMP 1.10.0, SQLDelight 2.2.1, wasmJs)
- ✅ CMP Phase 1 (Hilt → Koin 4.1.1)
- ✅ Web App (React 18 + TypeScript + MUI - shipped early!)
- 🔄 CMP Phase 2 (GitLive Firebase SDK)

### Q2 (Abr-Jun)
- 📅 CMP Phase 3 (Shared UI in composeApp/)
- 📅 iOS app launch via TestFlight
- 📅 Sistema de torneios
- 📅 Pagamentos PIX integrados
- 📅 Votação MVP aprimorada

### Q3 (Jul-Set)
- 📅 Networking entre grupos
- 📅 Convites cross-group
- 📅 Dashboard para donos de quadra

### Q4 (Out-Dez)
- 📅 Analytics avançado
- 📅 Cards instagramáveis de partidas
- 📅 Sistema de reputação

---

## 📞 Contato

- **Email:** techfernandesltda@gmail.com
- **Issues:** https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues
- **Discussions:** https://github.com/TechFernandesLTDA/futeba-dos-parcas/discussions

---

**Feito com ❤️ pela Tech Fernandes Ltda**
*Built for broken ankles and spectacular goals.* ⚽
