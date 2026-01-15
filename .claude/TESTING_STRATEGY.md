# TESTING STRATEGY - Futeba dos Parças

> Estratégia de testes: pirâmide, ferramentas, cobertura.
> Última atualização: 2025-01-10

---

## 1. PIRÂMIDE DE TESTES

```
                    ┌─────────────┐
                    │   E2E UI    │  ← 5% (Instrumented)
                    │   (Espresso)│
                    └─────────────┘
                  ┌─────────────────┐
                  │   Integration   │  ← 15% (Android Test)
                  │  (Repository)   │
                  └─────────────────┘
               ┌────────────────────────┐
               │      Unit Tests       │  ← 80% (JVM Test)
               │  (ViewModel, UseCase)  │
               └────────────────────────┘
```

---

## 2. TESTES UNITÁRIOS

### 2.1 O Que Testar

| Camada | O Que Testar | Exemplo |
|--------|--------------|---------|
| **Domain** | Use Cases, Services, Calculators | `XPCalculator.calculateXP()` |
| **Data** | Repository methods (com mock) | `GameRepository.getGame()` |
| **UI** | ViewModels (state transitions) | `GamesViewModel.loadGames()` |
| **Util** | Extensions, helpers | `DateFormatter.format()` |

### 2.1 Exemplos de Testes

#### Use Case
```kotlin
@Test
fun `calculateXP returns correct XP for game with goals`() = runTest {
    // Given
    val calculator = XPCalculator()
    val game = mockGame(
        goals = 2,
        assists = 1,
        mvp = false
    )

    // When
    val xp = calculator.calculateXP(game, userId)

    // Then
    assertThat(xp).isEqualTo(10 + 2*5 + 1*3) // base + goals + assists
}
```

#### ViewModel
```kotlin
@Test
fun `loadGames success updates ui state to Success`() = runTest {
    // Given
    val repository = mockk<GameRepository>()
    coEvery { repository.getUpcomingGames(any()) } returns flowOf(
        listOf(mockGame1, mockGame2)
    )
    val viewModel = GamesViewModel(repository)

    // When
    viewModel.loadGames()
    advanceUntilIdle()

    // Then
    assertThat(viewModel.uiState.value)
        .isInstanceOf(GamesUiState.Success::class.java)

    val successState = viewModel.uiState.value as GamesUiState.Success
    assertThat(successState.games).hasSize(2)
}
```

#### Repository
```kotlin
@Test
fun `getGame returns cached game if available`() = runTest {
    // Given
    val repository = GameRepositoryImpl(firestore, cache)
    cache.put("game1", mockGame)

    // When
    val result = repository.getGame("game1")

    // Then
    assertThat(result).isEqualTo(mockGame)
    coVerify { firestore wasNot Called }
}
```

### 2.2 Ferramentas

| Ferramenta | Uso |
|------------|-----|
| **JUnit 5** | Framework de testes |
| **MockK** | Mocking |
| **Turbine** | Flow testing |
| **Truth** | Assertões |
| **Coroutines Test** | Testes assíncronos |

### 2.3 Setup

```kotlin
@RunWith(JUnitPlatform::class)
class ExampleTest {

    @Test
    fun example() = runTest {
        // Test code here
    }
}
```

---

## 3. TESTES DE INTEGRAÇÃO

### 3.1 O Que Testar

| Componente | O Que Testar |
|-------------|--------------|
| **Repository** | Integração com Firebase mock |
| **Database** | Operações Room |
| **Use Case** | Fluxo completo repository → domain |

### 3.2 Exemplo

```kotlin
@HiltAndroidTest
class GameRepositoryIntegrationTest {

    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    @Inject
    lateinit var repository: GameRepository

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun getGame_fromFirestore_savesToCache() = runTest {
        // Given
        val gameId = "test-game"

        // When
        val result = repository.getGame(gameId)

        // Then
        assertThat(result).isNotNull()
        // Verify cache was updated...
    }
}
```

---

## 4. TESTES UI (INSTRUMENTED)

### 4.1 O Que Testar

| Cena | O Que Testar |
|------|--------------|
| **Fluxo principal** | Login → Home → Games → Detail |
| **Formulários** | Validação, erros |
| **Listas** | Scroll, click em items |
| **Navegação** | Transições entre telas |

### 4.2 Compose UI Testing

```kotlin
@Test
fun gamesScreen_showsLoading_whenLoading() {
    composeTestRule.setContent {
        GamesScreen(
            viewModel = viewModel,
            onNavigate = {}
        )
    }

    composeTestRule
        .onNodeWithText("Carregando...")
        .assertIsDisplayed()
}

@Test
fun gamesScreen_clickItem_navigatesToDetail() {
    composeTestRule.setContent {
        GamesScreen(
            viewModel = viewModel,
            onNavigate = { destination = it }
        )
    }

    composeTestRule
        .onAllNodesWithTag("game_item")[0]
        .performClick()

    assertThat(destination).isEqualTo("game_detail/123")
}
```

### 4.3 Espresso (XML)

```kotlin
@Test
fun loginButtonClick_opensHome() {
    // Login activity
    onView(withId(R.id.btn_login))
        .perform(click())

    // Verify home is shown
    onView(withId(R.id.home_fragment))
        .check(matches(isDisplayed()))
}
```

---

## 5. COBERTURA

### 5.1 Metas

| Camada | Atual | Meta | Prazo |
|--------|-------|------|-------|
| **Domain** | ~60% | 80% | Q2 2025 |
| **Data** | ~40% | 70% | Q3 2025 |
| **UI** | ~20% | 50% | Q4 2025 |
| **Overall** | ~35% | 65% | Q4 2025 |

### 5.2 Medir Cobertura

```bash
# Gerar relatório
./gradlew testDebugUnitTestCoverage

# Relatório em:
# app/build/reports/coverage/test/debug/index.html
```

---

## 6. ESTRATÉGIA POR CAMADA

### 6.1 Domain Layer

**Foco:** Lógica de negócio

**Testar:**
- ✅ Cálculos de XP
- ✅ Balanceamento de times
- ✅ Validações de regras
- ✅ Transformações de modelo

**Não testar:**
- ❌ Implementação de repository
- ❌ Detalhes de Firebase

### 6.2 Data Layer

**Foco:** Acesso e cache de dados

**Testar:**
- ✅ Cache hit/miss
- ✅ Transformação DTO → Domain
- ✅ Batching logic
- ✅ Error handling

**Usar:**
- Mock para Firebase
- In-memory para cache
- Fake DAO para Room

### 6.3 UI Layer

**Foco:** Comportamento de ViewModel e renderização

**Testar:**
- ✅ Transições de estado
- ✅ Actions do usuário
- ✅ Error states
- ✅ Loading states

**Não testar:**
- ❌ Visual detalhado (ver manualmente)
- ❌ Animações

---

## 7. TEST DATA

### 7.1 Factories

```kotlin
object TestDataFactory {

    fun createGame(
        id: String = "game1",
        status: GameStatus = GameStatus.SCHEDULED,
        date: LocalDateTime = LocalDateTime.now()
    ): Game {
        return Game(
            id = id,
            status = status,
            date = date,
            // ...
        )
    }

    fun createUser(
        id: String = "user1",
        name: String = "Test User",
        level: Int = 1
    ): User {
        return User(id = id, name = name, level = level)
    }
}
```

### 7.2 Test Fixtures

```kotlin
// Arquivo: fixtures/TestGames.kt
val mockScheduledGame = Game(/* ... */)
val mockLiveGame = Game(/* ... */)
val mockFinishedGame = Game(/* ... */)
```

---

## 8. PADRÕES DE TESTE

### 8.1 Given-When-Then

```kotlin
@Test
fun `nome_descritivo`() = runTest {
    // Given - configuração
    val viewModel = GamesViewModel(mockRepository)

    // When - ação
    viewModel.loadGames()
    advanceUntilIdle()

    // Then - verificação
    assertThat(viewModel.uiState.value).isInstanceOf(Success::class.java)
}
```

### 8.2 Teste Parametrizado

```kotlin
@ParameterizedTest
@ValueSource(ints = [0, 5, 10, 20])
fun `calculateXP for different goal counts`(goals: Int) = runTest {
    val xp = XPCalculator.calculateXP(goals = goals)
    assertThat(xp).isEqualTo(10 + goals * 5)
}
```

### 8.3 Teste de Exceção

```kotlin
@Test
fun `getGame throws when game not found`() = runTest {
    val repository = GameRepositoryImpl(emptyFirestore)

    assertThrows<GameNotFoundException> {
        repository.getGame("nonexistent")
    }
}
```

---

## 9. SETUP E EXECUÇÃO

### 9.1 Comandos

```bash
# Unit tests
./gradlew test

# Unit tests específicos
./gradlew test --tests "com.futebadosparcas.ui.games.GamesViewModelTest"

# Instrumented tests
./gradlew connectedAndroidTest

# Com cobertura
./gradlew testDebugUnitTestCoverage
```

### 9.2 VS Code / Android Studio

- Clique direito no método de teste → Run
- Ctrl+Shift+R para rodar teste atual
- Ctrl+Shift+F10 para rodar todos os testes da classe

---

## 10. MELHORES PRÁTICAS

### 10.1 Testes Rápidos

```kotlin
@Test
fun `fast unit test`() {
    // ❌ EVITAR: I/O, network, sleeps
    // ✅ USAR: mock, in-memory
}
```

### 10.2 Testes Determinísticos

```kotlin
@Test
fun `deterministic test`() = runTest {
    // ❌ EVITAR: System.currentTimeMillis(), Random
    // ✅ USAR: TestClock, fixed seed
}
```

### 10.3 Testes Independentes

```kotlin
// ❌ ERRADO: ordem importa
@Test fun testA() { ... }
@Test fun testB() { ... } // depende de A

// ✅ CORRETO: cada teste isolado
@Test fun testA() { /* Given clean state */ }
@Test fun testB() { /* Given clean state */ }
```

---

## 11. CI/CD INTEGRAÇÃO

### 11.1 Pipeline

```yaml
test:
  script:
    - ./gradlew test
    - ./gradlew connectedAndroidTest
  artifacts:
    - app/build/reports/tests/
```

### 11.2 Reports

- JUnit XML para CI
- HTML para leitura humana
- Coverage para métricas

---

## 12. REFERÊNCIAS

- [JUnit 5 User Guide](https://junit.org/junit5/docs/current/user-guide/)
- [MockK](https://mockk.io/)
- [Turbine](https://github.com/cashapp/turbine)
- [Compose Testing](https://developer.android.com/jetpack/compose/testing)
