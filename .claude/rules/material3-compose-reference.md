# Material 3 & Jetpack Compose - Guia de Referência Oficial

> **Fontes Oficiais de Referência**
> - [android/compose-samples](https://github.com/android/compose-samples) - Exemplos oficiais do Google
> - [Codelab: Temas no Compose com Material 3](https://codelabs.developers.google.com/jetpack-compose-theming)
> - [Material Design 3 no Compose](https://developer.android.com/develop/ui/compose/designsystems/material3)
> - [Material 3 Guidelines](https://m3.material.io/)

**IMPORTANTE**: Este documento é a referência principal para implementação de UI no projeto. Sempre consulte estas diretrizes antes de criar ou modificar componentes Compose.

---

## 1. Configuração de Dependências (2025)

```kotlin
dependencies {
    // BOM para versões consistentes
    implementation(platform("androidx.compose:compose-bom:2025.06.00"))

    // Material 3
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material3:material3-window-size-class")
    implementation("androidx.compose.material3:material3-adaptive-navigation-suite")
}
```

---

## 2. Sistema de Cores (ColorScheme)

### Estrutura Completa do ColorScheme

O Material 3 usa um sistema de cores baseado em **funções (roles)**, não valores fixos.

```kotlin
private val LightColorScheme = lightColorScheme(
    // Cores Primárias - Para elementos principais (FABs, botões principais)
    primary = primaryLight,
    onPrimary = onPrimaryLight,
    primaryContainer = primaryContainerLight,
    onPrimaryContainer = onPrimaryContainerLight,

    // Cores Secundárias - Para elementos menos proeminentes
    secondary = secondaryLight,
    onSecondary = onSecondaryLight,
    secondaryContainer = secondaryContainerLight,
    onSecondaryContainer = onSecondaryContainerLight,

    // Cores Terciárias - Para tons contrastantes
    tertiary = tertiaryLight,
    onTertiary = onTertiaryLight,
    tertiaryContainer = tertiaryContainerLight,
    onTertiaryContainer = onTertiaryContainerLight,

    // Cores de Erro
    error = errorLight,
    onError = onErrorLight,
    errorContainer = errorContainerLight,
    onErrorContainer = onErrorContainerLight,

    // Cores de Superfície (NOVO no M3!)
    background = backgroundLight,
    onBackground = onBackgroundLight,
    surface = surfaceLight,
    onSurface = onSurfaceLight,
    surfaceVariant = surfaceVariantLight,
    onSurfaceVariant = onSurfaceVariantLight,

    // Surface Containers - Hierarquia de elevação (NOVO!)
    surfaceDim = surfaceDimLight,
    surfaceBright = surfaceBrightLight,
    surfaceContainerLowest = surfaceContainerLowestLight,
    surfaceContainerLow = surfaceContainerLowLight,
    surfaceContainer = surfaceContainerLight,
    surfaceContainerHigh = surfaceContainerHighLight,
    surfaceContainerHighest = surfaceContainerHighestLight,

    // Utilitários
    outline = outlineLight,
    outlineVariant = outlineVariantLight,
    scrim = scrimLight,
    inverseSurface = inverseSurfaceLight,
    inverseOnSurface = inverseOnSurfaceLight,
    inversePrimary = inversePrimaryLight,
)
```

### Funções de Cor - Quando Usar

| Token | Uso | Exemplos |
|-------|-----|----------|
| `primary` | Cor principal da marca, CTAs | FABs, botões importantes |
| `onPrimary` | Texto/ícones sobre primary | Texto no botão primário |
| `primaryContainer` | Containers destacados | Cards de destaque, chips selecionados |
| `onPrimaryContainer` | Texto sobre primaryContainer | Texto em cards destacados |
| `secondary` | Ações secundárias | Filtros, ações menos importantes |
| `tertiary` | Contraste/destaque especial | Badges, elementos especiais |
| `surface` | Backgrounds de componentes | Cards, Dialogs, BottomSheets |
| `onSurface` | Texto/ícones em superfícies | A maioria do texto e ícones |
| `surfaceVariant` | Backgrounds sutis | Dividers, estados desabilitados |
| `onSurfaceVariant` | Texto de baixa ênfase | Captions, placeholders |
| `surfaceContainer*` | Hierarquia de elevação | Cards com diferentes níveis |
| `error` | Estados de erro | Mensagens de erro, ações destrutivas |
| `outline` | Bordas e divisores | Bordas de campos, separadores |

### Surface Containers - Hierarquia de Elevação

```kotlin
// Do mais baixo ao mais alto
surfaceContainerLowest  // Nível 0 - Base
surfaceContainerLow     // Nível 1
surfaceContainer        // Nível 2 - Padrão
surfaceContainerHigh    // Nível 3
surfaceContainerHighest // Nível 4 - Mais elevado

// Uso em Cards com hierarquia
Card(
    colors = CardDefaults.cardColors(
        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
    )
)
```

---

## 3. Tema Dinâmico (Dynamic Theming)

### Implementação Completa

```kotlin
@Composable
fun AppTheme(
    useDarkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val context = LocalContext.current

    val colorScheme = when {
        // Cores dinâmicas (Android 12+)
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            if (useDarkTheme) dynamicDarkColorScheme(context)
            else dynamicLightColorScheme(context)
        }
        // Fallback para cores estáticas
        useDarkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    // Cor da status bar
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view)
                .isAppearanceLightStatusBars = !useDarkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = AppTypography,
        shapes = AppShapes,
        content = content
    )
}
```

### Suporte a Contraste (Android 14+)

```kotlin
@Composable
fun selectSchemeForContrast(isDark: Boolean): ColorScheme {
    val context = LocalContext.current

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        val uiModeManager = context.getSystemService(Context.UI_MODE_SERVICE) as UiModeManager
        val contrastLevel = uiModeManager.contrast

        return when (contrastLevel) {
            in 0.0f..0.33f -> if (isDark) darkScheme else lightScheme
            in 0.34f..0.66f -> if (isDark) mediumContrastDarkScheme else mediumContrastLightScheme
            in 0.67f..1.0f -> if (isDark) highContrastDarkScheme else highContrastLightScheme
            else -> if (isDark) darkScheme else lightScheme
        }
    }

    return if (isDark) darkScheme else lightScheme
}
```

---

## 4. Tipografia (Typography)

### Escala de Tipos do Material 3

```kotlin
val AppTypography = Typography(
    // Display - Para hero content
    displayLarge = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 57.sp,
        lineHeight = 64.sp,
        letterSpacing = (-0.25).sp,
    ),
    displayMedium = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 45.sp,
        lineHeight = 52.sp,
        letterSpacing = 0.sp,
    ),
    displaySmall = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 36.sp,
        lineHeight = 44.sp,
        letterSpacing = 0.sp,
    ),

    // Headline - Para títulos de seções
    headlineLarge = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 32.sp,
        lineHeight = 40.sp,
        letterSpacing = 0.sp,
    ),
    headlineMedium = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 28.sp,
        lineHeight = 36.sp,
        letterSpacing = 0.sp,
    ),
    headlineSmall = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp,
        lineHeight = 32.sp,
        letterSpacing = 0.sp,
    ),

    // Title - Para títulos de componentes
    titleLarge = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        letterSpacing = 0.sp,
    ),
    titleMedium = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.15.sp,
    ),
    titleSmall = TextStyle(
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.1.sp,
    ),

    // Body - Para conteúdo principal
    bodyLarge = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.15.sp,
    ),
    bodyMedium = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.25.sp,
    ),
    bodySmall = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.4.sp,
    ),

    // Label - Para botões, chips, etc.
    labelLarge = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.1.sp,
    ),
    labelMedium = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp,
    ),
    labelSmall = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp,
    ),
)
```

### Uso Correto

```kotlin
// Título de seção
Text(
    text = "Próximos Jogos",
    style = MaterialTheme.typography.headlineSmall,
    color = MaterialTheme.colorScheme.onSurface
)

// Título de card
Text(
    text = game.title,
    style = MaterialTheme.typography.titleMedium,
    color = MaterialTheme.colorScheme.onSurface
)

// Corpo do texto
Text(
    text = game.description,
    style = MaterialTheme.typography.bodyMedium,
    color = MaterialTheme.colorScheme.onSurfaceVariant
)

// Label/caption
Text(
    text = "há 2 horas",
    style = MaterialTheme.typography.labelSmall,
    color = MaterialTheme.colorScheme.onSurfaceVariant
)
```

---

## 5. Formas (Shapes)

### Definição de Shapes

```kotlin
val AppShapes = Shapes(
    // Para elementos pequenos (chips, badges)
    extraSmall = RoundedCornerShape(4.dp),

    // Para botões, campos de texto
    small = RoundedCornerShape(8.dp),

    // Para cards, dialogs
    medium = RoundedCornerShape(16.dp),

    // Para bottom sheets, navigation drawers
    large = RoundedCornerShape(24.dp),

    // Para elementos full-width
    extraLarge = RoundedCornerShape(32.dp),
)
```

### Formas Especiais

```kotlin
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RectangleShape
import androidx.compose.foundation.shape.CutCornerShape

// Circular
Box(modifier = Modifier.background(color, CircleShape))

// Retangular
Box(modifier = Modifier.background(color, RectangleShape))

// Cantos cortados
Box(modifier = Modifier.background(color, CutCornerShape(8.dp)))
```

### Aplicação em Componentes

```kotlin
// Card com shape do tema
Card(shape = MaterialTheme.shapes.medium) { }

// FAB com shape personalizado
FloatingActionButton(
    shape = MaterialTheme.shapes.large
) { }

// Background com shape
Row(
    modifier = Modifier
        .background(
            MaterialTheme.colorScheme.surface,
            MaterialTheme.shapes.medium
        )
        .padding(16.dp)
)
```

---

## 6. Componentes Material 3 - Boas Práticas

### Cards

```kotlin
@Composable
fun GameCard(game: Game, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = 2.dp,
            pressedElevation = 4.dp
        ),
        onClick = onClick
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = game.title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = game.description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
```

### Floating Action Button

```kotlin
// FAB padrão
FloatingActionButton(
    onClick = { },
    containerColor = MaterialTheme.colorScheme.primaryContainer,
    contentColor = MaterialTheme.colorScheme.onPrimaryContainer
) {
    Icon(Icons.Default.Add, contentDescription = null)
}

// Extended FAB
ExtendedFloatingActionButton(
    onClick = { },
    text = { Text("Criar Jogo") },
    icon = { Icon(Icons.Default.Add, contentDescription = null) },
    containerColor = MaterialTheme.colorScheme.tertiaryContainer,
    contentColor = MaterialTheme.colorScheme.onTertiaryContainer
)

// Large FAB
LargeFloatingActionButton(
    onClick = { },
    containerColor = MaterialTheme.colorScheme.tertiaryContainer,
    contentColor = MaterialTheme.colorScheme.onTertiaryContainer
) {
    Icon(Icons.Default.Add, contentDescription = null)
}
```

### TopAppBar

```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppTopBar(title: String, onNavigateBack: () -> Unit) {
    TopAppBar(
        title = {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge
            )
        },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Voltar"
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface,
            navigationIconContentColor = MaterialTheme.colorScheme.onSurface
        )
    )
}
```

### Navigation (Adaptativo)

```kotlin
@Composable
fun AdaptiveNavigation(
    selectedDestination: String,
    onNavigate: (String) -> Unit
) {
    val windowSizeClass = calculateWindowSizeClass(LocalContext.current as Activity)

    when (windowSizeClass.widthSizeClass) {
        // Celular - Bottom Navigation
        WindowWidthSizeClass.Compact -> {
            NavigationBar {
                destinations.forEach { destination ->
                    NavigationBarItem(
                        selected = selectedDestination == destination.route,
                        onClick = { onNavigate(destination.route) },
                        icon = { Icon(destination.icon, contentDescription = null) },
                        label = { Text(destination.label) }
                    )
                }
            }
        }
        // Tablet - Navigation Rail
        WindowWidthSizeClass.Medium -> {
            NavigationRail {
                destinations.forEach { destination ->
                    NavigationRailItem(
                        selected = selectedDestination == destination.route,
                        onClick = { onNavigate(destination.route) },
                        icon = { Icon(destination.icon, contentDescription = null) },
                        label = { Text(destination.label) }
                    )
                }
            }
        }
        // Desktop/TV - Permanent Navigation Drawer
        WindowWidthSizeClass.Expanded -> {
            PermanentNavigationDrawer(
                drawerContent = { /* drawer content */ }
            ) { /* main content */ }
        }
    }
}
```

---

## 7. Elevação Tonal

O Material 3 usa **elevação tonal** (cor) em vez de apenas sombras.

```kotlin
// Surface com elevação tonal
Surface(
    tonalElevation = 3.dp,  // Afeta a cor, não apenas sombra
    shadowElevation = 2.dp   // Sombra tradicional
) {
    // Conteúdo
}

// Níveis de elevação tonal:
// 0.dp  -> surfaceContainerLowest
// 1.dp  -> surfaceContainerLow
// 3.dp  -> surfaceContainer
// 6.dp  -> surfaceContainerHigh
// 12.dp -> surfaceContainerHighest
```

---

## 8. Ênfase com Cores

### Hierarquia Visual

```kotlin
// Alta ênfase - Títulos importantes
Text(
    text = "Título Principal",
    color = MaterialTheme.colorScheme.onSurface
)

// Média ênfase - Corpo do texto
Text(
    text = "Descrição do conteúdo",
    color = MaterialTheme.colorScheme.onSurfaceVariant
)

// Baixa ênfase - Metadados
Text(
    text = "há 2 horas",
    color = MaterialTheme.colorScheme.outline
)

// Destaque especial
Text(
    text = "+50 XP",
    color = MaterialTheme.colorScheme.primary
)

// Erro/Alerta
Text(
    text = "Campo obrigatório",
    color = MaterialTheme.colorScheme.error
)
```

---

## 9. Cores Customizadas (Gamificação)

Para cores que devem ser fixas independente do tema (medalhas, rankings):

```kotlin
object GamificationColors {
    val Gold = Color(0xFFFFD700)      // 1º lugar
    val Silver = Color(0xFFE0E0E0)    // 2º lugar
    val Bronze = Color(0xFFCD7F32)    // 3º lugar
    val Diamond = Color(0xFFB9F2FF)   // Divisão especial
    val XpGreen = Color(0xFF00C853)   // Barras de XP
}

// Uso com ContrastHelper para texto legível
@Composable
fun MedalBadge(position: Int) {
    val backgroundColor = when (position) {
        1 -> GamificationColors.Gold
        2 -> GamificationColors.Silver
        3 -> GamificationColors.Bronze
        else -> MaterialTheme.colorScheme.surfaceVariant
    }

    Box(
        modifier = Modifier
            .size(32.dp)
            .background(backgroundColor, CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "$position",
            color = ContrastHelper.getContrastingTextColor(backgroundColor),
            style = MaterialTheme.typography.labelMedium
        )
    }
}
```

---

## 10. Acessibilidade

### Contraste Mínimo (WCAG AA)

- Texto normal: 4.5:1
- Texto grande (18pt+ ou 14pt+ bold): 3.0:1
- Ícones/gráficos: 3.0:1

### Touch Targets

```kotlin
// Mínimo 48dp para touch targets
IconButton(
    onClick = { },
    modifier = Modifier.size(48.dp)
) {
    Icon(
        imageVector = Icons.Default.Settings,
        contentDescription = "Configurações",
        modifier = Modifier.size(24.dp)
    )
}
```

### Content Descriptions

```kotlin
// Sempre forneça descrições para elementos interativos
Icon(
    imageVector = Icons.Default.Star,
    contentDescription = "Favorito",
    tint = MaterialTheme.colorScheme.primary
)

// Para ícones decorativos, use null
Icon(
    imageVector = Icons.Default.ChevronRight,
    contentDescription = null,
    tint = MaterialTheme.colorScheme.onSurfaceVariant
)
```

---

## 11. Checklist de Revisão de UI

Antes de fazer commit de código de UI:

- [ ] Nenhum `Color.Black`, `Color.White`, `Color.Gray` hardcoded
- [ ] Todos os ícones usam `MaterialTheme.colorScheme.*` para tint
- [ ] TopBars usam cores do tema
- [ ] Cores customizadas (gamificação) usam `ContrastHelper` para texto
- [ ] Testado em tema claro e escuro
- [ ] Touch targets >= 48dp
- [ ] Content descriptions em elementos interativos
- [ ] Contraste >= 4.5:1 para texto

---

## Referências Rápidas

### Links Oficiais
- [android/compose-samples](https://github.com/android/compose-samples)
- [Material Theme Builder](https://material-foundation.github.io/material-theme-builder/)
- [Material 3 Color System](https://m3.material.io/styles/color/overview)
- [Material 3 Typography](https://m3.material.io/styles/typography/overview)
- [Material 3 Shape](https://m3.material.io/styles/shape/overview)

### Amostras de Código
- **Reply** - App de email com Material 3 completo
- **Jetchat** - Chat com temas dinâmicos
- **Jetsnack** - Sistema de cores customizado
- **JetNews** - Tipografia e componentes

### Ferramentas
- Material Theme Builder: Gera código de tema
- Figma Material 3 Kit: Design tokens
- Android Studio Preview: Teste light/dark themes
