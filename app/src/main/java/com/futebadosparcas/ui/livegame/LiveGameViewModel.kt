package com.futebadosparcas.ui.livegame

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.*
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.LiveGameRepository
import com.futebadosparcas.util.SoundHelper
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel principal para tela de jogo ao vivo
 *
 * Gerencia:
 * - Estado do jogo e placar em tempo real
 * - Eventos de jogo (gols, cartoes, substituicoes)
 * - Timer configuravel com pause/resume
 * - Modo arbitro
 * - Undo de eventos (janela de 30s)
 * - Efeitos sonoros via SoundHelper
 */
@HiltViewModel
class LiveGameViewModel @Inject constructor(
    private val liveGameRepository: LiveGameRepository,
    private val gameRepository: GameRepository,
    private val authRepository: AuthRepository,
    private val soundHelper: SoundHelper
) : ViewModel() {

    private val _uiState = MutableStateFlow<LiveGameUiState>(LiveGameUiState.Loading)
    val uiState: StateFlow<LiveGameUiState> = _uiState

    private val _userMessage = MutableSharedFlow<String>()
    val userMessage: SharedFlow<String> = _userMessage

    private val _navigationEvent = MutableSharedFlow<LiveGameNavigationEvent>()
    val navigationEvent: SharedFlow<LiveGameNavigationEvent> = _navigationEvent

    // Undo event state
    private val _undoableEvent = MutableStateFlow<UndoableEvent?>(null)
    val undoableEvent: StateFlow<UndoableEvent?> = _undoableEvent

    // Referee mode state
    private val _isRefereeMode = MutableStateFlow(false)
    val isRefereeMode: StateFlow<Boolean> = _isRefereeMode

    // Timer configuration
    private val _selectedHalfDuration = MutableStateFlow(25)
    val selectedHalfDuration: StateFlow<Int> = _selectedHalfDuration

    private var currentGameId: String = ""
    private var currentGame: Game? = null

    // Job para controlar o collect do Flow
    private var scoreObserverJob: Job? = null
    private var undoTimerJob: Job? = null

    // Flag para evitar navegação múltipla para votação
    private var hasNavigatedToVote: Boolean = false

    // Flag para evitar iniciar live game múltiplas vezes
    private var hasTriedToStartLiveGame: Boolean = false

    // Estado de som habilitado
    private val _soundEnabled = MutableStateFlow(true)
    val soundEnabled: StateFlow<Boolean> = _soundEnabled

    init {
        // Pre-carregar sons do jogo ao vivo
        soundHelper.preloadGameSounds()
    }

    /**
     * Habilita/desabilita efeitos sonoros
     */
    fun setSoundEnabled(enabled: Boolean) {
        _soundEnabled.value = enabled
        soundHelper.setSoundEnabled(enabled)
    }

    fun loadGame(gameId: String) {
        scoreObserverJob?.cancel()
        currentGameId = gameId
        hasNavigatedToVote = false
        hasTriedToStartLiveGame = false

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

                    // Handler para iniciar jogo se necessário
                    // Qualquer usuário confirmado pode iniciar se score não existir
                    if (score == null && game.status == "LIVE" && !hasTriedToStartLiveGame) {
                        hasTriedToStartLiveGame = true
                        // Iniciar placar ao vivo (qualquer um pode fazer isso se ainda não existe)
                        liveGameRepository.startLiveGame(gameId, team1.id, team2.id)
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

    /**
     * Inicia o jogo com apito
     */
    fun startGame() {
        viewModelScope.launch {
            // Tocar apito de inicio
            soundHelper.playGameStartSequence()
            _userMessage.emit("Jogo iniciado!")
        }
    }

    fun finishGame() {
        viewModelScope.launch {
            val result = liveGameRepository.finishGame(currentGameId)
            if (result.isSuccess) {
                // Tocar apito de fim de jogo
                soundHelper.playGameEndSequence()

                // Atualizar status do jogo para FINISHED
                gameRepository.updateGameStatus(currentGameId, "FINISHED")
                _userMessage.emit("Jogo finalizado com sucesso!")

                // Gamification: Awarding logic moved to Cloud Function
                // badgeAwarder.checkAndAwardBadges removed to prevent duplication
            } else {
                soundHelper.playError()
                _userMessage.emit("Erro ao finalizar jogo: ${result.exceptionOrNull()?.message}")
            }
        }
    }

    fun addGoal(playerId: String, playerName: String, teamId: String, assistedById: String? = null, assistedByName: String? = null, minute: Int = 0) {
        viewModelScope.launch {
            com.futebadosparcas.util.AppLogger.d("LiveGameViewModel") { "addGoal: currentGameId=$currentGameId, playerId=$playerId, teamId=$teamId" }

            if (currentGameId.isEmpty()) {
                _userMessage.emit("Erro: ID do jogo nao carregado")
                return@launch
            }

            // BUG #7 FIX: Validar que jogador pertence ao time
            val state = _uiState.value as? LiveGameUiState.Success
            if (state != null) {
                val team = when (teamId) {
                    state.team1.id -> state.team1
                    state.team2.id -> state.team2
                    else -> null
                }
                if (team == null || !team.playerIds.contains(playerId)) {
                    _userMessage.emit("Erro: Jogador nao pertence ao time selecionado")
                    return@launch
                }
            }

            val currentHalf = getCurrentHalf()
            val result = liveGameRepository.addGameEvent(
                gameId = currentGameId,
                eventType = GameEventType.GOAL,
                playerId = playerId,
                playerName = playerName,
                teamId = teamId,
                assistedById = assistedById,
                assistedByName = assistedByName,
                minute = minute,
                half = currentHalf
            )

            if (result.isSuccess) {
                // Tocar som de gol
                soundHelper.playGoalHorn()
                _userMessage.emit("Gol de $playerName!")
                result.getOrNull()?.let { event ->
                    startUndoTimer(event)
                }
            } else {
                soundHelper.playError()
                com.futebadosparcas.util.AppLogger.e("LiveGameViewModel", "Erro ao adicionar gol", result.exceptionOrNull())
                _userMessage.emit("Erro ao adicionar gol: ${result.exceptionOrNull()?.message}")
            }
        }
    }

    fun addSave(playerId: String, playerName: String, teamId: String, minute: Int = 0) {
        viewModelScope.launch {
            val currentHalf = getCurrentHalf()
            val result = liveGameRepository.addGameEvent(
                gameId = currentGameId,
                eventType = GameEventType.SAVE,
                playerId = playerId,
                playerName = playerName,
                teamId = teamId,
                minute = minute,
                half = currentHalf
            )

            if (result.isSuccess) {
                // Tocar som de defesa
                soundHelper.playSaveSound()
                _userMessage.emit("Defesa de $playerName!")
                result.getOrNull()?.let { event ->
                    startUndoTimer(event)
                }
            } else {
                soundHelper.playError()
                _userMessage.emit("Erro ao adicionar defesa")
            }
        }
    }

    fun addYellowCard(playerId: String, playerName: String, teamId: String, minute: Int = 0) {
        viewModelScope.launch {
            val currentHalf = getCurrentHalf()
            val result = liveGameRepository.addGameEvent(
                gameId = currentGameId,
                eventType = GameEventType.YELLOW_CARD,
                playerId = playerId,
                playerName = playerName,
                teamId = teamId,
                minute = minute,
                half = currentHalf
            )

            if (result.isSuccess) {
                // Tocar som de cartao
                soundHelper.playCardSound()
                _userMessage.emit("Cartao amarelo para $playerName")
                result.getOrNull()?.let { event ->
                    startUndoTimer(event)
                }
            } else {
                soundHelper.playError()
                _userMessage.emit("Erro ao adicionar cartao")
            }
        }
    }

    fun addRedCard(playerId: String, playerName: String, teamId: String, minute: Int = 0) {
        viewModelScope.launch {
            val currentHalf = getCurrentHalf()
            val result = liveGameRepository.addGameEvent(
                gameId = currentGameId,
                eventType = GameEventType.RED_CARD,
                playerId = playerId,
                playerName = playerName,
                teamId = teamId,
                minute = minute,
                half = currentHalf
            )

            if (result.isSuccess) {
                // Tocar som de cartao
                soundHelper.playCardSound()
                _userMessage.emit("Cartao vermelho para $playerName")
                result.getOrNull()?.let { event ->
                    startUndoTimer(event)
                }
            } else {
                soundHelper.playError()
                _userMessage.emit("Erro ao adicionar cartao")
            }
        }
    }

    /**
     * Adiciona uma substituicao
     */
    fun addSubstitution(
        playerInId: String,
        playerInName: String,
        playerOutId: String,
        playerOutName: String,
        teamId: String,
        minute: Int = 0
    ) {
        viewModelScope.launch {
            val currentHalf = getCurrentHalf()
            val result = liveGameRepository.addGameEvent(
                gameId = currentGameId,
                eventType = GameEventType.SUBSTITUTION,
                playerId = playerInId,
                playerName = playerInName,
                teamId = teamId,
                minute = minute,
                half = currentHalf,
                playerOutId = playerOutId,
                playerOutName = playerOutName
            )

            if (result.isSuccess) {
                // Tocar som de substituicao
                soundHelper.playSubstitutionSound()
                _userMessage.emit("Substituicao: $playerOutName saiu, $playerInName entrou")
                result.getOrNull()?.let { event ->
                    startUndoTimer(event)
                }
            } else {
                soundHelper.playError()
                _userMessage.emit("Erro ao adicionar substituicao")
            }
        }
    }

    /**
     * Define a duracao do tempo antes de iniciar o jogo
     */
    fun setHalfDuration(minutes: Int) {
        _selectedHalfDuration.value = minutes
    }

    /**
     * Pausa o timer
     */
    fun pauseTimer() {
        viewModelScope.launch {
            val result = liveGameRepository.pauseTimer(currentGameId)
            if (result.isSuccess) {
                _userMessage.emit("Tempo pausado")
            } else {
                _userMessage.emit("Erro ao pausar tempo")
            }
        }
    }

    /**
     * Resume o timer
     */
    fun resumeTimer() {
        viewModelScope.launch {
            val result = liveGameRepository.resumeTimer(currentGameId)
            if (result.isSuccess) {
                _userMessage.emit("Tempo retomado")
            } else {
                _userMessage.emit("Erro ao retomar tempo")
            }
        }
    }

    /**
     * Inicia o segundo tempo
     */
    fun startSecondHalf() {
        viewModelScope.launch {
            val result = liveGameRepository.startSecondHalf(currentGameId)
            if (result.isSuccess) {
                // Tocar apito para segundo tempo
                soundHelper.playHalfTimeSequence()
                _userMessage.emit("Segundo tempo iniciado!")
            } else {
                soundHelper.playError()
                _userMessage.emit("Erro ao iniciar segundo tempo")
            }
        }
    }

    /**
     * Alterna modo arbitro
     */
    fun toggleRefereeMode() {
        _isRefereeMode.value = !_isRefereeMode.value
    }

    /**
     * Desfaz o ultimo evento (dentro da janela de 30s)
     */
    fun undoLastEvent() {
        val eventToUndo = _undoableEvent.value ?: return

        viewModelScope.launch {
            val result = liveGameRepository.deleteGameEvent(currentGameId, eventToUndo.event.id)
            if (result.isSuccess) {
                _userMessage.emit("Evento desfeito!")
                _undoableEvent.value = null
                undoTimerJob?.cancel()
            } else {
                _userMessage.emit("Erro ao desfazer evento")
            }
        }
    }

    /**
     * Inicia timer de 30s para permitir undo
     */
    private fun startUndoTimer(event: GameEvent) {
        undoTimerJob?.cancel()
        _undoableEvent.value = UndoableEvent(event, System.currentTimeMillis())

        undoTimerJob = viewModelScope.launch {
            kotlinx.coroutines.delay(30_000L) // 30 segundos
            _undoableEvent.value = null
        }
    }

    /**
     * Cancela a opcao de undo
     */
    fun dismissUndo() {
        _undoableEvent.value = null
        undoTimerJob?.cancel()
    }

    /**
     * Obtem o tempo atual do jogo
     */
    private fun getCurrentHalf(): Int {
        val state = _uiState.value as? LiveGameUiState.Success
        return state?.score?.currentHalf ?: 1
    }

    /**
     * Adiciona gol com posicao no campo (heat map)
     */
    fun addGoalWithPosition(
        playerId: String,
        playerName: String,
        teamId: String,
        assistedById: String? = null,
        assistedByName: String? = null,
        minute: Int = 0,
        fieldPositionX: Float? = null,
        fieldPositionY: Float? = null
    ) {
        viewModelScope.launch {
            if (currentGameId.isEmpty()) {
                _userMessage.emit("Erro: ID do jogo nao carregado")
                return@launch
            }

            val state = _uiState.value as? LiveGameUiState.Success
            if (state != null) {
                val team = when (teamId) {
                    state.team1.id -> state.team1
                    state.team2.id -> state.team2
                    else -> null
                }
                if (team == null || !team.playerIds.contains(playerId)) {
                    _userMessage.emit("Erro: Jogador nao pertence ao time selecionado")
                    return@launch
                }
            }

            val currentHalf = getCurrentHalf()
            val result = liveGameRepository.addGameEvent(
                gameId = currentGameId,
                eventType = GameEventType.GOAL,
                playerId = playerId,
                playerName = playerName,
                teamId = teamId,
                assistedById = assistedById,
                assistedByName = assistedByName,
                minute = minute,
                half = currentHalf,
                fieldPositionX = fieldPositionX,
                fieldPositionY = fieldPositionY
            )

            if (result.isSuccess) {
                // Tocar som de gol
                soundHelper.playGoalHorn()
                _userMessage.emit("Gol de $playerName!")
                result.getOrNull()?.let { event ->
                    startUndoTimer(event)
                }
            } else {
                soundHelper.playError()
                _userMessage.emit("Erro ao adicionar gol")
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        scoreObserverJob?.cancel()
        undoTimerJob?.cancel()
    }
}

/**
 * Evento que pode ser desfeito
 */
data class UndoableEvent(
    val event: GameEvent,
    val createdAt: Long
) {
    fun getRemainingTimeMs(): Long {
        val elapsed = System.currentTimeMillis() - createdAt
        return maxOf(0L, 30_000L - elapsed)
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
