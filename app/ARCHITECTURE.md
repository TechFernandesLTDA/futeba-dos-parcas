# 🏛️ Android Architecture - Futeba dos Parças

## Índice
- [Clean Architecture](#clean-architecture)
- [Camadas](#camadas)
- [Padrões](#padrões)
- [Data Flow](#data-flow)
- [Exemplo Prático](#exemplo-prático)

---

## Clean Architecture

```
┌──────────────────────────────────────────┐
│      PRESENTATION LAYER (UI)             │
│  Fragments, ViewModels, Compose          │
└────────────────────┬─────────────────────┘
                     │ (observa)
                     ▼
┌──────────────────────────────────────────┐
│      DOMAIN LAYER (Business Logic)       │
│  Use Cases, Entities, Repositories API   │
└────────────────────┬─────────────────────┘
                     │ (usa)
                     ▼
┌──────────────────────────────────────────┐
│      DATA LAYER (Data Access)            │
│  Repositories, DataSources, Mappers      │
└──────────────────────────────────────────┘
```

**Benefícios:**
- ✅ Testabilidade (cada camada isolada)
- ✅ Reusabilidade (use cases compartilháveis)
- ✅ Manutenibilidade (padrão consistente)
- ✅ Escalabilidade (fácil adicionar features)

---

## Camadas

### 1. Presentation Layer

**Responsabilidade:** Exibir dados, capturar input, navigation

**Componentes:**
- **Fragment** - Tela/UI container
- **ViewModel** - Gerenciar estado da UI
- **Adapter** - Binding de dados (RecyclerView)
- **Composables** - Modern UI (Jetpack Compose)

```kotlin
// Exemplo: GameDetailFragment
class GameDetailFragment : Fragment() {

    private val viewModel: GameDetailViewModel by viewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Observar estado do ViewModel
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    when (state) {
                        is Loading -> showLoading()
                        is Success -> displayGame(state.game)
                        is Error -> showError(state.message)
                    }
                }
            }
        }
    }

    // ✅ Apenas UI logic, sem business logic
}

// ViewModel: State Management
class GameDetailViewModel(
    private val gameId: String,
    private val getGameUseCase: GetGameUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<GameDetailState>(Loading)
    val uiState: StateFlow<GameDetailState> = _uiState.asStateFlow()

    init {
        loadGame()
    }

    private fun loadGame() {
        viewModelScope.launch {
            getGameUseCase.execute(gameId)
                .catch { _uiState.value = Error(it.message.orEmpty()) }
                .collect { game -> _uiState.value = Success(game) }
        }
    }

    // ✅ Apenas state management, sem UI details
}
```

**Responsabilidades:**
- ✅ Renderizar UI
- ✅ Capturar gestos/input
- ✅ Navegar entre telas
- ❌ Lógica de negócio
- ❌ Acesso a banco de dados

---

### 2. Domain Layer

**Responsabilidade:** Lógica de negócio pura, independente de frameworks

**Componentes:**
- **Entity** - Modelos de domínio (Game, User, etc)
- **Repository** - Interface de data access
- **UseCase** - Operações específicas de negócio

```kotlin
// Entity: Modelo de domínio puro
data class Game(
    val id: String,
    val date: LocalDate,
    val time: LocalTime,
    val location: Location,
    val confirmations: List<GameConfirmation>,
    val status: GameStatus
)

// Repository: Interface (sem implementação)
interface GameRepository {
    fun getUpcomingGames(): Flow<List<Game>>
    fun confirmPresence(gameId: String, position: Position): Flow<Result<Unit>>
    suspend fun checkTimeConflict(fieldId: String, dateTime: LocalDateTime): Boolean
}

// UseCase: Operação de negócio específica
class ConfirmPresenceUseCase(
    private val gameRepository: GameRepository,
    private val badgeAwarder: BadgeAwarder
) {
    suspend operator fun invoke(
        gameId: String,
        position: Position
    ): Result<Unit> = try {
        gameRepository.confirmPresence(gameId, position).firstOrNull() ?: Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

**Responsabilidades:**
- ✅ Definir interfaces de repositório
- ✅ Lógica de negócio (use cases)
- ✅ Modelos de domínio (entities)
- ❌ Detalhes de banco de dados
- ❌ Detalhes de UI/Framework

---

### 3. Data Layer

**Responsabilidade:** Acesso a dados de diferentes fontes

**Componentes:**
- **Repository** - Implementação (combina local + remote)
- **LocalDataSource** - Room database
- **RemoteDataSource** - Firestore API
- **Mapper** - Converte between models
- **DAO** - Database access objects

```kotlin
// Repository: Implementação (combina local + remote)
class GameRepositoryImpl(
    private val roomDao: GameDao,
    private val firestoreSource: FirestoreDataSource,
    private val mapper: GameMapper
) : GameRepository {

    override fun getUpcomingGames(): Flow<List<Game>> = flow {
        // 1. Emit dados do Room (cache local)
        val cachedGames = roomDao.getUpcomingGames()
        emit(cachedGames.map { mapper.toDomain(it) })

        // 2. Buscar dados frescos do Firestore
        try {
            val remotGames = firestoreSource.getUpcomingGames()

            // 3. Atualizar Room
            roomDao.insertGames(remotGames.map { mapper.toEntity(it) })

            // 4. Emit novamente
            emit(remotGames.map { mapper.toDomain(it) })
        } catch (e: Exception) {
            // 5. Fallback para cache local
            emit(cachedGames.map { mapper.toDomain(it) })
        }
    }
}

// LocalDataSource: Room
@Dao
interface GameDao {
    @Query("SELECT * FROM games WHERE status IN ('SCHEDULED', 'CONFIRMED') ORDER BY date ASC")
    fun getUpcomingGames(): List<GameEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGames(games: List<GameEntity>)
}

// RemoteDataSource: Firestore
class FirestoreDataSource {
    suspend fun getUpcomingGames(): List<Game> {
        return firestore
            .collection("games")
            .whereIn("status", listOf("SCHEDULED", "CONFIRMED"))
            .orderBy("date")
            .get()
            .await()
            .toObjects(Game::class.java)
    }
}

// Mapper: Conversão de modelos
class GameMapper {
    fun toDomain(entity: GameEntity): Game = Game(
        id = entity.id,
        date = entity.date,
        // ...
    )

    fun toEntity(domain: Game): GameEntity = GameEntity(
        id = domain.id,
        date = domain.date,
        // ...
    )
}
```

**Responsabilidades:**
- ✅ Implementar repositórios
- ✅ Acessar banco de dados (Room, Firestore)
- ✅ Mapear entre modelos
- ❌ Lógica de negócio
- ❌ UI details

---

## Padrões

### 1. Repository Pattern

Abstrai fonte de dados:

```kotlin
// Cliente não sabe se vem de Room, Firestore ou API
val games: Flow<List<Game>> = gameRepository.getUpcomingGames()

// Repository decide: cache local + sync remote
```

### 2. ViewModel Pattern

Gerencia estado da UI de forma reactive:

```kotlin
// ViewModel emite estado continuamente
val uiState: StateFlow<GameDetailState>

// Fragment observa e renderiza
uiState.collect { state ->
    displayGame(state.game)
}
```

### 3. UseCase Pattern

Encapsula operação de negócio:

```kotlin
// UseCase = operação específica, reutilizável
class ConfirmPresenceUseCase { ... }

// Pode ser reutilizada por múltiplos ViewModels
```

### 4. Dependency Injection (Hilt)

Injeta dependências automaticamente:

```kotlin
@HiltViewModel
class GameDetailViewModel(
    private val gameRepository: GameRepository,  // Injetado
    private val statsRepository: StatsRepository // Injetado
) : ViewModel()

// Hilt resolve as dependências automaticamente
```

---

## Data Flow

### Exemplo: Confirmar Presença em Jogo

```
┌─────────────────┐
│ User clica      │
│ "Confirmar"     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ GameDetailFragment              │
│ viewModel.confirmPresence()     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ GameDetailViewModel             │
│ chamá ConfirmPresenceUseCase    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ ConfirmPresenceUseCase          │
│ chamá gameRepository            │
└────────┬────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ GameRepositoryImpl                    │
│ 1. Room: salva localmente            │
│ 2. Firestore: syncroniza na nuvem    │
└────────┬─────────────────────────────┘
         │
    ┌────┴────┐
    │          │
    ▼          ▼
┌─────────┐  ┌──────────┐
│ Room DB │  │ Firestore│
└────┬────┘  └────┬─────┘
     │            │
     └────┬───────┘
          │
          ▼
┌────────────────────────────────┐
│ Firestore listener             │
│ atualiza GameDetailViewModel   │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ UI renderiza novo estado       │
│ "Confirmado!" + contador +11/12│
└────────────────────────────────┘
```

---

## Exemplo Prático

### Criar Jogo Completo

**1. Fragment (UI)**
```kotlin
class CreateGameFragment : Fragment() {
    private val viewModel: CreateGameViewModel by viewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        binding.createButton.setOnClickListener {
            viewModel.createGame(
                date = binding.dateInput.text.toString(),
                time = binding.timeInput.text.toString(),
                location = selectedLocation
            )
        }
    }
}
```

**2. ViewModel (State Management)**
```kotlin
@HiltViewModel
class CreateGameViewModel(
    private val createGameUseCase: CreateGameUseCase
) : ViewModel() {

    fun createGame(date: String, time: String, location: Location) {
        viewModelScope.launch {
            try {
                val game = createGameUseCase(date, time, location)
                // Navegar para game detail
            } catch (e: Exception) {
                // Mostrar erro
            }
        }
    }
}
```

**3. UseCase (Business Logic)**
```kotlin
class CreateGameUseCase(
    private val gameRepository: GameRepository,
    private val notificationService: NotificationService
) {
    suspend operator fun invoke(
        date: String,
        time: String,
        location: Location
    ): Game {
        // Validar
        val localDate = LocalDate.parse(date)
        if (localDate.isBefore(LocalDate.now())) {
            throw ValidationException("Date must be in future")
        }

        // Criar
        val game = gameRepository.createGame(date, time, location)

        // Side effect
        notificationService.notifyGroupMembers(game)

        return game
    }
}
```

**4. Repository (Data Access)**
```kotlin
class GameRepositoryImpl(
    private val gameDao: GameDao,
    private val firestore: FirebaseFirestore
) : GameRepository {

    override suspend fun createGame(
        date: String,
        time: String,
        location: Location
    ): Game {
        val game = Game(
            id = UUID.randomUUID().toString(),
            date = LocalDate.parse(date),
            time = LocalTime.parse(time),
            location = location
        )

        // Salvar localmente
        gameDao.insert(GameEntity.from(game))

        // Salvar na nuvem
        firestore.collection("games")
            .document(game.id)
            .set(game)
            .await()

        return game
    }
}
```

---

## Veja Também

- [README.md](./README.md) - Android app overview
- [MODULES.md](./MODULES.md) - Features e telas
- [../ARCHITECTURE.md](../ARCHITECTURE.md) - Arquitetura geral (3 camadas)
- [../DEVELOPMENT_GUIDE.md](../DEVELOPMENT_GUIDE.md) - Padrões de código

---

**Última atualização:** Dezembro 2025
