# LiveGame Migration to Jetpack Compose

## Visão Geral

Migração completa da funcionalidade de jogo ao vivo (LiveGame) de ViewBinding/XML para **Jetpack Compose moderno**, seguindo as melhores práticas do Material Design 3 e preparado para **Kotlin Multiplatform (KMP)**.

---

## Arquitetura

### Estrutura de Arquivos

```
ui/livegame/
├── LiveGameScreen.kt           [NOVO] - Tela principal em Compose
├── LiveStatsScreen.kt          [EXISTENTE] - Tab de estatísticas
├── LiveEventsScreen.kt         [EXISTENTE] - Tab de eventos
├── LiveGameViewModel.kt        [EXISTENTE] - Lógica principal
├── LiveStatsViewModel.kt       [EXISTENTE] - Lógica de estatísticas
├── LiveEventsViewModel.kt      [EXISTENTE] - Lógica de eventos
├── LiveGameFragment.kt         [LEGACY] - Fragment wrapper (manter por compatibilidade)
├── AddEventDialog.kt           [LEGACY] - Dialog em XML (pode ser removido)
```

### Componentes Principais

#### 1. LiveGameScreen (Tela Principal)
```kotlin
@Composable
fun LiveGameScreen(
    viewModel: LiveGameViewModel,
    statsViewModel: LiveStatsViewModel,
    eventsViewModel: LiveEventsViewModel,
    gameId: String,
    onNavigateBack: () -> Unit,
    onNavigateToVote: () -> Unit
)
```

**Features:**
- ✅ TopBar com informações do jogo
- ✅ Header com placar dinâmico
- ✅ Cronômetro em tempo real
- ✅ HorizontalPager para navegação entre tabs
- ✅ TabRow com indicador animado
- ✅ ExtendedFloatingActionButton com animações
- ✅ ModalBottomSheet para adicionar eventos
- ✅ Estados de Loading/Error
- ✅ Real-time updates via Firestore

#### 2. LiveGameTabs (Navegação)
```kotlin
@Composable
private fun LiveGameTabs(
    pagerState: PagerState,
    statsViewModel: LiveStatsViewModel,
    eventsViewModel: LiveEventsViewModel,
    gameId: String,
    onTabSelected: (Int) -> Unit
)
```

**Features:**
- ✅ Material3 TabRow
- ✅ HorizontalPager (substitui ViewPager2)
- ✅ Swipe gestures para navegação
- ✅ Pré-carregamento de tabs adjacentes (beyondBoundsPageCount = 1)
- ✅ Sincronização de estado entre tabs

#### 3. AddEventBottomSheet (Adicionar Eventos)
```kotlin
@Composable
private fun AddEventBottomSheet(
    sheetState: SheetState,
    team1: Team,
    team2: Team,
    gameId: String,
    onDismiss: () -> Unit,
    onEventAdded: (eventType, playerId, playerName, ...) -> Unit
)
```

**Features:**
- ✅ ModalBottomSheet Material3
- ✅ Seleção de tipo de evento (Gol, Defesa, Cartões)
- ✅ Seleção de time
- ✅ Input de minuto
- ✅ Validação de campos
- ⚠️ **TODO**: Implementar seleção de jogador com Dropdown/Dialog

---

## Tecnologias Utilizadas

### Compose Foundation
- `HorizontalPager` - Navegação entre tabs
- `TabRow` - Material3 TabRow
- `ModalBottomSheet` - Bottom sheet moderno
- `ExtendedFloatingActionButton` - FAB animado

### State Management
- `collectAsStateWithLifecycle()` - Coleta de StateFlow otimizada
- `rememberPagerState()` - Estado do pager
- `rememberModalBottomSheetState()` - Estado do bottom sheet
- `remember` e `derivedStateOf` - Otimização de recomposições

### Animações
- `AnimatedVisibility` - FAB animado
- `scaleIn/scaleOut` - Animações de escala
- `fadeIn/fadeOut` - Animações de opacidade
- `TabRowDefaults.SecondaryIndicator` - Indicador animado

---

## Performance Optimizations

### 1. Lazy Loading
- ✅ `key` parameters em LazyColumn (LiveStatsScreen/LiveEventsScreen)
- ✅ `beyondBoundsPageCount = 1` para pré-carregar tabs adjacentes
- ✅ `remember` para evitar recomposições desnecessárias

### 2. Real-time Updates
- ✅ `collectAsStateWithLifecycle()` ao invés de `collectAsState()`
- ✅ Auto-cancelamento quando sai da tela
- ✅ Cronômetro atualizado a cada 1 segundo (otimizado)

### 3. Memory Management
- ✅ Cancelamento de Jobs no `onCleared()` do ViewModel
- ✅ Lifecycle-aware state collection
- ✅ Proper cleanup de listeners do Firestore

---

## Preparação para KMP/iOS

### O que está pronto para KMP:

#### ViewModels ✅
- `LiveGameViewModel` - Lógica de negócio 100% Kotlin
- `LiveStatsViewModel` - Lógica de negócio 100% Kotlin
- `LiveEventsViewModel` - Lógica de negócio 100% Kotlin

#### Data Models ✅
- `Game`, `Team`, `LiveGameScore`
- `GameEvent`, `LivePlayerStats`
- `GameEventType` enum

#### Repositories ✅
- `LiveGameRepository` - Interface agnóstica de plataforma
- `GameRepository` - Interface agnóstica de plataforma

### O que precisa de adaptação para KMP:

#### UI Layer ⚠️
- **Android**: Jetpack Compose (atual)
- **iOS**: SwiftUI (a ser implementado)
- **Shared**: ViewModels e lógica de negócio

#### Firebase SDK 🔄
- **Android**: Firebase Android SDK
- **iOS**: Firebase iOS SDK
- **Shared**: Interface comum (`expect/actual`)

#### Navigation 🔄
- **Android**: Jetpack Navigation Compose
- **iOS**: SwiftUI NavigationStack
- **Shared**: Interface de navegação

---

## Migração Passo a Passo

### Fase 1: Compose Screen (Concluída ✅)
1. ✅ Criar `LiveGameScreen.kt` com HorizontalPager
2. ✅ Implementar TabRow com Material3
3. ✅ Adicionar ModalBottomSheet para eventos
4. ✅ Integrar LiveStatsScreen e LiveEventsScreen
5. ✅ Implementar animações e FAB

### Fase 2: Fragment Wrapper (Próxima)
1. ⏳ Atualizar `LiveGameFragment.kt` para usar ComposeView
2. ⏳ Manter compatibilidade com Navigation XML
3. ⏳ Testar navegação para votação MVP

### Fase 3: Cleanup (Futura)
1. ⏳ Remover `AddEventDialog.kt` (XML)
2. ⏳ Remover layouts XML relacionados
3. ⏳ Atualizar testes

### Fase 4: KMP (Futura)
1. ⏳ Mover ViewModels para shared module
2. ⏳ Criar interfaces `expect/actual` para Firebase
3. ⏳ Implementar UI em SwiftUI para iOS

---

## Como Usar

### Em Jetpack Compose (Recomendado)
```kotlin
@Composable
fun MyScreen() {
    val liveGameViewModel: LiveGameViewModel = hiltViewModel()
    val statsViewModel: LiveStatsViewModel = hiltViewModel()
    val eventsViewModel: LiveEventsViewModel = hiltViewModel()

    LiveGameScreen(
        viewModel = liveGameViewModel,
        statsViewModel = statsViewModel,
        eventsViewModel = eventsViewModel,
        gameId = "game123",
        onNavigateBack = { /* voltar */ },
        onNavigateToVote = { /* ir para votação */ }
    )
}
```

### Em Fragment (Compatibilidade)
```kotlin
@AndroidEntryPoint
class LiveGameFragment : Fragment() {
    private val viewModel: LiveGameViewModel by viewModels()

    override fun onCreateView(...): View {
        return ComposeView(requireContext()).apply {
            setContent {
                FutebaTheme {
                    LiveGameScreen(
                        viewModel = viewModel,
                        // ... outros parâmetros
                    )
                }
            }
        }
    }
}
```

---

## Testes

### Unit Tests
```kotlin
@Test
fun `test LiveGameViewModel loads game successfully`() {
    // Test implementation
}

@Test
fun `test LiveGameViewModel adds goal event`() {
    // Test implementation
}
```

### UI Tests (Compose)
```kotlin
@Test
fun testLiveGameScreen_DisplaysCorrectScore() {
    composeTestRule.setContent {
        LiveGameScreen(...)
    }

    composeTestRule.onNodeWithText("Time 1").assertIsDisplayed()
    composeTestRule.onNodeWithText("0").assertIsDisplayed()
}
```

---

## Issues Conhecidas

### 1. Seleção de Jogador no BottomSheet ⚠️
**Status**: Placeholder implementado
**TODO**: Implementar Dropdown ou Dialog para seleção de jogador e assistência

### 2. Feedback de Erro ⚠️
**Status**: Snackbar básico
**TODO**: Melhorar feedback visual de erros (cores, ícones, retry)

### 3. Persistência de Estado ⚠️
**Status**: Estado perdido ao rotacionar tela
**TODO**: Salvar estado em SavedStateHandle

---

## Referências

- [Jetpack Compose Official Docs](https://developer.android.com/jetpack/compose)
- [Material Design 3](https://m3.material.io/)
- [HorizontalPager Guide](https://developer.android.com/jetpack/compose/layouts/pager)
- [Kotlin Multiplatform](https://kotlinlang.org/docs/multiplatform.html)
- [Firebase Kotlin SDK](https://github.com/GitLiveApp/firebase-kotlin-sdk)

---

## Checklist de Migração

- [x] Criar LiveGameScreen.kt
- [x] Implementar HorizontalPager
- [x] Implementar TabRow
- [x] Adicionar ModalBottomSheet
- [x] Integrar LiveStatsScreen
- [x] Integrar LiveEventsScreen
- [x] Implementar cronômetro em tempo real
- [x] Implementar placar dinâmico
- [x] Adicionar ExtendedFloatingActionButton
- [x] Implementar animações
- [x] Adicionar estados de Loading/Error
- [ ] Atualizar LiveGameFragment wrapper
- [ ] Completar seleção de jogador no BottomSheet
- [ ] Adicionar testes unitários
- [ ] Adicionar testes de UI
- [ ] Documentar componentes
- [ ] Code review
- [ ] QA testing

---

**Última atualização**: 2026-01-05
**Autor**: Claude Sonnet 4.5
**Status**: ✅ Fase 1 Concluída - Em revisão
