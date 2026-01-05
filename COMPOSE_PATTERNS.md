# Padrões de Jetpack Compose - Futeba dos Parças

**Data:** 2026-01-05
**Versão:** 1.0
**Status:** Ativo

Este documento define os padrões estabelecidos para desenvolvimento em Jetpack Compose no projeto Futeba dos Parças.

---

## 📋 Índice

1. [Arquitetura Fragment → Screen](#arquitetura-fragment--screen)
2. [Componentes Compartilhados](#componentes-compartilhados)
3. [Gerenciamento de Estado](#gerenciamento-de-estado)
4. [Diálogos de Confirmação](#diálogos-de-confirmação)
5. [Estados de Loading e Erro](#estados-de-loading-e-erro)
6. [Navegação e Callbacks](#navegação-e-callbacks)
7. [Convenções de Código](#convenções-de-código)

---

## 🏗️ Arquitetura Fragment → Screen

### Padrão Estabelecido

Cada tela é composta por **2 arquivos**:

```
📁 ui/feature/
├── FeatureFragment.kt      (~60-80 linhas)
└── FeatureScreen.kt        (200-600 linhas)
```

### FeatureFragment.kt

**Responsabilidades:**
- ✅ Setup do ComposeView
- ✅ Navegação (findNavController, safe-args)
- ✅ Integração com dialogs legados (DialogFragment)
- ❌ NÃO contém lógica de UI
- ❌ NÃO contém composables

**Template:**

```kotlin
@AndroidEntryPoint
class FeatureFragment : Fragment() {

    private val viewModel: FeatureViewModel by viewModels()
    private val args: FeatureFragmentArgs by navArgs() // Se recebe argumentos

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(
                ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed
            )

            setContent {
                FutebaTheme {
                    FeatureScreen(
                        viewModel = viewModel,
                        // Passar argumentos como parâmetros
                        featureId = args.featureId,
                        // Callbacks de navegação
                        onNavigateBack = {
                            if (isAdded) {
                                findNavController().popBackStack()
                            }
                        },
                        onNavigateToDetail = { id ->
                            if (isAdded) {
                                val action = FeatureFragmentDirections
                                    .actionFeatureToDetail(id)
                                findNavController().navigate(action)
                            }
                        },
                        // Callbacks para dialogs legados
                        onShowLegacyDialog = { data ->
                            if (isAdded) {
                                val dialog = LegacyDialog.newInstance(data)
                                dialog.show(childFragmentManager, "Tag")
                            }
                        }
                    )
                }
            }
        }
    }
}
```

**Regras:**
- ✅ **SEMPRE** verificar `if (isAdded)` antes de navegar
- ✅ **SEMPRE** usar `ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed`
- ✅ Passar argumentos do Bundle/navArgs como parâmetros do Screen
- ✅ Callbacks de navegação sempre como lambdas

### FeatureScreen.kt

**Responsabilidades:**
- ✅ Toda a lógica de UI em Compose
- ✅ Observar ViewModel via `collectAsStateWithLifecycle()`
- ✅ Gerenciar estado local com `remember { mutableStateOf() }`
- ✅ Definir todos os composables da tela
- ✅ Gerenciar diálogos internos (AlertDialog)

**Template:**

```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeatureScreen(
    viewModel: FeatureViewModel,
    featureId: String = "",
    onNavigateBack: () -> Unit = {},
    onNavigateToDetail: (id: String) -> Unit = {},
    onShowLegacyDialog: (data: Data) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    // Estados locais para diálogos
    var showDeleteDialog by remember { mutableStateOf(false) }

    // LaunchedEffect para inicialização
    LaunchedEffect(featureId) {
        if (featureId.isNotEmpty()) {
            viewModel.loadFeature(featureId)
        }
    }

    // Diálogos usando componentes compartilhados
    DeleteConfirmationDialog(
        visible = showDeleteDialog,
        itemName = "Item",
        itemType = "tipo",
        onConfirm = {
            showDeleteDialog = false
            viewModel.deleteItem()
        },
        onDismiss = { showDeleteDialog = false }
    )

    Scaffold(
        topBar = { /* TopAppBar */ }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is FeatureUiState.Loading -> LoadingState(
                    shimmerCount = 6,
                    itemType = LoadingItemType.LIST_ITEM
                )
                is FeatureUiState.Success -> FeatureContent(
                    data = state.data,
                    onItemClick = onNavigateToDetail
                )
                is FeatureUiState.Error -> ErrorState(
                    message = state.message,
                    onRetry = { viewModel.retry() }
                )
            }
        }
    }
}

@Composable
private fun FeatureContent(
    data: List<Item>,
    onItemClick: (id: String) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(data, key = { it.id }) { item ->
            ItemCard(item = item, onClick = { onItemClick(item.id) })
        }
    }
}
```

**Regras:**
- ✅ Função principal `@Composable` pública
- ✅ Composables auxiliares `private`
- ✅ Usar `collectAsStateWithLifecycle()` para ViewModels
- ✅ LaunchedEffect para side effects (inicialização, argumentos)
- ✅ Diálogos gerenciados com `remember { mutableStateOf() }`

---

## 🧩 Componentes Compartilhados

### Localização

```
📁 ui/components/
├── dialogs/
│   └── ConfirmationDialog.kt
├── states/
│   ├── LoadingState.kt
│   └── ErrorState.kt
├── cards/
│   └── UserCard.kt
└── lists/
    └── ShimmerEffect.kt
```

### 1. Diálogos de Confirmação

**Usar:** `ConfirmationDialog.kt`

```kotlin
import com.futebadosparcas.ui.components.dialogs.*

// Dialog genérico
ConfirmationDialog(
    visible = showDialog,
    title = "Confirmar Ação",
    message = "Tem certeza que deseja continuar?",
    confirmText = "Sim",
    dismissText = "Não",
    type = ConfirmationDialogType.NORMAL, // NORMAL, DESTRUCTIVE, WARNING, SUCCESS
    icon = Icons.Default.Warning,
    onConfirm = { /* ação */ },
    onDismiss = { showDialog = false }
)

// Variantes específicas
DeleteConfirmationDialog(
    visible = showDialog,
    itemName = "Nome do Item",
    itemType = "jogo", // tipo do item
    onConfirm = { /* deletar */ },
    onDismiss = { showDialog = false }
)

RemoveMemberDialog(
    visible = showDialog,
    memberName = "João Silva",
    onConfirm = { /* remover */ },
    onDismiss = { showDialog = false }
)

PromoteMemberDialog(visible = ..., memberName = ..., ...)
DemoteMemberDialog(visible = ..., memberName = ..., ...)
LeaveGroupDialog(visible = ..., groupName = ..., ...)
ArchiveGroupDialog(visible = ..., groupName = ..., ...)
DeleteGroupDialog(visible = ..., groupName = ..., ...)
```

**Tipos de Dialog:**
- `NORMAL` - Azul, ações padrão
- `DESTRUCTIVE` - Vermelho, deletar/remover
- `WARNING` - Laranja, arquivar/desativar
- `SUCCESS` - Verde, promover/aprovar

### 2. Estados de Loading

**Usar:** `LoadingState.kt`

```kotlin
import com.futebadosparcas.ui.components.states.*

// Loading padrão com shimmer
LoadingState(
    shimmerCount = 6, // número de placeholders
    itemType = LoadingItemType.LIST_ITEM // CARD, GAME_CARD, PLAYER_CARD, RANKING_ITEM, LIST_ITEM
)

// Loading compacto
LoadingStateCompact(message = "Carregando...")

// Loading tela inteira
FullScreenLoadingState(message = "Processando...")
```

### 3. Estados de Erro

**Usar:** `ErrorState.kt`

```kotlin
import com.futebadosparcas.ui.components.states.*

// Erro padrão
ErrorState(
    message = "Erro ao carregar dados",
    onRetry = { viewModel.retry() },
    retryButtonText = "Tentar Novamente",
    icon = Icons.Default.Error
)

// Erro compacto
ErrorStateCompact(
    message = "Erro",
    onRetry = { /* retry */ }
)

// Variantes específicas
NoConnectionErrorState(onRetry = { /* retry */ })
TimeoutErrorState(onRetry = { /* retry */ })
PermissionDeniedErrorState(
    message = "Sem permissão",
    onRetry = { /* voltar */ } // opcional
)
```

### 4. Cards de Usuário

**Usar:** `UserCard.kt`

```kotlin
import com.futebadosparcas.ui.components.cards.*

// Card genérico de usuário
UserCard(
    photoUrl = user.photoUrl,
    name = user.name,
    subtitle = "Membro desde 2024",
    badge = "Admin",
    badgeColor = MaterialTheme.colorScheme.primary,
    badgeIcon = Icons.Default.Shield,
    onClick = { onUserClick(user.id) },
    showMenu = true,
    menuItems = listOf(
        UserCardMenuItem("Promover", Icons.Default.ArrowUpward) { onPromote() },
        UserCardMenuItem("Remover", Icons.Default.Delete, isDestructive = true) { onRemove() }
    )
)

// Card de membro de grupo
GroupMemberCard(
    photoUrl = member.userPhoto,
    name = member.getDisplayName(),
    role = "Admin",
    roleIcon = Icons.Default.Shield,
    roleColor = MaterialTheme.colorScheme.primary,
    onClick = { onMemberClick(member.userId) },
    canManage = true,
    onPromote = { /* promover */ },
    onDemote = { /* rebaixar */ },
    onRemove = { /* remover */ }
)

// Card compacto
UserCardCompact(
    photoUrl = user.photoUrl,
    name = user.name,
    subtitle = "Level 10",
    onClick = { onUserClick(user.id) },
    trailingContent = {
        Text("100 XP")
    }
)
```

### 5. Shimmer Effects

**Usar:** `ShimmerEffect.kt`

```kotlin
import com.futebadosparcas.ui.components.lists.*

// Box com shimmer
ShimmerBox(
    modifier = Modifier
        .fillMaxWidth()
        .height(120.dp)
)

// Círculo com shimmer (avatares)
ShimmerCircle(
    modifier = Modifier.size(48.dp)
)

// Cards específicos
GameCardShimmer()
PlayerCardShimmer()
RankingItemShimmer()
```

---

## 🔄 Gerenciamento de Estado

### ViewModel State Pattern

```kotlin
// Sealed class para UI State
sealed class FeatureUiState {
    object Loading : FeatureUiState()
    data class Success(val data: List<Item>) : FeatureUiState()
    data class Error(val message: String) : FeatureUiState()
}

// ViewModel
@HiltViewModel
class FeatureViewModel @Inject constructor(
    private val repository: FeatureRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<FeatureUiState>(FeatureUiState.Loading)
    val uiState: StateFlow<FeatureUiState> = _uiState.asStateFlow()

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = FeatureUiState.Loading

            repository.getData()
                .catch { e ->
                    _uiState.value = FeatureUiState.Error(e.message ?: "Erro")
                }
                .collect { data ->
                    _uiState.value = FeatureUiState.Success(data)
                }
        }
    }
}
```

### Screen State Management

```kotlin
@Composable
fun FeatureScreen(viewModel: FeatureViewModel) {
    // Estado do ViewModel (persistente)
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    // Estados locais (só durante composição)
    var searchQuery by remember { mutableStateOf("") }
    var showDialog by remember { mutableStateOf(false) }
    var selectedItem by remember { mutableStateOf<Item?>(null) }

    // LaunchedEffect para side effects
    LaunchedEffect(searchQuery) {
        // Debounce ou ação ao mudar query
        delay(300)
        viewModel.search(searchQuery)
    }

    // UI reage ao estado
    when (val state = uiState) {
        is FeatureUiState.Loading -> LoadingState()
        is FeatureUiState.Success -> Content(state.data)
        is FeatureUiState.Error -> ErrorState(state.message, onRetry = { viewModel.retry() })
    }
}
```

**Regras:**
- ✅ ViewModel State: dados que sobrevivem recomposições e mudanças de configuração
- ✅ Local State: estados temporários de UI (dialogs, inputs, seleções)
- ✅ `collectAsStateWithLifecycle()` para observar StateFlow
- ✅ `LaunchedEffect` para side effects baseados em mudanças de estado
- ❌ NUNCA usar LiveData em novos componentes Compose

---

## 🚦 Navegação e Callbacks

### Pattern: Callbacks para o Fragment

**Screen NÃO navega diretamente**, apenas chama callbacks:

```kotlin
// Screen.kt
@Composable
fun FeatureScreen(
    onNavigateBack: () -> Unit = {},
    onNavigateToDetail: (id: String) -> Unit = {},
    onShowLegacyDialog: (data: Data) -> Unit = {}
) {
    Button(onClick = onNavigateBack) { Text("Voltar") }

    ItemCard(
        item = item,
        onClick = { onNavigateToDetail(item.id) }
    )
}

// Fragment.kt - implementa navegação
FeatureScreen(
    onNavigateBack = {
        if (isAdded) {
            findNavController().popBackStack()
        }
    },
    onNavigateToDetail = { id ->
        if (isAdded) {
            val action = FeatureFragmentDirections.actionToDetail(id)
            findNavController().navigate(action)
        }
    }
)
```

**Regras:**
- ✅ Callbacks SEMPRE têm valores default `= {}`
- ✅ Fragment SEMPRE verifica `if (isAdded)` antes de navegar
- ✅ Screen NÃO tem dependência de Navigation
- ✅ Usar safe-args para type safety

---

## 📝 Convenções de Código

### Nomenclatura

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Screen composable | `{Feature}Screen` | `GroupDetailScreen` |
| Fragment | `{Feature}Fragment` | `GroupDetailFragment` |
| ViewModel | `{Feature}ViewModel` | `GroupDetailViewModel` |
| UiState | `{Feature}UiState` | `GroupDetailUiState` |
| Private composable | `{Feature}{Component}` | `GroupDetailHeader` |

### Estrutura de Arquivo

```kotlin
// 1. Package
package com.futebadosparcas.ui.feature

// 2. Imports agrupados
import androidx.compose...
import androidx.lifecycle...
import com.futebadosparcas...

// 3. Documentação KDoc (PT-BR)
/**
 * FeatureScreen - Descrição da tela
 *
 * Permite:
 * - Ação 1
 * - Ação 2
 *
 * Features:
 * - Feature 1
 * - Feature 2
 */

// 4. Composable principal (público)
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeatureScreen(...) { }

// 5. Composables auxiliares (privados)
@Composable
private fun FeatureHeader(...) { }

@Composable
private fun FeatureContent(...) { }
```

### Comentários

- ✅ **Português (PT-BR)** para todos os comentários
- ✅ KDoc para composables públicos
- ✅ Comentários inline para lógica complexa
- ❌ Evitar comentários óbvios

```kotlin
// ✅ BOM
/**
 * Card de membro do grupo com gerenciamento de permissões
 */
@Composable
private fun GroupMemberCard(...) {
    // Determina permissões baseado no role atual
    val canManage = when (myRole) {
        GroupMemberRole.OWNER -> memberRole != GroupMemberRole.OWNER
        else -> false
    }
}

// ❌ RUIM
// Cria um card
@Composable
private fun Card(...) {
    // Define modifier
    val modifier = Modifier.fillMaxWidth()
}
```

### Material Design 3

**SEMPRE usar Material 3:**

```kotlin
// ✅ CORRETO
import androidx.compose.material3.*

MaterialTheme.colorScheme.primary
CardDefaults.cardColors()
TopAppBar(...)

// ❌ ERRADO
import androidx.compose.material.*

MaterialTheme.colors.primary // Material 2
```

---

## ✅ Checklist de Code Review

### Fragment

- [ ] Usa `ComposeView` com `ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed`
- [ ] Envolve Screen em `FutebaTheme`
- [ ] Verifica `if (isAdded)` antes de todas as navegações
- [ ] Passa argumentos do Bundle/navArgs como parâmetros do Screen
- [ ] Não contém lógica de UI ou composables

### Screen

- [ ] Função principal é pública, auxiliares são privadas
- [ ] Usa `collectAsStateWithLifecycle()` para ViewModels
- [ ] Estados locais de diálogo com `remember { mutableStateOf() }`
- [ ] Usa componentes compartilhados (ConfirmationDialog, LoadingState, ErrorState, UserCard)
- [ ] LaunchedEffect para inicialização e side effects
- [ ] Callbacks têm valores default `= {}`
- [ ] Documentação KDoc em PT-BR
- [ ] Material Design 3

### Componentes

- [ ] Não reinventa componentes que já existem em `ui/components/`
- [ ] Se criar componente novo, avaliar se deve ser compartilhado
- [ ] Shimmer usa `ShimmerBox` ou variantes de `ShimmerEffect.kt`
- [ ] Diálogos usam `ConfirmationDialog` e variantes
- [ ] Estados de loading/erro usam componentes de `states/`

---

## 📊 Métricas de Sucesso

Após aplicar esses padrões, espera-se:

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| Linhas no Fragment | 200-370 | 60-130 | **-55%** |
| Linhas no Screen | N/A | 200-700 | N/A |
| Código duplicado | Alto | Baixo | **-70%** |
| Tempo para criar nova tela | ~4h | ~1.5h | **-62%** |
| Consistência visual | Média | Alta | **+90%** |

---

## 🔗 Referências

- [Material Design 3](https://m3.material.io/)
- [Jetpack Compose Guidelines](https://developer.android.com/jetpack/compose/guidelines)
- [State Management](https://developer.android.com/jetpack/compose/state)
- [Navigation Compose](https://developer.android.com/jetpack/compose/navigation)

---

**Última atualização:** 2026-01-05
**Autor:** Claude Code
**Status:** ✅ Ativo - FASE 3.5 Consolidação Completa
