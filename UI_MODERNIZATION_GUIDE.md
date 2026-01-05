# Guia de Modernização da UI - Material Design 3 & WindowInsets

Este documento detalha as mudanças implementadas para modernizar a UI do app com **Material Design 3**, **WindowInsets** e **Type-Safe Navigation**.

## 📋 Resumo das Mudanças

### ✅ 1. WindowInsets & Edge-to-Edge

**Arquivos criados:**
- `app/src/main/java/com/futebadosparcas/ui/theme/WindowInsets.kt`

**Arquivos modificados:**
- `app/src/main/java/com/futebadosparcas/ui/main/MainActivity.kt`

**Melhorias:**
- Edge-to-edge habilitado antes de `super.onCreate()` para garantir aplicação correta
- Status bar completamente transparente
- Navigation bar semi-transparente (efeito premium)
- `WindowCompat.setDecorFitsSystemWindows(false)` aplicado
- Modifier extensions para gerenciar insets de forma consistente

### ✅ 2. Material Design 3 Color Scheme

**Arquivos modificados:**
- `app/src/main/java/com/futebadosparcas/ui/theme/Color.kt`
- `app/src/main/java/com/futebadosparcas/ui/theme/Theme.kt`

**Melhorias:**
- ColorSchemes completos MD3: `FutebaLightColorScheme` e `FutebaDarkColorScheme`
- Todas as color roles MD3 implementadas
- OLED-optimized para dark theme
- Cores de gamificação separadas em `GamificationColors` e `FieldTypeColors`
- Compatibilidade mantida com código XML existente (objeto `FutebaColors`)

### ✅ 3. Type-Safe Navigation

**Arquivos criados:**
- `app/src/main/java/com/futebadosparcas/ui/navigation/NavDestinations.kt`
- `app/src/main/java/com/futebadosparcas/ui/navigation/NavGraph.kt`

**Melhorias:**
- Navegação tipada com sealed classes
- Eliminação de erros em tempo de compilação
- Extension functions para navegação segura
- Preparado para migração gradual Fragment → Compose

---

## 🎨 WindowInsets Extensions

### Uso básico

```kotlin
import com.futebadosparcas.ui.theme.*

// Padding para todas as barras do sistema
Column(modifier = Modifier.systemBarsPadding()) { }

// Padding apenas no topo (status bar)
TopAppBar(modifier = Modifier.statusBarsPadding()) { }

// Padding apenas no bottom (navigation bar)
FloatingActionButton(modifier = Modifier.bottomBarPadding()) { }

// Padding para teclado (formulários)
TextField(modifier = Modifier.imePadding()) { }

// Padding vertical (top + bottom)
LazyColumn(modifier = Modifier.systemBarsVerticalPadding()) { }
```

### Extensions disponíveis

| Modifier | Descrição |
|----------|-----------|
| `.systemBarsPadding()` | Padding para status + navigation bars |
| `.statusBarsPadding()` | Padding apenas para status bar (topo) |
| `.navigationBarsPadding()` | Padding apenas para navigation bar (bottom) |
| `.imePadding()` | Padding para teclado (IME) |
| `.systemBarsHorizontalPadding()` | Padding horizontal (NavigationRail) |
| `.systemBarsVerticalPadding()` | Padding vertical (top + bottom) |
| `.topBarPadding()` | Padding apenas no topo |
| `.bottomBarPadding()` | Padding apenas no bottom |
| `.systemBarsAndImePadding()` | Combina system bars + teclado |

---

## 🎨 Material Design 3 Colors

### Color Schemes

```kotlin
import com.futebadosparcas.ui.theme.*

// Usar nos composables
MaterialTheme(
    colorScheme = if (isDark) FutebaDarkColorScheme else FutebaLightColorScheme
) {
    // Seu conteúdo
}
```

### Color Roles MD3

```kotlin
// Cores primárias
MaterialTheme.colorScheme.primary           // Ações principais
MaterialTheme.colorScheme.onPrimary         // Texto sobre primary
MaterialTheme.colorScheme.primaryContainer  // Containers destacados
MaterialTheme.colorScheme.onPrimaryContainer // Texto sobre container

// Cores secundárias
MaterialTheme.colorScheme.secondary
MaterialTheme.colorScheme.secondaryContainer

// Cores terciárias (accent)
MaterialTheme.colorScheme.tertiary
MaterialTheme.colorScheme.tertiaryContainer

// Backgrounds e surfaces
MaterialTheme.colorScheme.background
MaterialTheme.colorScheme.surface
MaterialTheme.colorScheme.surfaceVariant

// Borders e outlines
MaterialTheme.colorScheme.outline
MaterialTheme.colorScheme.outlineVariant
```

### Cores de Gamificação

```kotlin
import com.futebadosparcas.ui.theme.GamificationColors

// Medalhas
GamificationColors.Gold
GamificationColors.Silver
GamificationColors.Bronze
GamificationColors.Diamond

// XP e Níveis
GamificationColors.XpGreen
GamificationColors.XpLightGreen
GamificationColors.LevelUpGold

// Premium
GamificationColors.Purple
GamificationColors.PurpleLight
```

### Cores de Tipo de Campo

```kotlin
import com.futebadosparcas.ui.theme.FieldTypeColors

FieldTypeColors.Grass      // Grama
FieldTypeColors.Synthetic  // Sintético
FieldTypeColors.Futsal     // Futsal
FieldTypeColors.Sand       // Areia
```

---

## 🧭 Type-Safe Navigation

### Definir destinos

```kotlin
import com.futebadosparcas.ui.navigation.*

// Navegação simples
navController.navigateSafe(NavDestinations.Home)

// Navegação com argumentos
navController.navigateSafe(
    NavDestinations.GameDetail(gameId = "123")
)

// Navegação com opções
navController.navigateSafe(NavDestinations.Profile) {
    popUpTo(NavDestinations.Home.route) {
        inclusive = false
    }
    launchSingleTop = true
}
```

### Todos os destinos disponíveis

**Main Navigation:**
- `NavDestinations.Home`
- `NavDestinations.Games`
- `NavDestinations.Players`
- `NavDestinations.League`
- `NavDestinations.Statistics`
- `NavDestinations.Profile`

**Games:**
- `NavDestinations.GameDetail(gameId: String)`
- `NavDestinations.CreateGame(gameId: String? = null)`
- `NavDestinations.LiveGame(gameId: String)`
- `NavDestinations.MvpVote(gameId: String)`
- `NavDestinations.TacticalBoard`

**Groups:**
- `NavDestinations.Groups`
- `NavDestinations.GroupDetail(groupId: String)`
- `NavDestinations.CreateGroup`
- `NavDestinations.InvitePlayers(groupId: String)`
- `NavDestinations.Cashbox(groupId: String)`

**Profile & Settings:**
- `NavDestinations.EditProfile`
- `NavDestinations.Preferences`
- `NavDestinations.ThemeSettings`
- `NavDestinations.Developer`
- `NavDestinations.LevelJourney`
- `NavDestinations.GamificationSettings`
- `NavDestinations.About`

**Locations:**
- `NavDestinations.LocationsMap`
- `NavDestinations.FieldOwnerDashboard`
- `NavDestinations.LocationDetail(locationId: String? = null)`
- `NavDestinations.ManageLocations`

**Others:**
- `NavDestinations.Notifications`
- `NavDestinations.Ranking`
- `NavDestinations.Evolution`
- `NavDestinations.Badges`
- `NavDestinations.UserManagement`
- `NavDestinations.Schedules`

### Pop back stack

```kotlin
// Voltar para um destino específico
navController.popBackStackSafe(NavDestinations.Home)

// Voltar incluindo o destino
navController.popBackStackSafe(NavDestinations.Games, inclusive = true)
```

---

## 🎯 MainActivity - Edge-to-Edge

### Mudanças principais

1. **Edge-to-edge habilitado ANTES de super.onCreate()**
   ```kotlin
   WindowCompat.setDecorFitsSystemWindows(window, false)
   super.onCreate(savedInstanceState)
   ```

2. **Status bar transparente**
   ```kotlin
   window.statusBarColor = android.graphics.Color.TRANSPARENT
   ```

3. **Navigation bar semi-transparente**
   ```kotlin
   val navBarColor = if (isDark) {
       android.graphics.Color.argb(230, 15, 17, 20) // Dark
   } else {
       android.graphics.Color.argb(245, 255, 255, 255) // Light
   }
   window.navigationBarColor = navBarColor
   ```

4. **Contrast enforcement desabilitado (Android 10+)**
   ```kotlin
   window.isNavigationBarContrastEnforced = false
   window.isStatusBarContrastEnforced = false
   ```

---

## 📱 Exemplo Completo: Tela Compose

```kotlin
@Composable
fun GameDetailScreen(
    gameId: String,
    navController: NavController
) {
    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding(), // Padding para barras do sistema
        topBar = {
            TopAppBar(
                title = { Text("Detalhes do Jogo") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, "Voltar")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    navController.navigateSafe(
                        NavDestinations.MvpVote(gameId = gameId)
                    )
                },
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(Icons.Default.Star, "Votar MVP")
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .imePadding() // Padding para teclado se houver inputs
        ) {
            // Conteúdo da tela
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Text(
                        text = "Game ID: $gameId",
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
```

---

## 🔄 Migração Gradual

### Estratégia recomendada

1. **Fragments existentes continuam usando XML navigation**
   - `nav_graph.xml` mantido intacto
   - ViewBinding continua funcionando

2. **Novas telas podem usar Compose navigation**
   - Adicionar composables em `NavGraph.kt`
   - Usar `NavDestinations` para navegação tipada

3. **Migração de Fragment → Compose**
   - Converter Fragment para Composable
   - Adicionar rota em `NavGraph.kt`
   - Atualizar chamadas de navegação

---

## 🎨 Tipografia

A tipografia já está configurada para MD3 em `Typography.kt`:

```kotlin
MaterialTheme.typography.displayLarge  // 57sp, Bold
MaterialTheme.typography.headlineLarge // 32sp, Bold
MaterialTheme.typography.titleLarge    // 22sp, Bold
MaterialTheme.typography.bodyLarge     // 16sp, Normal
MaterialTheme.typography.labelLarge    // 14sp, Medium
```

---

## 🔧 Troubleshooting

### Status bar não está transparente

Verifique se `WindowCompat.setDecorFitsSystemWindows(window, false)` é chamado **antes** de `super.onCreate()`.

### Conteúdo sendo cortado pelas barras do sistema

Use os modifiers de WindowInsets:
```kotlin
Modifier.systemBarsPadding() // Para toda a tela
Modifier.statusBarsPadding()  // Apenas topo
Modifier.navigationBarsPadding() // Apenas bottom
```

### Cores não aplicando no tema

Certifique-se de usar `MaterialTheme.colorScheme.X` ao invés de `Color(0xFF...)` diretamente.

### Navegação não funciona

Verifique se está usando `navigateSafe()` com as sealed classes:
```kotlin
// ✅ Correto
navController.navigateSafe(NavDestinations.Home)

// ❌ Incorreto
navController.navigate("home")
```

---

## 📚 Referências

- [Material Design 3](https://m3.material.io/)
- [Compose WindowInsets](https://developer.android.com/develop/ui/compose/layouts/insets)
- [Type-Safe Navigation](https://developer.android.com/guide/navigation/design/type-safety)
- [Edge-to-Edge](https://developer.android.com/develop/ui/views/layout/edge-to-edge)

---

## ✅ Checklist de Implementação

- [x] WindowInsets extensions criadas
- [x] MainActivity atualizada para edge-to-edge completo
- [x] Color Schemes MD3 implementados
- [x] Type-Safe Navigation configurada
- [x] Documentação completa
- [ ] Testes de compilação (aguardando correção do módulo shared)
- [ ] Migração de telas XML → Compose (gradual)

---

**Versão:** 1.0
**Data:** 2026-01-05
**Autor:** Claude Code
