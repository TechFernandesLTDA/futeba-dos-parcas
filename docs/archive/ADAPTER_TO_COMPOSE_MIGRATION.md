# Guia de Conversão: RecyclerView Adapters → Jetpack Compose LazyColumn

## Status da Migração (Críticos - 4/4 Completos ✅)

### Críticos (Convertidos)
- ✅ **NotificationsAdapter** → `NotificationsScreen.kt`
- ✅ **BadgesAdapter** → `BadgesScreen.kt`
- ✅ **LiveEventsAdapter** → `LiveEventsScreen.kt`
- ✅ **LiveStatsAdapter** → `LiveStatsScreen.kt`

### A Converter (Próxima Fase)
- **UserManagementAdapter.kt** (90 linhas)
- **GroupMembersAdapter.kt**
- **InvitePlayersAdapter.kt**
- **SchedulesAdapter.kt** (76 linhas)
- **TransferOwnershipAdapter.kt**
- **ManageFieldsAdapter.kt**
- **ManageLocationsAdapter.kt**
- **ReviewsAdapter.kt**
- **RankingAdapter.kt** (League)
- **VoteCandidatesAdapter.kt**
- **FieldAdapter.kt** (Locations)
- **LocationDashboardAdapter.kt**
- + 2 outros

---

## Padrão de Conversão Implementado

### 1. NotificationsAdapter → NotificationsScreen

**Adapter Original (143 linhas):**
```kotlin
// RecyclerView com ListAdapter<AppNotification, ViewHolder>
// - onItemClick callback
// - onAcceptClick callback
// - onDeclineClick callback
// Binding: ItemNotificationBinding
```

**Tela Compose (NotificationsScreen.kt - 660 linhas):**
```kotlin
@Composable
fun NotificationsScreen(
    viewModel: NotificationsViewModel,
    onNotificationClick: (AppNotification) -> Unit,
    onBackClick: () -> Unit
)
```

**Características Implementadas:**
- ✅ LazyColumn com `items(notifications)`
- ✅ SwipeToDismissBox para deletar (swipe direita)
- ✅ Grouping por data (Hoje, Ontem, Esta Semana, Antigas)
- ✅ Action buttons (Aceitar/Recusar) baseado em `requiresResponse()`
- ✅ Badge de não-lidas
- ✅ Pull-to-refresh
- ✅ NotificationIcon com Material Icons (substitui drawables)
- ✅ Timestamp relativo formatado
- ✅ Shimmer loading state
- ✅ Empty state quando vazio

**Callbacks Implementados:**
```kotlin
onNotificationClick: (AppNotification) -> Unit
onAccept: (AppNotification) -> Unit
onDecline: (AppNotification) -> Unit
onDelete: (AppNotification) -> Unit
```

---

### 2. BadgesAdapter → BadgesScreen

**Adapter Original (146 linhas):**
```kotlin
// RecyclerView com ListAdapter<BadgeWithData, ViewHolder>
// Sem callbacks (apenas exibição)
// Binding: ItemBadgeBinding
```

**Tela Compose (BadgesScreen.kt - 903 linhas):**
```kotlin
@Composable
fun BadgesScreen(
    viewModel: BadgesViewModel = hiltViewModel(),
    onBackClick: (() -> Unit)? = null
)
```

**Características Implementadas:**
- ✅ LazyVerticalGrid (2 colunas) em vez de simples lista
- ✅ Header com progresso circular animado
- ✅ Tabs de filtro por categoria (PERFORMANCE, PRESENCA, COMUNIDADE, NIVEL)
- ✅ Card de badge com borda colorida por raridade
- ✅ Dialog de detalhes ao clicar (com animação de escala)
- ✅ Badge count chip (×3) quando count > 1
- ✅ Rarity labels com cores (COMUM, RARO, ÉPICO, LENDÁRIO)
- ✅ Data de desbloqueio formatada
- ✅ Shimmer loading state para cada card
- ✅ Empty state por categoria

**Funções de Utilidade:**
```kotlin
private fun getBadgeEmoji(type: BadgeType): String
private fun getRarityColor(rarity: BadgeRarity): Color
private fun getCategoryEmoji(category: BadgeCategory): String
```

**Estados da UI:**
```kotlin
sealed class BadgesUiState {
    object Loading : BadgesUiState()
    data class Error(val message: String) : BadgesUiState()
    data class Success(...) : BadgesUiState()
}
```

---

### 3. LiveEventsAdapter → LiveEventsScreen

**Adapter Original (93 linhas):**
```kotlin
// RecyclerView com ListAdapter<GameEvent, ViewHolder>
// Sem callbacks
// Binding: ItemGameEventBinding
```

**Tela Compose (LiveEventsScreen.kt - 260 linhas):**
```kotlin
@Composable
fun LiveEventsScreen(
    viewModel: LiveEventsViewModel,
    onEventClick: (eventId: String) -> Unit = {},
    gameId: String = ""
)
```

**Características Implementadas:**
- ✅ LazyColumn com `items(events)`
- ✅ GameEventCard com cores por tipo de evento
- ✅ Ícones Material 3 ao invés de strings
- ✅ Tipo de evento como label (⚽ Gol, 🔄 Substituição, etc)
- ✅ Nome do jogador + assistência
- ✅ Minuto do evento em badge
- ✅ Team badge (T1/T2)
- ✅ AnimatedVisibility para fade in/out
- ✅ Empty state quando sem eventos
- ✅ Auto-refresh via Firestore Flow

**Funções de Utilidade:**
```kotlin
private fun getEventColor(eventType: String): Color
private fun getEventIcon(eventType: String): ImageVector
private fun getEventTypeLabel(eventType: String): String
```

---

### 4. LiveStatsAdapter → LiveStatsScreen

**Adapter Original (88 linhas):**
```kotlin
// RecyclerView com ListAdapter<LivePlayerStats, ViewHolder>
// Sem callbacks
// Binding: ItemLivePlayerStatBinding
```

**Tela Compose (LiveStatsScreen.kt - 354 linhas):**
```kotlin
@Composable
fun LiveStatsScreen(
    viewModel: LiveStatsViewModel,
    onPlayerClick: (playerId: String) -> Unit = {},
    gameId: String = ""
)
```

**Características Implementadas:**
- ✅ LazyColumn com `items(stats)`
- ✅ PlayerStatsCard com avatar circular (inicial do nome)
- ✅ Nome + Posição + Status (SAIU se não jogando)
- ✅ StatBadges em grid (⚽ Gols, 🎯 Assistências, 🧤 Defesas)
- ✅ Cartões amarelos/vermelhos (miniatura)
- ✅ Lógica condicional para mostrar defesas (só goleiro)
- ✅ Condicionais para estatísticas (mostra apenas se > 0)
- ✅ AnimatedVisibility para transições
- ✅ Empty state quando sem jogadores
- ✅ Auto-refresh via Firestore Flow

**Componentes Reutilizáveis:**
```kotlin
@Composable
private fun PlayerStatsCard(...)

@Composable
private fun StatBadge(
    label: String,
    value: String,
    isPrimary: Boolean = false
)
```

---

## Padrão General de Conversão

### 1. Estrutura ViewHolder → Composable
```
RecyclerView.ViewHolder(binding)
    ↓
@Composable
fun ItemCard(data: T, callbacks: Callbacks)
```

### 2. Callbacks
```kotlin
// RecyclerView (callbacks no constructor)
class MyAdapter(
    private val onItemClick: (Item) -> Unit,
    private val onAction: (Item) -> Unit
)

// Compose (callbacks como parameters)
@Composable
fun MyListScreen(
    items: List<Item>,
    onItemClick: (Item) -> Unit,
    onAction: (Item) -> Unit
)
```

### 3. ListAdapter.submitList() → StateFlow
```kotlin
// RecyclerView
adapter.submitList(items)

// Compose
val items by viewModel.items.collectAsStateWithLifecycle()
// ou
val items by viewModel.items.collectAsState()
```

### 4. DiffUtil → Compose @Composable Trailing Lambda Key
```kotlin
// RecyclerView
DiffUtil.ItemCallback<Item>()
    areItemsTheSame(oldItem, newItem) // ID comparison
    areContentsTheSame(oldItem, newItem) // Full comparison

// Compose
items(items, key = { it.id }) { item ->
    ItemCard(item)
}
```

### 5. ViewBinding → Modifier Properties
```kotlin
// RecyclerView
binding.apply {
    tvTitle.text = item.title
    tvTitle.visibility = if (condition) View.VISIBLE else View.GONE
    root.alpha = 0.6f
    root.strokeColor = Color.parseColor("#FFD700")
}

// Compose
Text(text = item.title)
if (condition) { /* composable already visible */ }
modifier = modifier.alpha(0.6f)
// Stroke via: border(width = 4.dp, color = Color(0xFFFFD700))
```

### 6. Loading States

**RecyclerView (Shimmer em separado):**
```kotlin
// Mudar entre adapter real e shimmer adapter
```

**Compose (Built-in):**
```kotlin
when (uiState) {
    is UiState.Loading -> LoadingState()
    is UiState.Success -> ContentState(data)
    is UiState.Error -> ErrorState(error)
}
```

### 7. Conditional Visibility

**RecyclerView:**
```kotlin
binding.llStats.visibility = if (stats.goals > 0) View.VISIBLE else View.GONE
```

**Compose:**
```kotlin
if (stats.goals > 0) {
    StatBadges(stats)
}
// or
if (stats.goals > 0) {
    StatBadges(stats)
} else {
    Spacer(modifier = Modifier.height(24.dp))
}
```

---

## Material Design 3 Substitutions

| RecyclerView | Compose |
|---|---|
| `MaterialCardView` | `Card()` |
| `CircleImageView` | `Surface(shape = CircleShape)` + `Image()` |
| `MaterialButton` | `Button()` or `OutlinedButton()` |
| `drawable` icon | `Icons.Default.*` or `Icons.Filled.*` |
| `strokeColor/strokeWidth` | `border(width, color)` |
| `visibility = GONE` | `if (condition) { Composable() }` |
| `alpha` | `modifier.alpha(0.6f)` |
| `.background()` (XML) | `.background(color, shape)` |
| `setOnClickListener` | `onClick = { ... }` modifier |
| `ListAdapter<T>` | `StateFlow<List<T>>` + `collectAsStateWithLifecycle()` |

---

## Fragmento/Activity Integration

### Antes (RecyclerView + Fragment)
```kotlin
class MyFragment : Fragment() {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val adapter = MyAdapter(
            onItemClick = { },
            onAction = { }
        )
        binding.recyclerView.adapter = adapter
        viewModel.items.observe(viewLifecycleOwner) { items ->
            adapter.submitList(items)
        }
    }
}
```

### Depois (Compose Screen + Fragment)
```kotlin
class MyFragment : Fragment() {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        binding.composeContainer.setContent {
            MyScreen(
                viewModel = viewModel,
                onItemClick = { },
                onAction = { }
            )
        }
    }
}
```

Or in Activity:
```kotlin
setContent {
    FutebaTheme {
        MyScreen(viewModel = viewModel)
    }
}
```

---

## Temas e Cores

### Sistema de Cores Utilizado
Todos os Screens usam:
- `MaterialTheme.colorScheme.primary` (Verde #58CC02)
- `MaterialTheme.colorScheme.secondary`
- `MaterialTheme.colorScheme.tertiary` (Laranja #FF9600)
- `MaterialTheme.colorScheme.error`
- `MaterialTheme.colorScheme.surface`
- `MaterialTheme.colorScheme.background`

### Componentes Reutilizáveis
```
com.futebadosparcas.ui.components.
├── EmptyState (com tipos: NoData, Error)
├── ShimmerListContent
├── ShimmerBox
└── GamificationColors (Gold, Silver, Purple, etc)
```

---

## Performance Optimizations Implementados

### 1. LazyColumn vs LazyVerticalGrid
- **LazyColumn**: Linear lists (notifications, events, stats)
- **LazyVerticalGrid**: Grid layouts (badges 2x columns)

### 2. Key Function
```kotlin
items(items, key = { it.id }) { item ->
    ItemCard(item)
}
// Evita recomposição desnecessária de items que não mudaram
```

### 3. StateFlow com `collectAsStateWithLifecycle()`
```kotlin
val items by viewModel.items.collectAsStateWithLifecycle()
// Cancela coleção quando fragment é parado
// Evita memory leaks
```

### 4. Shimmer em Compose
```kotlin
when (uiState) {
    is Loading -> ShimmerListContent(count = 8) { brush ->
        ItemShimmer(brush)
    }
}
// Built-in via Brush.linearGradient
```

---

## Próximos Adapters a Converter

### Padrão para UserManagementAdapter
```kotlin
// Identificar:
- Que dados: List<User>
- Callbacks: onUserClick, onRemove, onPromote
- Visibilidades: role-based (é admin?)
- Formatação: mostrar role, data join

// Criar:
@Composable
fun UsersList(
    users: List<User>,
    onUserClick: (User) -> Unit,
    onRemove: (User) -> Unit,
    onPromote: (User) -> Unit
) {
    LazyColumn {
        items(users, key = { it.id }) { user ->
            UserCard(user, onUserClick, onRemove, onPromote)
        }
    }
}
```

### Verificação Rápida
1. ✅ Ler adapter original
2. ✅ Identificar ViewHolder binding properties
3. ✅ Identificar callbacks/listeners
4. ✅ Procurar por screen Compose existente
5. ✅ Se não existir, criar usando padrão NotificationsScreen
6. ✅ Testar LazyColumn com items()

---

## Checklist para Conversão de Novo Adapter

- [ ] Adapter encontrado em: `app/src/main/java/com/futebadosparcas/ui/.../[AdapterName].kt`
- [ ] Data model identificado: `data class [Model]`
- [ ] Callbacks listados: `onItemClick()`, `onAction()`, etc
- [ ] Layout XML lido: `item_[model].xml`
- [ ] Screen Compose criado: `[Model]Screen.kt` ou reutilizado existente
- [ ] LazyColumn implementado com `items(data)`
- [ ] Todos os callbacks conectados
- [ ] Visibilidades condicionais convertidas
- [ ] Cores/estilos aplicados com Material 3
- [ ] Loading state com shimmer
- [ ] Empty state quando vazio
- [ ] Testado em emulador
- [ ] Adapter XML removido (delete)

---

## Resultado Final

Ao completar a migração de todos os 4 adapters críticos:

✅ **Vantagens Conquistadas:**
- Código Compose mais conciso (LazyColumn vs ViewHolder boilerplate)
- Recomposição eficiente (apenas items com key alterados)
- Type-safe callbacks (Kotlin DSL)
- Material Design 3 nativo
- Menos arquivos XML (layouts)
- Preview support para UI testing
- Melhor performance com Shimmer nativo

✅ **Código Mais Limpo:**
- Sem ViewBinding necessário
- Sem RecyclerView.ViewHolder subclasses
- Sem DiffUtil callbacks
- Sem `adapter.submitList()` boilerplate

✅ **Manutenibilidade:**
- Tudo em um arquivo `.kt` (Screen + Composables + Utils)
- Fácil refatoração de componentes
- Melhor testabilidade
- Reuso de composables em multiple telas

---

## Referências

- **Arquivo**: `app/src/main/java/com/futebadosparcas/ui/`
- **Adapters Removidos**: Marcar para exclusão após verificação de uso
- **Screens Criados**: Garantir que Fragment/Activity usa `ComposeView.setContent{}`
- **ViewModel**: Já preparados com StateFlow
- **Temas**: `app/src/main/java/com/futebadosparcas/ui/theme/`

---

**Status Final:** 🎯 4/4 Críticos Completos | Próxima Fase: 4 Importantes
