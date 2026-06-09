# 👨‍💻 Development Guide - Futeba dos Parças

## Índice
- [Visão Geral](#visão-geral)
- [Padrões de Código](#padrões-de-código)
- [Git Workflow](#git-workflow)
- [Testing](#testing)
- [Code Review](#code-review)
- [Performance](#performance)
- [Security](#security)
- [Debugging](#debugging)

---

## Visão Geral

Este guia estabelece padrões de desenvolvimento para o Futeba dos Parças. Cobrimos:
- **Kotlin** (Android + KMP)
- **TypeScript** (Cloud Functions — `functions/src/`)
- **React + TypeScript** (Web — `web/src/`)

Todos devem seguir estas práticas para manter qualidade e consistência.

---

## Padrões de Código

### Kotlin (Android)

#### Nomenclatura

```kotlin
// Classes e interfaces: PascalCase
class GameRepository
interface IGameService
sealed class Result<T>

// Funções: camelCase
fun getUpcomingGames()
fun confirmPresence()

// Variáveis: camelCase
val userName: String
var currentGameId: String

// Constantes: UPPER_SNAKE_CASE
companion object {
    private const val MAX_PLAYERS = 12
    private const val GAME_TIMEOUT_MS = 5000L
}

// Enums: PascalCase para valores
enum class GameStatus {
    SCHEDULED, CONFIRMED, FINISHED, CANCELLED
}

// Lambdas de linha única: evitar
// ❌ BAD
val mapper = { game: Game -> GameDto(game.id, game.date) }

// ✅ GOOD
fun mapGameToDto(game: Game) = GameDto(game.id, game.date)
```

#### Estrutura de Funções

```kotlin
// ✅ GOOD: Claro, conciso, seguindo ordem lógica
fun createGame(request: CreateGameRequest): Flow<Result<Game>> = flow {
    // 1. Validar entrada
    require(request.date.isAfter(LocalDateTime.now())) {
        "Date must be in the future"
    }

    // 2. Lógica principal
    try {
        val game = gameRepository.createGame(request)
        emit(Result.Success(game))
    } catch (e: Exception) {
        // 3. Tratamento de erro
        emit(Result.Error(e))
    }
}
```

#### Evitar Anti-Padrões

```kotlin
// ❌ AVOID: God functions (muito longas)
fun handleGameScreen() {
    // 200+ linhas de código
}

// ✅ PREFER: Quebrar em pequenas funções
fun observeGameState()
fun displayGameConfirmations()
fun handlePlayerConfirmation()

// ❌ AVOID: Null safety ruim
val game = gameRepository.getGame(id)
val status = game.status  // ❌ NPE potencial

// ✅ PREFER: Flow + null safety
gameRepository.getGameFlow(id)
    .filterNotNull()
    .collect { game -> /* usar game */ }

// ❌ AVOID: Callbacks (callback hell)
repository.getGame(id) { game ->
    if (game != null) {
        repository.getTeams(game.id) { teams ->
            if (teams != null) {
                // nested callbacks...
            }
        }
    }
}

// ✅ PREFER: Coroutines + Flow
val gameWithTeams = combine(
    repository.getGameFlow(id),
    repository.getTeamsFlow(id)
) { game, teams -> game to teams }
```

#### Estrutura MVVM

```kotlin
// ViewModel - State management
class GameDetailViewModel(
    private val gameId: String,
    private val gameRepository: GameRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<UiState>(Loading)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    init {
        loadGame()
    }

    private fun loadGame() {
        viewModelScope.launch {
            gameRepository.getGameFlow(gameId)
                .catch { _uiState.value = Error(it.message.orEmpty()) }
                .collect { game -> _uiState.value = Success(game) }
        }
    }

    fun confirmPresence(position: Position) {
        viewModelScope.launch {
            gameRepository.confirmPresence(gameId, position)
                .collect { result ->
                    _uiState.value = when (result) {
                        is Result.Success -> Success(result.data)
                        is Result.Error -> Error(result.exception.message.orEmpty())
                    }
                }
        }
    }
}

// Fragment - UI layer
class GameDetailFragment : Fragment() {

    private val viewModel: GameDetailViewModel by viewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    when (state) {
                        is Loading -> showLoadingState()
                        is Success -> displayGame(state.game)
                        is Error -> showError(state.message)
                    }
                }
            }
        }
    }

    private fun displayGame(game: Game) {
        // Update UI
    }
}
```

### TypeScript (Cloud Functions)

As Cloud Functions vivem em `functions/src/` e usam Node 22. Siga os mesmos padrões de nomenclatura Kotlin (camelCase para funções, UPPER_SNAKE_CASE para constantes).

#### Estrutura de Cloud Functions

```typescript
// ✅ GOOD: Callable function com validação e error handling
import { onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

export const createGame = onCall(async (request) => {
    // 1. Autenticação
    if (!request.auth) {
        throw new Error('Unauthenticated');
    }

    // 2. Validar
    const data = request.data as CreateGameData;
    if (!data.date) {
        throw new Error('Date is required');
    }

    // 3. Executar
    try {
        const game = await db.collection('games').add({
            ...data,
            createdAt: FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
        });
        logger.info(`Game created: ${game.id}`);
        return { gameId: game.id };
    } catch (error) {
        logger.error('Failed to create game', error);
        throw error;
    }
});
```

#### Evitar Anti-Padrões

```typescript
// ❌ AVOID: any type
function processData(data: any): any { ... }

// ✅ PREFER: Strong typing
function processData(data: GameData): string { ... }

// ❌ AVOID: new Date() em dados Firestore
await doc.set({ createdAt: new Date() });

// ✅ PREFER: serverTimestamp() para consistência
import { FieldValue } from 'firebase-admin/firestore';
await doc.set({ createdAt: FieldValue.serverTimestamp() });
```

---

## Git Workflow

### Branches

```bash
# Branch principal (production-ready) — squash-merge only
master

# Feature branches: novo trabalho
feat/add-team-balancing
feat/fix-xp-calculation
feat/refactor-game-repo

# Hotfix branches: correções urgentes em prod
fix/critical-game-crash
```

> **Atenção:** O projeto usa **squash-merge** exclusivo para `master`. Não existe branch `develop`. Nunca faça push direto a `master`.

### Commits

#### Formato

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Tipos

- **feat**: Nova funcionalidade
- **fix**: Correção de bug
- **refactor**: Mudança de código sem alterar comportamento
- **perf**: Melhoria de performance
- **test**: Adicionar/atualizar testes
- **docs**: Documentação
- **ci**: Alterações em CI/CD
- **chore**: Dependências, configs, etc

#### Exemplos

```bash
# ✅ GOOD
git commit -m "feat(game): add team balancing algorithm

- Implement AI-based team balancing
- Use player skill level for fair distribution
- Add tests for balancing logic

Closes #123"

# ✅ GOOD
git commit -m "fix(xp): correct XP calculation for assists

Assists were being counted twice in some cases.

Closes #456"

# ❌ AVOID
git commit -m "fixed stuff"
git commit -m "WIP"
git commit -m "asdf"
```

### Pull Requests

#### Checklist

- [ ] Código segue padrões do projeto
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada
- [ ] Sem conflitos com `master`
- [ ] Lint passa (`npm run lint`)
- [ ] Build passa (`npm run build`)

#### Exemplo de PR

```markdown
## Descrição
Implementa algoritmo de balanceamento de times usando IA.

## Tipo de Mudança
- [x] Nova funcionalidade
- [ ] Correção de bug
- [ ] Breaking change

## Testing
- [x] Testes unitários adicionados
- [x] Testes de integração passam
- [x] Testado manualmente

## Screenshots (se UI)
[imagens aqui]

## Checklist
- [x] Código revisto por mim mesmo
- [x] Documentação atualizada
- [x] Testes adicionados
```

---

## Testing

### Android - Unit Tests

```kotlin
// ✅ GOOD: Teste claro e isolado
class GameRepositoryTest {

    private lateinit var gameRepository: GameRepository
    private val mockFirestore = mockk<FirebaseFirestore>()
    private val mockRoom = mockk<GameDao>()

    @Before
    fun setup() {
        gameRepository = GameRepositoryImpl(mockFirestore, mockRoom)
    }

    @Test
    fun `getUpcomingGames should emit cached data first`() = runTest {
        // Arrange
        val cachedGames = listOf(
            mockGame(date = LocalDate.now().plusDays(1))
        )
        coEvery { mockRoom.getGames() } returns cachedGames

        // Act
        val result = gameRepository.getUpcomingGames().toList()

        // Assert
        assertEquals(1, result.size)
        assertEquals(cachedGames, result[0])
    }
}
```

### Cloud Functions - Unit Tests

```typescript
// ✅ GOOD: Jest + mock do Firestore
jest.mock('../src/middleware/rate-limiter');

describe('XP processing', () => {
    it('should award XP for participation', async () => {
        // Arrange / Act / Assert ...
    });
});
```

```bash
# Cloud Functions
cd functions && npx jest --no-coverage

# Arquivo específico
npx jest test/xp.test.ts
```

### Cobertura de Teste

```bash
# Android
./gradlew testDebugUnitTest --tests "*GameRepository*"
./gradlew createDebugCoverageReport

# Cloud Functions
cd functions && npx jest
```

---

## Code Review

### Checklist para Revisor

- [ ] Código legível e bem formatado
- [ ] Sem duplicação desnecessária
- [ ] Testes cobrem happy path e edge cases
- [ ] Tratamento de erro apropriado
- [ ] Documentação clara
- [ ] Sem performance regressions
- [ ] Sem vulnerabilidades de segurança

### Comments Úteis

```
// ✅ GOOD: Específico e construtivo
"Consider extracting this validation into a separate method for reusability"

// ❌ AVOID: Vago
"This doesn't look right"

// ✅ GOOD: Oferece alternativa
"This could use Optional.map() to avoid null check"

// ❌ AVOID: Muito crítico
"This code is terrible"
```

---

## Performance

### Android

```kotlin
// ❌ AVOID: Carregar tudo em memória
val allGames = gameRepository.getAllGames()  // 1000+ items

// ✅ PREFER: Paginação
val games = gameRepository.getGames(limit = 20, offset = 0)

// ❌ AVOID: Múltiplas queries
games.forEach { game ->
    val teams = teamRepository.getTeams(game.id)  // N+1 queries!
}

// ✅ PREFER: Batch query ou relacionamento pré-carregado
val gamesWithTeams = gameRepository.getGamesWithTeams()

// ❌ AVOID: Sincronização bloqueante na UI
val data = repository.getData()  // Bloqueia por 2 segundos

// ✅ PREFER: Async
viewModel.gameState  // Flow contínuo
```

### Backend

```typescript
// ❌ AVOID: Nested loops
games.forEach(game => {
    confirmations.forEach(conf => {
        if (conf.gameId === game.id) {
            // O(n²) complexity
        }
    });
});

// ✅ PREFER: Map para lookup
const confirmationsByGame = new Map(
    confirmations.map(c => [c.gameId, c])
);
games.forEach(game => {
    const confirmation = confirmationsByGame.get(game.id);
});

// ❌ AVOID: Sem índices
async function findGamesByStatus(status: string) {
    return await gameRepository.find({ status });  // Table scan!
}

// ✅ PREFER: Com índice
// CREATE INDEX idx_games_status ON games(status);
async function findGamesByStatus(status: string) {
    return await gameRepository.find({ status });  // Index scan
}
```

---

## Security

### Vulnerabilidades Comuns

```kotlin
// ❌ AVOID: SQL Injection
"SELECT * FROM users WHERE email = '$email'"

// ✅ PREFER: Parameterized queries
database.query("SELECT * FROM users WHERE email = ?", email)

// ❌ AVOID: Hardcoded secrets
const JWT_SECRET = "super-secret-key-12345"

// ✅ PREFER: Environment variables
const JWT_SECRET = process.env.JWT_SECRET

// ❌ AVOID: Armazenar senhas em plaintext
user.password = inputPassword

// ✅ PREFER: Hash + salt
user.password = bcrypt.hash(inputPassword)
```

### Checklist de Segurança

- [ ] Sem hardcoded secrets
- [ ] Inputs validados
- [ ] Outputs escapados
- [ ] HTTPS em produção
- [ ] CORS configurado corretamente
- [ ] Rate limiting ativado
- [ ] Sem exposição de dados sensíveis em logs
- [ ] Testes de autenticação/autorização

---

## Debugging

### Android Studio

```bash
# Logs
adb logcat | grep "futebadosparcas"

# Breakpoints
# Ctrl+F8 para toggle breakpoint
# F8 para step over
# F7 para step into

# Layout inspection
Layout Inspector → Device → Select process → futebadosparcas
```

### Cloud Functions (VS Code / WebStorm)

```bash
# Iniciar emuladores com Functions
firebase emulators:start

# Logs em tempo real
firebase functions:log --follow
```

### Firebase

```bash
# Logs em tempo real
firebase functions:log --follow

# Emulator logs
firebase emulators:start

# Firestore
Firebase Console → Firestore → Monitoring
```

---

## Veja Também

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Environment setup
- [KMP_QUICK_START.md](./KMP_QUICK_START.md) - Kotlin Multiplatform
- [CI_CD_SETUP.md](./CI_CD_SETUP.md) - GitHub Actions e deploy

---

**Última atualização:** Junho 2026
**Versão:** 1.31.0
