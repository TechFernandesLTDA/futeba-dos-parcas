# Jetpack Compose Patterns

Padrões e boas práticas para Jetpack Compose no projeto.

## Estrutura de Telas

```kotlin
// Screen = Composable stateful que recebe ViewModel
@Composable
fun FeatureScreen(
    viewModel: FeatureViewModel,
    onNavigate: (destination: String) -> Unit = {}
)

// Content = Composable stateless para preview/teste
@Composable
private fun FeatureContent(
    state: FeatureUiState,
    onAction: (FeatureAction) -> Unit
)
```

## State Management

- Usar `collectAsStateWithLifecycle()` para StateFlows
- Usar `remember {}` para cálculos caros
- Usar `key` em `items()` de LazyColumn/LazyRow

## Performance

- **NUNCA** aninhar LazyVerticalGrid dentro de LazyColumn
- Usar `FlowRow` para grids dentro de LazyColumn
- Adicionar `@OptIn(ExperimentalLayoutApi::class)` para FlowRow
- Evitar recomposições desnecessárias com `derivedStateOf`

## Material Design 3

- Usar componentes Material3 (`androidx.compose.material3.*`)
- `HorizontalDivider` em vez de `Divider` (deprecated)
- `PullToRefreshBox` em vez de `SwipeRefresh` (deprecated)
- `Icons.AutoMirrored.Filled.*` para ícones direcionais (Back, Forward, etc.)

## Modifiers

- Ordem importa: `clickable` antes de `padding` para área de toque maior
- Usar `Modifier.fillMaxWidth()` antes de `padding`

## Navigation

- Callbacks para navegação (`onNavigateToX: () -> Unit`)
- Verificar `isAdded` no Fragment antes de navegar
