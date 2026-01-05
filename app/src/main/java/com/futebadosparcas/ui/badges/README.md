# BadgesScreen - Jetpack Compose Migration

## Visão Geral

O `BadgesScreen` foi migrado de XML + RecyclerView para **Jetpack Compose** seguindo as melhores práticas modernas do Android.

## Arquitetura

### Componentes Principais

1. **BadgesScreen** - Composable principal que orquestra toda a tela
2. **BadgesFragment** - Fragment wrapper que usa ComposeView
3. **BadgesViewModel** - Gerencia o estado (não foi modificado)

### Estados da UI

```kotlin
sealed class BadgesUiState {
    object Loading : BadgesUiState()
    data class Error(val message: String) : BadgesUiState()
    data class Success(
        val allBadges: List<BadgeWithData>,
        val filteredBadges: List<BadgeWithData>,
        val totalUnlocked: Int,
        val selectedCategory: BadgeCategory?
    ) : BadgesUiState()
}
```

## Features Implementadas

### 1. Header de Progresso
- **Progresso circular animado** mostrando X/Y badges desbloqueadas
- **Animação suave** usando `animateFloatAsState`
- **Card com elevação** usando Material3

### 2. Filtros por Categoria
- **ScrollableTabRow** com todas as categorias
- **Emojis visuais** para cada categoria:
  - ⚽ Desempenho
  - 📅 Presença
  - 👥 Comunidade
  - 🏆 Nível
- **Filtro "Todas"** para mostrar badges sem filtro

### 3. Grid de Badges
- **LazyVerticalGrid** com 2 colunas fixas
- **Aspect ratio 0.85** para cards harmoniosos
- **Spacing de 12dp** entre itens
- **Animação de entrada** fadeIn + scaleIn

### 4. Badge Card
Cada card exibe:
- **Label de raridade** (Comum, Raro, Épico, Lendário)
- **Ícone emoji** grande com borda colorida baseada na raridade
- **Nome da badge** em negrito
- **Descrição** com max 2 linhas
- **Contador de conquistas** (se > 1)

Cores por raridade:
- **Comum**: Cinza (#8E8E8E)
- **Raro**: Prata (GamificationColors.Silver)
- **Épico**: Roxo (GamificationColors.Purple)
- **Lendário**: Ouro (GamificationColors.Gold)

### 5. Dialog de Detalhes
Ao clicar em uma badge:
- **Animação de escala** com spring bouncy
- **Header "🎉 Conquista Desbloqueada!"**
- **Ícone grande** com borda gradiente
- **Nome e descrição** da badge
- **Label de raridade**
- **XP reward** com fundo verde
- **Data de desbloqueio** formatada (dd/MM/yyyy)
- **Contador** de vezes conquistada
- **Botão "Continuar"** para fechar

### 6. Estados de Loading
- **Shimmer effect** usando infinite transition
- **Header shimmer** (card de 200dp de altura)
- **Grid shimmer** (6 cards placeholders)

### 7. Estados de Erro
- **EmptyState** reutilizável
- **Botão de retry** para recarregar
- **Mensagem de erro** customizada

### 8. Empty State
- **EmptyState** quando nenhuma badge foi desbloqueada
- **Mensagem diferenciada** quando filtro não tem resultados
- **Ícone temático** (EmojiEvents)

## Emojis por Badge Type

```kotlin
HAT_TRICK       -> "⚽"  // 3+ gols
PAREDAO         -> "🧤"  // Defesas
ARTILHEIRO_MES  -> "👑"  // Top scorer
FOMINHA         -> "🔥"  // Frequência
STREAK_7        -> "📅"  // 7 dias seguidos
STREAK_30       -> "🗓️"  // 30 dias seguidos
ORGANIZADOR_MASTER -> "📋"  // Organização
INFLUENCER      -> "✨"  // Influência
LENDA           -> "🏆"  // Lendário
FAIXA_PRETA     -> "🥋"  // Veterano
MITO            -> "💎"  // Mito
```

## Material Design 3

### Cores Utilizadas
- **Primary**: Verde vibrante (#00C853)
- **Secondary**: Azul elétrico (#2979FF)
- **Tertiary**: Laranja (#FF6D00)
- **Surface/Background**: Tema adaptativo
- **GamificationColors**: Ouro, Prata, Bronze, Roxo

### Typography
- **headlineSmall**: TopBar title
- **headlineMedium**: Dialog badge name, Progress numbers
- **titleLarge**: Dialog header
- **titleMedium**: XP reward
- **titleSmall**: Badge card name
- **bodyLarge**: Dialog description
- **bodyMedium**: Progress percentage
- **bodySmall**: Card description, dates
- **labelSmall**: Rarity labels

### Shapes
- **RoundedCornerShape(16.dp)**: Cards principais
- **RoundedCornerShape(12.dp)**: Chips, botões
- **RoundedCornerShape(8.dp)**: Labels pequenas
- **CircleShape**: Badge icons

## Animações

### Entrada de Cards
```kotlin
AnimatedVisibility(
    visible = visible,
    enter = fadeIn() + scaleIn(),
    exit = fadeOut() + scaleOut()
)
```

### Progresso Circular
```kotlin
animateFloatAsState(
    targetValue = progress,
    animationSpec = tween(800, easing = FastOutSlowInEasing)
)
```

### Dialog Scale
```kotlin
animateFloatAsState(
    targetValue = if (animationPlayed) 1f else 0.8f,
    animationSpec = spring(
        dampingRatio = Spring.DampingRatioMediumBouncy,
        stiffness = Spring.StiffnessLow
    )
)
```

### Shimmer
```kotlin
rememberInfiniteTransition()
animateFloat(
    initialValue = 0f,
    targetValue = 1000f,
    animationSpec = infiniteRepeatable(
        animation = tween(1200, easing = LinearEasing),
        repeatMode = RepeatMode.Restart
    )
)
```

## Uso

### No Fragment (atual)
```kotlin
@AndroidEntryPoint
class BadgesFragment : Fragment() {
    private val viewModel: BadgesViewModel by viewModels()

    override fun onCreateView(...): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(
                ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed
            )
            setContent {
                FutebaTheme {
                    BadgesScreen(
                        viewModel = viewModel,
                        onBackClick = null
                    )
                }
            }
        }
    }
}
```

### Standalone (navegação Compose)
```kotlin
// Navigation Compose
composable("badges") {
    BadgesScreen(onBackClick = { navController.popBackStack() })
}
```

## Performance

### Otimizações Aplicadas
1. **LazyVerticalGrid** - Apenas badges visíveis são compostas
2. **key parameter** - Recomposição otimizada usando badge.id
3. **remember** - Estados locais memoizados
4. **derivedStateOf** - Não usado (não necessário aqui)
5. **collectAsStateWithLifecycle** - Coleta lifecycle-aware

### Recomposição
- **Badge count** não causa recomposição total do grid
- **Filtro** recompõe apenas o grid, não o header
- **Dialog** é uma composição separada

## Testing

### Previews Disponíveis
```kotlin
@Preview BadgeProgressHeaderPreview()
@Preview BadgeCardPreview()
@Preview BadgesLoadingStatePreview()
```

Execute no Android Studio para visualizar componentes individuais.

## Próximos Passos

### Melhorias Futuras
1. **Compartilhamento de badges** nas redes sociais
2. **Animação de desbloqueio** em tempo real (quando badge é conquistada)
3. **Filtro por raridade** adicional
4. **Busca de badges** por nome
5. **Badge collections** (grupos temáticos)
6. **Progress tracking** para badges não conquistadas
7. **Comparação** de badges com outros jogadores

### Migração Completa
Quando todas as telas estiverem em Compose:
1. Remover `FragmentBadgesBinding`
2. Remover `BadgesAdapter` (RecyclerView)
3. Usar Navigation Compose puro
4. Remover dependências XML/View

## Dependências

### Compose
```kotlin
implementation("androidx.compose.ui:ui")
implementation("androidx.compose.material3:material3")
implementation("androidx.compose.ui:ui-tooling-preview")
implementation("androidx.lifecycle:lifecycle-runtime-compose")
```

### Hilt Navigation Compose
```kotlin
implementation("androidx.hilt:hilt-navigation-compose")
```

### Já incluídas no projeto
- ✅ Material3
- ✅ Lifecycle Compose
- ✅ Hilt Navigation Compose
- ✅ UI Tooling

## Estrutura de Arquivos

```
app/src/main/java/com/futebadosparcas/ui/badges/
├── BadgesScreen.kt          # ✅ NOVO - Tela Compose completa
├── BadgesFragment.kt        # ✅ ATUALIZADO - Usa ComposeView
├── BadgesViewModel.kt       # ✅ Mantido sem alterações
└── README.md               # ✅ NOVA - Esta documentação
```

## Referências

- [Jetpack Compose Basics](https://developer.android.com/jetpack/compose/tutorial)
- [Material Design 3](https://m3.material.io/)
- [Compose Animation](https://developer.android.com/jetpack/compose/animation)
- [State and Jetpack Compose](https://developer.android.com/jetpack/compose/state)
