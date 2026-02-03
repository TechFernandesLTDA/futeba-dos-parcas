# Cache System - Quick Reference

## 🚀 Quick Start

### 1. Using CachedGameRepository

```kotlin
@HiltViewModel
class YourViewModel @Inject constructor(
    private val cachedGameRepository: CachedGameRepository
) : ViewModel() {

    // Get single game with cache
    suspend fun loadGame(gameId: String) {
        val result = cachedGameRepository.getGameById(gameId)
        // Cache hit: instantâneo
        // Cache miss: busca do Firestore e atualiza cache
    }

    // Get upcoming games with reactive updates
    fun loadUpcomingGames() = viewModelScope.launch {
        cachedGameRepository.getUpcomingGamesFlow()
            .collect { result ->
                // First emission: cache (se existir)
                // Second emission: network (atualizado)
            }
    }
}
```

### 2. Using Paging 3 with Cache

```kotlin
@HiltViewModel
class GamesViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val gameDao: GameDao
) : ViewModel() {

    val gamesPager: Flow<PagingData<GameWithConfirmations>> = Pager(
        config = PagingConfig(
            pageSize = 20,
            enablePlaceholders = false
        ),
        pagingSourceFactory = {
            CachedGamesPagingSource(
                firestore = firestore,
                gameDao = gameDao,
                includeFinished = false
            )
        }
    ).flow.cachedIn(viewModelScope)
}
```

```kotlin
@Composable
fun GamesScreen(viewModel: GamesViewModel) {
    val games = viewModel.gamesPager.collectAsLazyPagingItems()

    LazyColumn {
        items(
            count = games.itemCount,
            key = { games[it]?.game?.id ?: it }
        ) { index ->
            games[index]?.let { GameCard(it) }
        }

        loadStateItems(games) // Loading/Error indicators
    }
}
```

---

## 📊 Cache Layers

```
UI Layer
   ↓
ViewModel (StateFlow)
   ↓
CachedRepository
   ↓
   ├─→ Room Cache (L2) - 1h-7d TTL
   └─→ Firestore (L3) - 100MB persistent cache
```

---

## ⏱️ TTL (Time To Live)

| Data Type | TTL | Cache Location |
|-----------|-----|----------------|
| Games (LIVE/SCHEDULED) | 1 hour | Room + Firestore |
| Games (FINISHED) | 7 days | Room + Firestore |
| Users | 24 hours | Room + SharedCacheService |
| Groups | 7 days | Room |

---

## 🔧 Cache Management

### Clear Expired Cache (Automatic via WorkManager)

```kotlin
// Runs every 12 hours automatically
// See CacheCleanupWorker.kt
```

### Manual Cache Operations

```kotlin
// Clear specific game cache
cachedGameRepository.invalidateGame("game-123")

// Clear all game cache
cachedGameRepository.clearAllCache()

// Clear expired cache manually
cachedGameRepository.clearExpiredCache()

// Get cache stats
val stats = cachedGameRepository.getCacheStats()
println("Total games in cache: ${stats.totalGames}")
```

---

## 📴 Offline Mode

**Automatic Offline Support:**
- Firestore SDK caches reads/writes automatically (100MB)
- Room provides local persistence
- Data available even without network

**Behavior:**
1. **First load**: Shows cache immediately
2. **Network available**: Updates with fresh data
3. **Network unavailable**: Shows stale cache with indicator

```kotlin
// Check if data is from cache
val isOnline by connectivityMonitor.isConnected.collectAsState()

if (!isOnline) {
    Text("Offline - showing cached data")
}
```

---

## 🧪 Testing

```kotlin
@Test
fun `cache hit returns immediately`() = runTest {
    // Given
    gameDao.insertGame(testGame.toEntity())

    // When
    val result = repository.getGameById("test-id")

    // Then
    assertTrue(result.isSuccess)
    // Should not call network
}

@Test
fun `offline mode uses stale cache`() = runTest {
    // Given: expired cache + no network
    gameDao.insertGame(expiredGame)
    networkRepository.simulateOffline()

    // When
    val result = repository.getGameById("test-id")

    // Then: returns stale cache (better than error)
    assertTrue(result.isSuccess)
}
```

---

## 📈 Performance Metrics

**Expected Improvements:**
- Cold load: 2.5s → 0.8s (-68%)
- Firestore reads: -40%
- Cache hit rate: >60%
- Offline support: ✅

**Monitoring:**
```kotlin
// Firebase Performance
val trace = FirebasePerformance.newTrace("home_load")
trace.putAttribute("source", "cache") // or "network"

// Analytics
FirebaseAnalytics.logEvent("cache_hit") {
    param("entity_type", "game")
}
```

---

## 🚨 Common Issues

**Q: Cache not updating after editing game?**
A: Call `cachedGameRepository.invalidateGame(gameId)` after edit

**Q: Too much storage usage?**
A: CacheCleanupWorker runs automatically. Check TTL settings.

**Q: Stale data showing?**
A: Pull-to-refresh or restart app. Cache expires based on TTL.

---

## 🔗 Related Files

- `CachedGameRepository.kt` - Main cache repository
- `CachedGamesPagingSource.kt` - Paging with cache
- `AppDatabase.kt` - Room database schema
- `FirebaseModule.kt` - Firestore persistent cache config
- `CacheCleanupWorker.kt` - Periodic cleanup
- `specs/PERFORMANCE_CACHING_PAGING.md` - Full specification

