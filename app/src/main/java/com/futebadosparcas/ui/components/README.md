# Componentes Modernos de UX - Futeba dos Parças

Este diretório contém componentes reutilizáveis de interface construídos com **Jetpack Compose** e **Material Design 3** para proporcionar uma experiência de usuário moderna e consistente.

## 📦 Componentes Disponíveis

### 1. Shimmer Components (Loading States)

Componentes de loading com efeito shimmer para melhor feedback visual durante carregamento.

#### `ShimmerGameCard.kt`
Card de shimmer para loading de jogos.

```kotlin
@Composable
fun ShimmerGameCard(modifier: Modifier = Modifier)

@Composable
fun ShimmerGameCardList(count: Int = 3, modifier: Modifier = Modifier)
```

**Uso:**
```kotlin
// Mostrar loading enquanto carrega jogos
if (isLoading) {
    ShimmerGameCardList(count = 5)
}
```

#### `ShimmerPlayerCard.kt`
Card de shimmer para loading de jogadores.

```kotlin
@Composable
fun ShimmerPlayerCard(modifier: Modifier = Modifier)

@Composable
fun ShimmerPlayerCardList(count: Int = 5, modifier: Modifier = Modifier)
```

**Uso:**
```kotlin
// Mostrar loading enquanto carrega jogadores
if (isLoading) {
    ShimmerPlayerCardList(count = 8)
}
```

#### `ShimmerListContent.kt`
Componente genérico para criar shimmer customizado.

```kotlin
@Composable
fun ShimmerListContent(
    count: Int = 5,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(12.dp),
    shimmerContent: @Composable (Brush) -> Unit
)

@Composable
fun ShimmerBox(modifier: Modifier = Modifier, cornerRadius: Dp = 4.dp)

@Composable
fun ShimmerTextItem(modifier: Modifier = Modifier)
```

**Uso:**
```kotlin
// Criar shimmer customizado
ShimmerListContent(count = 10) { brush ->
    Row {
        Box(modifier = Modifier.size(48.dp).background(brush))
        Column {
            Box(modifier = Modifier.fillMaxWidth().height(20.dp).background(brush))
            Box(modifier = Modifier.fillMaxWidth().height(16.dp).background(brush))
        }
    }
}
```

---

### 2. Empty States

Componentes para exibir estados vazios diferenciados com ícones e ações.

#### `EmptyState.kt`

Estados disponíveis:
- **NoData**: Lista vazia (primeira vez, sem dados)
- **Error**: Erro com opção de retry
- **NoConnection**: Sem conexão com internet
- **NoResults**: Busca sem resultados

```kotlin
sealed class EmptyStateType {
    data class NoData(...)
    data class Error(...)
    data class NoConnection(...)
    data class NoResults(...)
}

@Composable
fun EmptyState(
    type: EmptyStateType,
    modifier: Modifier = Modifier,
    visible: Boolean = true
)
```

**Uso:**

```kotlin
// Estado: Nenhum dado
EmptyState(
    type = EmptyStateType.NoData(
        title = "Nenhum jogo agendado",
        description = "Que tal criar o primeiro jogo e reunir a galera?",
        icon = Icons.Default.SportsScore,
        actionLabel = "Criar Jogo",
        onAction = { /* navegar para criar jogo */ }
    )
)

// Estado: Erro
EmptyState(
    type = EmptyStateType.Error(
        title = "Erro ao carregar jogos",
        description = "Não foi possível carregar os dados.",
        onRetry = { /* tentar novamente */ }
    )
)

// Estado: Sem conexão
EmptyState(
    type = EmptyStateType.NoConnection(
        onRetry = { /* tentar novamente */ }
    )
)

// Estado: Busca sem resultados
EmptyState(
    type = EmptyStateType.NoResults(
        description = "Nenhum resultado para \"Ronaldinho\"",
        actionLabel = "Limpar Busca",
        onAction = { /* limpar busca */ }
    )
)
```

#### Componentes Pré-configurados

```kotlin
@Composable
fun EmptyGamesState(onCreateGame: (() -> Unit)? = null)

@Composable
fun EmptyPlayersState(onInvitePlayers: (() -> Unit)? = null)

@Composable
fun EmptySearchState(query: String, onClearSearch: () -> Unit)

@Composable
fun EmptyStateCompact(
    icon: ImageVector,
    message: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
)
```

**Uso:**
```kotlin
// Empty state pré-configurado para jogos
EmptyGamesState(
    onCreateGame = { navigateToCreateGame() }
)

// Empty state pré-configurado para jogadores
EmptyPlayersState(
    onInvitePlayers = { openInviteScreen() }
)
```

---

### 3. Undo Snackbar

Snackbar com ação de desfazer para operações reversíveis.

#### `UndoSnackbar.kt`

```kotlin
@Composable
fun UndoSnackbar(snackbarData: SnackbarData, ...)

@Composable
fun UndoSnackbarHost(hostState: SnackbarHostState, ...)

@Composable
fun rememberUndoSnackbarState(): UndoSnackbarState

// Extension function
suspend fun SnackbarHostState.showUndoSnackbar(
    message: String,
    actionLabel: String = "Desfazer",
    duration: SnackbarDuration = SnackbarDuration.Short,
    onUndo: () -> Unit,
    onDismiss: (() -> Unit)? = null
): SnackbarResult

// Helper para ações reversíveis com timer
@Composable
fun rememberUndoableAction(
    snackbarHostState: SnackbarHostState,
    message: String,
    actionLabel: String = "Desfazer",
    delayMs: Long = 3000L,
    onCommit: () -> Unit,
    onUndo: (() -> Unit)? = null
): () -> Unit
```

**Uso:**

```kotlin
// 1. Setup básico
val snackbarHostState = remember { SnackbarHostState() }
val scope = rememberCoroutineScope()

Scaffold(
    snackbarHost = {
        UndoSnackbarHost(hostState = snackbarHostState)
    }
) { paddingValues ->
    // Conteúdo
}

// 2. Mostrar snackbar com undo
scope.launch {
    snackbarHostState.showUndoSnackbar(
        message = "Jogador removido do grupo",
        actionLabel = "Desfazer",
        onUndo = {
            // Restaurar jogador
        },
        onDismiss = {
            // Confirmar remoção permanente
        }
    )
}

// 3. Ação reversível com timer automático
val deleteAction = rememberUndoableAction(
    snackbarHostState = snackbarHostState,
    message = "Item excluído",
    delayMs = 3000L,
    onCommit = {
        // Executar exclusão permanente após timer
    },
    onUndo = {
        // Cancelar exclusão
    }
)

Button(onClick = deleteAction) {
    Text("Excluir")
}
```

#### Variantes de Cor

```kotlin
@Composable
fun ErrorUndoSnackbar(snackbarData: SnackbarData)

@Composable
fun SuccessUndoSnackbar(snackbarData: SnackbarData)
```

---

## 🎨 Design System

Todos os componentes seguem o **Material Design 3** e utilizam:

- **Cores**: `MaterialTheme.colorScheme`
- **Tipografia**: `MaterialTheme.typography`
- **Formas**: `MaterialTheme.shapes`
- **Espaçamentos**: Múltiplos de 4dp (4, 8, 12, 16, 24, 32...)

### Cores por Estado

- **Primary**: Estados normais, ações principais
- **Error**: Erros, estados de falha
- **Secondary**: Busca, resultados alternativos
- **Tertiary**: Conexão, avisos

---

## 📋 Strings Necessárias

Adicione ao `strings.xml`:

```xml
<!-- Empty States -->
<string name="empty_state_no_connection_title">Sem conexao</string>
<string name="empty_state_no_connection_desc">Verifique sua conexao com a internet e tente novamente</string>
<string name="empty_state_no_results_title">Nenhum resultado encontrado</string>
<string name="empty_state_no_results_desc">Tente buscar com outras palavras</string>
<string name="empty_state_no_games_title">Nenhum jogo agendado</string>
<string name="empty_state_no_games_desc">Que tal criar o primeiro jogo e reunir a galera?</string>
<string name="empty_state_no_players_title">Nenhum jogador</string>
<string name="empty_state_no_players_desc">Convide seus amigos para comecar a jogar!</string>
<string name="empty_state_create_game">Criar Jogo</string>
<string name="empty_state_invite_players">Convidar Jogadores</string>
<string name="empty_state_clear_search">Limpar Busca</string>

<!-- Undo Snackbar -->
<string name="undo">Desfazer</string>
<string name="undo_action">Desfazer acao</string>
<string name="item_deleted">Item excluido</string>
<string name="item_removed">Item removido</string>
<string name="action_undone">Acao desfeita</string>
```

---

## 💡 Boas Práticas

### 1. Loading States
- ✅ Use shimmer em vez de spinners genéricos
- ✅ Mantenha a estrutura visual similar ao conteúdo real
- ✅ Não exagere na quantidade de items (3-5 é suficiente)

### 2. Empty States
- ✅ Sempre forneça contexto claro sobre o que está vazio
- ✅ Ofereça ações relevantes quando possível
- ✅ Use ícones expressivos e cores apropriadas
- ✅ Mantenha textos curtos e objetivos

### 3. Undo Actions
- ✅ Use para ações destrutivas (delete, remove, archive)
- ✅ Defina um tempo razoável para desfazer (3-5 segundos)
- ✅ Sempre forneça feedback visual
- ✅ Confirme a ação após o timer expirar

### 4. Acessibilidade
- ✅ Todos os ícones têm `contentDescription` quando necessário
- ✅ Cores seguem contraste mínimo WCAG AA
- ✅ Textos são legíveis em diferentes tamanhos de fonte

---

## 🔧 Integração com ViewModels

```kotlin
@HiltViewModel
class GamesViewModel @Inject constructor(...) : ViewModel() {

    // Estado da UI
    sealed class UiState {
        object Loading : UiState()
        data class Success(val games: List<Game>) : UiState()
        data class Error(val message: String) : UiState()
        object Empty : UiState()
    }

    private val _uiState = MutableStateFlow<UiState>(UiState.Loading)
    val uiState = _uiState.asStateFlow()

    fun loadGames() {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            try {
                val games = repository.getGames()
                _uiState.value = if (games.isEmpty()) {
                    UiState.Empty
                } else {
                    UiState.Success(games)
                }
            } catch (e: Exception) {
                _uiState.value = UiState.Error(e.message ?: "Erro desconhecido")
            }
        }
    }
}

// Na tela Compose
@Composable
fun GamesScreen(viewModel: GamesViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    when (uiState) {
        is UiState.Loading -> ShimmerGameCardList()
        is UiState.Empty -> EmptyGamesState(onCreateGame = { /* ... */ })
        is UiState.Error -> EmptyState(type = EmptyStateType.Error(...))
        is UiState.Success -> GamesList(games = (uiState as UiState.Success).games)
    }
}
```

---

## 📚 Exemplos Completos

Veja `ComponentsUsageExamples.kt` para exemplos completos de uso de todos os componentes.

---

## 🚀 Próximos Passos

Possíveis melhorias futuras:
- [ ] Animações de transição entre estados
- [ ] Lottie animations para empty states
- [ ] Skeleton screens customizáveis
- [ ] Snackbar queue system
- [ ] Testes unitários dos componentes

---

## 📝 Licença

Componentes desenvolvidos para uso exclusivo no projeto **Futeba dos Parças**.
Desenvolvido por: Renan Locatiz Fernandes
