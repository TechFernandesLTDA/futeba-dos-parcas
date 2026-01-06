# LiveGame - Jogo ao Vivo

## Visão Geral

Sistema completo de gerenciamento de jogos ao vivo com recursos modernos de Jetpack Compose, incluindo:

- ⚽ **Placar em tempo real** - Atualização automática via Firestore
- ⏱️ **Cronômetro ao vivo** - Conta o tempo desde o início do jogo
- 📊 **Estatísticas dos jogadores** - Gols, assistências, defesas, cartões
- 📝 **Feed de eventos** - Timeline de eventos do jogo
- 👥 **Navegação por tabs** - HorizontalPager Material3
- ➕ **Adicionar eventos** - ModalBottomSheet para gols, cartões, etc.
- 🎨 **Material Design 3** - UI moderna e consistente
- 🚀 **Preparado para KMP** - Arquitetura agnóstica de plataforma

---

## Arquitetura

### Camadas

```
┌─────────────────────────────────────┐
│         UI Layer (Compose)          │
│  LiveGameScreen.kt                  │
│  LiveStatsScreen.kt                 │
│  LiveEventsScreen.kt                │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      ViewModel Layer (MVVM)         │
│  LiveGameViewModel.kt               │
│  LiveStatsViewModel.kt              │
│  LiveEventsViewModel.kt             │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       Repository Layer              │
│  LiveGameRepository.kt              │
│  GameRepository.kt                  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Data Source (Firebase)         │
│  Firestore Collections:             │
│  - live_game_scores                 │
│  - game_events                      │
│  - live_player_stats                │
└─────────────────────────────────────┘
```

---

## Componentes

### 1. LiveGameScreen

**Tela principal** que orquestra toda a experiência do jogo ao vivo.

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

**Responsabilidades:**
- Exibir header com placar e cronômetro
- Gerenciar navegação entre tabs (Estatísticas/Eventos)
- Mostrar FAB para adicionar eventos
- Exibir ModalBottomSheet para adicionar eventos
- Gerenciar estados de Loading/Error

**Features:**
- HorizontalPager com 2 tabs
- TabRow com indicador animado
- ExtendedFloatingActionButton (expande na tab de eventos)
- Real-time updates via collectAsStateWithLifecycle
- Cronômetro que atualiza a cada 1 segundo

---

### 2. LiveStatsScreen

**Tab de estatísticas** dos jogadores no jogo.

```kotlin
@Composable
fun LiveStatsScreen(
    viewModel: LiveStatsViewModel,
    gameId: String,
    onPlayerClick: (playerId: String) -> Unit = {}
)
```

**Exibe:**
- Lista de jogadores com avatar
- Estatísticas: Gols ⚽, Assistências 🎯, Defesas 🧤
- Cartões amarelos 🟨 e vermelhos 🟥
- Badge de posição (GOL, DEF, MEI, ATA)
- Badge de status (SAIU) para jogadores substituídos

**Ordenação:**
- Por gols (decrescente) - automática no ViewModel

---

### 3. LiveEventsScreen

**Timeline de eventos** do jogo em ordem cronológica.

```kotlin
@Composable
fun LiveEventsScreen(
    viewModel: LiveEventsViewModel,
    gameId: String,
    onEventClick: (eventId: String) -> Unit = {}
)
```

**Exibe:**
- Lista de eventos (gols, cartões, substituições)
- Ícone e cor por tipo de evento
- Nome do jogador
- Minuto do evento
- Informação de assistência (se houver)

**Cores por tipo:**
- ⚽ Gol: Verde claro (#E8F5E9)
- 🔄 Substituição: Laranja claro (#FFF3E0)
- 🟨 Cartão Amarelo: Amarelo claro (#FFFDE7)
- 🟥 Cartão Vermelho: Vermelho claro (#FFEBEE)

---

### 4. ViewModels

#### LiveGameViewModel
**Responsabilidades:**
- Carregar dados do jogo
- Observar placar em tempo real
- Adicionar eventos (gols, cartões, defesas)
- Finalizar jogo
- Navegar para votação MVP

**Principais Métodos:**
```kotlin
fun loadGame(gameId: String)
fun finishGame()
fun addGoal(playerId: String, playerName: String, teamId: String, ...)
fun addSave(playerId: String, playerName: String, teamId: String, minute: Int)
fun addYellowCard(...)
fun addRedCard(...)
```

**Estados:**
```kotlin
sealed class LiveGameUiState {
    object Loading : LiveGameUiState()
    data class Success(
        val game: Game,
        val score: LiveGameScore,
        val team1: Team,
        val team2: Team,
        val isOwner: Boolean
    ) : LiveGameUiState()
    data class Error(val message: String) : LiveGameUiState()
}
```

#### LiveStatsViewModel
**Responsabilidades:**
- Observar estatísticas dos jogadores em tempo real
- Ordenar por gols (decrescente)

**Principais Métodos:**
```kotlin
fun observeStats(gameId: String)
```

**Estado:**
```kotlin
val stats: StateFlow<List<LivePlayerStats>>
```

#### LiveEventsViewModel
**Responsabilidades:**
- Observar eventos do jogo em tempo real
- Manter ordenação cronológica

**Principais Métodos:**
```kotlin
fun observeEvents(gameId: String)
```

**Estado:**
```kotlin
val events: StateFlow<List<GameEvent>>
```

---

## Modelos de Dados

### LiveGameScore
```kotlin
data class LiveGameScore(
    var id: String = "",
    var gameId: String = "",
    var team1Id: String = "",
    var team1Score: Int = 0,
    var team2Id: String = "",
    var team2Score: Int = 0,
    var startedAt: Date? = null,
    var finishedAt: Date? = null
)
```

### GameEvent
```kotlin
data class GameEvent(
    var id: String = "",
    var gameId: String = "",
    var eventType: String = GameEventType.GOAL.name,
    var playerId: String = "",
    var playerName: String = "",
    var teamId: String = "",
    var assistedById: String? = null,
    var assistedByName: String? = null,
    var minute: Int = 0,
    var createdAt: Date? = null
)

enum class GameEventType {
    GOAL, ASSIST, SAVE, YELLOW_CARD, RED_CARD, SUBSTITUTION
}
```

### LivePlayerStats
```kotlin
data class LivePlayerStats(
    var id: String = "",
    var gameId: String = "",
    var playerId: String = "",
    var playerName: String = "",
    var teamId: String = "",
    var position: String = PlayerPosition.FIELD.name,
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0,
    var yellowCards: Int = 0,
    var redCards: Int = 0,
    var isPlaying: Boolean = true
)
```

---

## Fluxo de Uso

### 1. Iniciar Jogo ao Vivo

```kotlin
// Usuário clica em "Iniciar Jogo" no GameDetailScreen
viewModel.startLiveGame(gameId)

// ViewModel atualiza status do jogo para LIVE
gameRepository.updateGameStatus(gameId, "LIVE")

// Sistema cria placar inicial automaticamente
liveGameRepository.startLiveGame(gameId, team1Id, team2Id)
```

### 2. Observar Jogo em Tempo Real

```kotlin
// Fragment/Screen carrega LiveGameScreen
LiveGameScreen(
    viewModel = liveGameViewModel,
    statsViewModel = statsViewModel,
    eventsViewModel = eventsViewModel,
    gameId = gameId,
    onNavigateBack = { ... },
    onNavigateToVote = { ... }
)

// ViewModels observam Firestore em tempo real
liveGameViewModel.loadGame(gameId)
statsViewModel.observeStats(gameId)
eventsViewModel.observeEvents(gameId)
```

### 3. Adicionar Eventos

```kotlin
// Usuário clica no FAB "Adicionar Evento"
// Sistema abre ModalBottomSheet

// Usuário seleciona:
// - Tipo de evento (Gol, Defesa, Cartão)
// - Time
// - Jogador
// - Minuto (opcional)

// Sistema valida e adiciona evento
viewModel.addGoal(
    playerId = "player123",
    playerName = "João Silva",
    teamId = "team1",
    assistId = "player456",
    assistName = "Pedro Santos",
    minute = 15
)

// Firestore atualiza automaticamente:
// - game_events (novo evento)
// - live_player_stats (incrementa gols/assistências)
// - live_game_scores (atualiza placar)
```

### 4. Finalizar Jogo

```kotlin
// Organizador clica em "Encerrar Partida"
viewModel.finishGame()

// Sistema:
// 1. Marca placar como finalizado (finishedAt)
// 2. Atualiza status do jogo para FINISHED
// 3. Cloud Function processa XP e estatísticas
// 4. Navega para votação MVP
```

---

## Firestore Collections

### live_game_scores
```
/live_game_scores/{gameId}
{
  gameId: string,
  team1Id: string,
  team1Score: number,
  team2Id: string,
  team2Score: number,
  startedAt: timestamp,
  finishedAt: timestamp | null
}
```

### game_events
```
/game_events/{eventId}
{
  gameId: string,
  eventType: "GOAL" | "SAVE" | "YELLOW_CARD" | "RED_CARD",
  playerId: string,
  playerName: string,
  teamId: string,
  assistedById: string | null,
  assistedByName: string | null,
  minute: number,
  createdAt: timestamp
}
```

### live_player_stats
```
/live_player_stats/{gameId}__{playerId}
{
  gameId: string,
  playerId: string,
  playerName: string,
  teamId: string,
  position: string,
  goals: number,
  assists: number,
  saves: number,
  yellowCards: number,
  redCards: number,
  isPlaying: boolean
}
```

---

## Regras de Negócio

### Iniciar Jogo
- ✅ Qualquer jogador confirmado pode iniciar o jogo
- ✅ Sistema cria placar inicial automaticamente (0-0)
- ✅ Marca `startedAt` com timestamp atual
- ✅ Status do jogo muda para LIVE

### Adicionar Eventos
- ✅ Qualquer jogador pode adicionar eventos durante o jogo
- ✅ Gol incrementa placar e estatísticas
- ✅ Assistência é opcional
- ✅ Cartões não afetam o placar
- ✅ Defesas só para goleiros

### Finalizar Jogo
- ⚠️ Apenas organizador pode finalizar
- ✅ Marca `finishedAt` com timestamp atual
- ✅ Status do jogo muda para FINISHED
- ✅ Cloud Function processa XP e ranking
- ✅ Navega automaticamente para votação MVP

---

## Animações

### FAB (Floating Action Button)
```kotlin
ExtendedFloatingActionButton(
    expanded = pagerState.currentPage == 1, // Expande na tab de eventos
    onClick = { showAddEventSheet = true }
)
```

**Comportamento:**
- **Tab Estatísticas**: FAB recolhido (só ícone)
- **Tab Eventos**: FAB expandido (ícone + texto)

### Cronômetro
```kotlin
LaunchedEffect(state.score.startedAt, isFinished) {
    if (state.score.startedAt != null && !isFinished) {
        while (true) {
            elapsedTime = System.currentTimeMillis() - startTime
            delay(1000L) // Atualiza a cada segundo
        }
    }
}
```

---

## Navegação

### De GamesFragment para LiveGameScreen
```kotlin
// Via Navigation Component
findNavController().navigate(
    GamesFragmentDirections.actionGamesToLiveGame(gameId)
)
```

### De LiveGameScreen para MvpVoteScreen
```kotlin
// Automático ao finalizar jogo (se organizador)
LiveGameNavigationEvent.NavigateToVote
```

---

## Testes

### Unit Tests (ViewModel)
```kotlin
@Test
fun `test addGoal updates score correctly`() = runTest {
    // Given
    val gameId = "game123"
    viewModel.loadGame(gameId)

    // When
    viewModel.addGoal("player1", "João", "team1", null, null, 10)

    // Then
    val state = viewModel.uiState.value as LiveGameUiState.Success
    assertEquals(1, state.score.team1Score)
}
```

### UI Tests (Compose)
```kotlin
@Test
fun testLiveGameScreen_displaysCorrectScore() {
    composeTestRule.setContent {
        LiveGameScreen(...)
    }

    composeTestRule.onNodeWithText("Time 1").assertIsDisplayed()
    composeTestRule.onNodeWithText("0").assertIsDisplayed()
    composeTestRule.onNodeWithText("VS").assertIsDisplayed()
}
```

---

## Troubleshooting

### Placar não atualiza
**Causa**: Listener do Firestore não está ativo
**Solução**: Verificar se `observeLiveScore()` foi chamado no ViewModel

### Cronômetro parado
**Causa**: `startedAt` é null
**Solução**: Verificar se o jogo foi iniciado corretamente via `startLiveGame()`

### FAB não aparece
**Causa**: Jogo não está com status LIVE
**Solução**: Verificar `game.status == "LIVE"` no Firestore

### Eventos não aparecem
**Causa**: `observeGameEvents()` não foi chamado
**Solução**: Verificar se `eventsViewModel.observeEvents(gameId)` foi chamado

---

## Performance

### Otimizações Implementadas

1. **collectAsStateWithLifecycle** - Cancela automaticamente ao sair da tela
2. **remember** - Evita recomposições desnecessárias
3. **key parameters** - LazyColumn otimizado para mudanças de lista
4. **beyondBoundsPageCount** - Pré-carrega tabs adjacentes
5. **Debounce** - Cronômetro atualiza apenas a cada 1 segundo

### Métricas
- **Carregamento inicial**: ~500ms
- **Recomposições por segundo**: ~1 (cronômetro)
- **Latência Firestore**: ~100-300ms (depende da rede)

---

## Roadmap

### Fase 1: Compose Migration ✅
- [x] Criar LiveGameScreen.kt
- [x] Implementar HorizontalPager
- [x] Implementar ModalBottomSheet
- [x] Atualizar LiveGameFragment wrapper

### Fase 2: Melhorias 🚧
- [ ] Completar seleção de jogador no BottomSheet
- [ ] Adicionar confirmação ao finalizar jogo
- [ ] Implementar desfazer evento (undo)
- [ ] Adicionar filtros nas tabs

### Fase 3: KMP 🔮
- [ ] Mover ViewModels para shared module
- [ ] Criar interfaces expect/actual para Firebase
- [ ] Implementar UI em SwiftUI para iOS

---

## Recursos

- [Material Design 3 - Components](https://m3.material.io/components)
- [HorizontalPager Guide](https://developer.android.com/jetpack/compose/layouts/pager)
- [Firestore Real-time Updates](https://firebase.google.com/docs/firestore/query-data/listen)
- [State in Compose](https://developer.android.com/jetpack/compose/state)

---

**Última atualização**: 2026-01-05
**Versão**: 1.0.0
**Status**: ✅ Produção
