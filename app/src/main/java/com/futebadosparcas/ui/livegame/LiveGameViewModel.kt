package com.futebadosparcas.ui.livegame

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameEventType
import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.domain.model.LiveScore
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.LiveGameRepository
import com.futebadosparcas.domain.model.Team
import com.futebadosparcas.domain.usecase.livegame.AddGameEventUseCase
import com.futebadosparcas.domain.usecase.livegame.AddGameEventParams
import com.futebadosparcas.domain.usecase.livegame.FinishLiveGameUseCase
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class LiveGameViewModel(
    private val liveGameRepository: LiveGameRepository,
    private val gameRepository: GameRepository,
    private val authRepository: AuthRepository,
    private val addGameEventUseCase: AddGameEventUseCase,
    private val finishLiveGameUseCase: FinishLiveGameUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<LiveGameUiState>(LiveGameUiState.Loading)
    val uiState: StateFlow<LiveGameUiState> = _uiState

    private val _userMessage = MutableSharedFlow<String>()
    val userMessage: SharedFlow<String> = _userMessage

    private val _navigationEvent = MutableSharedFlow<LiveGameNavigationEvent>()
    val navigationEvent: SharedFlow<LiveGameNavigationEvent> = _navigationEvent

    private var currentGameId: String = ""
    private var currentGame: Game? = null

    // Job para controlar o collect do Flow
    private var scoreObserverJob: Job? = null

    // Flag para evitar navegação múltipla para votação
    private var hasNavigatedToVote: Boolean = false

    fun loadGame(gameId: String) {
        scoreObserverJob?.cancel()
        currentGameId = gameId
        hasNavigatedToVote = false

        scoreObserverJob = viewModelScope.launch {
            _uiState.value = LiveGameUiState.Loading

            // Mantém toda a tela reativa sem refazer leituras pontuais a cada placar.
            val gameFlow = gameRepository.getGameDetailsFlow(gameId)
            val scoreFlow = liveGameRepository.observeLiveScore(gameId)
            val teamsFlow = gameRepository.getGameTeamsFlow(gameId)
            val confirmationsFlow = gameRepository.getGameConfirmationsFlow(gameId)

            combine(gameFlow, scoreFlow, teamsFlow, confirmationsFlow) {
                    gameResult,
                    score,
                    teamsResult,
                    confirmationsResult ->
                LiveGameSnapshot(
                    gameResult = gameResult,
                    score = score,
                    teamsResult = teamsResult,
                    confirmationsResult = confirmationsResult
                )
            }
            .catch { e ->
                com.futebadosparcas.util.AppLogger.e("LiveGameViewModel", "Erro no combine de flows", e)
                _uiState.value = LiveGameUiState.Error(e.message ?: "Erro ao carregar jogo")
            }
            .collect { snapshot ->
                val game = snapshot.gameResult.getOrElse {
                    _uiState.value = LiveGameUiState.Error(it.message ?: "Erro ao carregar jogo")
                    return@collect
                }
                val teams = snapshot.teamsResult.getOrElse {
                    _uiState.value = LiveGameUiState.Error(it.message ?: "Erro ao carregar times")
                    return@collect
                }
                val confirmations = snapshot.confirmationsResult.getOrElse {
                    _uiState.value = LiveGameUiState.Error(it.message ?: "Erro ao carregar confirmações")
                    return@collect
                }
                val score = snapshot.score
                if (score == null) {
                    _uiState.value = LiveGameUiState.Loading
                    return@collect
                }
                currentGame = game

                val currentUserId = authRepository.getCurrentUserId()
                val isOwner = currentUserId != null && (currentUserId == game.ownerId || currentUserId in game.coOrganizers)

                // Detectar fim de jogo para navegação - apenas uma vez
                if (game.status == GameStatus.FINISHED.name && !hasNavigatedToVote) {
                    hasNavigatedToVote = true
                    _navigationEvent.emit(LiveGameNavigationEvent.NavigateToVote)
                }

                if (teams.size < 2) {
                    _uiState.value = LiveGameUiState.Error("Times não definidos.")
                } else {
                    // #3942: resolve o placar por time a partir do mapa canônico
                    // `score.scores` (2-4 times). Quando ausente (docs legados),
                    // cai para team1_id/team2_id — mesma estratégia do backend.
                    val scoresByTeamId: Map<String, Int> = score.scores.ifEmpty {
                        buildMap {
                            if (score.team1Id.isNotEmpty()) put(score.team1Id, score.team1Score)
                            if (score.team2Id.isNotEmpty()) put(score.team2Id, score.team2Score)
                        }
                    }

                    val teamScores = scoresByTeamId.keys.mapNotNull { teamId ->
                        teams.find { it.id == teamId }?.let { team ->
                            TeamScore(
                                team = team,
                                score = scoresByTeamId[teamId] ?: 0,
                                players = confirmations.filter { team.playerIds.contains(it.userId) }
                            )
                        }
                    }

                    if (teamScores.size < 2) {
                        com.futebadosparcas.util.AppLogger.w("LiveGameViewModel") {
                            "Vínculo do placar com os times é inválido: " +
                                "scores=${score.scores}, team1Id=${score.team1Id}, " +
                                "team2Id=${score.team2Id}, teams=${teams.map { it.id }}"
                        }
                        _uiState.value = LiveGameUiState.Error(
                            "Placar indisponível: times vinculados não foram encontrados."
                        )
                        return@collect
                    }

                    _uiState.value = LiveGameUiState.Success(
                        game = game,
                        score = score,
                        teamScores = teamScores,
                        isOwner = isOwner
                    )
                }
            }
        }
    }

    private data class LiveGameSnapshot(
        val gameResult: Result<Game>,
        val score: LiveScore?,
        val teamsResult: Result<List<Team>>,
        val confirmationsResult: Result<List<GameConfirmation>>
    )

    fun finishGame() {
        viewModelScope.launch {
            val result = finishLiveGameUseCase(currentGameId)
            if (result.isSuccess) {
                _userMessage.emit("Jogo finalizado com sucesso!")
            } else {
                _userMessage.emit("Erro ao finalizar jogo: ${result.exceptionOrNull()?.message}")
            }
        }
    }

    fun addGoal(playerId: String, playerName: String, teamId: String, assistedById: String? = null, assistedByName: String? = null, minute: Int = 0) {
        // BUG #7 FIX: Validar que jogador pertence ao time
        // #3942: aceita qualquer time válido do jogo (2-4 times), não só os 2 primeiros.
        val state = _uiState.value as? LiveGameUiState.Success
        if (state != null) {
            val team = state.teamScores.firstOrNull { it.team.id == teamId }?.team
            if (team == null || !team.playerIds.contains(playerId)) {
                viewModelScope.launch { _userMessage.emit("Erro: Jogador não pertence ao time selecionado") }
                return
            }
        }

        addEvent(
            eventType = GameEventType.GOAL,
            playerId = playerId,
            playerName = playerName,
            teamId = teamId,
            assistedById = assistedById,
            assistedByName = assistedByName,
            minute = minute,
            successMessage = "Gol de $playerName!",
            errorMessage = "Erro ao adicionar gol"
        )
    }

    fun addSave(playerId: String, playerName: String, teamId: String, minute: Int = 0) {
        addEvent(
            eventType = GameEventType.SAVE,
            playerId = playerId,
            playerName = playerName,
            teamId = teamId,
            minute = minute,
            successMessage = "Defesa de $playerName!",
            errorMessage = "Erro ao adicionar defesa"
        )
    }

    fun addYellowCard(playerId: String, playerName: String, teamId: String, minute: Int = 0) {
        addEvent(
            eventType = GameEventType.YELLOW_CARD,
            playerId = playerId,
            playerName = playerName,
            teamId = teamId,
            minute = minute,
            successMessage = "Cartão amarelo para $playerName",
            errorMessage = "Erro ao adicionar cartão"
        )
    }

    fun addRedCard(playerId: String, playerName: String, teamId: String, minute: Int = 0) {
        addEvent(
            eventType = GameEventType.RED_CARD,
            playerId = playerId,
            playerName = playerName,
            teamId = teamId,
            minute = minute,
            successMessage = "Cartão vermelho para $playerName",
            errorMessage = "Erro ao adicionar cartão"
        )
    }

    /**
     * Método centralizado para adicionar eventos via AddGameEventUseCase.
     * Elimina duplicação de código entre addGoal, addSave, addYellowCard, addRedCard.
     */
    private fun addEvent(
        eventType: GameEventType,
        playerId: String,
        playerName: String,
        teamId: String,
        assistedById: String? = null,
        assistedByName: String? = null,
        minute: Int = 0,
        successMessage: String,
        errorMessage: String
    ) {
        viewModelScope.launch {
            if (currentGameId.isEmpty()) {
                _userMessage.emit("Erro: ID do jogo não carregado")
                return@launch
            }

            val result = addGameEventUseCase(
                AddGameEventParams(
                    gameId = currentGameId,
                    eventType = eventType,
                    playerId = playerId,
                    playerName = playerName,
                    teamId = teamId,
                    assistedById = assistedById,
                    assistedByName = assistedByName,
                    minute = minute
                )
            )

            if (result.isSuccess) {
                _userMessage.emit(successMessage)
            } else {
                com.futebadosparcas.util.AppLogger.e("LiveGameViewModel", errorMessage, result.exceptionOrNull())
                _userMessage.emit("$errorMessage: ${result.exceptionOrNull()?.message}")
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        scoreObserverJob?.cancel()
    }
}

sealed class LiveGameUiState {
    object Loading : LiveGameUiState()
    data class Success(
        val game: Game,
        val score: LiveScore,
        val teamScores: List<TeamScore>,
        val isOwner: Boolean
    ) : LiveGameUiState() {
        // O domínio válido é 2..4 times (firestore.rules isValidNumberOfTeams).
        // O ViewModel filtra < 2 antes de construir este estado; a UI renderiza
        // qualquer quantidade via FlowRow, então não há require() aqui para não
        // transformar um dado de servidor inesperado em crash.

        // Compatibilidade com consumidores que esperam os dois primeiros times.
        val team1: Team get() = teamScores[0].team
        val team2: Team get() = teamScores[1].team
        val team1Players: List<GameConfirmation> get() = teamScores[0].players
        val team2Players: List<GameConfirmation> get() = teamScores[1].players
    }
    data class Error(val message: String) : LiveGameUiState()
}

/**
 * Placar de um time no jogo ao vivo.
 */
data class TeamScore(
    val team: Team,
    val score: Int,
    val players: List<GameConfirmation>
)

sealed class LiveGameNavigationEvent {
    object NavigateToVote : LiveGameNavigationEvent()
}
