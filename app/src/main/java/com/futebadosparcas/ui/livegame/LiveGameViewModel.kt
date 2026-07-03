package com.futebadosparcas.ui.livegame

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.*
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.LiveGameRepository
import com.futebadosparcas.domain.usecase.livegame.AddGameEventUseCase
import com.futebadosparcas.domain.usecase.livegame.AddGameEventParams
import com.futebadosparcas.domain.usecase.livegame.FinishLiveGameUseCase
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.catch
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

            // Combinar fluxos de Jogo e Placar
            val gameFlow = gameRepository.getGameDetailsFlow(gameId)
            val scoreFlow = liveGameRepository.observeLiveScore(gameId)

            combine(gameFlow, scoreFlow) { gameResult, score ->
                Pair(gameResult, score)
            }
            .catch { e ->
                com.futebadosparcas.util.AppLogger.e("LiveGameViewModel", "Erro no combine de flows", e)
                _uiState.value = LiveGameUiState.Error(e.message ?: "Erro ao carregar jogo")
            }
            .collect { (gameResult, score) ->
                val game = gameResult.getOrElse {
                    _uiState.value = LiveGameUiState.Error(it.message ?: "Erro ao carregar jogo")
                    return@collect
                }
                currentGame = game

                val isOwner = authRepository.getCurrentUserId() == game.ownerId

                // Detectar fim de jogo para navegação - apenas uma vez
                if (game.status == GameStatus.FINISHED.name && !hasNavigatedToVote) {
                    hasNavigatedToVote = true
                    _navigationEvent.emit(LiveGameNavigationEvent.NavigateToVote)
                }

                // Buscar times
                val teamsResult = gameRepository.getGameTeams(gameId)
                val teams = teamsResult.getOrNull() ?: emptyList()

                if (teams.size < 2) {
                    _uiState.value = LiveGameUiState.Error("Times não definidos.")
                } else {
                    val sortedTeams = teams.sortedBy { it.name }
                    var team1 = sortedTeams[0]
                    var team2 = sortedTeams[1]

                    // Se já existe placar, respeitar os IDs salvos
                    if (score != null) {
                        val savedTeam1 = teams.find { it.id == score.team1Id }
                        val savedTeam2 = teams.find { it.id == score.team2Id }
                        
                        if (savedTeam1 != null && savedTeam2 != null) {
                            team1 = savedTeam1
                            team2 = savedTeam2
                        } else {
                            // Fallback logging se times mudaram/foram deletados
                            com.futebadosparcas.util.AppLogger.w("LiveGameViewModel") { "Times do placar salvo não encontrados. Usando padrão." }
                        }
                    }

                    // Buscar confirmações para mapear nomes dos jogadores
                    val confirmationsResult = gameRepository.getGameConfirmations(gameId)
                    val confirmations = confirmationsResult.getOrNull() ?: emptyList()

                    val team1Players = confirmations.filter { team1.playerIds.contains(it.userId) }
                    val team2Players = confirmations.filter { team2.playerIds.contains(it.userId) }

                    _uiState.value = LiveGameUiState.Success(
                        game = game,
                        score = score ?: LiveGameScore(
                            id = gameId,
                            gameId = gameId,
                            team1Id = team1.id,
                            team2Id = team2.id,
                            team1Score = 0,
                            team2Score = 0
                        ),
                        team1 = team1,
                        team2 = team2,
                        team1Players = team1Players,
                        team2Players = team2Players,
                        isOwner = isOwner
                    )
                }
            }
        }
    }

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
        val state = _uiState.value as? LiveGameUiState.Success
        if (state != null) {
            val team = when (teamId) {
                state.team1.id -> state.team1
                state.team2.id -> state.team2
                else -> null
            }
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
        val score: LiveGameScore,
        val team1: Team,
        val team2: Team,
        val team1Players: List<GameConfirmation>,
        val team2Players: List<GameConfirmation>,
        val isOwner: Boolean
    ) : LiveGameUiState()
    data class Error(val message: String) : LiveGameUiState()
}

sealed class LiveGameNavigationEvent {
    object NavigateToVote : LiveGameNavigationEvent()
}
