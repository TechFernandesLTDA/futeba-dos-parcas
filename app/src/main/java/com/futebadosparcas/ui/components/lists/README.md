# Componentes de Lista Modernos (Jetpack Compose)

Este diretório contém componentes de lista modernos em Jetpack Compose para substituir RecyclerViews, seguindo Material Design 3 e o design system do app.

## Componentes Criados

### 1. Componentes Base (Reutilizáveis)

#### `LoadMoreIndicator.kt`
Indicador de carregamento para paginação em listas.
- Exibido no final da lista enquanto mais itens estão sendo carregados
- Design minimalista com CircularProgressIndicator + texto
- Customizável via parâmetros

**Uso:**
```kotlin
LoadMoreIndicator(
    modifier = Modifier.fillMaxWidth(),
    text = "Carregando mais jogadores..."
)
```

#### `PullRefreshContainer.kt`
Container com pull-to-refresh integrado (Material Design 3).
- Suporte nativo a swipe-down para atualizar
- Usa `PullToRefreshContainer` do Material 3
- Cores personalizáveis via MaterialTheme
- Envolve qualquer conteúdo (LazyColumn, LazyVerticalGrid, etc)

**Uso:**
```kotlin
PullRefreshContainer(
    isRefreshing = isRefreshing,
    onRefresh = { viewModel.refresh() }
) {
    LazyColumn { /* conteúdo */ }
}
```

#### `PaginatedLazyColumn.kt`
LazyColumn com paginação automática e pull-to-refresh integrados.
- Detecta quando o usuário chega ao final da lista (últimos 3 itens)
- Carrega mais itens automaticamente via callback `onLoadMore`
- Pull-to-refresh opcional
- Indicador de loading integrado
- Controle completo via `LazyListState`

**Uso:**
```kotlin
PaginatedLazyColumn(
    state = rememberLazyListState(),
    isRefreshing = uiState.isRefreshing,
    onRefresh = { viewModel.refresh() },
    hasMoreItems = uiState.hasMorePages,
    isLoadingMore = uiState.isLoadingMore,
    onLoadMore = { viewModel.loadMore() }
) {
    items(games, key = { it.id }) { game ->
        GameCard(game = game, onClick = { /* ... */ })
    }
}
```

#### `ShimmerEffect.kt`
Efeitos shimmer para estados de loading.

**Componentes:**
- `Modifier.shimmerEffect()` - Modificador para aplicar shimmer
- `ShimmerBox()` - Box retangular com shimmer
- `ShimmerCircle()` - Box circular com shimmer (avatares)
- `GameCardShimmer()` - Placeholder de card de jogo
- `PlayerCardShimmer()` - Placeholder de card de jogador
- `RankingItemShimmer()` - Placeholder de item de ranking

**Uso:**
```kotlin
// Shimmer customizado
Box(
    modifier = Modifier
        .size(200.dp, 100.dp)
        .shimmerEffect()
)

// Shimmer pré-construído
GameCardShimmer()
```

---

### 2. GamesList.kt

Lista moderna de jogos com todos os recursos avançados.

**Features:**
- LazyColumn otimizada para performance
- Pull-to-refresh integrado (Material Design 3)
- Shimmer loading states
- Empty states personalizados
- Paginação automática
- Cards premium com visual gamificado
- Badges de status coloridos (Agendado, Confirmado, Ao Vivo, Finalizado, Cancelado)
- Indicadores de vagas com cores dinâmicas (verde/amarelo/vermelho)
- Suporte a grupos

**Uso Completo:**
```kotlin
GamesList(
    games = uiState.games,
    onGameClick = { game -> navController.navigate("game/${game.id}") },
    modifier = Modifier.fillMaxSize(),
    state = rememberLazyListState(),
    isLoading = uiState.isLoading,
    isRefreshing = uiState.isRefreshing,
    onRefresh = { viewModel.refresh() },
    hasMoreItems = uiState.hasMorePages,
    isLoadingMore = uiState.isLoadingMore,
    onLoadMore = { viewModel.loadNextPage() },
    emptyMessage = "Nenhum jogo encontrado",
    emptyIcon = {
        Icon(
            imageVector = Icons.Default.SportsScore,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
        )
    }
)
```

**Uso Simples (sem paginação):**
```kotlin
GamesList(
    games = viewModel.games.collectAsState().value,
    onGameClick = { game -> /* navegar */ },
    isLoading = viewModel.isLoading.collectAsState().value
)
```

**GameCard Individual:**
```kotlin
GameCard(
    game = game,
    onClick = { /* ... */ },
    modifier = Modifier.fillMaxWidth()
)
```

---

### 3. PlayersGrid.kt

Grid moderna de jogadores com colunas adaptativas.

**Features:**
- LazyVerticalGrid com colunas adaptativas baseadas no tamanho da tela
  - 2 colunas em phones
  - 3 colunas em tablets portrait
  - 4 colunas em tablets landscape
- Shimmer loading states
- Empty states personalizados
- Pull-to-refresh integrado
- Cards premium com avatar, nível, XP e stats
- Suporte a paginação
- Bordas de avatar com gradiente baseado no nível
- Badge de nível circular
- Stats compactas (ATK/MID/DEF)

**Uso Completo:**
```kotlin
PlayersGrid(
    players = uiState.players,
    onPlayerClick = { player -> navController.navigate("player/${player.id}") },
    modifier = Modifier.fillMaxSize(),
    state = rememberLazyGridState(),
    isLoading = uiState.isLoading,
    isRefreshing = uiState.isRefreshing,
    onRefresh = { viewModel.refresh() },
    hasMoreItems = uiState.hasMorePages,
    isLoadingMore = uiState.isLoadingMore,
    onLoadMore = { viewModel.loadNextPage() },
    emptyMessage = "Nenhum jogador encontrado"
)
```

**Uso Simples:**
```kotlin
PlayersGrid(
    players = viewModel.players.collectAsState().value,
    onPlayerClick = { player -> /* navegar */ },
    isLoading = viewModel.isLoading.collectAsState().value
)
```

**PlayerCard Individual:**
```kotlin
PlayerCard(
    player = player,
    onClick = { /* ... */ },
    modifier = Modifier.fillMaxWidth()
)
```

---

### 4. RankingList.kt

Lista de ranking com sticky headers por divisão e animações.

**Features:**
- LazyColumn com sticky headers por divisão
- Animações de entrada (fade + scale)
- Shimmer loading states
- Empty states personalizados
- Pull-to-refresh integrado
- Destaque visual para top 3 (gradientes ouro/prata/bronze)
- Cores e badges por divisão (Diamante/Ouro/Prata/Bronze)
- Headers de divisão com ícones e cores
- Média e quantidade de jogos

**Uso Completo (com Divisões):**
```kotlin
// Agrupar entries por divisão
val entriesByDivision = uiState.entries.groupBy { it.division }

RankingList(
    entries = entriesByDivision,
    onPlayerClick = { entry -> navController.navigate("player/${entry.userId}") },
    modifier = Modifier.fillMaxSize(),
    state = rememberLazyListState(),
    isLoading = uiState.isLoading,
    isRefreshing = uiState.isRefreshing,
    onRefresh = { viewModel.refresh() },
    emptyMessage = "Nenhum dado de ranking disponível",
    showDivisions = true
)
```

**Uso Simples (sem Divisões):**
```kotlin
SimpleRankingList(
    entries = uiState.entries,
    onPlayerClick = { entry -> /* navegar */ },
    isLoading = uiState.isLoading,
    isRefreshing = uiState.isRefreshing,
    onRefresh = { viewModel.refresh() }
)
```

**RankingItem Individual:**
```kotlin
RankingItem(
    entry = entry,
    division = LeagueDivision.OURO,
    onClick = { /* ... */ },
    isTopThree = entry.rank <= 3
)
```

---

## Design System

Todos os componentes seguem o design system do app:

### Cores
- **Primary**: `#00C853` (Verde elétrico)
- **Gold**: `#FFD700` (Ouro - top 1)
- **Silver**: `#E0E0E0` (Prata - top 2)
- **Bronze**: `#CD7F32` (Bronze - top 3)
- **Diamond**: `#00BCD4` (Diamante)
- **Success**: `#00C853` (Verde)
- **Warning**: `#FFD600` (Amarelo)
- **Error**: `#D32F2F` (Vermelho)
- **Info**: `#0288D1` (Azul)

### Typography
- Material Design 3 Typography
- Roboto font family
- Hierarquia clara (titleLarge → titleMedium → bodyLarge → bodyMedium → labelSmall)

### Shapes
- Cards: `RoundedCornerShape(16.dp)` (cantos arredondados premium)
- Badges: `RoundedCornerShape(8.dp)`
- Avatares: `CircleShape`

### Elevação
- Cards normais: `2.dp`
- Cards destacados (top 3): `4.dp`
- Shimmer: sem elevação

---

## Estados de UI

Todos os componentes suportam 3 estados principais:

1. **Loading (inicial)**: Exibe shimmer placeholders
2. **Empty**: Exibe empty state com ícone e mensagem
3. **Content**: Exibe os dados reais

### Estados Adicionais:
- **Refreshing**: Pull-to-refresh ativo (indicador no topo)
- **Loading More**: Paginação ativa (indicador no final)

---

## Performance

### Otimizações Implementadas:

1. **Keys Estáveis**: Todos os items usam `key = { item.id }` para recomposição eficiente
2. **AnimateItem**: Modifier `.animateItem()` para animações de reordenação suaves
3. **LazyList States**: Suporte a `rememberLazyListState()` e `rememberLazyGridState()` para preservar scroll position
4. **Paginação**: Carregamento automático nos últimos 3 itens (threshold configurável)
5. **Imagens Otimizadas**: Coil com placeholder e error handling
6. **Shimmer Performático**: Usa `InfiniteTransition` ao invés de recomposições manuais

---

## Exemplos de Integração com ViewModels

### Padrão Recomendado:

```kotlin
// ViewModel
@HiltViewModel
class GamesViewModel @Inject constructor(
    private val repository: GameRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(GamesUiState())
    val uiState = _uiState.asStateFlow()

    init {
        loadGames()
    }

    fun loadGames() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            repository.getGames()
                .catch { error ->
                    _uiState.update { it.copy(isLoading = false, error = error.message) }
                }
                .collect { games ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            games = games,
                            hasMorePages = games.size >= PAGE_SIZE
                        )
                    }
                }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isRefreshing = true) }
            // lógica de refresh
            _uiState.update { it.copy(isRefreshing = false) }
        }
    }

    fun loadNextPage() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingMore = true) }
            // lógica de paginação
            _uiState.update { it.copy(isLoadingMore = false) }
        }
    }
}

data class GamesUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val isLoadingMore: Boolean = false,
    val games: List<Game> = emptyList(),
    val hasMorePages: Boolean = false,
    val error: String? = null
)

// Composable
@Composable
fun GamesScreen(
    viewModel: GamesViewModel = hiltViewModel(),
    navController: NavController
) {
    val uiState by viewModel.uiState.collectAsState()

    GamesList(
        games = uiState.games,
        onGameClick = { game -> navController.navigate("game/${game.id}") },
        isLoading = uiState.isLoading,
        isRefreshing = uiState.isRefreshing,
        onRefresh = { viewModel.refresh() },
        hasMoreItems = uiState.hasMorePages,
        isLoadingMore = uiState.isLoadingMore,
        onLoadMore = { viewModel.loadNextPage() }
    )
}
```

---

## Migração de RecyclerView

### Antes (XML + RecyclerView):
```kotlin
// Fragment
class GamesFragment : Fragment() {
    private lateinit var binding: FragmentGamesBinding
    private lateinit var adapter: GamesAdapter

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        adapter = GamesAdapter { game -> /* click */ }
        binding.recyclerView.adapter = adapter
        binding.recyclerView.layoutManager = LinearLayoutManager(context)

        viewModel.games.observe(viewLifecycleOwner) { games ->
            adapter.submitList(games)
        }
    }
}

// Adapter (50-100 linhas de boilerplate)
class GamesAdapter(
    private val onGameClick: (Game) -> Unit
) : ListAdapter<Game, GameViewHolder>(GameDiffCallback()) {
    // ViewHolder, onCreateViewHolder, onBindViewHolder, etc
}
```

### Depois (Compose):
```kotlin
@Composable
fun GamesScreen(viewModel: GamesViewModel = hiltViewModel()) {
    val games by viewModel.games.collectAsState()

    GamesList(
        games = games,
        onGameClick = { game -> /* navigate */ }
    )
}
```

**Redução de código: ~90%**
**Benefícios:**
- Sem boilerplate de Adapter/ViewHolder
- Animações automáticas
- Pull-to-refresh nativo
- Paginação integrada
- Type-safe

---

## Testando os Componentes

### Preview:
```kotlin
@Preview(showBackground = true)
@Composable
fun GamesListPreview() {
    FutebaTheme {
        GamesList(
            games = listOf(
                Game(
                    id = "1",
                    date = "15/01/2025",
                    time = "19:00",
                    locationName = "Arena Parque",
                    locationAddress = "Rua das Flores, 123",
                    maxPlayers = 14,
                    playersCount = 10,
                    dailyPrice = 35.0,
                    status = GameStatus.SCHEDULED.name
                )
            ),
            onGameClick = {},
            isLoading = false
        )
    }
}

@Preview(showBackground = true)
@Composable
fun GamesListLoadingPreview() {
    FutebaTheme {
        GamesList(
            games = emptyList(),
            onGameClick = {},
            isLoading = true
        )
    }
}
```

---

## Dependências Necessárias

Já incluídas no `build.gradle.kts`:
```kotlin
// Jetpack Compose
implementation(platform("androidx.compose:compose-bom:2024.09.00"))
implementation("androidx.compose.ui:ui")
implementation("androidx.compose.material3:material3")
implementation("androidx.compose.material:material-icons-extended")

// Image Loading
implementation("io.coil-kt:coil-compose:2.7.0")

// Hilt Compose
implementation("androidx.hilt:hilt-navigation-compose:1.2.0")
```

---

## Próximos Passos (Sugestões)

1. **Migrar telas existentes**:
   - `GamesFragment` → `GamesScreen` (Compose)
   - `PlayersFragment` → `PlayersScreen` (Compose)
   - `LeagueFragment` → `LeagueScreen` (Compose)

2. **Adicionar mais variantes**:
   - `GroupsList.kt` (lista de grupos)
   - `NotificationsList.kt` (lista de notificações)
   - `LocationsList.kt` (lista de locais)

3. **Animações avançadas**:
   - Shared element transitions entre lista e detalhes
   - Custom animations para mudanças de posição no ranking

4. **Acessibilidade**:
   - Content descriptions completos
   - Semantic properties
   - Suporte a leitores de tela

---

## Contato

Criado por: **Claude Opus 4.5**
Data: **2025-01-05**
Versão do App: **1.4.2**
Material Design: **3**
Compose BOM: **2024.09.00**
