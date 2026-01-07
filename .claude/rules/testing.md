# Testing Conventions

Convenções de testes para o projeto Futeba dos Parças.

## Estrutura de Diretórios

```
app/src/
├── test/           # Unit tests (JVM)
└── androidTest/    # Instrumented tests (Device/Emulator)
```

## Comandos

```bash
./gradlew test                    # Unit tests
./gradlew connectedAndroidTest    # Instrumented tests
./gradlew testDebugUnitTest       # Debug unit tests only
```

## Naming Convention

```kotlin
// Formato: methodName_condition_expectedResult
@Test
fun calculateXP_withValidGame_returnsCorrectXP() { }

@Test
fun loadUser_whenNotFound_returnsError() { }
```

## ViewModel Tests

```kotlin
@Test
fun loadData_success_updatesUiState() = runTest {
    // Given
    val mockRepo = mockk<Repository>()
    coEvery { mockRepo.getData() } returns Result.success(testData)

    val viewModel = FeatureViewModel(mockRepo)

    // When
    viewModel.loadData()
    advanceUntilIdle()

    // Then
    assertThat(viewModel.uiState.value).isInstanceOf(UiState.Success::class.java)
}
```

## Repository Tests

```kotlin
@Test
fun getUser_existingId_returnsUser() = runTest {
    // Given
    val userId = "test-user-id"

    // When
    val result = repository.getUser(userId)

    // Then
    assertThat(result.isSuccess).isTrue()
    assertThat(result.getOrNull()?.id).isEqualTo(userId)
}
```

## Compose UI Tests

```kotlin
@Test
fun homeScreen_showsUpcomingGames() {
    composeTestRule.setContent {
        HomeScreen(viewModel = testViewModel)
    }

    composeTestRule
        .onNodeWithText("Próximos Jogos")
        .assertIsDisplayed()
}
```

## Mocking

- Usar MockK para Kotlin
- `coEvery` para suspend functions
- `every` para funções normais
