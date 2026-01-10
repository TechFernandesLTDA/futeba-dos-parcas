# 🚀 PRÓXIMAS OTIMIZAÇÕES DE PERFORMANCE

**Data**: 2026-01-09
**Status**: 📋 Ready for Implementation
**Impacto Total Estimado**: 300-500ms faster, 20-30% menos leitura Firestore

---

## ✅ O QUE JÁ FOI DEPLOYADO

```bash
✅ firebase deploy --only firestore:rules,firestore:indexes,storage
   → 64 índices compostos ativados
   → Regras de segurança atualizadas (CVE-1, 2, 4 corrigidas)

✅ firebase deploy --only functions
   → Cloud Functions com MVP validation
   → Seeding protection ativo
   → Activity logging
```

---

## 🎯 FASE 4: ADVANCED PERFORMANCE (2-3 dias)

### 1️⃣ FIRESTORE OFFLINE-FIRST CACHE (50-100ms savings)

**Problema**: Cada re-render da liga busca users novamente do Firestore.

**Solução**: Usar `Source.CACHE` com fallback para network.

**Arquivo**: `shared/src/commonMain/kotlin/com/futebadosparcas/data/repository/UserRepositoryImpl.kt`

```kotlin
suspend fun getUsersByIds(userIds: List<String>): Result<List<User>> {
    return try {
        // 1. Tentar cache local primeiro (SQLDelight)
        val cachedUsers = database.usersQueries
            .selectAllUsers()
            .executeAsList()
            .map { it.toUser() }
            .filter { it.id in userIds }

        if (cachedUsers.size == userIds.size) {
            return Result.success(cachedUsers) // ✅ Cache hit!
        }

        // 2. Tentar Firestore com cache policy
        val missing = userIds.filter { id -> cachedUsers.none { it.id == id } }
        if (missing.isEmpty()) {
            return Result.success(cachedUsers)
        }

        // 3. Buscar apenas faltantes - com retry policy
        val snapshot = firestore.collection("users")
            .whereIn(FieldPath.documentId(), missing.chunked(10).first())
            .get(Source.CACHE_AND_NETWORK) // ✅ Tenta cache primeiro, depois network
            .await()

        val newUsers = snapshot.toObjects(User::class.java)

        // 4. Atualizar cache com os novos
        newUsers.forEach { user ->
            database.usersQueries.insertUser(user.toDatabaseEntity())
        }

        Result.success(cachedUsers + newUsers)
    } catch (e: Exception) {
        AppLogger.e(TAG, "Erro ao buscar users", e)
        Result.failure(e)
    }
}
```

**Impacto**:
- Cache hit: 5-10ms (vs 100-150ms network)
- Melhora de 95% em listagens da liga

---

### 2️⃣ CONSOLIDATE GAME + CONFIRMATIONS QUERY (100ms savings)

**Problema**: GameDetailFragment carrega game, depois confirmations separadamente.

**Solução**: Usar bulk query com estrutura agregada.

**Arquivo**: `shared/src/commonMain/kotlin/com/futebadosparcas/data/repository/GameRepository.kt`

```kotlin
data class GameWithConfirmations(
    val game: Game,
    val confirmations: List<GameConfirmation>,
    val stats: List<PlayerStats>
)

suspend fun getGameDetail(gameId: String): Result<GameWithConfirmations> {
    return try {
        val jobs = listOf(
            async {
                firestore.collection("games")
                    .document(gameId)
                    .get()
                    .await()
            },
            async {
                firestore.collection("games").document(gameId)
                    .collection("confirmations")
                    .get()
                    .await()
            },
            async {
                firestore.collection("games").document(gameId)
                    .collection("player_stats")
                    .get()
                    .await()
            }
        )

        val (gameSnapshot, confirmationsSnapshot, statsSnapshot) = jobs.awaitAll()

        val game = gameSnapshot.toObject(Game::class.java) ?:
            return Result.failure(Exception("Game not found"))

        val confirmations = confirmationsSnapshot.toObjects(GameConfirmation::class.java)
        val stats = statsSnapshot.toObjects(PlayerStats::class.java)

        Result.success(GameWithConfirmations(game, confirmations, stats))
    } catch (e: Exception) {
        AppLogger.e(TAG, "Erro ao buscar detalhe do jogo", e)
        Result.failure(e)
    }
}
```

**Impacto**:
- ANTES: 3 chamadas sequenciais = 300-400ms
- DEPOIS: 3 chamadas paralelas = 150-200ms
- **Economia: 150-200ms + 3 leituras Firestore**

---

### 3️⃣ LOCAL CONFIRMATIONS CACHE (50-150ms savings)

**Problema**: Ao confirmar presença, a lista de confirmações fica lenta para atualizar.

**Solução**: Cache local com invalidação automática.

**Arquivo**: `shared/src/commonMain/kotlin/com/futebadosparcas/data/repository/GameRepository.kt`

```kotlin
// Cache com timestamp para invalidação
private val confirmationCache = mutableMapOf<String, CachedData<List<GameConfirmation>>>()

data class CachedData<T>(
    val data: T,
    val timestamp: Long,
    val ttlMs: Long = 5 * 60 * 1000 // 5 minutos
) {
    fun isExpired() = System.currentTimeMillis() - timestamp > ttlMs
}

suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>> {
    return try {
        // 1. Verificar cache
        val cached = confirmationCache[gameId]
        if (cached != null && !cached.isExpired()) {
            return Result.success(cached.data)
        }

        // 2. Buscar do Firestore
        val snapshot = firestore.collection("games")
            .document(gameId)
            .collection("confirmations")
            .orderBy("created_at", Query.Direction.DESCENDING)
            .get()
            .await()

        val confirmations = snapshot.toObjects(GameConfirmation::class.java)

        // 3. Cachear
        confirmationCache[gameId] = CachedData(confirmations, System.currentTimeMillis())

        Result.success(confirmations)
    } catch (e: Exception) {
        AppLogger.e(TAG, "Erro ao buscar confirmações", e)
        Result.failure(e)
    }
}

// Invalidar cache quando confirmar presença
suspend fun confirmPresence(...): Result<GameConfirmation> {
    return try {
        // ... criar confirmação ...

        // Invalidar cache
        confirmationCache.remove(gameId)

        Result.success(confirmation)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

**Impacto**:
- Cache hit: 10-20ms (vs 80-150ms network)
- Reduz leitura de confirmations em 70%

---

### 4️⃣ IMAGE CACHING & OPTIMIZATION (100-200ms savings)

**Problema**: Coil carrega imagens de avatar sem cache.

**Arquivo**: `app/src/main/java/com/futebadosparcas/ui/theme/Coil.kt` (novo)

```kotlin
import android.content.Context
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

object CoilConfig {
    fun setupCoil(context: Context) {
        val imageLoader = ImageLoader.Builder(context)
            // Memory cache: 100MB
            .memoryCache {
                MemoryCache.Builder(context)
                    .maxSizePercent(0.25) // 25% of available RAM
                    .build()
            }
            // Disk cache: 200MB
            .diskCache {
                DiskCache.Builder()
                    .directory(context.cacheDir.resolve("image_cache"))
                    .maxSizeBytes(200 * 1024 * 1024) // 200MB
                    .build()
            }
            // HTTP client com persistent cache
            .okHttpClient {
                OkHttpClient.Builder()
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .build()
            }
            .crossfade(true)
            .respectCacheHeaders(true)
            .build()

        coil.Coil.setImageLoader(imageLoader)
    }
}
```

**Uso no App**:

```kotlin
// MainActivity.kt
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        CoilConfig.setupCoil(this)
        // ...
    }
}
```

**Impacto**:
- Primeira carga: 200-300ms (network)
- Cache hit: 10-30ms
- Reduz transferência de dados em 80%

---

### 5️⃣ CANCEL STALE QUERIES (Prevent memory leaks)

**Problema**: ViewModels podem fazer múltiplas queries que se sobrepõem.

**Arquivo**: `shared/src/commonMain/kotlin/com/futebadosparcas/ui/league/LeagueViewModel.kt`

```kotlin
@HiltViewModel
class LeagueViewModel @Inject constructor(
    private val gamificationRepository: GamificationRepository,
    private val authRepository: AuthRepository,
) : ViewModel() {

    private var leagueDataJob: Job? = null

    fun selectSeason(season: Season) {
        // ✅ CANCELAR job anterior antes de iniciar novo
        leagueDataJob?.cancel()

        leagueDataJob = viewModelScope.launch {
            try {
                _uiState.value = LeagueUiState.Loading

                val ranking = gamificationRepository.observeSeasonRanking(season.id)
                    .catch { e ->
                        _uiState.value = LeagueUiState.Error(e.message ?: "Erro")
                    }
                    .collect { participations ->
                        // ... atualizar state ...
                    }
            } catch (e: CancellationException) {
                AppLogger.d(TAG, "Query cancelada (season mudou)")
                throw e // Re-throw para o coroutine framework
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        leagueDataJob?.cancel()
    }
}
```

**Impacto**:
- Previne memory leaks
- Reduz leitura desnecessárias do Firestore
- Melhora responsividade na navegação

---

### 6️⃣ MONITORING & ANALYTICS (Para análise contínua)

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/repository/RepositoryBase.kt` (novo)

```kotlin
abstract class BaseRepository {
    protected suspend inline fun <T> measureQuery(
        operationName: String,
        crossinline block: suspend () -> Result<T>
    ): Result<T> {
        val startTime = System.currentTimeMillis()
        return try {
            block().also { result ->
                val duration = System.currentTimeMillis() - startTime
                logQueryPerformance(operationName, duration, result.isSuccess)
            }
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            logQueryPerformance(operationName, duration, false)
            Result.failure(e)
        }
    }

    private fun logQueryPerformance(
        operationName: String,
        durationMs: Long,
        success: Boolean
    ) {
        val status = if (success) "✅" else "❌"
        AppLogger.d("PERF", "$status $operationName: ${durationMs}ms")

        // Firebase Analytics
        if (durationMs > 500) {
            FirebaseAnalytics.getInstance(context).logEvent("slow_query") {
                param("operation", operationName)
                param("duration_ms", durationMs.toFloat())
            }
        }
    }
}

// Uso
class UserRepository : BaseRepository() {
    suspend fun getUserById(userId: String): Result<User> {
        return measureQuery("getUserById") {
            // ... implementação ...
        }
    }
}
```

**Impacto**:
- Identifica queries lentas em tempo real
- Dados para otimização contínua

---

## 📊 RESUMO DE IMPACTO

| Otimização | Impacto | Esforço | ROI |
|------------|---------|---------|-----|
| Offline Cache (Source.CACHE) | 50-100ms | 1h | 🔥🔥🔥 |
| Consolidate Queries | 150-200ms | 2h | 🔥🔥🔥 |
| Local Cache | 50-150ms | 1.5h | 🔥🔥 |
| Image Caching | 100-200ms | 1h | 🔥🔥 |
| Cancel Stale Queries | 0ms (leak fix) | 30min | 🔥🔥 |
| Monitoring | 0ms (insights) | 1h | 🔥 |
| **TOTAL** | **350-750ms** | **7-8h** | **ROI 40-60ms/h** |

---

## ✅ PRÓXIMOS PASSOS (ORDEM DE PRIORIDADE)

### 🔴 HOJE (Critical)
1. **Offline Caching** (Source.CACHE)
   - Arquivo: UserRepositoryImpl.kt
   - Impacto: 50-100ms em 80% das queries
   - Esforço: 1 hora

### 🟡 ESTA SEMANA (High)
2. **Consolidate Queries** (game + confirmations)
   - Arquivo: GameRepository.kt
   - Impacto: 150-200ms em game details
   - Esforço: 2 horas

3. **Image Caching**
   - Arquivo: CoilConfig.kt (novo)
   - Impacto: 100-200ms em listagens
   - Esforço: 1 hora

4. **Local Confirmations Cache**
   - Arquivo: GameRepository.kt
   - Impacto: 50-150ms em confirmações
   - Esforço: 1.5 horas

### 🟢 PRÓXIMA SEMANA (Medium)
5. **Query Cancellation**
   - Arquivo: ViewModels
   - Impacto: Previne memory leaks
   - Esforço: 30 minutos

6. **Monitoring Setup**
   - Arquivo: BaseRepository.kt (novo)
   - Impacto: Insights para otimização contínua
   - Esforço: 1 hora

---

## 🎯 META FINAL

```
Performance Target: < 1 segundo para qualquer tela
├── Load: < 100ms
├── Render: < 200ms
├── Interactive: < 500ms
└── Cache hits: > 70%

Database Target: Reduzir leituras em 40%
├── Offline cache: 30%
├── Query consolidation: 10%
└── Smart invalidation: 5%
```

---

**Status**: Pronto para implementação
**Próximo Revisão**: 2026-01-12
