# ARCHITECTURE - Futeba dos Parças

> Documento de arquitetura do projeto.
> Última atualização: 2025-01-10

---

## 1. VISÃO GERAL

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │ XML Fragments  │  │ Compose Screens│  │   ViewModels   │   │
│  │  (38 arquivos) │  │  (33 arquivos) │  │  (Hilt inj.)   │   │
│  │  - ViewBinding │  │  - Material3   │  │  - StateFlow   │   │
│  └────────────────┘  └────────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                           DOMAIN                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │   Use Cases    │  │    Services    │  │     Models     │   │
│  │ (KMP shared)   │  │ (KMP shared)   │  │ (KMP shared)   │   │
│  └────────────────┘  └────────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                            DATA                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │  Repositories  │  │  Local Cache   │  │    Remote      │   │
│  │  (impl Android)│  │  - Room        │  │  - Firestore   │   │
│  │  (impl KMP)    │  │  - SQLDelight  │  │  - Firebase    │   │
│  │                │  │  - LRU Cache   │  │  - Auth        │   │
│  └────────────────┘  └────────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. CAMADAS

### 2.1 Presentation Layer

**Responsabilidade:** Exibir dados e capturar interações do usuário.

#### Fragments (XML)
- Implementam Navigation Component destinations
- Usam ViewBinding para acessar views
- Hospedam Composables via `ComposeView`
- **Pasta:** `app/src/main/java/com/futebadosparcas/ui/`

#### Screens (Compose)
- Composables stateless para UI
- Recebem estado e callbacks como parâmetros
- Usam Material3 components
- **Pasta:** `app/src/main/java/com/futebadosparcas/ui/`

#### ViewModels
- `@HiltViewModel` para injeção
- Exponhem `StateFlow<UiState>` para estado
- Recebem ações via métodos ou `Channel`
- **Job tracking** para prevenir memory leaks
- **Pasta:** `app/src/main/java/com/futebadosparcas/ui/`

```kotlin
@HiltViewModel
class ExampleViewModel @Inject constructor(
    private val repository: ExampleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<ExampleUiState>(ExampleUiState.Loading)
    val uiState: StateFlow<ExampleUiState> = _uiState

    private var loadJob: Job? = null

    fun loadData() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            repository.getData()
                .catch { e -> _uiState.value = ExampleUiState.Error(e.message) }
                .collect { data -> _uiState.value = ExampleUiState.Success(data) }
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }
}
```

### 2.2 Domain Layer

**Responsabilidade:** Lógica de negócio e regras do domínio.

**Localização:** `shared/src/commonMain/kotlin/com/futebadosparcas/domain/`

#### Use Cases
- Encapsulam uma ação específica do domínio
- São independentes de UI e Data
- Retornam `Result<T>` ou `Flow<T>`

```kotlin
class GetUpcomingGamesUseCase(
    private val repository: GameRepository
) {
    operator fun invoke(userId: String): Flow<List<Game>> {
        return repository.getUpcomingGames(userId)
    }
}
```

#### Services
- Lógica de negócio complexa
- Exemplos: `XPCalculator`, `TeamBalancer`, `MatchFinalizationService`

#### Models
- Entidades do domínio
- Platform-agnostic (KMP)

### 2.3 Data Layer

**Responsabilidade:** Acesso a dados (local e remoto).

**Localização:** `app/src/main/java/com/futebadosparcas/data/`

#### Repositories
- Implementam interfaces do domain
- Coordenam fontes de dados (cache + remote)
- Aplicam estratégias de cache (LRU, TTL)

```kotlin
class GameRepositoryImpl(
    private val firestore: FirebaseFirestore,
    private val gameDao: GameDao,
    private val cache: GameCache
) : GameRepository {

    private val cacheTtl = 5 * 60 * 1000L // 5 minutos

    override suspend fun getGame(gameId: String): Game? {
        // 1. Check cache
        cache.get(gameId)?.let { return it }

        // 2. Check local DB
        gameDao.getGame(gameId)?.let { return it.toDomain() }

        // 3. Fetch from Firestore
        val doc = firestore.collection("games").document(gameId).get().await()
        val game = doc.toObject<GameDto>()?.toDomain() ?: return null

        // 4. Update cache and DB
        cache.put(gameId, game)
        gameDao.insert(game.toEntity())

        return game
    }
}
```

#### Local Storage
- **Room:** Banco local para Android-only
- **SQLDelight:** Banco compartilhado KMP
- **LRU Cache:** Cache em memória
- **DataStore:** Preferências key-value

#### Remote Data Sources
- **Firestore:** Banco principal
- **Firebase Auth:** Autenticação
- **Firebase Storage:** Arquivos
- **FCM:** Push notifications

---

## 3. PADRÕES ARQUITETURAIS

### 3.1 MVVM (Model-View-ViewModel)

```
┌─────────────┐      events       ┌──────────────┐
│    View     │ ───────────────► │ ViewModel    │
│ (Fragment/  │ ◄─────────────── │ (StateFlow)  │
│  Screen)    │     state        └──────────────┘
└─────────────┘                      │
                                      │
                                      ↓
                              ┌──────────────┐
                              │   Model      │
                              │ (Domain)     │
                              └──────────────┘
```

**Fluxo de dados:**
1. View dispara ação → ViewModel
2. ViewModel processa → Repository
3. Repository retorna → ViewModel
4. ViewModel atualiza StateFlow → View recompose

### 3.2 Repository Pattern

```
                ┌─────────────────┐
                │   ViewModel     │
                └────────┬────────┘
                         │
                ┌────────▼────────┐
                │   Repository    │
                └────────┬────────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
    ┌──────▼──────┐ ┌───▼────┐ ┌────▼─────┐
    │   Cache     │ │  DB    │ │  Remote  │
    │   (LRU)     │ │ (Room) │ │(Firebase)│
    └─────────────┘ └────────┘ └──────────┘
```

### 3.3 Use Case Pattern

```
┌──────────────┐    invoke    ┌──────────────┐
│  ViewModel   │ ───────────► │  Use Case    │
└──────────────┘              └──────┬───────┘
                                     │
                             ┌───────▼───────┐
                             │  Repository    │
                             └───────────────┘
```

---

## 4. DECISÕES ARQUITETURAIS

### 4.1 Híbrida XML + Compose

**Decisão:** Migrar gradualmente para Compose sem quebrar o app.

**Estratégia:**
- Fragment (Navigation) → hospeda → Screen (Compose)
- Novas features: 100% Compose
- Features existentes: migrar quando fizer sentido

**Benefícios:**
- Sem "big bang" rewrite
- Coexistência permite aprendizado gradual
- Navigation Component continua funcionando

### 4.2 Kotlin Multiplatform para Domain

**Decisão:** Compartilhar domain layer entre Android e futuro iOS.

**Estrutura:**
- `commonMain`: Domain models, use cases, services
- `androidMain`: Implementações Android (Firebase)
- `iosMain`: Implementações iOS (futuras)

**Benefícios:**
- Lógica de negócio testada uma vez
- iOS herda regras de XP, ranking, etc.
- Reduz código duplicado

### 4.3 Firebase no Android Main

**Decisão:** Manter Firebase SDK no Android, usar expect/actual.

**Razão:**
- Firebase SDK não é multiplataforma
- expect/actual permite abstrair no KMP

```kotlin
// commonMain
expect fun FirebaseDataSource(): FirebaseDataSource

// androidMain
actual fun FirebaseDataSource(): FirebaseDataSource {
    return AndroidFirebaseDataSource(...)
}

// iosMain (futuro)
actual fun FirebaseDataSource(): FirebaseDataSource {
    return IOSFirebaseDataSource(...)
}
```

### 4.4 Job Tracking Obrigatório

**Decisão:** Todos os ViewModels devem cancelar jobs.

**Razão:** Prevenir memory leaks e race conditions.

```kotlin
private var loadJob: Job? = null

fun loadData() {
    loadJob?.cancel()  // Prevenir execuções simultâneas
    loadJob = viewModelScope.launch { ... }
}
```

---

## 5. LIMITAÇÕES E TRADE-OFFS

### 5.1 Firestore Limites

| Limite | Valor | Workaround |
|--------|-------|------------|
| `whereIn()` | 10 itens | `chunked(10)` + parallel queries |
| Document size | 1 MB | Subcoleções para dados grandes |
| Transaction writes | 500 documentos | Batch operations |
| Realtime listeners | Preço | Cache + poll estratégico |

### 5.2 Compose Performance

| Problema | Solução |
|----------|---------|
| Recomposição excessiva | `remember`, `derivedStateOf` |
| Listas grandes | `key` em items, paging |
| Imagens pesadas | Coil cache otimizado |

### 5.3 KMP Trade-offs

| Aspecto | Status | Nota |
|---------|--------|------|
| Domain layer | ✅ 90% KMP | Quanto pronto |
| Data layer | ⚠️ 40% KMP | Migração em andamento |
| UI layer | ❌ 0% KMP | Plataforma-specific |

---

## 6. EVOLUÇÃO ARQUITETURAL

### 6.1 Roadmap

| Fase | Status | Próximo Passo |
|------|--------|---------------|
| **1. MVVM + XML** | ✅ Completo | - |
| **2. Compose híbrido** | 🔄 Em andamento | Continuar migração |
| **3. Domain KMP** | 🔄 90% | Finalizar use cases |
| **4. Data KMP** | ⏳ 40% | Migrar repositories |
| **5. iOS App** | ⏳ Planejado | Após KMP 100% |

### 6.2 Dívida Técnica

| Item | Prioridade | Complexidade |
|------|------------|--------------|
| Remover XML Fragments | Média | Alta |
| Migrar repos para KMP | Alta | Alta |
| Paging 3 para listas | Média | Média |
| Testes de UI (Compose) | Média | Baixa |
| CI/CD automation | Alta | Média |

---

## 7. DIAGRAMAS DE FLUXO

### 7.1 Fluxo de Autenticação

```
SplashActivity → LoginActivity → (Google Sign-In)
                        ↓
                FirebaseAuth.getInstance()
                        ↓
                (success) → MainActivity
                        ↓
                HomeFragment (Bottom Nav)
```

### 7.2 Fluxo de Jogo

```
CreateGameScreen → (schedule) → GamesScreen
                        ↓
                GameDetailScreen → (confirm) → GameDetail
                        ↓
                LiveGameScreen → (events) → GameDetail
                        ↓
                (finish) → Cloud Function → XP processado
                        ↓
                Rankings atualizados
```

### 7.3 Fluxo de Dados

```
User Action (UI)
       ↓
ViewModel (action handler)
       ↓
Use Case (domain logic)
       ↓
Repository (data orchestration)
       ↓
Cache Check → DB Check → Remote Fetch
       ↓
Data transformation (DTO → Domain)
       ↓
StateFlow emit → UI observe
```
