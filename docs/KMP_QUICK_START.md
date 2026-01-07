# KMP Quick Start - Futeba dos Parças

## Guia Rápido para Desenvolvedores

Este documento fornece exemplos práticos de como usar o módulo `shared` no app Android.

## Importações Necessárias

```kotlin
// Use Cases
import com.futebadosparcas.domain.usecase.*

// Models
import com.futebadosparcas.domain.model.*

// Calculadoras
import com.futebadosparcas.domain.ranking.*
import com.futebadosparcas.domain.gamification.*

// AI
import com.futebadosparcas.domain.ai.*
```

## Casos de Uso Comuns

### 1. Validação de Dados

#### Validar Nome de Grupo

```kotlin
val nameResult = ValidateGroupNameUseCase("Pelada dos Parças")
if (nameResult.isSuccess()) {
    val validName = nameResult.getOrNull()!!
    // Prosseguir com criação...
} else {
    showError(nameResult.getErrorOrNull()!!)
}
```

#### Validar Descrição de Grupo

```kotlin
val descResult = ValidateGroupDescriptionUseCase(description)
when (descResult) {
    is ValidationResult.Success -> createGroup(descResult.value)
    is ValidationResult.Error -> binding.descriptionError.text = descResult.message
}
```

### 2. Gamificação - XP e Níveis

#### Calcular XP Ganho em Jogo

```kotlin
class GameFinalizationViewModel @Inject constructor() : ViewModel() {

    private val xpUseCase = CalculatePlayerXpUseCase()

    fun calculatePlayerXp(
        confirmation: GameConfirmation,
        team1Won: Boolean,
        isMvp: Boolean,
        currentStreak: Int
    ) {
        val result = xpUseCase.calculateSafe(
            confirmation = confirmation,
            teamWon = confirmation.teamId == "team1" && team1Won,
            teamDrew = false,
            isMvp = isMvp,
            isWorstPlayer = false,
            currentStreak = currentStreak
        )

        result.onSuccess { xpResult ->
            val totalXp = xpResult.totalXp
            val breakdown = xpResult.breakdown.toDisplayMap()

            Log.d("XP", "Total: $totalXp XP")
            breakdown.forEach { (category, xp) ->
                Log.d("XP", "$category: +$xp XP")
            }

            // Atualizar UI
            _xpGained.value = totalXp
            _xpBreakdown.value = breakdown
        }.onFailure { error ->
            Log.e("XP", "Erro ao calcular XP", error)
        }
    }
}
```

#### Mostrar Nível e Progresso

```kotlin
class ProfileViewModel @Inject constructor() : ViewModel() {

    private val levelUseCase = CalculateLevelUseCase()

    fun updateLevelInfo(currentXp: Long) {
        val info = levelUseCase.getLevelInfo(currentXp)

        _levelInfo.value = LevelUiState(
            level = info.currentLevel,
            currentXp = info.currentXp,
            xpForNextLevel = info.xpForNextLevel,
            xpNeeded = info.xpNeededForNextLevel,
            progressPercent = info.getProgressInt()
        )

        // Atualizar barra de progresso
        binding.levelProgressBar.progress = info.getProgressInt()
        binding.levelText.text = "Nível ${info.currentLevel}"
        binding.xpText.text = "${info.xpInCurrentLevel} / ${info.xpForNextLevel - info.xpForCurrentLevel} XP"
    }

    fun checkLevelUp(oldXp: Long, newXp: Long) {
        if (levelUseCase.didLevelUp(oldXp, newXp)) {
            val levelsGained = levelUseCase.getLevelGain(oldXp, newXp)
            showLevelUpDialog(levelsGained)
        }
    }
}
```

### 3. Balanceamento de Times

#### Balancear Times de Forma Justa

```kotlin
class TeamBalancerViewModel @Inject constructor() : ViewModel() {

    private val balanceUseCase = BalanceTeamsUseCase()

    fun balanceTeams(confirmedPlayers: List<User>, teamSize: Int = 5) {
        // 1. Validar primeiro
        val validation = balanceUseCase.validateTeamBalance(
            playerCount = confirmedPlayers.size,
            teamSize = teamSize
        )

        when (validation) {
            is TeamBalanceValidation.Invalid -> {
                _errorMessage.value = validation.reason
                return
            }
            is TeamBalanceValidation.WithBench -> {
                _warningMessage.value = validation.getMessage()
            }
            is TeamBalanceValidation.Perfect -> {
                // Tudo certo!
            }
        }

        // 2. Balancear
        val result = balanceUseCase(confirmedPlayers, teamSize)

        result.onSuccess { balanced ->
            _team1Players.value = balanced.team1.map { playerInfo ->
                confirmedPlayers.find { it.id == playerInfo.id }!!
            }

            _team2Players.value = balanced.team2.map { playerInfo ->
                confirmedPlayers.find { it.id == playerInfo.id }!!
            }

            _balanceInfo.value = BalanceInfo(
                team1Rating = balanced.team1Rating,
                team2Rating = balanced.team2Rating,
                difference = balanced.ratingDifference,
                isFair = balanced.ratingDifference < 0.5
            )

            Log.d("Balance", "Times balanceados!")
            Log.d("Balance", "Rating Time 1: ${balanced.team1Rating}")
            Log.d("Balance", "Rating Time 2: ${balanced.team2Rating}")
            Log.d("Balance", "Diferença: ${balanced.ratingDifference}")
        }.onFailure { error ->
            _errorMessage.value = "Erro ao balancear times: ${error.message}"
        }
    }

    fun getBalanceIds(confirmedPlayers: List<User>) {
        balanceUseCase.balanceAndGetIds(confirmedPlayers, teamSize = 5)
            .onSuccess { (team1Ids, team2Ids) ->
                // Salvar no Firestore
                saveTeamsToFirestore(team1Ids, team2Ids)
            }
    }
}
```

### 4. Sistema de Milestones

#### Verificar Conquistas Desbloqueadas

```kotlin
class MilestoneViewModel @Inject constructor() : ViewModel() {

    private val milestonesUseCase = CheckMilestonesUseCase()

    fun checkNewMilestones(
        playerStats: Statistics,
        previousMilestones: List<String>
    ) {
        val newMilestones = milestonesUseCase(
            statistics = playerStats,
            previouslyUnlocked = previousMilestones
        )

        if (newMilestones.isNotEmpty()) {
            newMilestones.forEach { milestoneId ->
                val info = milestonesUseCase.getMilestoneInfo(milestoneId)
                info?.let {
                    Log.d("Milestone", "🏆 ${it.name} desbloqueado!")
                    showMilestoneAnimation(it)
                    awardMilestoneXp(it.xpReward)
                }
            }
        }
    }

    fun getMilestoneProgress(milestoneId: String, stats: Statistics): Double {
        return milestonesUseCase.getMilestoneProgress(milestoneId, stats)
    }

    fun getAllAvailableMilestones(): List<String> {
        return milestonesUseCase.getAllMilestones()
    }
}
```

### 5. Sistema de Rating (Elo)

#### Calcular Novo Rating Após Partida

```kotlin
class RatingViewModel @Inject constructor() : ViewModel() {

    private val ratingUseCase = CalculateLeagueRatingUseCase()

    fun calculatePostMatchRatings(
        winners: List<Pair<String, Double>>, // (userId, currentRating)
        losers: List<Pair<String, Double>>
    ) {
        winners.forEach { (winnerId, winnerRating) ->
            losers.forEach { (loserId, loserRating) ->
                val newRating = ratingUseCase.calculateNewRatingAfterWin(
                    currentRating = winnerRating,
                    opponentRating = loserRating
                )

                updatePlayerRating(winnerId, newRating)
            }
        }

        losers.forEach { (loserId, loserRating) ->
            winners.forEach { (winnerId, winnerRating) ->
                val newRating = ratingUseCase.calculateNewRatingAfterLoss(
                    currentRating = loserRating,
                    opponentRating = winnerRating
                )

                updatePlayerRating(loserId, newRating)
            }
        }
    }

    fun showMatchPreview(playerRating: Double, opponentRating: Double) {
        val matchInfo = ratingUseCase.getMatchInfo(playerRating, opponentRating)

        binding.winProbability.text = "${matchInfo.getWinProbabilityPercent()}%"
        binding.potentialGain.text = "+${matchInfo.potentialGain.toInt()}"
        binding.potentialLoss.text = "-${matchInfo.potentialLoss.toInt()}"

        if (matchInfo.isFavorite()) {
            binding.favoriteIcon.visibility = View.VISIBLE
        }

        binding.ratingDifference.text = when {
            matchInfo.getRatingDifference() > 0 -> "Você é mais forte"
            matchInfo.getRatingDifference() < 0 -> "Adversário é mais forte"
            else -> "Rating igual"
        }
    }
}
```

## Compose UI Examples

### Validação de Formulário

```kotlin
@Composable
fun GroupCreationForm() {
    var groupName by remember { mutableStateOf("") }
    var nameError by remember { mutableStateOf<String?>(null) }

    OutlinedTextField(
        value = groupName,
        onValueChange = { newValue ->
            groupName = newValue

            // Validar em tempo real
            val result = ValidateGroupNameUseCase(newValue)
            nameError = result.getErrorOrNull()
        },
        label = { Text("Nome do Grupo") },
        isError = nameError != null,
        supportingText = {
            nameError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    )
}
```

### Barra de Progresso de Nível

```kotlin
@Composable
fun LevelProgressCard(currentXp: Long) {
    val levelUseCase = remember { CalculateLevelUseCase() }
    val levelInfo = remember(currentXp) { levelUseCase.getLevelInfo(currentXp) }

    Card {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Nível ${levelInfo.currentLevel}", style = MaterialTheme.typography.headlineMedium)

            Spacer(modifier = Modifier.height(8.dp))

            LinearProgressIndicator(
                progress = levelInfo.progressPercentage.toFloat(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                "${levelInfo.xpInCurrentLevel} / ${levelInfo.xpForNextLevel - levelInfo.xpForCurrentLevel} XP",
                style = MaterialTheme.typography.bodySmall
            )

            Text(
                "Faltam ${levelInfo.xpNeededForNextLevel} XP para o próximo nível",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.secondary
            )
        }
    }
}
```

### Times Balanceados

```kotlin
@Composable
fun BalancedTeamsView(players: List<User>) {
    val balanceUseCase = remember { BalanceTeamsUseCase() }
    var balancedTeams by remember { mutableStateOf<BalancedTeams?>(null) }

    LaunchedEffect(players) {
        balanceUseCase(players, teamSize = 5).onSuccess { balanced ->
            balancedTeams = balanced
        }
    }

    balancedTeams?.let { teams ->
        Row(modifier = Modifier.fillMaxWidth()) {
            // Time 1
            Column(modifier = Modifier.weight(1f)) {
                Text("Time 1", style = MaterialTheme.typography.titleMedium)
                Text("Rating: ${teams.team1Rating}", style = MaterialTheme.typography.bodySmall)

                teams.team1.forEach { player ->
                    PlayerCard(player)
                }
            }

            Divider(modifier = Modifier.width(1.dp).fillMaxHeight())

            // Time 2
            Column(modifier = Modifier.weight(1f)) {
                Text("Time 2", style = MaterialTheme.typography.titleMedium)
                Text("Rating: ${teams.team2Rating}", style = MaterialTheme.typography.bodySmall)

                teams.team2.forEach { player ->
                    PlayerCard(player)
                }
            }
        }

        if (teams.ratingDifference < 0.5) {
            Text(
                "✅ Times perfeitamente balanceados!",
                color = Color.Green
            )
        }
    }
}
```

## Testes Unitários

### Testar Use Cases

```kotlin
class CalculatePlayerXpUseCaseTest {

    private val useCase = CalculatePlayerXpUseCase()

    @Test
    fun `should calculate XP correctly for MVP winner`() {
        val confirmation = GameConfirmation(
            userId = "player1",
            position = PlayerPosition.LINE,
            goals = 3,
            assists = 2,
            saves = 0
        )

        val result = useCase(
            confirmation = confirmation,
            teamWon = true,
            teamDrew = false,
            isMvp = true,
            currentStreak = 5
        )

        assertTrue(result.totalXp > 0)
        assertTrue(result.breakdown.goals > 0)
        assertTrue(result.breakdown.mvp > 0)
        assertEquals(GameResult.WIN, result.gameResult)
    }

    @Test
    fun `should reject negative streak`() {
        val result = useCase.calculateSafe(
            confirmation = testConfirmation,
            teamWon = true,
            teamDrew = false,
            currentStreak = -1
        )

        assertTrue(result.isFailure)
    }
}
```

## Dicas e Boas Práticas

### 1. Sempre Usar Result para Operações que Podem Falhar

```kotlin
// ✅ BOM
val result = balanceUseCase(players, teamSize = 5)
result.onSuccess { teams -> /* ... */ }
result.onFailure { error -> /* ... */ }

// ❌ RUIM
val teams = balanceUseCase(players, teamSize = 5) // Pode lançar exceção!
```

### 2. Validar Dados Antes de Processar

```kotlin
// ✅ BOM
val validation = balanceUseCase.validateTeamBalance(players.size, teamSize)
if (validation.isValid()) {
    balanceUseCase(players, teamSize)
}

// ❌ RUIM
balanceUseCase(players, teamSize) // Pode falhar silenciosamente
```

### 3. Reutilizar Instâncias de Use Cases

```kotlin
// ✅ BOM - Em ViewModel
class MyViewModel : ViewModel() {
    private val levelUseCase = CalculateLevelUseCase() // Reutilizar

    fun updateLevel(xp: Long) {
        val info = levelUseCase.getLevelInfo(xp)
        // ...
    }
}

// ❌ RUIM - Criar toda vez
fun updateLevel(xp: Long) {
    val levelUseCase = CalculateLevelUseCase() // Nova instância toda vez
    // ...
}
```

### 4. Usar Type Aliases para Clareza

```kotlin
import com.futebadosparcas.domain.usecase.XpCalculationResult
import com.futebadosparcas.domain.usecase.XpBreakdown

// ✅ Tipos claros e descritivos
val result: XpCalculationResult = calculateXp()
val breakdown: XpBreakdown = result.breakdown
```

## Referência Rápida

| Use Case | Propósito | Retorno |
|----------|-----------|---------|
| `ValidateGroupNameUseCase` | Valida nome de grupo | `ValidationResult` |
| `CalculatePlayerXpUseCase` | Calcula XP ganho | `Result<XpCalculationResult>` |
| `BalanceTeamsUseCase` | Balanceia times | `Result<BalancedTeams>` |
| `CalculateLevelUseCase` | Calcula nível e progresso | `LevelInfo` |
| `CheckMilestonesUseCase` | Verifica milestones | `List<String>` |
| `CalculateLeagueRatingUseCase` | Calcula rating Elo | `MatchRatingInfo` |

---

**Dúvidas?** Consulte `shared/README.md` ou `docs/KMP_SETUP_SUMMARY.md`
