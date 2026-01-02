# 🏗️ Arquitetura - Futeba dos Parças

## Índice
- [Visão Geral](#visão-geral)
- [Arquitetura em 3 Camadas](#arquitetura-em-3-camadas)
- [Componentes Principais](#componentes-principais)
- [Fluxo de Dados](#fluxo-de-dados)
- [Padrões de Design](#padrões-de-design)
- [Decisões Arquiteturais](#decisões-arquiteturais)
- [Escalabilidade e Performance](#escalabilidade-e-performance)

---

## Visão Geral

**Futeba dos Parças** é uma aplicação **full-stack distribuída** com três camadas bem definidas:

```
┌─────────────────────────────────────────────────────────────────┐
│                      ANDROID APP (Kotlin)                       │
│  MVVM + Clean Architecture + Jetpack Compose                    │
│  - UI (Fragments + Compose)                                     │
│  - ViewModel (State Management)                                 │
│  - Repositories (Data Access)                                   │
│  - Room Database (Offline Cache)                                │
└────────────────┬────────────────────────────────────┬───────────┘
                 │                                    │
        ┌────────▼─────────┐         ┌────────────────▼──────────┐
        │  FIREBASE CLOUD  │         │   BACKEND API (Node.js)   │
        │    (Real-time)   │         │   Express + TypeORM        │
        ├──────────────────┤         ├───────────────────────────┤
        │ Firestore        │         │ REST Endpoints            │
        │ Realtime DB      │         │ Business Logic (Services) │
        │ Auth             │         │ Database (PostgreSQL)     │
        │ Cloud Functions  │         │ Cron Jobs                 │
        │ Cloud Storage    │         │ WebSocket                 │
        │ Messaging (FCM)  │         │                           │
        └──────────────────┘         └───────────────────────────┘
```

---

## Arquitetura em 3 Camadas

### 1. **Camada de Apresentação (Android UI)**

```
┌─────────────────────────────────────────┐
│    PRESENTATION LAYER (Jetpack)         │
├─────────────────────────────────────────┤
│ • Fragments (Navigation)                │
│ • Compose Components (Modern UI)        │
│ • ViewModels (State Management)         │
│ • LiveData / StateFlow (Reactivity)     │
└────────────┬────────────────────────────┘
             │
       (observa)
             │
        ┌────▼──────────────────┐
        │ Domain Layer           │
        │ (Business Logic)       │
        │ - Use Cases           │
        │ - Gamification        │
        │ - Ranking Logic       │
        │ - Team Balancing      │
        └────┬──────────────────┘
             │
       (usa)
             │
        ┌────▼──────────────────┐
        │ Data Layer             │
        │ (Data Access)          │
        │ - Repositories         │
        │ - DataSources          │
        │ - Room Database        │
        │ - Firestore Remote     │
        │ - Mappers              │
        └───────────────────────┘
```

### 2. **Camada de Domínio (Business Logic)**

Contém a lógica de negócio pura, independente de frameworks:

```
Domain/
├── gamification/
│   ├── BadgeAwarder.kt          # Concessão de badges
│   ├── XPCalculator.kt          # Cálculo de XP
│   └── SeasonManager.kt         # Gerenciamento de estações
├── ranking/
│   ├── RankingCalculator.kt     # Cálculo de ranking
│   ├── PostGameEventEmitter.kt  # Eventos pós-jogo
│   └── MatchFinalizer.kt        # Finalização de partidas
├── ai/
│   └── TeamBalancer.kt          # Algoritmo de balanceamento
└── usecase/
    ├── CreateGameUseCase.kt
    ├── ConfirmPresenceUseCase.kt
    ├── GenerateTeamsUseCase.kt
    └── ...mais use cases
```

### 3. **Camada de Dados (Data Access)**

Abstração completa do acesso a dados:

```
Data/
├── repository/                  # Interface + Implementação
│   ├── GameRepository.kt
│   ├── UserRepository.kt
│   ├── LocationRepository.kt
│   └── ...mais repositórios
├── datasource/
│   ├── local/                   # Room Database
│   │   ├── dao/
│   │   └── model/
│   └── remote/                  # Firebase/API
│       └── FirestoreDataSource.kt
├── mapper/                      # DTO → Domain Models
├── model/                       # Domain Models
└── local/
    ├── AppDatabase.kt           # Room Database
    └── entities/                # Room Entities
```

---

## Componentes Principais

### Android

| Componente | Propósito | Stack |
|-----------|----------|-------|
| **MainActivity** | Hub de navegação | Fragment + BottomNav |
| **Repositories** | Acesso a dados (Local + Remote) | Room + Firestore + Flow |
| **ViewModels** | State management da UI | Jetpack ViewModel |
| **Use Cases** | Lógica de negócio reutilizável | Kotlin Coroutines |
| **Adapters** | Binding de dados à UI | RecyclerView/Compose |
| **Services** | Background tasks | Android Services + FCM |

### Backend (Node.js)

| Componente | Propósito | Tecnologia |
|-----------|----------|-----------|
| **Controllers** | Endpoints HTTP | Express.js |
| **Services** | Lógica de negócio | Plain TypeScript |
| **Repositories** | Acesso a dados | TypeORM |
| **Entities** | Modelos de banco | TypeORM Entities |
| **Middlewares** | Cross-cutting concerns | Express Middleware |
| **Cron Jobs** | Tasks agendadas | node-cron |
| **Cloud Functions** | Serverless processing | Firebase Functions |

### Firebase

| Serviço | Uso |
|--------|-----|
| **Firestore** | Real-time database + sync |
| **Authentication** | User auth (custom + Google Sign-In) |
| **Cloud Functions** | Processamento de XP, badges, ranking |
| **Cloud Storage** | Fotos de perfil, campos, grupos |
| **Cloud Messaging (FCM)** | Push notifications |
| **App Check** | Proteção contra abuse |
| **Crashlytics** | Error tracking em produção |

---

## Fluxo de Dados

### Fluxo 1: Criar Jogo

```
┌─────────────────────────────────────────────────────────┐
│ User: Toca botão "Criar Jogo" na Home                  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ CreateGameFragment abre dialog                          │
│ Carrega locais/campos via GameRepository.getLocations()│
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ User: Preenche form (data, hora, local, campo)         │
│ CreateGameViewModel valida via                         │
│   GameRepository.checkTimeConflict()                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ User: Clica "Criar"                                    │
│ ViewModel: Chama GameRepository.createGame()           │
│ Repository: Salva em Firestore                         │
└────────────────┬────────────────────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
         ▼                ▼
    ┌─────────────┐  ┌──────────────────┐
    │ Firestore   │  │ Backend API      │
    │ onWrite()   │  │ Webhook listener │
    │ trigger     │  │ (optional)       │
    └──────┬──────┘  └────────────────┘
           │
           ▼
    ┌─────────────────────────┐
    │ Cloud Function          │
    │ Enviar notificações     │
    │ aos jogadores do grupo  │
    └─────────────────────────┘
```

### Fluxo 2: Confirmar Presença

```
User toca "Confirmar" em jogo

    ▼

ConfirmPresenceUseCase.execute()
  └─> GameRepository.confirmPresence(gameId, position)

    ▼

Repository (local + remote)
  ├─> Room: salva localmente para offline
  └─> Firestore: sincroniza na nuvem

    ▼

Firestore listener atualiza GameDetailViewModel em tempo real

    ▼

UI atualiza: "Você confirmado! (X/Y players)"
```

### Fluxo 3: Pós-Jogo (XP + Ranking)

```
Jogo finalizado: status = FINISHED, stats adicionados

    ▼

Firestore onUpdate() trigger

    ▼

Cloud Function: processXPAndRanking()
  ├─> Calcula XP por jogador
  │   ├─> XP presença
  │   ├─> XP gols
  │   ├─> XP assists
  │   ├─> XP saves
  │   ├─> XP MVP
  │   └─> XP streaks
  │
  ├─> Atualiza UserStatistics no Firestore
  │
  ├─> Verifica badges desbloqueadas
  │   └─> Cria UserBadge se aplicável
  │
  └─> Atualiza ranking geral (Season)

    ▼

Android app observa mudanças:
  ├─> ViewModel detecta novo XP
  ├─> UI exibe animação de unlock (se badge)
  └─> League/Statistics atualizam automaticamente
```

---

## Padrões de Design

### 1. **Repository Pattern**

Abstrai a fonte de dados (Local vs Remote):

```kotlin
interface GameRepository {
    fun getUpcomingGames(): Flow<List<Game>>
    fun confirmPresence(gameId: String, position: Position): Flow<Result<Unit>>
}

// Implementação decide: Room + Firestore
class GameRepositoryImpl(
    private val roomDao: GameDao,
    private val firestoreSource: FirestoreDataSource
) : GameRepository {
    override fun getUpcomingGames() = flow {
        // 1. Emite dados do Room (cache local)
        emit(roomDao.getGames())

        // 2. Busca dados frescos do Firestore
        val remote = firestoreSource.getGames()

        // 3. Atualiza Room e emite novamente
        roomDao.insertGames(remote)
        emit(remote)
    }
}
```

### 2. **ViewModel + StateFlow Pattern**

UI sempre reactiva ao estado:

```kotlin
class GameDetailViewModel(
    private val gameId: String,
    private val gameRepository: GameRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<GameDetailUiState>(Loading)
    val uiState: StateFlow<GameDetailUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            gameRepository.getGameFlow(gameId)
                .catch { _uiState.value = Error(it.message) }
                .collect { game ->
                    _uiState.value = Success(game)
                }
        }
    }

    fun confirmPresence(position: Position) {
        viewModelScope.launch {
            gameRepository.confirmPresence(gameId, position)
                .collect { result -> /* atualiza estado */ }
        }
    }
}
```

### 3. **Service Layer Pattern (Backend)**

Centraliza lógica de negócio:

```typescript
class GameService {
    constructor(
        private gameRepo: GameRepository,
        private statsService: StatisticsService,
        private notificationService: NotificationService
    ) {}

    async createGame(data: CreateGameDto): Promise<Game> {
        // 1. Validação
        this.validateGameData(data);

        // 2. Criar jogo
        const game = await this.gameRepo.save(data);

        // 3. Notificar jogadores
        await this.notificationService.notifyGroupMembers(game);

        return game;
    }

    async finalizeGame(gameId: string, stats: GameStats[]): Promise<void> {
        // 1. Atualizar jogo
        await this.gameRepo.update(gameId, { status: 'FINISHED' });

        // 2. Salvar stats
        await this.statsRepo.save(stats);

        // 3. Recalcular estatísticas de usuários
        await this.statsService.recalculateUserStats(stats);

        // 4. Cloud Function processa XP e badges (async)
    }
}
```

### 4. **Dependency Injection Pattern**

**Android (Hilt):**
```kotlin
@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    fun provideGameRepository(
        roomDao: GameDao,
        firestore: FirebaseFirestore
    ): GameRepository = GameRepositoryImpl(roomDao, firestore)
}
```

**Backend (TypeORM/Manual):**
```typescript
export const createGameService = () => {
    const gameRepo = getRepository(Game);
    const statsService = new StatisticsService(getRepository(UserStatistics));
    return new GameService(gameRepo, statsService);
}
```

---

## Decisões Arquiteturais

### 1. **Por que Firebase + PostgreSQL?**

| Aspecto | Firebase | PostgreSQL |
|--------|----------|-----------|
| Real-time sync | ✅ Excelente | ❌ Requer polling |
| Offline support | ✅ Automático | ❌ Manual |
| Queries complexas | ❌ Limitado | ✅ SQL poderoso |
| Escalabilidade | ✅ Auto-scaling | ✅ Manual |
| Custo inicial | ✅ Baixo | ❌ Setup |

**Decisão:** Usar ambos:
- **Firestore**: Real-time sync, presença de jogadores, notificações
- **PostgreSQL**: Queries complexas, analytics, backup

### 2. **Por que Room Database no Android?**

- ✅ Suporta offline-first
- ✅ Sincroniza automaticamente com Firestore
- ✅ Melhor performance que APIs locais
- ✅ Type-safe queries

### 3. **Por que Cloud Functions para Processamento de XP?**

```
Alternativas e trade-offs:

A. Cloud Function (escolhido)
   ✅ Desacoplado
   ✅ Escalável
   ✅ Triggered por eventos Firestore
   ❌ Latência de 1-2 segundos

B. Backend síncrono
   ✅ Resposta imediata
   ❌ Bloqueia requisição
   ❌ Difícil de escalar

C. Backend async com queue
   ✅ Escalável
   ❌ Mais complexo
   ❌ Precisa gerenciar fila
```

### 4. **Por que MVVM + Clean Architecture no Android?**

```
Benefícios:
✅ Testabilidade (UI separada de lógica)
✅ Reusabilidade (Use Cases compartilháveis)
✅ Manutenibilidade (Padrão consistente)
✅ Escalabilidade (Fácil adicionar features)
```

---

## Escalabilidade e Performance

### Escalabilidade: Android App

```
┌─────────────────────────────────────┐
│ Problema: Muitos jogadores, muitos  │
│ jogos simultâneos = Firestore lento │
└────────────┬────────────────────────┘
             │
      ┌──────┴──────────┐
      │ Solução         │
      └──────┬──────────┘
             │
    ┌────────┴────────────┐
    ▼                     ▼
Room Cache         Firestore Indices
(local)            (optimized queries)

+ Paginação nas listas
+ Lazy loading de images
+ Debounce em searches
+ Offline-first
```

### Escalabilidade: Backend

```
┌──────────────────────┐
│ PostgreSQL 15+       │
│ - Índices em status  │
│ - Índices em date_id │
│ - Connection pooling │
│ - Prepared statements│
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
Cache      Load Balancing
(Redis)    (múltiplas instâncias)
```

### Performance: Queries Críticas

```
GET /api/games/upcoming
- Firestore: index em (status, date_id)
- PostgreSQL: index em (status, date DESC)
- Cache: Redis 5 minutos

GET /api/statistics/schedule/:id/rankings
- PostgreSQL: computed columns
- Atualizado por Cloud Function
- Cache: 1 hora
```

---

## Veja Também

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Como rodar tudo
- [API_REFERENCE.md](./API_REFERENCE.md) - Endpoints disponíveis
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Schema do banco
- [app/ARCHITECTURE.md](./app/ARCHITECTURE.md) - Android detalhes
- [backend/ARCHITECTURE.md](./backend/ARCHITECTURE.md) - Backend detalhes
- [docs/BUSINESS_RULES.md](./docs/BUSINESS_RULES.md) - Regras de negócio

---

**Última atualização:** Dezembro 2025
