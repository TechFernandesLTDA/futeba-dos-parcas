# RULES - Futeba dos Parças

> Regras de desenvolvimento para manter consistência e qualidade do código.
> Última atualização: 2025-01-10

---

## ÍNDICE

1. [HARD RULES](#1-hard-rules-não-negociável)
2. [PREFERRED PATTERNS](#2-preferred-patterns-recomendado)
3. [ANTI-PATTERNS](#3-anti-patterns-proibido-evitar)

---

## 1. HARD RULES (NÃO NEGOCIÁVEL)

### 1.1 Strings e Localização

**REGRA:** **NUNCA** hardcoded strings no código. Sempre usar `strings.xml`.

```kotlin
// ❌ ERRADO
Text("Bem-vindo")

// ✅ CORRETO
Text(stringResource(R.string.welcome))

// ❌ ERRADO
showError("Erro ao carregar jogos")

// ✅ CORRETO
showError(getString(R.string.error_loading_games))
```

**Exceção:** Logs técnicos (tags, mensagens de debug) podem ser hardcoded.

### 1.2 ViewBinding Obrigatório

**REGRA:** **NUNCA** usar `findViewById`. Sempre ViewBinding.

```kotlin
// ❌ ERRADO
val textView = findViewById<TextView>(R.id.text_view)

// ✅ CORRETO
binding.textView.text = "Hello"
```

### 1.3 Job Tracking em ViewModels

**REGRA:** **SEMPRE** armazenar referência de Job e cancelar antes de iniciar novo.

```kotlin
@HiltViewModel
class ExampleViewModel @Inject constructor() : ViewModel() {

    private var loadJob: Job? = null

    fun loadData() {
        loadJob?.cancel()  // OBRIGATÓRIO
        loadJob = viewModelScope.launch {
            // ...
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()  // OBRIGATÓRIO
    }
}
```

### 1.4 Flow Collection com .catch {}

**REGRA:** **SEMPRE** adicionar `.catch {}` em coleções de Flow.

```kotlin
// ❌ ERRADO
viewModelScope.launch {
    repository.getData().collect { data ->
        _uiState.value = UiState.Success(data)
    }
}

// ✅ CORRETO
viewModelScope.launch {
    repository.getData()
        .catch { e ->
            _uiState.value = UiState.Error(e.message ?: "Erro")
        }
        .collect { data ->
            _uiState.value = UiState.Success(data)
        }
}
```

### 1.5 Fechar Channels em onCleared()

**REGRA:** **SEMPRE** fechar Channels no `onCleared()` do ViewModel.

```kotlin
@HiltViewModel
class ExampleViewModel : ViewModel() {

    private val _actions = Channel<Action>()
    val actions = _actions.receiveAsFlow()

    override fun onCleared() {
        super.onCleared()
        _actions.close()  // OBRIGATÓRIO
    }
}
```

### 1.6 Firestore Batching (limite 10)

**REGRA:** **SEMPRE** usar `chunked(10)` para queries com `whereIn()`.

```kotlin
// ❌ ERRADO - pode crashar se ids.length > 10
firestore.collection("users")
    .whereIn(FieldPath.documentId(), ids)
    .get()
    .await()

// ✅ CORRETO
suspend fun getUsersByIds(ids: List<String>): List<User> {
    return ids.chunked(10)
        .map { chunk ->
            async {
                firestore.collection("users")
                    .whereIn(FieldPath.documentId(), chunk)
                    .get()
                    .await()
            }
        }
        .awaitAll()
        .flatMap { it.toObjects<User>() }
}
```

### 1.7 Segurança: Sem Secrets no Código

**REGRA:** **NUNCA** commitar:
- `serviceAccountKey.json`
- `google-services.json` (exceto exemplo com .example)
- `.keystore` / `.jks`
- API keys hardcoded
- Senhas, tokens, credenciais

**Uso correto:**
```kotlin
// ❌ ERRADO
const val API_KEY = "sk-abc123..."

// ✅ CORRETO - local.properties
val mapsApiKey = localProperties.getProperty("MAPS_API_KEY") ?: ""
manifestPlaceholders["MAPS_API_KEY"] = mapsApiKey
```

### 1.8 Commits: Version Code Obrigatório

**REGRA:** **SEMPRE** incrementar `versionCode` antes de release.

```kotlin
// app/build.gradle.kts
defaultConfig {
    versionCode = 16  // ← Incrementar ANTES de release
    versionName = "1.4.3"
}
```

### 1.9 StateFlow para ViewModels

**REGRA:** Expor estado via `StateFlow<UiState>`, **NÃO** LiveData.

```kotlin
// ❌ ERRADO
val uiState: LiveData<UiState> = MutableLiveData()

// ✅ CORRETO
private val _uiState = MutableStateFlow<UiState>(UiState.Loading)
val uiState: StateFlow<UiState> = _uiState
```

### 1.10 collectAsStateWithLifecycle para Compose

**REGRA:** Em Compose, usar `collectAsStateWithLifecycle()` **NÃO** `collectAsState()`.

```kotlin
// ❌ ERRADO - mantém coleta em background
val state by viewModel.uiState.collectAsState()

// ✅ CORRETO - respeita lifecycle
val state by viewModel.uiState.collectAsStateWithLifecycle()
```

### 1.11 Anotações @Composable sem parâmetros desnecessários

**REGRA:** Separar `Screen` (stateful) de `Content` (stateless).

```kotlin
// ✅ CORRETO
@Composable
fun ExampleScreen(
    viewModel: ExampleViewModel,
    onNavigate: (String) -> Unit
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    ExampleContent(
        state = state,
        onAction = { viewModel.handleAction(it) }
    )
}

@Composable
private fun ExampleContent(
    state: ExampleUiState,
    onAction: (ExampleAction) -> Unit
) {
    // UI stateless
}
```

### 1.12 NUNCA aninhar LazyVerticalGrid dentro de LazyColumn

**REGRA:** Usar `FlowRow` para grids dentro de listas verticais.

```kotlin
// ❌ ERRADO - crash!
LazyColumn {
    items(items) { item ->
        LazyVerticalGrid(...)  // NUNCA!
    }
}

// ✅ CORRETO
LazyColumn {
    item {
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items.forEach { item ->
                GridItem(item)
            }
        }
    }
}
```

---

## 2. PREFERRED PATTERNS (RECOMENDADO)

### 2.1 Arquitetura MVVM + Clean Architecture

**Estrutura recomendada:**
```
ui/
├── feature/
│   ├── FeatureScreen.kt       ← Composable UI
│   ├── FeatureViewModel.kt    ← State + Events
│   └── FeatureUiState.kt      ← Sealed class
domain/
├── usecase/
│   └── GetFeatureUseCase.kt
└── model/
    └── FeatureModel.kt
data/
└── repository/
    └── FeatureRepositoryImpl.kt
```

### 2.2 Sealed Classes para UiState

```kotlin
// ✅ RECOMENDADO
sealed class FeatureUiState {
    object Loading : FeatureUiState()
    data class Success(val data: Data) : FeatureUiState()
    data class Error(val message: String, val error: Throwable? = null) : FeatureUiState()
    object Empty : FeatureUiState()
}
```

### 2.3 Result<T> para Operações Únicas

```kotlin
// ✅ RECOMENDADO
suspend fun createUser(email: String, password: String): Result<User> {
    return try {
        val user = auth.createUser(email, password).await()
        Result.success(user)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

// Uso
viewModelScope.launch {
    repository.createUser(email, password)
        .onSuccess { user -> /* ... */ }
        .onFailure { error -> /* ... */ }
}
```

### 2.4 LRU Cache para Queries Frequentes

```kotlin
// ✅ RECOMENDADO
class UserRepositoryImpl(
    private val firestore: FirebaseFirestore
) : UserRepository {

    private val cache = LruCache<String, User>(200)
    private val cacheTimestamps = mutableMapOf<String, Long>()
    private val CACHE_TTL = 5 * 60 * 1000L // 5 minutos

    override suspend fun getUser(userId: String): User? {
        // Check cache
        val cached = cache.get(userId)
        val timestamp = cacheTimestamps[userId] ?: 0
        if (cached != null && System.currentTimeMillis() - timestamp < CACHE_TTL) {
            return cached
        }

        // Fetch from Firestore
        val doc = firestore.collection("users").document(userId).get().await()
        val user = doc.toObject<User>() ?: return null

        // Update cache
        cache.put(userId, user)
        cacheTimestamps[userId] = System.currentTimeMillis()
        return user
    }
}
```

### 2.5 Pagination (50 itens por página)

```kotlin
// ✅ RECOMENDADO
suspend fun getUsers(lastUserName: String? = null): List<User> {
    var query = firestore.collection("users")
        .orderBy("name")
        .limit(50)

    if (lastUserName != null) {
        query = query.startAfter(lastUserName)
    }

    return query.get().await().toObjects()
}
```

### 2.6 Parallel Queries com async/awaitAll

```kotlin
// ✅ RECOMENDADO
suspend fun loadDashboardData(): DashboardData {
    return coroutineScope {
        val gamesDeferred = async { getUpcomingGames() }
        val statsDeferred = async { getUserStats() }
        val rankingsDeferred = async { getRankings() }

        val results = awaitAll(gamesDeferred, statsDeferred, rankingsDeferred)
        DashboardData(
            games = results[0],
            stats = results[1],
            rankings = results[2]
        )
    }
}
```

### 2.7 Material Design 3 no Compose

```kotlin
// ✅ RECOMENDADO
import androidx.compose.material3.*

// Usar HorizontalDivider (não Divider deprecated)
HorizontalDivider()

// Usar PullToRefreshBox (não SwipeRefresh deprecated)
PullToRefreshBox(
    isRefreshing = isRefreshing,
    onRefresh = { refresh() }
) {
    // Content
}

// Usar ícones AutoMirrored para direcionais
Icons.AutoMirrored.Filled.ArrowBack
```

### 2.8 Modifier Order

```kotlin
// ✅ RECOMENDADO - ordem importa!
MyComposable(
    modifier = Modifier
        .clickable { }        // 1. Interações antes de padding
        .padding(16.dp)       // 2. Depois padding
        .fillMaxWidth()       // 3. Restrito depois do padding
)
```

### 2.9 key em LazyColumn/LazyRow items

```kotlin
// ✅ RECOMENDADO
LazyColumn {
    items(
        items = games,
        key = { it.id }  // ← OBRIGATÓRIO para performance
    ) { game ->
        GameItem(game)
    }
}
```

### 2.10 EncryptedSharedPreferences para Dados Sensíveis

```kotlin
// ✅ RECOMENDADO
val encryptedPrefs = EncryptedSharedPreferences.create(
    "secret_prefs",
    masterKey,
    context,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)

// Uso
encryptedPrefs.edit()
    .putString("fcm_token", token)
    .apply()
```

### 2.11 Coil para Imagens

```kotlin
// ✅ RECOMENDADO
AsyncImage(
    model = ImageRequest.Builder(LocalContext.current)
        .data(photoUrl)
        .crossfade(true)
        .build(),
    placeholder = painterResource(R.drawable.placeholder),
    error = painterResource(R.drawable.error),
    contentDescription = stringResource(R.string.photo_description),
    modifier = Modifier.clip(CircleShape)
)
```

### 2.12 Hilt Injection Patterns

```kotlin
// ✅ RECOMENDADO - ViewModel
@HiltViewModel
class ExampleViewModel @Inject constructor(
    private val repository: ExampleRepository
) : ViewModel()

// ✅ RECOMENDADO - Repository com @Singleton
@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideRepository(
        firestore: FirebaseFirestore
    ): ExampleRepository {
        return ExampleRepositoryImpl(firestore)
    }
}

// ✅ RECOMENDADO - Qualifier
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class DefaultDispatcher

@Module
@InstallIn(SingletonComponent::class)
object DispatcherModule {
    @DefaultDispatcher
    @Provides
    fun provideDefaultDispatcher(): CoroutineDispatcher = Dispatchers.Default
}
```

---

## 3. ANTI-PATTERNS (PROIBIDO / EVITAR)

### 3.1 NUNCA usar `!!` (double-bang)

```kotlin
// ❌ ERRADO - pode crashar
val user = user!!

// ✅ CORRETO
val user = user ?: return
// ou
val user = user ?: throw IllegalStateException("User not found")
// ou
user?.let { /* ... */ }
```

### 3.2 NUNCA Global Scope

```kotlin
// ❌ ERRADO - memory leak garantido
GlobalScope.launch {
    // ...
}

// ✅ CORRETO
viewModelScope.launch { } // em ViewModels
lifecycleScope.launch { } // em Fragments/Activities
```

### 3.3 NUNCA Thread.sleep em Coroutines

```kotlin
// ❌ ERRADO - bloqueia thread
Thread.sleep(1000)

// ✅ CORRETO
delay(1000)
```

### 3.4 NUNCA RunBlocking em UI

```kotlin
// ❌ ERRADO - congela UI
val result = runBlocking { repository.getData() }

// ✅ CORRETO
lifecycleScope.launch {
    val result = repository.getData()
}
```

### 3.5 NÃO aninhar LazyVerticalGrid em LazyColumn

Já coberto em [1.12](#112-nunca-aninhar-lazyverticalgrid-dentro-de-lazycolumn)

### 3.6 NÃO usar componentes deprecated

```kotlin
// ❌ ERRADO - deprecated
Divider()
SwipeRefresh()

// ✅ CORRETO
HorizontalDivider()
PullToRefreshBox()
```

### 3.7 NÃO usar Context em ViewModels

```kotlin
// ❌ ERRADO - memory leak
class MyViewModel : ViewModel() {
    fun doSomething(context: Context) { }
}

// ✅ CORRETO - passar Application context via DI
class MyViewModel @Inject constructor(
    @ApplicationContext private val context: Context
) : ViewModel()
```

### 3.8 NÃO logar dados sensíveis

```kotlin
// ❌ ERRADO
Log.d("Auth", "User logged in: ${user.email} ${user.password}")

// ✅ CORRETO
Log.d("Auth", "User logged in: userId=${user.id}")
```

### 3.9 NÃO usar strings hardcoded

Já coberto em [1.1](#11-strings-e-localização)

### 3.10 NÃO ignorar warnings do KMP/KSP

```kotlin
// gradle.properties
// ❌ Não deixar warnings sem tratamento
kotlin.mpp.androidGradlePluginCompatibility.nowarn=true  // já configurado

// ✅ Corrigir a causa do warning quando possível
```

### 3.11 NÃO emendar fragments em navegação Compose

```kotlin
// ❌ ERRADO - misturar padrões
NavHost(navController, startDestination = "home") {
    composable("home") { HomeScreen() }
    // depois tentar usar fragment...
}

// ✅ CORRETO - manter nav_graph.xml ou ir 100% Compose Navigation
// Por enquanto: usar nav_graph.xml para tudo
```

### 3.12 NÃO criar arquivos `.md` não solicitados

```kotlin
// ❌ ERRADO - criar README.md espontaneamente
// ✅ CORRETO - esperar usuário solicitar
```

---

## 4. PADRÕES DE NOMEAÇÃO

| Tipo | Formato | Exemplo |
|------|---------|---------|
| Classe | `PascalCase` | `GameRepository` |
| Interface | `PascalCase` | `GameRepository` |
| Implementação | `PascalCase` + `Impl` | `GameRepositoryImpl` |
| ViewModel | `PascalCase` + `ViewModel` | `GamesViewModel` |
| Screen (Compose) | `PascalCase` + `Screen` | `GamesScreen` |
| Fragment | `PascalCase` + `Fragment` | `GamesFragment` |
| UiState | `PascalCase` + `UiState` | `GamesUiState` |
| UseCase | `PascalCase` + `UseCase` | `GetUpcomingGamesUseCase` |
| Variável | `camelCase` | `userName`, `maxPlayers` |
| Constante | `UPPER_SNAKE_CASE` | `MAX_PLAYERS_COUNT` |
| Private | `_camelCase` | `_uiState`, `_actions` |
| Sealed class methods | `camelCase` (verb) | `navigateTo()`, `submit()` |
| Composable | `PascalCase` | `GameCard()`, `PlayerRow()` |

---

## 5. COMENTÁRIOS E DOCUMENTAÇÃO

**REGRA:** Escrever comentários em **PORTUGUÊS (PT-BR)**.

```kotlin
/**
 * Calcula XP baseado em estatísticas da partida.
 *
 * @param game Jogo finalizado com todos os eventos
 * @param userId ID do usuário para calcular XP individual
 * @return XP total calculado (base + bônus)
 * @throws IllegalArgumentException se game.status != FINISHED
 */
fun calculateXP(game: Game, userId: String): Int {
    // ...
}

// Para lógica de negócio complexa:
// 1. XP base: 10 pontos por participação
// 2. Bônus de gol: +5 por gol marcado
// 3. Bônus MVP: +20 se foi eleito craque
// 4. Penalidade de cartão: -5 por amarelo, -15 por vermelho
```

---

## 6. MUDANÇA GRANDE: FATIAR EM PRs

**REGRA:** Mudanças grandes devem ser divididas em PRs pequenos.

**Exemplo:**
```
PR1: Adicionar estrutura básica (sem mudar comportamento)
PR2: Implementar lógica nova em feature flag
PR3: Migrar consumo para nova implementação
PR4: Remover código antigo
PR5: Atualizar testes
```

**Cada PR deve:**
- Passar em todos os testes
- Ser reviewável em < 30 minutos
- Ter título descritivo e commit message clara
- Incluir testes para o novo código
- Não introduzir warnings

---

## 7. CHECKLIST FINAL

Antes de marcar tarefa como completa, verificar:

- [ ] Compila sem erros: `./gradlew compileDebugKotlin`
- [ ] Passa testes: `./gradlew test`
- [ ] Sem strings hardcoded (usar `strings.xml`)
- [ ] ViewModels com job tracking
- [ ] Flows com `.catch {}`
- [ ] Channels fechados em `onCleared()`
- [ ] Queries Firestore com `chunked(10)` se necessário
- [ ] `collectAsStateWithLifecycle()` no Compose
- [ ] `key` em items de LazyColumn/LazyRow
- [ ] Comentários em PT-BR
- [ ] Sem warnings ignorados
- [ ] Version code incrementado (se for release)
