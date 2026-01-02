# Plano de Implementação: Melhorias da Tela Home - Futeba dos Parças

## Visão Geral

Implementação de 13 funcionalidades para aprimorar a tela inicial do aplicativo Futeba dos Parças, incluindo sistema de privacidade de jogos, feed de atividades, widgets de gamificação, visualizações de dados e melhorias de UX.

**Duração Estimada**: 12-16 semanas (6 fases)
**Arquitetura**: MVVM + Clean Architecture (preservada)
**UI**: Híbrida XML + Jetpack Compose (mantida)

---

## FASE 1: Sistema de Privacidade de Jogos (Semanas 1-3)

### Objetivo
Implementar sistema de visibilidade de jogos e solicitações externas de participação.

### Funcionalidades
- **#2 (Parcial)**: Jogos públicos/privados com solicitações externas

### Contexto Técnico Descoberto
- Campo `Game.isPublic` existe mas está INUTILIZADO
- Atualmente TODOS os jogos são privados via grupos (obrigatório)
- NÃO existe sistema de descoberta pública
- Grupo é obrigatório para criar jogos

### Implementação

#### 1.1 Novos Modelos de Dados

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/model/GameRequest.kt` (CRIAR)
```kotlin
enum class GameVisibility {
    GROUP_ONLY,      // Apenas membros do grupo (comportamento atual)
    PUBLIC_CLOSED,   // Público para descobrir mas fechado
    PUBLIC_OPEN      // Público e aceita solicitações externas
}

enum class RequestStatus {
    PENDING, APPROVED, REJECTED
}

data class GameJoinRequest(
    @DocumentId val id: String = "",
    @get:PropertyName("game_id") var gameId: String = "",
    @get:PropertyName("user_id") var userId: String = "",
    @get:PropertyName("user_name") var userName: String = "",
    @get:PropertyName("user_photo") var userPhoto: String? = null,
    val message: String = "",
    val status: String = RequestStatus.PENDING.name,
    @get:PropertyName("requested_at") var requestedAt: Date? = null,
    @get:PropertyName("reviewed_at") var reviewedAt: Date? = null,
    @get:PropertyName("reviewed_by") var reviewedBy: String? = null
)
```

#### 1.2 Atualização do Modelo Game

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/model/Game.kt` (MODIFICAR)
```kotlin
// ADICIONAR campo:
@get:PropertyName("visibility")
@set:PropertyName("visibility")
var visibility: String = GameVisibility.GROUP_ONLY.name

// ADICIONAR método helper:
fun getVisibility(): GameVisibility = try {
    GameVisibility.valueOf(visibility)
} catch (e: Exception) {
    // Compatibilidade: se isPublic=true -> PUBLIC_CLOSED
    if (isPublic) GameVisibility.PUBLIC_CLOSED else GameVisibility.GROUP_ONLY
}
```

#### 1.3 Novo Repositório

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/repository/GameRequestRepository.kt` (CRIAR)
```kotlin
interface GameRequestRepository {
    suspend fun requestJoinGame(gameId: String, message: String): Result<GameJoinRequest>
    suspend fun getPendingRequests(gameId: String): Result<List<GameJoinRequest>>
    fun getPendingRequestsFlow(gameId: String): Flow<List<GameJoinRequest>>
    suspend fun approveRequest(requestId: String): Result<Unit>
    suspend fun rejectRequest(requestId: String): Result<Unit>
}
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/repository/GameRequestRepositoryImpl.kt` (CRIAR)

#### 1.4 Extensão GameRepository

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/repository/GameRepository.kt` (MODIFICAR)
```kotlin
// ADICIONAR métodos:
suspend fun getPublicGames(limit: Int = 20): Result<List<Game>>
fun getPublicGamesFlow(limit: Int = 20): Flow<List<Game>>
suspend fun getNearbyPublicGames(
    userLat: Double,
    userLng: Double,
    radiusKm: Double = 10.0
): Result<List<Game>>
```

#### 1.5 Firestore

**Arquivo**: `firestore.indexes.json` (MODIFICAR)
```json
{
  "indexes": [
    {
      "collectionGroup": "games",
      "fields": [
        {"fieldPath": "visibility", "order": "ASCENDING"},
        {"fieldPath": "dateTime", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "game_requests",
      "fields": [
        {"fieldPath": "game_id", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "requested_at", "order": "DESCENDING"}
      ]
    }
  ]
}
```

**Arquivo**: `firestore.rules` (MODIFICAR)
```
match /games/{gameId} {
  allow read: if request.auth != null &&
    (resource.data.visibility in ['PUBLIC_CLOSED', 'PUBLIC_OPEN'] ||
     isGroupMember(request.auth.uid, resource.data.group_id));
}

match /game_requests/{requestId} {
  allow create: if request.auth != null &&
    request.auth.uid == request.resource.data.user_id;
  allow read, update: if request.auth != null &&
    (request.auth.uid == resource.data.user_id ||
     isGameOwnerOrAdmin(request.auth.uid, resource.data.game_id));
}
```

### Arquivos Críticos
- `app/src/main/java/com/futebadosparcas/data/model/Game.kt`
- `app/src/main/java/com/futebadosparcas/data/repository/GameRepositoryImpl.kt`
- `firestore.rules`
- `firestore.indexes.json`

### Risco
**ALTO** - Mudanças em regras de segurança e visibilidade de jogos

### Testes
- Firestore Security Rules com emulador
- Testes de queries públicas
- Testes de transição de visibilidade

---

## FASE 2: Infraestrutura de UI (Semanas 3-5)

### Objetivo
Melhorar estados de carregamento e adicionar indicador offline.

### Funcionalidades
- **#6**: Loading States Mais Informativos
- **#9**: Modo Offline Aprimorado com Sincronização Visual

### Implementação

#### 2.1 Loading States

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/HomeViewModel.kt` (MODIFICAR)
```kotlin
sealed class LoadingState {
    object Idle : LoadingState()
    data class Loading(val message: String = "Carregando...") : LoadingState()
    data class LoadingProgress(val current: Int, val total: Int, val message: String) : LoadingState()
    object Success : LoadingState()
    data class Error(val message: String, val retryable: Boolean = true) : LoadingState()
}

private val _loadingState = MutableStateFlow<LoadingState>(LoadingState.Idle)
val loadingState: StateFlow<LoadingState> = _loadingState

// Atualizar loadHomeData() para emitir progresso
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/components/LoadingStateIndicator.kt` (CRIAR)

**Arquivo**: `app/src/main/res/layout/layout_home_shimmer_v2.xml` (CRIAR)

#### 2.2 Monitor de Conectividade

**Arquivo**: `app/src/main/java/com/futebadosparcas/util/ConnectivityMonitor.kt` (CRIAR)
```kotlin
@Singleton
class ConnectivityMonitor @Inject constructor(
    @ApplicationContext private val context: Context
) {
    val isConnected: StateFlow<Boolean> = callbackFlow {
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { trySend(true) }
            override fun onLost(network: Network) { trySend(false) }
        }
        connectivityManager.registerDefaultNetworkCallback(callback)
        awaitClose { connectivityManager.unregisterNetworkCallback(callback) }
    }.stateIn(scope, SharingStarted.Eagerly, isCurrentlyConnected())
}
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/components/SyncStatusBanner.kt` (CRIAR)

**Arquivo**: `app/src/main/res/layout/fragment_home.xml` (MODIFICAR)
```xml
<!-- Adicionar no topo após fixed header -->
<androidx.compose.ui.platform.ComposeView
    android:id="@+id/composeConnectionStatus"
    android:layout_width="match_parent"
    android:layout_height="wrap_content" />
```

### Arquivos Críticos
- `app/src/main/java/com/futebadosparcas/ui/home/HomeViewModel.kt`
- `app/src/main/java/com/futebadosparcas/ui/home/HomeFragment.kt`

### Risco
**BAIXO** - Mudanças não-destrutivas

---

## FASE 3: Feed de Atividades e Gamificação (Semanas 5-8)

### Objetivo
Implementar feed de atividades, sugestões de jogos públicos, widgets de streak, desafios e badges.

### Funcionalidades
- **#1**: Feed de Atividades Recentes
- **#2 (Completa)**: Sugestões Personalizadas de Jogos Próximos
- **#3**: Widget de Streak
- **#8**: Sistema de Conquistas/Challenges na Home
- **#10**: Carrossel de Conquistas Recentes com Animação

### Contexto Descoberto
- `GamificationRepository` JÁ implementa streaks (getUserStreak, updateStreak)
- `BadgeAwarder` JÁ existe e premia badges automaticamente
- `User.milestonesAchieved` existe mas é simples lista de strings
- NÃO existe BadgeType enum (referenciado mas missing)
- NÃO existe sistema de challenges/desafios

### Implementação

#### 3.1 Feed de Atividades

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/model/Activity.kt` (CRIAR)
```kotlin
enum class ActivityType {
    GAME_FINISHED, BADGE_EARNED, MILESTONE_REACHED, LEVEL_UP,
    STREAK_MILESTONE, CHALLENGE_COMPLETED, MVP_EARNED, HAT_TRICK, CLEAN_SHEET
}

enum class ActivityVisibility {
    PRIVATE, FRIENDS, PUBLIC
}

data class Activity(
    @DocumentId val id: String = "",
    @get:PropertyName("user_id") var userId: String = "",
    @get:PropertyName("user_name") var userName: String = "",
    @get:PropertyName("user_photo") var userPhoto: String? = null,
    val type: String = ActivityType.GAME_FINISHED.name,
    val title: String = "",
    val description: String = "",
    @get:PropertyName("reference_id") var referenceId: String? = null,
    @get:PropertyName("reference_type") var referenceType: String? = null,
    val metadata: Map<String, Any> = emptyMap(),
    @ServerTimestamp @get:PropertyName("created_at") var createdAt: Date? = null,
    val visibility: String = ActivityVisibility.PUBLIC.name
)
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/repository/ActivityRepository.kt` (CRIAR)

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/repository/ActivityRepositoryImpl.kt` (CRIAR)

**Arquivo**: `backend/functions/src/activities.ts` (CRIAR - Cloud Function)
```javascript
// Auto-gerar atividades quando jogo finaliza
exports.onGameFinished = functions.firestore
  .document('games/{gameId}')
  .onUpdate(async (change, context) => {
    // Se status mudou para FINISHED
    // Criar activities para MVP, hat-trick, etc.
  });
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/components/ActivityFeedSection.kt` (CRIAR)

#### 3.2 Sugestões de Jogos Públicos

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/components/PublicGamesSuggestions.kt` (CRIAR)

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/HomeViewModel.kt` (MODIFICAR)
```kotlin
// Adicionar Flow de jogos públicos
private val _publicGames = MutableStateFlow<List<Game>>(emptyList())
val publicGames: StateFlow<List<Game>> = _publicGames

init {
    viewModelScope.launch {
        gameRepository.getPublicGamesFlow(limit = 10).collect { result ->
            _publicGames.value = result.getOrDefault(emptyList())
        }
    }
}
```

#### 3.3 Widget de Streak

**Descoberta Importante**: `GamificationRepository` linha 35-63 JÁ implementa `updateStreak()` e `getUserStreak()`

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/components/StreakWidget.kt` (CRIAR)
```kotlin
@Composable
fun StreakWidget(streak: UserStreak?, onClick: () -> Unit) {
    Card {
        Row {
            Icon(Icons.Default.LocalFireDepartment) // Fire emoji
            Column {
                Text("${streak?.currentStreak ?: 0} dias")
                Text("Recorde: ${streak?.longestStreak ?: 0} dias")
            }
        }
    }
}
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/HomeViewModel.kt` (MODIFICAR)
```kotlin
// Adicionar no loadHomeData()
val streakDeferred = async {
    gamificationRepository.getUserStreak(userId)
}
```

#### 3.4 Sistema de Desafios

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/model/Challenge.kt` (CRIAR)
```kotlin
data class WeeklyChallenge(
    @DocumentId val id: String = "",
    val name: String = "",
    val description: String = "",
    val type: String = ChallengeType.GOALS.name,
    @get:PropertyName("target_value") var targetValue: Int = 0,
    @get:PropertyName("xp_reward") var xpReward: Int = 0,
    @get:PropertyName("start_date") var startDate: String = "",
    @get:PropertyName("end_date") var endDate: String = "",
    @get:PropertyName("is_active") var isActive: Boolean = true
)

enum class ChallengeType {
    GOALS, ASSISTS, GAMES_PLAYED, MVP, CLEAN_SHEETS, STREAK
}

data class UserChallengeProgress(
    @DocumentId val id: String = "",
    @get:PropertyName("user_id") var userId: String = "",
    @get:PropertyName("challenge_id") var challengeId: String = "",
    @get:PropertyName("current_progress") var currentProgress: Int = 0,
    @get:PropertyName("completed") var completed: Boolean = false,
    @get:PropertyName("completed_at") var completedAt: Date? = null
)
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/repository/ChallengeRepository.kt` (CRIAR)

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/components/ChallengesSection.kt` (CRIAR)

#### 3.5 Carrossel de Badges

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/components/RecentBadgesCarousel.kt` (CRIAR)
```kotlin
@Composable
fun RecentBadgesCarousel(badges: List<UserBadge>) {
    LazyRow {
        items(badges) { badge ->
            BadgeCard(badge) // Com animação flip, shimmer
        }
    }
}
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/HomeViewModel.kt` (MODIFICAR)
```kotlin
// Adicionar no loadHomeData()
val badgesDeferred = async {
    gamificationRepository.getUserBadges(userId)
        .map { it.sortedByDescending { badge -> badge.unlockedAt }.take(5) }
}
```

### Arquivos Críticos
- `app/src/main/java/com/futebadosparcas/ui/home/HomeViewModel.kt`
- `app/src/main/java/com/futebadosparcas/ui/home/HomeFragment.kt`
- `firestore.indexes.json` (adicionar índices activities, challenges)
- `backend/functions/src/activities.ts` (Cloud Function)

### Risco
**MÉDIO** - Novas coleções Firestore, Cloud Functions

---

## FASE 4: Visualização de Dados (Semanas 8-10)

### Objetivo
Adicionar gráficos de estatísticas e mapa de calor de atividades.

### Funcionalidades
- **#4**: Estatísticas Expandíveis com Gráficos
- **#11**: Mapa de Calor de Atividades (Heatmap)

### Implementação

#### 4.1 Biblioteca de Gráficos

**Arquivo**: `app/build.gradle` (MODIFICAR)
```gradle
dependencies {
    implementation "com.patrykandpatrick.vico:compose:1.13.1"
    // OU
    implementation "co.yml:ycharts:2.1.0"
}
```

#### 4.2 Estatísticas com Gráficos

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/model/StatisticsDetail.kt` (CRIAR)
```kotlin
data class StatisticsTimeSeries(
    val period: String, // "week", "month", "year"
    val dataPoints: List<StatDataPoint>
)

data class StatDataPoint(
    val timestamp: Long,
    val label: String,
    val goals: Int = 0,
    val assists: Int = 0,
    val games: Int = 0,
    val xp: Long = 0
)
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/repository/StatisticsRepository.kt` (MODIFICAR)
```kotlin
// ADICIONAR:
suspend fun getStatisticsTimeSeries(
    userId: String,
    period: String,
    metric: String
): Result<StatisticsTimeSeries>

suspend fun getMonthlyBreakdown(userId: String, year: Int): Result<List<MonthlyStats>>
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/components/ExpandableStatsSection.kt` (CRIAR)

#### 4.3 Mapa de Calor

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/model/HeatmapData.kt` (CRIAR)
```kotlin
data class ActivityHeatmap(
    val year: Int,
    val contributions: Map<String, Int> // "YYYY-MM-DD" -> game count
)

enum class HeatmapIntensity {
    NONE, LOW, MEDIUM, HIGH
}
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/repository/StatisticsRepository.kt` (MODIFICAR)
```kotlin
// ADICIONAR:
suspend fun getActivityHeatmap(userId: String, year: Int): Result<ActivityHeatmap>
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/components/ActivityHeatmapSection.kt` (CRIAR)

### Arquivos Críticos
- `app/src/main/java/com/futebadosparcas/data/repository/StatisticsRepositoryImpl.kt`
- `app/build.gradle`

### Risco
**BAIXO** - Apenas visualização, não altera dados

---

## FASE 5: Melhorias de Interação (Semanas 10-12)

### Objetivo
Adicionar preview de notificações, countdown e modos de visualização.

### Funcionalidades
- **#5**: Notificações In-App com Preview
- **#7**: Countdown para Próximo Jogo
- **#12**: Modo Compacto/Expansível para Lista de Jogos

### Contexto Descoberto
- Sistema de notificações é COMPLETO (14 tipos, FCM, Firestore)
- NotificationRepository JÁ tem getUnreadCountFlow()
- Atualmente badge está no profile tab (pode mover para home)

### Implementação

#### 5.1 Preview de Notificações

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/components/NotificationPreviewSheet.kt` (CRIAR)
```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationPreviewSheet(
    notifications: List<AppNotification>,
    onDismiss: () -> Unit,
    onNotificationClick: (AppNotification) -> Unit,
    onMarkAllRead: () -> Unit,
    onViewAll: () -> Unit
) {
    ModalBottomSheet {
        // Últimas 5 notificações
        // Botões de ação inline
        // Link "Ver todas"
    }
}
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/HomeFragment.kt` (MODIFICAR)
```kotlin
// Em btnNotifications.setOnClickListener
// Abrir bottom sheet em vez de navegar diretamente
```

#### 5.2 Countdown para Jogos

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/components/GameCountdown.kt` (CRIAR)
```kotlin
@Composable
fun GameCountdown(game: Game) {
    val (days, hours, minutes) = remember(game.dateTime) {
        calculateTimeUntil(game.dateTime)
    }

    // Atualizar a cada minuto
    LaunchedEffect(Unit) {
        while (true) {
            delay(60000)
            // Recalcular
        }
    }

    Text(
        buildCountdownText(days, hours, minutes),
        color = when {
            days == 0 && hours < 3 -> Color.Red
            days == 0 -> Color.Orange
            else -> Color.Gray
        }
    )
}
```

**Arquivo**: `app/src/main/res/layout/item_game_card.xml` (MODIFICAR)
```xml
<!-- Adicionar ComposeView para countdown -->
<androidx.compose.ui.platform.ComposeView
    android:id="@+id/composeCountdown"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content" />
```

#### 5.3 Modos de Visualização

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/model/ViewMode.kt` (CRIAR)
```kotlin
enum class GameListViewMode {
    LIST,      // Vertical cards (padrão)
    GRID,      // 2 colunas
    COMPACT    // Lista condensada 1 linha
}
```

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/components/ViewModeSwitcher.kt` (CRIAR)

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/components/AdaptiveGamesList.kt` (CRIAR)

**Arquivo**: `app/src/main/java/com/futebadosparcas/util/PreferencesManager.kt` (MODIFICAR)
```kotlin
// Adicionar métodos para salvar/carregar viewMode
```

### Arquivos Críticos
- `app/src/main/java/com/futebadosparcas/ui/home/HomeFragment.kt`
- `app/src/main/res/layout/item_game_card.xml`

### Risco
**BAIXO** - Melhorias de UI não-destrutivas

---

## FASE 6: Integração e Polimento (Semanas 12-14)

### Objetivo
Integrar todas as funcionalidades, otimizar performance e testar.

### Atividades

#### 6.1 Reorganização do Layout Home

**Arquivo**: `app/src/main/res/layout/fragment_home.xml` (MODIFICAR COMPLETO)

Nova estrutura:
```xml
<ConstraintLayout>
    <!-- 1. Fixed Header (Notifications, Groups, Map) -->
    <LinearLayout android:id="@+id/layoutFixedHeader" />

    <!-- 2. Connection Status Banner -->
    <ComposeView android:id="@+id/composeConnectionStatus" />

    <SwipeRefreshLayout>
        <NestedScrollView>
            <ConstraintLayout>
                <!-- 3. Expressive Hub Header (User, XP, Stats básicas) -->
                <ComposeView android:id="@+id/composeHeader" />

                <!-- 4. Streak Widget -->
                <ComposeView android:id="@+id/composeStreak" />

                <!-- 5. Activity Heatmap (expandível) -->
                <ComposeView android:id="@+id/composeHeatmap" />

                <!-- 6. Activity Feed (horizontal scroll) -->
                <ComposeView android:id="@+id/composeActivityFeed" />

                <!-- 7. Public Games Suggestions (horizontal scroll) -->
                <ComposeView android:id="@+id/composePublicGames" />

                <!-- 8. Challenges Section -->
                <ComposeView android:id="@+id/composeChallenges" />

                <!-- 9. Recent Badges Carousel -->
                <ComposeView android:id="@+id/composeBadges" />

                <!-- 10. Expandable Stats Section -->
                <ComposeView android:id="@+id/composeStats" />

                <!-- 11. My Games Header + View Mode Switcher -->
                <LinearLayout android:id="@+id/layoutGamesHeader">
                    <TextView android:text="Meus Próximos Jogos" />
                    <ComposeView android:id="@+id/composeViewModeSwitcher" />
                </LinearLayout>

                <!-- 12. Adaptive Games List -->
                <ComposeView android:id="@+id/composeGamesList" />

                <!-- 13. Empty State -->
                <include layout="@layout/layout_empty_state" />
            </ConstraintLayout>
        </NestedScrollView>
    </SwipeRefreshLayout>

    <ShimmerFrameLayout android:id="@+id/shimmerViewContainer" />
    <FloatingActionButton android:id="@+id/fabCreateGame" />
    <ComposeView android:id="@+id/composeNotificationSheet" />
</ConstraintLayout>
```

#### 6.2 Consolidação do HomeViewModel

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/home/HomeViewModel.kt` (MODIFICAR)

```kotlin
data class HomeUiState(
    val user: User? = null,
    val games: List<Game> = emptyList(),
    val gamificationSummary: GamificationSummary? = null,
    val statistics: UserStatistics? = null,
    val statisticsTimeSeries: StatisticsTimeSeries? = null,
    val streak: UserStreak? = null,
    val activities: List<Activity> = emptyList(),
    val publicGames: List<Game> = emptyList(),
    val challenges: List<Pair<WeeklyChallenge, UserChallengeProgress?>> = emptyList(),
    val recentBadges: List<UserBadge> = emptyList(),
    val activityHeatmap: ActivityHeatmap? = null,
    val viewMode: GameListViewMode = GameListViewMode.LIST,
    val isLoading: Boolean = false,
    val loadingState: LoadingState = LoadingState.Idle,
    val error: String? = null
)

// Carregar tudo em paralelo
fun loadHomeData() {
    viewModelScope.launch {
        val deferreds = listOf(
            async { userRepository.getCurrentUser() },
            async { gameRepository.getConfirmedUpcomingGamesForUser() },
            async { gamificationRepository.getUserStreak(userId) },
            async { activityRepository.getRecentActivitiesFlow(20).first() },
            async { gameRepository.getPublicGamesFlow(10).first() },
            async { challengeRepository.getActiveChallenges() },
            async { gamificationRepository.getUserBadges(userId) },
            async { statisticsRepository.getActivityHeatmap(userId, year) }
        )

        val results = deferreds.awaitAll()
        // Processar e emitir state
    }
}
```

#### 6.3 Otimizações de Performance

1. **Lazy Loading**: Carregar stats/heatmap apenas quando expandido
2. **Caching**: Cache de gráficos e heatmap
3. **Image Loading**: Coil com disk cache
4. **Paginação**: Activity feed com paginação

#### 6.4 Testes

**Arquivos**: (CRIAR)
- `app/src/test/java/com/futebadosparcas/ui/home/HomeViewModelTest.kt`
- `app/src/androidTest/java/com/futebadosparcas/ui/home/HomeFragmentTest.kt`
- `app/src/test/java/com/futebadosparcas/data/repository/ActivityRepositoryTest.kt`
- `app/src/test/java/com/futebadosparcas/data/repository/GameRequestRepositoryTest.kt`

**Cobertura Alvo**:
- ViewModels: 90%+
- Repositories: 80%+
- UI Components: 60%+

#### 6.5 Documentação

**Arquivos**: (CRIAR/MODIFICAR)
- `docs/ARCHITECTURE_HOME_SCREEN.md` (CRIAR)
- `docs/BUSINESS_RULES.md` (MODIFICAR - adicionar seção game privacy)
- `docs/TECH_STACK_AND_CONTEXT.md` (MODIFICAR - novas libs)

### Arquivos Críticos
- `app/src/main/res/layout/fragment_home.xml` (REESTRUTURAÇÃO COMPLETA)
- `app/src/main/java/com/futebadosparcas/ui/home/HomeFragment.kt`
- `app/src/main/java/com/futebadosparcas/ui/home/HomeViewModel.kt`

### Risco
**MÉDIO** - Muitas partes móveis, integração complexa

---

## RESPOSTA: Ícone do Mapa

### Contexto Descoberto
- `LocationsMapFragment` mostra LOCAIS/QUADRAS (venues)
- Cada marcador = 1 local esportivo (ex: "Ginásio Apollo")
- Já está correto: ícone de pin de localização (`ic_location`)
- Mostra todos os locais cadastrados com lat/lng
- Centrado em Curitiba por padrão

### Recomendação
**Manter como está** - O ícone é semanticamente correto. Mostra locais onde se pode jogar, não jogos específicos.

---

## ARQUIVOS NOVOS (Total: 35)

### Fase 1: Privacidade (3 arquivos)
1. `app/src/main/java/com/futebadosparcas/data/model/GameRequest.kt`
2. `app/src/main/java/com/futebadosparcas/data/repository/GameRequestRepository.kt`
3. `app/src/main/java/com/futebadosparcas/data/repository/GameRequestRepositoryImpl.kt`

### Fase 2: UI Infra (4 arquivos)
4. `app/src/main/java/com/futebadosparcas/util/ConnectivityMonitor.kt`
5. `app/src/main/java/com/futebadosparcas/ui/components/LoadingStateIndicator.kt`
6. `app/src/main/java/com/futebadosparcas/ui/components/SyncStatusBanner.kt`
7. `app/src/main/res/layout/layout_home_shimmer_v2.xml`

### Fase 3: Feed & Gamificação (13 arquivos)
8. `app/src/main/java/com/futebadosparcas/data/model/Activity.kt`
9. `app/src/main/java/com/futebadosparcas/data/repository/ActivityRepository.kt`
10. `app/src/main/java/com/futebadosparcas/data/repository/ActivityRepositoryImpl.kt`
11. `app/src/main/java/com/futebadosparcas/data/model/Challenge.kt`
12. `app/src/main/java/com/futebadosparcas/data/repository/ChallengeRepository.kt`
13. `app/src/main/java/com/futebadosparcas/data/repository/ChallengeRepositoryImpl.kt`
14. `app/src/main/java/com/futebadosparcas/ui/home/components/ActivityFeedSection.kt`
15. `app/src/main/java/com/futebadosparcas/ui/home/components/PublicGamesSuggestions.kt`
16. `app/src/main/java/com/futebadosparcas/ui/home/components/StreakWidget.kt`
17. `app/src/main/java/com/futebadosparcas/ui/home/components/ChallengesSection.kt`
18. `app/src/main/java/com/futebadosparcas/ui/home/components/RecentBadgesCarousel.kt`
19. `backend/functions/src/activities.ts`
20. `app/src/main/java/com/futebadosparcas/data/model/BadgeType.kt` (enum missing)

### Fase 4: Visualização (4 arquivos)
21. `app/src/main/java/com/futebadosparcas/data/model/StatisticsDetail.kt`
22. `app/src/main/java/com/futebadosparcas/data/model/HeatmapData.kt`
23. `app/src/main/java/com/futebadosparcas/ui/home/components/ExpandableStatsSection.kt`
24. `app/src/main/java/com/futebadosparcas/ui/home/components/ActivityHeatmapSection.kt`

### Fase 5: Interação (5 arquivos)
25. `app/src/main/java/com/futebadosparcas/ui/home/components/NotificationPreviewSheet.kt`
26. `app/src/main/java/com/futebadosparcas/ui/home/components/GameCountdown.kt`
27. `app/src/main/java/com/futebadosparcas/data/model/ViewMode.kt`
28. `app/src/main/java/com/futebadosparcas/ui/home/components/ViewModeSwitcher.kt`
29. `app/src/main/java/com/futebadosparcas/ui/home/components/AdaptiveGamesList.kt`

### Fase 6: Testes & Docs (6 arquivos)
30. `app/src/test/java/com/futebadosparcas/ui/home/HomeViewModelTest.kt`
31. `app/src/androidTest/java/com/futebadosparcas/ui/home/HomeFragmentTest.kt`
32. `app/src/test/java/com/futebadosparcas/data/repository/ActivityRepositoryTest.kt`
33. `app/src/test/java/com/futebadosparcas/data/repository/GameRequestRepositoryTest.kt`
34. `docs/ARCHITECTURE_HOME_SCREEN.md`
35. Layouts adicionais para grid/compact modes

---

## ARQUIVOS MODIFICADOS (Total: 15)

### Críticos (Alto Risco)
1. `app/src/main/java/com/futebadosparcas/data/model/Game.kt`
2. `app/src/main/java/com/futebadosparcas/data/repository/GameRepository.kt`
3. `app/src/main/java/com/futebadosparcas/data/repository/GameRepositoryImpl.kt`
4. `firestore.rules`
5. `firestore.indexes.json`

### ViewModels & Fragments
6. `app/src/main/java/com/futebadosparcas/ui/home/HomeViewModel.kt`
7. `app/src/main/java/com/futebadosparcas/ui/home/HomeFragment.kt`

### Layouts
8. `app/src/main/res/layout/fragment_home.xml` (REESTRUTURAÇÃO GRANDE)
9. `app/src/main/res/layout/item_game_card.xml`

### Repositories
10. `app/src/main/java/com/futebadosparcas/data/repository/StatisticsRepository.kt`
11. `app/src/main/java/com/futebadosparcas/data/repository/StatisticsRepositoryImpl.kt`

### Utilitários
12. `app/src/main/java/com/futebadosparcas/util/PreferencesManager.kt`

### Build & Docs
13. `app/build.gradle`
14. `docs/BUSINESS_RULES.md`
15. `docs/TECH_STACK_AND_CONTEXT.md`

---

## DEPENDÊNCIAS NOVAS

```gradle
// app/build.gradle
dependencies {
    // Charts
    implementation "com.patrykandpatrick.vico:compose:1.13.1"

    // Image Loading (otimizado)
    implementation "io.coil-kt:coil-compose:2.5.0"

    // Testing
    testImplementation "app.cash.turbine:turbine:1.0.0"
    testImplementation "org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3"
    androidTestImplementation "androidx.compose.ui:ui-test-junit4:1.5.4"
}
```

---

## MÉTRICAS DE SUCESSO

### Performance
- Tempo de carregamento home: <2s
- FPS durante scroll: 60 FPS
- Latency pull-to-refresh: <1s
- Funcionalidade offline: 100% dados em cache

### Adoção de Features
- Public game discovery: track view/join ratio
- Notification preview: engagement vs full screen
- View mode: distribuição list/grid/compact
- Stats expansion: % usuários que expandem

### Técnicas
- Crash-free rate: >99.5%
- Cobertura de testes: >75%
- Aumento build time: <10%
- Aumento APK size: <2MB

---

## RISCOS E MITIGAÇÕES

### ALTO RISCO
**Sistema de Privacidade (Fase 1)**
- Risco: Quebrar visibilidade existente, vulnerabilidades de segurança
- Mitigação:
  - Testar exaustivamente Firestore rules com emulador
  - Feature flag para rollout gradual
  - Compatibilidade retroativa com `isPublic`

**Performance com Muitos Componentes (Fase 6)**
- Risco: Home lenta, scroll travado
- Mitigação:
  - Lazy loading agressivo
  - LaunchedEffect com keys corretas
  - Profiling constante com Android Profiler

### MÉDIO RISCO
**Cloud Function Activities**
- Risco: Falhas, atividades perdidas, custos
- Mitigação:
  - Idempotência
  - Logging robusto
  - Batch writes

**Limites de Query Firestore**
- Risco: Queries complexas lentas
- Mitigação: Índices compostos, paginação

### BAIXO RISCO
- Features apenas de UI (countdown, view modes)
- Componentes Compose isolados

---

## NOTAS FINAIS

### Descobertas Importantes
1. ✅ Sistema de notificações é COMPLETO (14 tipos, FCM, real-time)
2. ✅ GamificationRepository JÁ tem streaks implementados
3. ✅ BadgeAwarder JÁ existe e funciona
4. ⚠️ Game.isPublic existe mas NUNCA é usado
5. ⚠️ NÃO existe BadgeType enum (precisa criar)
6. ⚠️ NÃO existe sistema de challenges (criar do zero)
7. ✅ Mapa mostra locais/quadras (correto, não precisa mudar)

### Arquitetura Preservada
- MVVM + Clean Architecture mantida
- Híbrido XML + Compose mantido
- Offline-first com Firestore mantido
- Real-time via Flows mantido

### Timeline Realista
- 12-16 semanas (3-4 meses)
- 6 fases de 2-3 semanas cada
- Buffer para testes e iteração
- Permite feedback entre fases
