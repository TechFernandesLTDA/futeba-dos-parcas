# Material Design 3 - Best Practices

Guia completo de melhores praticas Material 3 baseado nos projetos:
- **BeerCSS** - Framework CSS Material 3 (Web)
- **Gramophone** - Music Player Android com M3

---

## 1. Sistema de Cores (Color System)

### 1.1 Tokens Semanticos Obrigatorios

Material 3 define **29 tokens de cor** que DEVEM ser usados:

```kotlin
// CORRETO - Usar MaterialTheme.colorScheme
MaterialTheme.colorScheme.primary
MaterialTheme.colorScheme.onPrimary
MaterialTheme.colorScheme.primaryContainer
MaterialTheme.colorScheme.onPrimaryContainer

MaterialTheme.colorScheme.secondary
MaterialTheme.colorScheme.onSecondary
MaterialTheme.colorScheme.secondaryContainer
MaterialTheme.colorScheme.onSecondaryContainer

MaterialTheme.colorScheme.tertiary
MaterialTheme.colorScheme.onTertiary
MaterialTheme.colorScheme.tertiaryContainer
MaterialTheme.colorScheme.onTertiaryContainer

MaterialTheme.colorScheme.error
MaterialTheme.colorScheme.onError
MaterialTheme.colorScheme.errorContainer
MaterialTheme.colorScheme.onErrorContainer

MaterialTheme.colorScheme.surface
MaterialTheme.colorScheme.onSurface
MaterialTheme.colorScheme.surfaceVariant
MaterialTheme.colorScheme.onSurfaceVariant

MaterialTheme.colorScheme.outline
MaterialTheme.colorScheme.outlineVariant

MaterialTheme.colorScheme.background
MaterialTheme.colorScheme.onBackground

MaterialTheme.colorScheme.inverseSurface
MaterialTheme.colorScheme.inverseOnSurface
MaterialTheme.colorScheme.inversePrimary

MaterialTheme.colorScheme.scrim
```

### 1.2 Surface Containers (M3 Novidade)

Material 3 introduziu novos tokens para hierarquia de superficies:

```kotlin
// Hierarquia de elevacao visual (sem sombra)
MaterialTheme.colorScheme.surfaceContainerLowest  // Nivel mais baixo
MaterialTheme.colorScheme.surfaceContainerLow
MaterialTheme.colorScheme.surfaceContainer        // Padrao
MaterialTheme.colorScheme.surfaceContainerHigh
MaterialTheme.colorScheme.surfaceContainerHighest // Nivel mais alto

// Brilho de superficie
MaterialTheme.colorScheme.surfaceDim
MaterialTheme.colorScheme.surfaceBright
```

**Uso Pratico:**
```kotlin
// Cards em diferentes niveis
Card(
    colors = CardDefaults.cardColors(
        containerColor = MaterialTheme.colorScheme.surfaceContainerLow
    )
)

// Bottom Sheet
ModalBottomSheet(
    containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
)
```

---

## 2. Dynamic Colors (Monet)

### 2.1 Ativar Dynamic Colors no Android 12+

```kotlin
// Theme.kt
@Composable
fun FutebaDosParçasTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true, // Ativar por padrao
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context)
            else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
```

### 2.2 Fallback para Android < 12

```kotlin
// Cores estaticas para dispositivos sem Monet
private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF58CC02),      // Verde Futeba
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD4F8C4),
    onPrimaryContainer = Color(0xFF002200),
    secondary = Color(0xFFFF9600),    // Laranja destaque
    // ... demais cores
)

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF9EE87A),
    onPrimary = Color(0xFF003A00),
    primaryContainer = Color(0xFF005300),
    onPrimaryContainer = Color(0xFFD4F8C4),
    // ... demais cores
)
```

---

## 3. Componentes Material 3

### 3.1 Buttons (Hierarquia)

```kotlin
// ALTA enfase - Acao principal
Button(onClick = {}) { Text("Confirmar") }

// MEDIA enfase - Acao secundaria
FilledTonalButton(onClick = {}) { Text("Editar") }

// BAIXA enfase - Acao terciaria
OutlinedButton(onClick = {}) { Text("Cancelar") }

// MINIMA enfase - Links/acoes sutis
TextButton(onClick = {}) { Text("Saiba mais") }

// Acao flutuante
FloatingActionButton(onClick = {}) { Icon(...) }
ExtendedFloatingActionButton(onClick = {}, icon = {...}, text = {...})
```

### 3.2 Cards (Tipos)

```kotlin
// Card padrao (elevado)
Card { ... }

// Card preenchido (sem elevacao)
Card(
    colors = CardDefaults.cardColors(
        containerColor = MaterialTheme.colorScheme.surfaceVariant
    ),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
) { ... }

// Card com borda
OutlinedCard { ... }
```

### 3.3 TopAppBar (Tipos M3)

```kotlin
// TopAppBar pequena (padrao)
TopAppBar(
    title = { Text("Titulo") },
    navigationIcon = { IconButton(...) },
    actions = { ... }
)

// TopAppBar media (com titulo grande em scroll)
MediumTopAppBar(
    title = { Text("Titulo") },
    scrollBehavior = scrollBehavior
)

// TopAppBar grande
LargeTopAppBar(
    title = { Text("Titulo") },
    scrollBehavior = scrollBehavior
)

// Center-aligned (iOS style)
CenterAlignedTopAppBar(
    title = { Text("Titulo") }
)
```

### 3.4 Navigation

```kotlin
// Bottom Navigation (3-5 destinos)
NavigationBar {
    destinations.forEach { dest ->
        NavigationBarItem(
            selected = currentRoute == dest.route,
            onClick = { ... },
            icon = { Icon(...) },
            label = { Text(dest.label) }
        )
    }
}

// Navigation Rail (tablets/landscape)
NavigationRail {
    destinations.forEach { dest ->
        NavigationRailItem(...)
    }
}

// Navigation Drawer (muitos destinos)
ModalNavigationDrawer(
    drawerContent = { ModalDrawerSheet { ... } }
) { ... }
```

---

## 4. Tipografia

### 4.1 Escala Tipografica M3

```kotlin
// Display - Titulos hero (muito grandes)
MaterialTheme.typography.displayLarge   // 57sp
MaterialTheme.typography.displayMedium  // 45sp
MaterialTheme.typography.displaySmall   // 36sp

// Headline - Titulos de secao
MaterialTheme.typography.headlineLarge  // 32sp
MaterialTheme.typography.headlineMedium // 28sp
MaterialTheme.typography.headlineSmall  // 24sp

// Title - Subtitulos
MaterialTheme.typography.titleLarge     // 22sp
MaterialTheme.typography.titleMedium    // 16sp (Medium weight)
MaterialTheme.typography.titleSmall     // 14sp (Medium weight)

// Body - Texto corrido
MaterialTheme.typography.bodyLarge      // 16sp
MaterialTheme.typography.bodyMedium     // 14sp
MaterialTheme.typography.bodySmall      // 12sp

// Label - Botoes, chips, captions
MaterialTheme.typography.labelLarge     // 14sp (Medium weight)
MaterialTheme.typography.labelMedium    // 12sp (Medium weight)
MaterialTheme.typography.labelSmall     // 11sp (Medium weight)
```

### 4.2 Uso Correto

```kotlin
// CORRETO
Text(
    text = "Proximo Jogo",
    style = MaterialTheme.typography.titleMedium
)

// ERRADO - Nunca usar fontSize diretamente
Text(
    text = "Proximo Jogo",
    fontSize = 16.sp  // Evitar!
)
```

---

## 5. Espacamento e Layout

### 5.1 Grid de 4dp

Material 3 usa grid de 4dp para espacamentos:

```kotlin
// Espacamentos padrao
val spacing4 = 4.dp
val spacing8 = 8.dp
val spacing12 = 12.dp
val spacing16 = 16.dp
val spacing24 = 24.dp
val spacing32 = 32.dp
val spacing48 = 48.dp

// Padding de conteudo
Modifier.padding(horizontal = 16.dp, vertical = 12.dp)

// Espaco entre elementos
Spacer(modifier = Modifier.height(8.dp))
```

### 5.2 Corner Radius (Shapes)

```kotlin
// Shapes Material 3
MaterialTheme.shapes.extraSmall  // 4.dp
MaterialTheme.shapes.small       // 8.dp
MaterialTheme.shapes.medium      // 12.dp
MaterialTheme.shapes.large       // 16.dp
MaterialTheme.shapes.extraLarge  // 28.dp

// Uso
Card(
    shape = MaterialTheme.shapes.medium
) { ... }
```

---

## 6. Icones

### 6.1 Material Symbols

```kotlin
// Usar Material Symbols (nao Material Icons legado)
implementation("androidx.compose.material:material-icons-extended")

// Icones direcionais devem usar AutoMirrored
Icon(
    imageVector = Icons.AutoMirrored.Filled.ArrowBack,  // CORRETO
    contentDescription = "Voltar"
)

// NAO usar
Icon(
    imageVector = Icons.Filled.ArrowBack,  // ERRADO para RTL
    contentDescription = "Voltar"
)
```

### 6.2 Tinting

```kotlin
// SEMPRE usar tint do colorScheme
Icon(
    imageVector = Icons.Default.Star,
    tint = MaterialTheme.colorScheme.primary
)

// Para icones em superficies
Icon(
    imageVector = Icons.Default.Info,
    tint = MaterialTheme.colorScheme.onSurface
)

// Para icones desabilitados
Icon(
    imageVector = Icons.Default.Lock,
    tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
)
```

---

## 7. Animacoes e Motion

### 7.1 Durações Padrao

```kotlin
// Duracoes Material 3
object MotionTokens {
    const val DurationShort1 = 50   // Micro interacoes
    const val DurationShort2 = 100
    const val DurationShort3 = 150
    const val DurationShort4 = 200

    const val DurationMedium1 = 250 // Transicoes simples
    const val DurationMedium2 = 300
    const val DurationMedium3 = 350
    const val DurationMedium4 = 400

    const val DurationLong1 = 450   // Transicoes complexas
    const val DurationLong2 = 500
    const val DurationLong3 = 550
    const val DurationLong4 = 600
}
```

### 7.2 Easing

```kotlin
// Easing Material 3
val EmphasizedEasing = CubicBezierEasing(0.2f, 0.0f, 0.0f, 1.0f)
val EmphasizedDecelerateEasing = CubicBezierEasing(0.05f, 0.7f, 0.1f, 1.0f)
val EmphasizedAccelerateEasing = CubicBezierEasing(0.3f, 0.0f, 0.8f, 0.15f)
val StandardEasing = CubicBezierEasing(0.2f, 0.0f, 0.0f, 1.0f)
```

---

## 8. Acessibilidade

### 8.1 Contraste Minimo

```kotlin
// WCAG AA - 4.5:1 para texto normal, 3:1 para texto grande
// Usar ContrastHelper do projeto

val textColor = ContrastHelper.getContrastingTextColor(backgroundColor)
```

### 8.2 Touch Target

```kotlin
// Minimo 48dp para touch targets
IconButton(
    onClick = { },
    modifier = Modifier.size(48.dp)  // Minimo 48dp
) {
    Icon(...)
}
```

### 8.3 Content Description

```kotlin
// SEMPRE fornecer contentDescription para elementos interativos
Icon(
    imageVector = Icons.Default.Delete,
    contentDescription = "Remover jogador"  // Obrigatorio!
)

// Para elementos decorativos
Icon(
    imageVector = Icons.Default.Star,
    contentDescription = null  // Explicito que e decorativo
)
```

---

## 9. Checklist de Revisao

Antes de cada PR, verificar:

- [ ] Todas as cores usam `MaterialTheme.colorScheme.*`
- [ ] Nenhum `Color.Black`, `Color.White`, `Color.Gray` hardcoded
- [ ] Tipografia usa `MaterialTheme.typography.*`
- [ ] Shapes usam `MaterialTheme.shapes.*`
- [ ] Icones direcionais usam `Icons.AutoMirrored.*`
- [ ] Touch targets >= 48dp
- [ ] Content descriptions em elementos interativos
- [ ] Testado em dark mode
- [ ] Testado com Dynamic Colors (Android 12+)
- [ ] Contraste >= 4.5:1 verificado

---

## 10. Recursos

- [Material Design 3 Guidelines](https://m3.material.io/)
- [Material Theme Builder](https://m3.material.io/theme-builder)
- [BeerCSS Demo](https://www.beercss.com/)
- [Gramophone Source](https://github.com/AkaneTan/Gramophone)
