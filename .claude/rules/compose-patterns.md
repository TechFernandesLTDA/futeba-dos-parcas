# Jetpack Compose Patterns

Padrões e boas práticas para Jetpack Compose no projeto.

> **Referência Completa**: Consulte `material3-compose-reference.md` para guia detalhado de Material 3.
> **Fontes Oficiais**: [android/compose-samples](https://github.com/android/compose-samples)

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

### Surface Containers (Hierarquia de Elevação)

```kotlin
// Do mais baixo ao mais alto:
surfaceContainerLowest  // Nível 0
surfaceContainerLow     // Nível 1
surfaceContainer        // Nível 2 (padrão)
surfaceContainerHigh    // Nível 3
surfaceContainerHighest // Nível 4

// Uso em Cards
Card(
    colors = CardDefaults.cardColors(
        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
    )
)
```

### Temas Dinâmicos

```kotlin
val dynamicColor = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
val colorScheme = when {
    dynamicColor && isDark -> dynamicDarkColorScheme(context)
    dynamicColor && !isDark -> dynamicLightColorScheme(context)
    isDark -> DarkColorScheme
    else -> LightColorScheme
}
```

### Cores - NUNCA Hardcode

```kotlin
// CORRETO
color = MaterialTheme.colorScheme.onSurface
tint = MaterialTheme.colorScheme.primary

// ERRADO - Quebra tema escuro!
color = Color.Black
tint = Color.White
```

## Modifiers

- Ordem importa: `clickable` antes de `padding` para área de toque maior
- Usar `Modifier.fillMaxWidth()` antes de `padding`

## Navigation

- Callbacks para navegação (`onNavigateToX: () -> Unit`)
- Verificar `isAdded` no Fragment antes de navegar
