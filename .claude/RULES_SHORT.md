# RULES SHORT - Futeba dos Parças

> Versão resumida para consulta rápida durante o desenvolvimento.

---

## HARD RULES (OBRIGATÓRIO)

| # | Regra | Exemplo |
|---|-------|---------|
| 1 | **Sem strings hardcoded** | Usar `stringResource(R.string.x)` no Compose, `getString(R.string.x)` no Android |
| 2 | **Sem findViewById** | Usar ViewBinding sempre |
| 3 | **Job tracking em ViewModels** | `private var job: Job? = null; job?.cancel()` |
| 4 | **.catch {} em Flows** | `.catch { e -> _uiState.value = Error(e.message) }` |
| 5 | **Fechar Channels** | `_actions.close()` em `onCleared()` |
| 6 | **Firestore chunked(10)** | `ids.chunked(10).map { async { ... } }.awaitAll()` |
| 7 | **Sem secrets no código** | Usar `local.properties` para API keys |
| 8 | **StateFlow, não LiveData** | `val uiState: StateFlow<UiState>` |
| 9 | **collectAsStateWithLifecycle** | `val state by viewModel.uiState.collectAsStateWithLifecycle()` |
| 10 | **NUNCA LazyVerticalGrid em LazyColumn** | Usar `FlowRow` para grids em listas |
| 11 | **Incrementar versionCode** | Antes de release |
| 12 | **AsyncImage para fotos** | Usar Coil, não Picasso/Glide |

---

## PATTERN PADRÃO

### ViewModel
```kotlin
@HiltViewModel
class FeatureViewModel @Inject constructor(
    private val repository: FeatureRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<FeatureUiState>(FeatureUiState.Loading)
    val uiState: StateFlow<FeatureUiState> = _uiState

    private var loadJob: Job? = null

    fun loadData() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            repository.getData()
                .catch { e -> _uiState.value = FeatureUiState.Error(e.message ?: "Erro") }
                .collect { data -> _uiState.value = FeatureUiState.Success(data) }
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }
}
```

### Screen Compose
```kotlin
@Composable
fun FeatureScreen(
    viewModel: FeatureViewModel,
    onNavigate: (String) -> Unit
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    FeatureContent(
        state = state,
        onAction = { viewModel.handleAction(it) },
        onNavigate = onNavigate
    )
}

@Composable
private fun FeatureContent(
    state: FeatureUiState,
    onAction: (FeatureAction) -> Unit,
    onNavigate: (String) -> Unit
) {
    when (state) {
        is FeatureUiState.Loading -> CircularProgressIndicator()
        is FeatureUiState.Success -> SuccessContent(state.data)
        is FeatureUiState.Error -> ErrorContent(state.message)
    }
}
```

### UiState
```kotlin
sealed class FeatureUiState {
    object Loading : FeatureUiState()
    data class Success(val data: Data) : FeatureUiState()
    data class Error(val message: String) : FeatureUiState()
    object Empty : FeatureUiState()
}
```

---

## ANTI-PATTERNS (EVITAR)

| ❌ Anti-Pattern | ✅ Correto |
|----------------|------------|
| `Text("Hello")` | `Text(stringResource(R.string.hello))` |
| `findViewById<TextView>()` | `binding.textView` |
| `GlobalScope.launch {}` | `viewModelScope.launch {}` |
| `Thread.sleep(1000)` | `delay(1000)` |
| `val user = user!!` | `val user = user ?: return` |
| `Divider()` | `HorizontalDivider()` |
| `SwipeRefresh()` | `PullToRefreshBox()` |
| `Icons.Filled.ArrowBack` | `Icons.AutoMirrored.Filled.ArrowBack` |
| `val state by collectAsState()` | `val state by collectAsStateWithLifecycle()` |

---

## FIRESTORE PATTERNS

### Batching
```kotlin
suspend fun getUsersByIds(ids: List<String>): List<User> {
    return ids.chunked(10)
        .map { chunk ->
            async {
                firestore.collection("users")
                    .whereIn(FieldPath.documentId(), chunk)
                    .get().await()
            }
        }
        .awaitAll()
        .flatMap { it.toObjects<User>() }
}
```

### Pagination
```kotlin
suspend fun getUsers(lastUserName: String? = null): List<User> {
    var query = firestore.collection("users")
        .orderBy("name")
        .limit(50)

    lastUserName?.let { query = query.startAfter(it) }

    return query.get().await().toObjects()
}
```

---

## COMPOSE PATTERNS

### Image Loading
```kotlin
AsyncImage(
    model = ImageRequest.Builder(LocalContext.current)
        .data(url)
        .crossfade(true)
        .build(),
    placeholder = painterResource(R.drawable.placeholder),
    contentDescription = stringResource(R.string.desc),
    modifier = Modifier.clip(CircleShape)
)
```

### LazyColumn com key
```kotlin
LazyColumn {
    items(items, key = { it.id }) { item ->
        ItemComposable(item)
    }
}
```

### Modifiers ordem
```kotlin
Modifier
    .clickable { }     // 1. Interações primeiro
    .padding(16.dp)    // 2. Depois padding
    .fillMaxWidth()    // 3. Constraints depois
```

---

## NOMEAÇÃO

| Tipo | Formato | Exemplo |
|------|---------|---------|
| Classe | `PascalCase` | `GameRepository` |
| ViewModel | `PascalCase` + `ViewModel` | `GamesViewModel` |
| Screen | `PascalCase` + `Screen` | `GamesScreen` |
| Fragment | `PascalCase` + `Fragment` | `GamesFragment` |
| UiState | `PascalCase` + `UiState` | `GamesUiState` |
| UseCase | `PascalCase` + `UseCase` | `GetGamesUseCase` |
| Variável | `camelCase` | `userName` |
| Private | `_camelCase` | `_uiState` |

---

## COMANDOS ÚTEIS

```bash
# Compilar rápido
./gradlew compileDebugKotlin

# Rodar testes
./gradlew test

# Build debug
./gradlew assembleDebug

# Lint
./gradlew lint

# Clean
./gradlew clean
```

---

## CHECKLIST PR

Antes de abrir PR:

- [ ] `./gradlew compileDebugKotlin` ✓
- [ ] `./gradlew test` ✓
- [ ] Sem strings hardcoded
- [ ] Job tracking nos ViewModels
- [ ] `.catch {}` nos Flows
- [ ] `chunked(10)` no Firestore
- [ ] `collectAsStateWithLifecycle()` no Compose
- [ ] Comentários em PT-BR
