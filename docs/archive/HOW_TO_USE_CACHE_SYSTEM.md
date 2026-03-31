# How to Use Cache System - Quick Start Guide

## 🚀 Para Desenvolvedores

### Migrar ViewModel Existente para Cache

**ANTES (sem cache):**
```kotlin
@HiltViewModel
class GamesViewModel @Inject constructor(
    private val gameRepository: GameRepository
) : ViewModel() {

    private val _games = MutableStateFlow<List<Game>>(emptyList())
    val games: StateFlow<List<Game>> = _games

    fun loadGames() {
        viewModelScope.launch {
            val result = gameRepository.getUpcomingGames()
            if (result.isSuccess) {
                _games.value = result.getOrThrow()
            }
        }
    }
}
```

**DEPOIS (com cache):**
```kotlin
@HiltViewModel
class GamesViewModel @Inject constructor(
    private val cachedGameRepository: CachedGameRepository  // MUDANÇA
) : ViewModel() {

    private val _games = MutableStateFlow<List<Game>>(emptyList())
    val games: StateFlow<List<Game>> = _games

    fun loadGames() {
        viewModelScope.launch {
            // Usa Flow para receber atualizações cache + network
            cachedGameRepository.getUpcomingGamesFlow()  // MUDANÇA
                .collect { result ->
                    if (result.isSuccess) {
                        _games.value = result.getOrThrow()
                    }
                }
        }
    }
}
```

---

### Migrar para Paging 3 (Recomendado)

**ANTES (load all):**
```kotlin
@HiltViewModel
class GamesViewModel @Inject constructor(
    private val gameRepository: GameRepository
) : ViewModel() {

    private val _games = MutableStateFlow<List<Game>>(emptyList())
    val games: StateFlow<List<Game>> = _games

    init {
        loadGames()
    }

    fun loadGames() {
        viewModelScope.launch {
            val result = gameRepository.getAllGames()
            _games.value = result.getOrDefault(emptyList())
        }
    }
}

@Composable
fun GamesScreen(viewModel: GamesViewModel) {
    val games by viewModel.games.collectAsState()

    LazyColumn {
        items(games) { game ->
            GameCard(game)
        }
    }
}
```

**DEPOIS (com Paging 3 + cache):**
```kotlin
@HiltViewModel
class GamesViewModel @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val gameDao: GameDao
) : ViewModel() {

    // Flow de PagingData (carregamento incremental)
    val gamesPager: Flow<PagingData<GameWithConfirmations>> = Pager(
        config = PagingConfig(
            pageSize = 20,  // Carrega 20 items por vez
            enablePlaceholders = false,
            prefetchDistance = 5  // Prefetch 5 items antes do fim
        ),
        pagingSourceFactory = {
            CachedGamesPagingSource(
                firestore = firestore,
                gameDao = gameDao,
                includeFinished = false
            )
        }
    ).flow.cachedIn(viewModelScope)  // Cache no escopo do ViewModel
}

@Composable
fun GamesScreen(viewModel: GamesViewModel) {
    val games = viewModel.gamesPager.collectAsLazyPagingItems()

    LazyColumn {
        items(
            count = games.itemCount,
            key = { index -> games[index]?.game?.id ?: index }
        ) { index ->
            games[index]?.let { gameWithConf ->
                GameCard(game = gameWithConf.game)
            }
        }

        // Loading/Error indicators
        loadStateItems(games)
    }
}
```

---

## 📱 Para QA/Testers

### Testar Offline Mode

1. **Abrir app com internet**
   - Navegar para tela de jogos
   - Verificar que jogos carregam normalmente

2. **Ativar modo avião**
   - Fechar app completamente (swipe up)
   - Ativar modo avião
   - Reabrir app

3. **Verificar comportamento offline**
   - ✅ Jogos devem aparecer imediatamente (do cache)
   - ✅ Banner "Offline" deve aparecer no topo
   - ✅ Pull-to-refresh deve mostrar erro de rede
   - ❌ NÃO deve crashar
   - ❌ NÃO deve mostrar tela em branco

4. **Voltar online**
   - Desativar modo avião
   - Pull-to-refresh
   - ✅ Dados devem atualizar

### Testar Cache Persistence

1. **Carregar jogos**
   - Abrir app
   - Navegar para HomeScreen
   - Aguardar jogos carregarem

2. **Force close app**
   - Force stop via configurações do Android
   - Ou kill process via adb

3. **Reabrir app**
   - ✅ Jogos devem aparecer instantaneamente (<500ms)
   - ✅ Deve mostrar dados do cache
   - ⏳ Depois atualiza com dados do Firestore

### Testar TTL (Cache Expiration)

1. **Carregar jogos**
   - Abrir app e carregar jogos
   - Nota o horário

2. **Aguardar 1 hora** (ou mudar relógio do sistema)
   - Esperar 1 hora
   - Ou mudar horário do sistema para +2 horas

3. **Reabrir app**
   - ✅ Deve buscar dados do Firestore (cache expirado)
   - ⏳ Loading indicator deve aparecer brevemente

---

## 🔧 Para Backend/DevOps

### Deploy Firestore Indexes

1. **Verificar arquivo de indexes**
   ```bash
   cat firestore.indexes.json
   ```

2. **Deploy para Firebase**
   ```bash
   firebase deploy --only firestore:indexes
   ```

3. **Aguardar build dos indexes**
   - No Firebase Console, verificar status
   - Pode levar alguns minutos dependendo do tamanho da collection

4. **Verificar indexes criados**
   ```bash
   firebase firestore:indexes
   ```

### Monitorar Cache Hit Rate

**Firebase Analytics:**
```kotlin
// No código (já implementado no CachedGameRepository)
FirebaseAnalytics.logEvent("cache_hit") {
    param("entity_type", "game")
    param("source", "room")  // ou "firestore"
}
```

**Query no Firebase Console:**
- Analytics → Events → Filter by "cache_hit"
- Calcular: cache_hits / (cache_hits + cache_misses) * 100

**Meta**: >60% cache hit rate

### Monitorar Firestore Reads

**Firebase Console:**
- Firestore → Usage tab
- Comparar reads antes/depois da implementação
- Meta: -40% de redução

**Cloud Functions Logs:**
```bash
firebase functions:log --only games
```

---

## 🐛 Troubleshooting

### Problema: Cache não atualizando

**Sintomas**: Dados antigos ficam presos no cache

**Diagnóstico**:
```kotlin
// Verificar stats do cache
val stats = cachedGameRepository.getCacheStats()
Log.d("Cache", "Total games: ${stats.totalGames}")
```

**Fix**:
```kotlin
// Invalidar cache manualmente
cachedGameRepository.invalidateGame(gameId)

// Ou limpar tudo
cachedGameRepository.clearAllCache()
```

### Problema: App usando muito storage

**Sintomas**: Warning de storage no Android

**Diagnóstico**:
```bash
adb shell du -h /data/data/com.futebadosparcas/databases/
```

**Fix**:
1. Ajustar TTL para valores menores
2. Reduzir page size do Paging
3. Executar cleanup manual:
```kotlin
cachedGameRepository.clearExpiredCache()
```

### Problema: Offline mode não funciona

**Sintomas**: Tela em branco no modo avião

**Checklist**:
- [ ] Firestore Persistent Cache habilitado? (FirebaseModule.kt)
- [ ] Room Database migrado para v4?
- [ ] CachedGameRepository injetado no ViewModel?
- [ ] Flow collection não cancelada prematuramente?

**Logs**:
```kotlin
AppLogger.d("Cache") { "Cache HIT/MISS: ..." }
```

---

## 📊 Métricas para Acompanhar

### Performance

| Métrica | Como Medir | Meta |
|---------|------------|------|
| Cold Load Time | Firebase Performance | <1s |
| Cache Hit Rate | Analytics events | >60% |
| Firestore Reads | Firebase Console | -40% |
| App Size | APK Analyzer | <50MB |

### UX

| Métrica | Como Medir | Meta |
|---------|------------|------|
| Time to Interactive | Lighthouse | <2s |
| Offline Availability | Manual test | 100% |
| Crash-free Sessions | Crashlytics | >99% |

---

## 🔗 Links Úteis

- **Spec Completa**: `specs/PERFORMANCE_CACHING_PAGING.md`
- **Quick Reference**: `app/.../repository/README_CACHE.md`
- **Implementation Report**: `PERFORMANCE_IMPLEMENTATION_REPORT.md`
- **Paging 3 Docs**: https://developer.android.com/topic/libraries/architecture/paging/v3-overview
- **Room Docs**: https://developer.android.com/training/data-storage/room

---

## 💡 Tips & Best Practices

### 1. Sempre use Flow para dados reativos
```kotlin
// ✅ CORRETO
cachedGameRepository.getUpcomingGamesFlow()
    .collect { games -> ... }

// ❌ ERRADO (não recebe updates)
val games = cachedGameRepository.getUpcomingGames()
```

### 2. Invalide cache após edições
```kotlin
// Após editar jogo
gameRepository.updateGame(game)
cachedGameRepository.invalidateGame(game.id)  // IMPORTANTE!
```

### 3. Use Paging para listas grandes
```kotlin
// Se > 50 items, use Paging
if (totalItems > 50) {
    usePaging3()
} else {
    useRegularList()
}
```

### 4. Teste offline durante desenvolvimento
```kotlin
// Simular offline no emulator
adb shell svc wifi disable
adb shell svc data disable
```

---

**Dúvidas?** Consulte a spec completa em `specs/PERFORMANCE_CACHING_PAGING.md`

