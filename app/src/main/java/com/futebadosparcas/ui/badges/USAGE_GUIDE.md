# Guia de Uso - BadgesScreen

## 🚀 Quick Start

### Uso Básico no Fragment
```kotlin
import androidx.compose.ui.platform.ComposeView
import com.futebadosparcas.ui.badges.BadgesScreen
import com.futebadosparcas.ui.theme.FutebaTheme

// No Fragment
override fun onCreateView(...): View {
    return ComposeView(requireContext()).apply {
        setContent {
            FutebaTheme {
                BadgesScreen()
            }
        }
    }
}
```

### Uso com ViewModel Customizado
```kotlin
@AndroidEntryPoint
class BadgesFragment : Fragment() {
    private val viewModel: BadgesViewModel by viewModels()

    override fun onCreateView(...): View {
        return ComposeView(requireContext()).apply {
            setContent {
                FutebaTheme {
                    BadgesScreen(
                        viewModel = viewModel,
                        onBackClick = { /* navegação */ }
                    )
                }
            }
        }
    }
}
```

### Uso em Navigation Compose
```kotlin
@Composable
fun BadgesRoute(
    navController: NavController,
    viewModel: BadgesViewModel = hiltViewModel()
) {
    BadgesScreen(
        viewModel = viewModel,
        onBackClick = { navController.popBackStack() }
    )
}

// No NavHost
composable("badges") {
    BadgesRoute(navController)
}
```

---

## 🎨 Personalização

### Ocultar Botão de Voltar
```kotlin
BadgesScreen(
    onBackClick = null // Oculta o botão
)
```

### Com Ação de Voltar
```kotlin
BadgesScreen(
    onBackClick = {
        // Sua lógica personalizada
        navController.popBackStack()
        // ou
        requireActivity().onBackPressed()
    }
)
```

---

## 🧩 Componentes Reutilizáveis

### Badge Progress Header
```kotlin
import com.futebadosparcas.ui.badges.BadgeProgressHeader

BadgeProgressHeader(
    totalUnlocked = 5,
    totalAvailable = 11
)
```

### Badge Card Individual
```kotlin
import com.futebadosparcas.ui.badges.BadgeCard

val badgeData = BadgeWithData(
    userBadge = UserBadge(...),
    badge = Badge(...)
)

BadgeCard(
    badgeWithData = badgeData,
    onClick = { /* ação ao clicar */ }
)
```

### Badge Detail Dialog
```kotlin
import com.futebadosparcas.ui.badges.BadgeDetailDialog

var selectedBadge by remember { mutableStateOf<BadgeWithData?>(null) }

selectedBadge?.let { badge ->
    BadgeDetailDialog(
        badgeWithData = badge,
        onDismiss = { selectedBadge = null }
    )
}
```

---

## 🎭 Estados da UI

### Estado de Loading
```kotlin
// Automaticamente exibido quando:
uiState = BadgesUiState.Loading

// Shimmer effect é aplicado automaticamente
```

### Estado de Sucesso
```kotlin
// Exibido quando há dados:
uiState = BadgesUiState.Success(
    allBadges = listOf(...),
    filteredBadges = listOf(...),
    totalUnlocked = 5,
    selectedCategory = null
)
```

### Estado de Erro
```kotlin
// Exibido em caso de falha:
uiState = BadgesUiState.Error("Mensagem de erro")

// Botão de retry chama:
viewModel.loadBadges()
```

### Empty State
```kotlin
// Automaticamente exibido quando:
filteredBadges.isEmpty()

// Com mensagem diferenciada se:
- Nenhuma badge conquistada
- Filtro sem resultados
```

---

## 🎨 Temas e Cores

### Uso com Tema Claro/Escuro
```kotlin
FutebaTheme(darkTheme = isSystemInDarkTheme()) {
    BadgesScreen()
}
```

### Cores Customizadas (se necessário)
```kotlin
// As cores já são definidas pelo tema Material3
// Mas podem ser sobrescritas:

MaterialTheme(
    colorScheme = CustomColorScheme,
    typography = FutebaTypography
) {
    BadgesScreen()
}
```

---

## 🔄 Filtros

### Filtrar por Categoria
```kotlin
// Programaticamente:
viewModel.filterByCategory(BadgeCategory.PERFORMANCE)
viewModel.filterByCategory(BadgeCategory.PRESENCA)
viewModel.filterByCategory(BadgeCategory.COMUNIDADE)
viewModel.filterByCategory(BadgeCategory.NIVEL)

// Remover filtro (todas):
viewModel.filterByCategory(null)
```

### Categorias Disponíveis
```kotlin
enum class BadgeCategory(val displayName: String) {
    PERFORMANCE("Desempenho"),    // ⚽
    PRESENCA("Presença"),          // 📅
    COMUNIDADE("Comunidade"),      // 👥
    NIVEL("Nível")                 // 🏆
}
```

---

## 🎯 Callbacks e Eventos

### Clicar em Badge
```kotlin
// Automaticamente abre o dialog de detalhes
// Internamente gerenciado pelo componente

// Se precisar customizar:
var selectedBadge by remember { mutableStateOf<BadgeWithData?>(null) }

BadgesGrid(
    badges = badges,
    onBadgeClick = { badge ->
        selectedBadge = badge
        // Sua lógica adicional aqui
        analytics.logEvent("badge_clicked", badge.badge.id)
    }
)
```

### Retry após Erro
```kotlin
// Automaticamente chama:
viewModel.loadBadges()

// Se precisar customizar o retry:
BadgesErrorState(
    message = "Erro personalizado",
    onRetry = {
        // Sua lógica de retry
        viewModel.loadBadges()
        analytics.logEvent("badges_retry")
    }
)
```

---

## 🧪 Testing

### Teste de UI com Compose
```kotlin
@get:Rule
val composeTestRule = createComposeRule()

@Test
fun badgesScreen_displaysProgress() {
    composeTestRule.setContent {
        FutebaTheme {
            BadgesScreen()
        }
    }

    composeTestRule
        .onNodeWithText("Seu Progresso")
        .assertIsDisplayed()
}
```

### Teste de Estados
```kotlin
@Test
fun badgesScreen_showsLoading() {
    val viewModel = FakeBadgesViewModel(
        initialState = BadgesUiState.Loading
    )

    composeTestRule.setContent {
        BadgesScreen(viewModel = viewModel)
    }

    // Verifica shimmer
    composeTestRule
        .onNode(hasTestTag("shimmer"))
        .assertIsDisplayed()
}

@Test
fun badgesScreen_showsError() {
    val viewModel = FakeBadgesViewModel(
        initialState = BadgesUiState.Error("Test error")
    )

    composeTestRule.setContent {
        BadgesScreen(viewModel = viewModel)
    }

    composeTestRule
        .onNodeWithText("Test error")
        .assertIsDisplayed()

    composeTestRule
        .onNodeWithText("Tentar Novamente")
        .assertIsDisplayed()
}
```

---

## 📱 Previews no Android Studio

### Executar Previews
1. Abra `BadgesScreen.kt`
2. Localize `@Preview` functions
3. Clique em "Run Preview" ou use o painel de Previews

### Previews Disponíveis
```kotlin
@Preview BadgeProgressHeaderPreview()
@Preview BadgeCardPreview()
@Preview BadgesLoadingStatePreview()
```

### Criar Preview Customizada
```kotlin
@Preview(showBackground = true, name = "Badge Grid")
@Composable
private fun BadgesGridPreview() {
    FutebaTheme {
        val sampleBadges = List(6) { index ->
            BadgeWithData(
                userBadge = UserBadge(id = "$index", ...),
                badge = Badge(id = "$index", ...)
            )
        }

        BadgesGrid(
            badges = sampleBadges,
            onBadgeClick = {}
        )
    }
}
```

---

## ⚡ Performance Tips

### 1. Recomposição Otimizada
```kotlin
// ✅ BOM: Usar key no LazyGrid
items(badges, key = { it.badge.id }) { badge ->
    BadgeCard(...)
}

// ❌ EVITAR: Sem key
items(badges) { badge ->
    BadgeCard(...)
}
```

### 2. Estados Derivados
```kotlin
// ✅ BOM: Usar remember para cálculos
val percentage = remember(totalUnlocked, totalAvailable) {
    (totalUnlocked.toFloat() / totalAvailable * 100).toInt()
}

// ❌ EVITAR: Calcular diretamente
Text("${(totalUnlocked.toFloat() / totalAvailable * 100).toInt()}%")
```

### 3. Lifecycle Awareness
```kotlin
// ✅ BOM: collectAsStateWithLifecycle
val uiState by viewModel.uiState.collectAsStateWithLifecycle()

// ❌ EVITAR: collectAsState (não lifecycle-aware)
val uiState by viewModel.uiState.collectAsState()
```

---

## 🐛 Troubleshooting

### Badge não aparece no grid
```kotlin
// Verifique:
1. Badge está na lista filteredBadges?
2. Categoria selecionada está correta?
3. Badge tem ID único?

// Debug:
println("Filtered badges: ${state.filteredBadges.size}")
```

### Shimmer não anima
```kotlin
// Verifique:
1. Estado é BadgesUiState.Loading?
2. Compose está renderizando?

// Debug:
LaunchedEffect(uiState) {
    println("UI State: $uiState")
}
```

### Dialog não fecha
```kotlin
// Verifique:
1. onDismiss está sendo chamado?
2. Estado selectedBadge é atualizado?

// Correto:
BadgeDetailDialog(
    badgeWithData = badge,
    onDismiss = { selectedBadge = null } // ✅
)

// Incorreto:
onDismiss = {} // ❌ Não atualiza estado
```

### Cores estranhas
```kotlin
// Verifique:
1. FutebaTheme está aplicado?
2. MaterialTheme está correto?

// Correto:
FutebaTheme {
    BadgesScreen()
}

// Incorreto:
BadgesScreen() // ❌ Sem tema
```

---

## 🔧 Customização Avançada

### Modificar Grid Columns
```kotlin
// Edite em BadgesGrid:
LazyVerticalGrid(
    columns = GridCells.Fixed(3), // Era 2, agora 3
    ...
)
```

### Alterar Animação de Entrada
```kotlin
// Edite em BadgeCard:
AnimatedVisibility(
    enter = fadeIn() + slideInVertically(), // Customizado
    exit = fadeOut() + slideOutVertically()
)
```

### Adicionar Novo Filtro
```kotlin
// 1. Adicione no enum BadgeCategory
enum class BadgeCategory {
    ...,
    NOVA_CATEGORIA("Nova")
}

// 2. Adicione mapeamento em getCategoryForBadgeType
private fun getCategoryForBadgeType(type: BadgeType): BadgeCategory {
    return when (type) {
        ...,
        BadgeType.NOVO_TIPO -> BadgeCategory.NOVA_CATEGORIA
    }
}

// 3. Adicione emoji em getCategoryEmoji
private fun getCategoryEmoji(category: BadgeCategory): String {
    return when (category) {
        ...,
        BadgeCategory.NOVA_CATEGORIA -> "🆕"
    }
}
```

---

## 📚 Referências Rápidas

### Imports Necessários
```kotlin
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import com.futebadosparcas.ui.badges.BadgesScreen
import com.futebadosparcas.ui.theme.FutebaTheme
import androidx.hilt.navigation.compose.hiltViewModel
```

### Dependencies (build.gradle.kts)
```kotlin
// Já incluídas no projeto:
implementation("androidx.compose.ui:ui")
implementation("androidx.compose.material3:material3")
implementation("androidx.lifecycle:lifecycle-runtime-compose")
implementation("androidx.hilt:hilt-navigation-compose")
```

---

## ✨ Exemplos Completos

### Exemplo 1: Fragment Simples
```kotlin
@AndroidEntryPoint
class BadgesFragment : Fragment() {
    override fun onCreateView(...): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(
                ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed
            )
            setContent {
                FutebaTheme {
                    BadgesScreen()
                }
            }
        }
    }
}
```

### Exemplo 2: Com Analytics
```kotlin
@AndroidEntryPoint
class BadgesFragment : Fragment() {
    private val viewModel: BadgesViewModel by viewModels()
    private val analytics: FirebaseAnalytics by inject()

    override fun onCreateView(...): View {
        return ComposeView(requireContext()).apply {
            setContent {
                FutebaTheme {
                    BadgesScreen(
                        viewModel = viewModel,
                        onBackClick = {
                            analytics.logEvent("badges_back", null)
                            requireActivity().onBackPressed()
                        }
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        analytics.logScreenView("badges_screen")
    }
}
```

### Exemplo 3: Navigation Compose
```kotlin
@Composable
fun AppNavGraph(navController: NavHostController) {
    NavHost(navController, startDestination = "home") {
        composable("badges") {
            BadgesScreen(
                onBackClick = { navController.popBackStack() }
            )
        }
    }
}
```

---

**Última atualização**: 2026-01-05
**Versão**: 1.0.0
**Projeto**: Futeba dos Parças
