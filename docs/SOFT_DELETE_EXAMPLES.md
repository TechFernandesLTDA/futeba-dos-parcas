# Soft Delete - Exemplos de Implementação

Guia prático de como implementar soft-delete no app Android.

---

## 1. Repository Layer (Firestore Queries)

### GameRepository

```kotlin
interface GameRepository {
    // Buscar jogos ativos (não deletados)
    fun getActiveGames(): Flow<List<Game>>

    // Soft-delete de um jogo
    suspend fun softDeleteGame(gameId: String): Result<Unit>

    // Admin: Buscar jogos deletados
    fun getDeletedGames(): Flow<List<Game>>

    // Admin: Recuperar jogo deletado
    suspend fun recoverGame(gameId: String): Result<Unit>
}

class GameRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions
) : GameRepository {

    override fun getActiveGames(): Flow<List<Game>> {
        return firestore.collection("games")
            .whereEqualTo("deleted_at", null)  // ← Filtro soft-delete
            .orderBy("created_at", Query.Direction.DESCENDING)
            .snapshots()
            .map { snapshot ->
                snapshot.toObjects<Game>()
            }
    }

    override suspend fun softDeleteGame(gameId: String): Result<Unit> {
        return try {
            // Opção 1: Via callable function (recomendado - validações no backend)
            val softDelete = functions.getHttpsCallable("softDeleteGame")
            softDelete.call(hashMapOf("gameId" to gameId)).await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Opção 2: Direct Firestore update (se permitido pelas rules)
    suspend fun softDeleteGameDirect(gameId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("User not authenticated"))

            firestore.collection("games").document(gameId).update(
                mapOf(
                    "deleted_at" to FieldValue.serverTimestamp(),
                    "deleted_by" to userId,
                    "status" to "DELETED"
                )
            ).await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Admin: Buscar jogos deletados
    override fun getDeletedGames(): Flow<List<Game>> {
        return firestore.collection("games")
            .whereNotEqualTo("deleted_at", null)  // ← Apenas deletados
            .orderBy("deleted_at", Query.Direction.DESCENDING)
            .snapshots()
            .map { snapshot ->
                snapshot.toObjects<Game>()
            }
    }

    // Admin: Recuperar jogo deletado
    override suspend fun recoverGame(gameId: String): Result<Unit> {
        return try {
            firestore.collection("games").document(gameId).update(
                mapOf(
                    "deleted_at" to FieldValue.delete(),
                    "deleted_by" to FieldValue.delete(),
                    "status" to "SCHEDULED"  // Ou status original
                )
            ).await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

---

## 2. Data Model

### Game.kt

```kotlin
@Keep
data class Game(
    val id: String = "",
    val owner_id: String = "",
    val title: String = "",
    val status: String = "SCHEDULED",
    val created_at: Timestamp? = null,
    val updated_at: Timestamp? = null,

    // Soft-delete fields
    val deleted_at: Timestamp? = null,
    val deleted_by: String? = null,

    // ... outros campos
) {
    // Helper: verifica se foi soft-deleted
    val isDeleted: Boolean
        get() = deleted_at != null

    // Helper: tempo até deletar permanentemente (90 dias)
    fun daysUntilPermanentDeletion(): Int? {
        if (deleted_at == null) return null

        val deletedDate = deleted_at.toDate()
        val permanentDeletionDate = Calendar.getInstance().apply {
            time = deletedDate
            add(Calendar.DAY_OF_YEAR, 90)
        }.time

        val now = Date()
        val diffMs = permanentDeletionDate.time - now.time
        return (diffMs / (1000 * 60 * 60 * 24)).toInt()
    }
}
```

---

## 3. ViewModel

### GameDetailViewModel.kt

```kotlin
@HiltViewModel
class GameDetailViewModel @Inject constructor(
    private val gameRepository: GameRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val gameId: String = savedStateHandle["gameId"]!!

    private val _uiState = MutableStateFlow<GameDetailUiState>(GameDetailUiState.Loading)
    val uiState: StateFlow<GameDetailUiState> = _uiState

    fun deleteGame() {
        viewModelScope.launch {
            _uiState.value = GameDetailUiState.Deleting

            gameRepository.softDeleteGame(gameId)
                .onSuccess {
                    _uiState.value = GameDetailUiState.Deleted
                }
                .onFailure { error ->
                    _uiState.value = GameDetailUiState.Error(
                        message = error.message ?: "Erro ao deletar jogo"
                    )
                }
        }
    }
}

sealed class GameDetailUiState {
    object Loading : GameDetailUiState()
    data class Success(val game: Game) : GameDetailUiState()
    object Deleting : GameDetailUiState()
    object Deleted : GameDetailUiState()
    data class Error(val message: String) : GameDetailUiState()
}
```

---

## 4. UI (Compose)

### GameDetailScreen.kt

```kotlin
@Composable
fun GameDetailScreen(
    viewModel: GameDetailViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    var showDeleteDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Detalhes do Jogo") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
                actions = {
                    // Botão de delete
                    IconButton(onClick = { showDeleteDialog = true }) {
                        Icon(Icons.Default.Delete, contentDescription = "Deletar")
                    }
                }
            )
        }
    ) { padding ->
        when (val state = uiState) {
            is GameDetailUiState.Success -> {
                GameDetailContent(
                    game = state.game,
                    modifier = Modifier.padding(padding)
                )
            }

            is GameDetailUiState.Deleting -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            is GameDetailUiState.Deleted -> {
                // Navegação de volta após deletar
                LaunchedEffect(Unit) {
                    onNavigateBack()
                }
            }

            is GameDetailUiState.Error -> {
                ErrorState(
                    message = state.message,
                    onRetry = { /* retry */ }
                )
            }

            GameDetailUiState.Loading -> {
                LoadingState()
            }
        }
    }

    // Dialog de confirmação
    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Deletar Jogo?") },
            text = {
                Text(
                    "O jogo será marcado como deletado e poderá ser recuperado " +
                    "nos próximos 90 dias. Após esse período, será deletado permanentemente."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteDialog = false
                        viewModel.deleteGame()
                    }
                ) {
                    Text("Deletar")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }
}
```

---

## 5. Admin Recovery Screen (Opcional)

### DeletedGamesScreen.kt

```kotlin
@Composable
fun DeletedGamesScreen(
    viewModel: AdminViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val deletedGames by viewModel.deletedGames.collectAsStateWithLifecycle(emptyList())

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Jogos Deletados (Admin)") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            items(deletedGames) { game ->
                DeletedGameItem(
                    game = game,
                    onRecover = { viewModel.recoverGame(game.id) }
                )
            }
        }
    }
}

@Composable
private fun DeletedGameItem(
    game: Game,
    onRecover: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = game.title,
                style = MaterialTheme.typography.titleMedium
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Deletado em: ${game.deleted_at?.toDate()?.formatDateTime()}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            game.daysUntilPermanentDeletion()?.let { days ->
                Text(
                    text = "Será deletado permanentemente em $days dias",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (days < 10) Color.Red else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = onRecover,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Restore, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Recuperar Jogo")
            }
        }
    }
}
```

---

## 6. Testes

### GameRepositoryTest.kt

```kotlin
@Test
fun `softDeleteGame marks game as deleted`() = runTest {
    // Given
    val gameId = "test-game-id"

    // When
    val result = gameRepository.softDeleteGame(gameId)

    // Then
    assertTrue(result.isSuccess)

    // Verificar que não aparece em getActiveGames
    val activeGames = gameRepository.getActiveGames().first()
    assertFalse(activeGames.any { it.id == gameId })

    // Verificar que aparece em getDeletedGames (admin)
    val deletedGames = gameRepository.getDeletedGames().first()
    assertTrue(deletedGames.any { it.id == gameId })
}

@Test
fun `recoverGame removes deleted_at field`() = runTest {
    // Given
    val gameId = "deleted-game-id"

    // When
    val result = gameRepository.recoverGame(gameId)

    // Then
    assertTrue(result.isSuccess)

    // Verificar que volta a aparecer em getActiveGames
    val activeGames = gameRepository.getActiveGames().first()
    assertTrue(activeGames.any { it.id == gameId })
}
```

---

## 7. Strings Resources

### strings.xml

```xml
<resources>
    <!-- Soft Delete -->
    <string name="dialog_delete_game_title">Deletar Jogo?</string>
    <string name="dialog_delete_game_message">O jogo será marcado como deletado e poderá ser recuperado nos próximos 90 dias. Após esse período, será deletado permanentemente.</string>
    <string name="dialog_delete_game_confirm">Deletar</string>
    <string name="dialog_delete_game_cancel">Cancelar</string>

    <string name="game_deleted_success">Jogo deletado com sucesso</string>
    <string name="game_deleted_error">Erro ao deletar jogo: %s</string>

    <string name="game_recovered_success">Jogo recuperado com sucesso</string>
    <string name="game_recovered_error">Erro ao recuperar jogo: %s</string>

    <string name="deleted_games_title">Jogos Deletados</string>
    <string name="deleted_at_label">Deletado em: %s</string>
    <string name="permanent_deletion_warning">Será deletado permanentemente em %d dias</string>
    <string name="recover_game_button">Recuperar Jogo</string>
</resources>
```

---

## 8. Migration Guide (Para Features Existentes)

### Passo 1: Adicionar campos no Model

```kotlin
// Antes
data class Game(
    val id: String = "",
    val owner_id: String = "",
    ...
)

// Depois
data class Game(
    val id: String = "",
    val owner_id: String = "",
    ...
    val deleted_at: Timestamp? = null,
    val deleted_by: String? = null
)
```

### Passo 2: Atualizar Queries

```kotlin
// Antes
fun getGames(): Flow<List<Game>> {
    return firestore.collection("games")
        .orderBy("created_at", Query.Direction.DESCENDING)
        .snapshots()
        .map { it.toObjects<Game>() }
}

// Depois
fun getGames(): Flow<List<Game>> {
    return firestore.collection("games")
        .whereEqualTo("deleted_at", null)  // ← Adicionar filtro
        .orderBy("created_at", Query.Direction.DESCENDING)
        .snapshots()
        .map { it.toObjects<Game>() }
}
```

### Passo 3: Substituir Delete por Soft-Delete

```kotlin
// Antes
suspend fun deleteGame(gameId: String): Result<Unit> {
    return try {
        firestore.collection("games").document(gameId).delete().await()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

// Depois
suspend fun softDeleteGame(gameId: String): Result<Unit> {
    return try {
        val softDelete = functions.getHttpsCallable("softDeleteGame")
        softDelete.call(hashMapOf("gameId" to gameId)).await()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

---

## 9. Performance Considerations

### Indexes Necessários

```javascript
// Firestore Console → Indexes → Composite

// 1. Para getActiveGames()
Collection: games
Fields:
  - deleted_at (ASC)
  - created_at (DESC)

// 2. Para getDeletedGames()
Collection: games
Fields:
  - deleted_at (DESC)
```

### Cache Local

Para melhor performance, considere cachear queries de soft-delete:

```kotlin
fun getActiveGames(): Flow<List<Game>> {
    return firestore.collection("games")
        .whereEqualTo("deleted_at", null)
        .orderBy("created_at", Query.Direction.DESCENDING)
        .get(Source.CACHE)  // ← Usar cache local quando possível
        .asFlow()
        .catch {
            // Fallback para network se cache falhar
            emit(firestore.collection("games")
                .whereEqualTo("deleted_at", null)
                .orderBy("created_at", Query.Direction.DESCENDING)
                .get(Source.SERVER)
                .await())
        }
        .map { snapshot ->
            snapshot.toObjects<Game>()
        }
}
```

---

## 10. Rollback Plan

Se precisar reverter soft-delete:

### Opção 1: Migração de Dados (Converter soft-delete para hard-delete)

```bash
# Cloud Function para deletar permanentemente todos os soft-deleted
firebase functions:shell

> const db = require('firebase-admin').firestore();
> const batch = db.batch();
> const snapshot = await db.collection('games').where('deleted_at', '!=', null).get();
> snapshot.docs.forEach(doc => batch.delete(doc.ref));
> await batch.commit();
```

### Opção 2: Remover Filtros (Voltar a mostrar deletados)

```kotlin
// Remover filtro de soft-delete temporariamente
fun getGames(): Flow<List<Game>> {
    return firestore.collection("games")
        // .whereEqualTo("deleted_at", null)  ← Comentar
        .orderBy("created_at", Query.Direction.DESCENDING)
        .snapshots()
        .map { it.toObjects<Game>() }
}
```

---

## Conclusão

Soft-delete oferece:
- ✅ Recuperação de dados deletados acidentalmente
- ✅ Período de graça de 90 dias
- ✅ Compliance com LGPD (dados podem ser recuperados temporariamente)
- ✅ Histórico de quem deletou e quando

Custos:
- ❌ Storage adicional (documentos não são deletados imediatamente)
- ❌ Queries mais complexas (filtrar `deleted_at`)
- ❌ Necessidade de cleanup automático (via Cloud Functions)

**Recomendação**: Implementar soft-delete em:
- ✅ Games (jogos podem ser deletados acidentalmente)
- ✅ Groups (grupos têm membros e histórico)
- ✅ Locations (locais podem ter jogos vinculados)

**Não implementar** em:
- ❌ Notifications (deletar é permanente)
- ❌ Activities (feed não precisa recuperação)
- ❌ XP Logs (histórico imutável)
