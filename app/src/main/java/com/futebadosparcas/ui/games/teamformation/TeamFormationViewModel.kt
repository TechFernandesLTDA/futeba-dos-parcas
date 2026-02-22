package com.futebadosparcas.ui.games.teamformation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.*
import com.futebadosparcas.data.model.SavedTeamFormation
import com.futebadosparcas.data.model.DraftState
import com.futebadosparcas.data.model.DraftRevealAnimation
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.ai.EnhancedTeamBalancer
import com.futebadosparcas.domain.ai.PlayerForBalancing
import com.futebadosparcas.domain.ai.SwapSuggestion
import com.futebadosparcas.domain.ai.toPlayerForBalancing
import com.futebadosparcas.domain.model.PlayerPosition
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

class TeamFormationViewModel(
    private val gameRepository: GameRepository,
    private val authRepository: AuthRepository,
    private val savedFormationRepository: SavedFormationRepository
) : ViewModel() {

    companion object {
        private const val TAG = "TeamFormationViewModel"
        private const val DRAFT_REVEAL_DELAY_MS = 800L
        private const val CAPTAIN_PICK_TIMER_SECONDS = 30
    }

    private val _uiState = MutableStateFlow<TeamFormationUiState>(TeamFormationUiState.Loading)
    val uiState: StateFlow<TeamFormationUiState> = _uiState

    private val _draftAnimationState = MutableStateFlow<DraftAnimationState>(DraftAnimationState.Idle)
    val draftAnimationState: StateFlow<DraftAnimationState> = _draftAnimationState

    private var loadJob: Job? = null
    private var draftJob: Job? = null
    private var timerJob: Job? = null
    private val enhancedBalancer = EnhancedTeamBalancer()

    private var gameId: String = ""
    private var currentPlayers: List<DraftPlayer> = emptyList()
    private var pairs: MutableList<PlayerPair> = mutableListOf()

    /**
     * Carrega os dados do jogo para formacao de times.
     */
    fun loadGame(id: String) {
        if (id.isEmpty()) {
            _uiState.value = TeamFormationUiState.Error("ID do jogo invalido")
            return
        }

        gameId = id
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.value = TeamFormationUiState.Loading

            try {
                // Buscar confirmacoes do jogo
                val confirmationsResult = gameRepository.getGameConfirmations(id)
                val confirmations = confirmationsResult.getOrElse {
                    _uiState.value = TeamFormationUiState.Error(it.message ?: "Erro ao carregar confirmacoes")
                    return@launch
                }

                // Filtrar apenas confirmados
                val confirmedPlayers = confirmations.filter { it.status == ConfirmationStatus.CONFIRMED.name }

                if (confirmedPlayers.size < 2) {
                    _uiState.value = TeamFormationUiState.Error("Minimo de 2 jogadores confirmados necessarios")
                    return@launch
                }

                // Converter para DraftPlayer
                currentPlayers = confirmedPlayers.map { conf ->
                    val position = PlayerPosition.fromString(conf.position)
                    DraftPlayer(
                        id = conf.userId,
                        name = conf.userName,
                        photoUrl = conf.userPhoto,
                        position = position,
                        overallRating = 3.0f, // Valor padrao, idealmente buscar do perfil
                        strikerRating = 3.0f,
                        midRating = 3.0f,
                        defenderRating = 3.0f,
                        gkRating = if (position == PlayerPosition.GOALKEEPER) 4.0f else 2.0f
                    )
                }

                // Buscar times existentes
                val teamsResult = gameRepository.getGameTeams(id)
                val existingTeams = teamsResult.getOrNull() ?: emptyList()

                // Buscar formacoes salvas
                val currentUserId = authRepository.getCurrentUserId() ?: ""
                val savedFormations = savedFormationRepository.getSavedFormations(currentUserId)
                    .getOrNull() ?: emptyList()

                _uiState.value = TeamFormationUiState.Ready(
                    gameId = id,
                    players = currentPlayers,
                    existingTeams = existingTeams,
                    pairs = pairs.toList(),
                    settings = DraftSettings(),
                    savedFormations = savedFormations,
                    teamAPlayers = emptyList(),
                    teamBPlayers = emptyList(),
                    teamAColor = TeamColor.BLUE,
                    teamBColor = TeamColor.RED,
                    teamAStrength = null,
                    teamBStrength = null,
                    headToHead = null,
                    rotationSuggestions = emptyList()
                )
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao carregar jogo para formacao", e)
                _uiState.value = TeamFormationUiState.Error(e.message ?: "Erro desconhecido")
            }
        }
    }

    /**
     * Adiciona um par de jogadores para manter juntos.
     */
    fun addPair(player1Id: String, player2Id: String) {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return

        val player1 = currentPlayers.find { it.id == player1Id } ?: return
        val player2 = currentPlayers.find { it.id == player2Id } ?: return

        // Verificar se ja existe par com algum desses jogadores
        if (pairs.any { it.containsPlayer(player1Id) || it.containsPlayer(player2Id) }) {
            _uiState.value = state.copy(userMessage = "Jogador ja esta em outro par")
            return
        }

        val newPair = PlayerPair(
            player1Id = player1Id,
            player2Id = player2Id,
            player1Name = player1.name,
            player2Name = player2.name
        )
        pairs.add(newPair)

        _uiState.value = state.copy(pairs = pairs.toList())
    }

    /**
     * Remove um par de jogadores.
     */
    fun removePair(player1Id: String, player2Id: String) {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return

        pairs.removeAll { it.player1Id == player1Id && it.player2Id == player2Id }
        _uiState.value = state.copy(pairs = pairs.toList())
    }

    /**
     * Atualiza as configuracoes do draft.
     */
    fun updateSettings(settings: DraftSettings) {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return
        _uiState.value = state.copy(settings = settings)
    }

    /**
     * Define a cor de um time.
     */
    fun setTeamColor(teamIndex: Int, color: TeamColor) {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return

        _uiState.value = if (teamIndex == 0) {
            state.copy(teamAColor = color)
        } else {
            state.copy(teamBColor = color)
        }
    }

    /**
     * Inicia o sorteio automatico de times.
     */
    fun startAutoDraft() {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return

        draftJob?.cancel()
        draftJob = viewModelScope.launch {
            _draftAnimationState.value = DraftAnimationState.Starting

            val playersForBalancing = currentPlayers.map { it.toPlayerForBalancing() }

            // Executar balanceamento
            val result = enhancedBalancer.balance(
                players = playersForBalancing,
                pairs = pairs,
                goalkeepersPerTeam = state.settings.goalkeepersPerTeam,
                considerPositions = state.settings.considerPositions
            )

            // Animar revelacao dos jogadores
            val allReveals = mutableListOf<DraftRevealAnimation>()

            // Intercalar jogadores dos dois times
            val maxSize = maxOf(result.teamA.size, result.teamB.size)
            for (i in 0 until maxSize) {
                if (i < result.teamA.size) {
                    val player = result.teamA[i]
                    val draftPlayer = currentPlayers.find { it.id == player.id }
                    allReveals.add(
                        DraftRevealAnimation(
                            playerId = player.id,
                            playerName = player.name,
                            playerPhoto = draftPlayer?.photoUrl,
                            teamIndex = 0,
                            teamName = "Time A",
                            teamColor = toAndroidTeamColor(state.teamAColor),
                            revealDelayMs = allReveals.size * DRAFT_REVEAL_DELAY_MS
                        )
                    )
                }
                if (i < result.teamB.size) {
                    val player = result.teamB[i]
                    val draftPlayer = currentPlayers.find { it.id == player.id }
                    allReveals.add(
                        DraftRevealAnimation(
                            playerId = player.id,
                            playerName = player.name,
                            playerPhoto = draftPlayer?.photoUrl,
                            teamIndex = 1,
                            teamName = "Time B",
                            teamColor = toAndroidTeamColor(state.teamBColor),
                            revealDelayMs = allReveals.size * DRAFT_REVEAL_DELAY_MS
                        )
                    )
                }
            }

            // Executar animacoes
            for (reveal in allReveals) {
                delay(DRAFT_REVEAL_DELAY_MS)
                _draftAnimationState.value = DraftAnimationState.Revealing(reveal)
            }

            delay(DRAFT_REVEAL_DELAY_MS)

            // Atualizar estado final
            val teamADraftPlayers = result.teamA.mapNotNull { p -> currentPlayers.find { it.id == p.id } }
            val teamBDraftPlayers = result.teamB.mapNotNull { p -> currentPlayers.find { it.id == p.id } }

            _uiState.value = state.copy(
                teamAPlayers = teamADraftPlayers,
                teamBPlayers = teamBDraftPlayers,
                teamAStrength = result.teamAStrength,
                teamBStrength = result.teamBStrength,
                rotationSuggestions = result.rotationSuggestions
            )

            _draftAnimationState.value = DraftAnimationState.Completed
        }
    }

    /**
     * Inicia o modo de escolha por capitaes.
     */
    fun startCaptainPicks(captain1Id: String, captain2Id: String) {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return

        val captain1 = currentPlayers.find { it.id == captain1Id }
        val captain2 = currentPlayers.find { it.id == captain2Id }

        if (captain1 == null || captain2 == null) {
            _uiState.value = state.copy(userMessage = "Capitaes invalidos")
            return
        }

        val remainingPlayers = currentPlayers.filter { it.id != captain1Id && it.id != captain2Id }

        val draftState = DraftState.InProgress(
            currentPickerId = captain1Id,
            currentPickerName = captain1.name,
            pickNumber = 1,
            team1Picks = listOf(captain1Id),
            team2Picks = listOf(captain2Id),
            remainingPlayers = remainingPlayers.map { it.id },
            timerSeconds = CAPTAIN_PICK_TIMER_SECONDS,
            isTeam1Turn = true
        )

        _uiState.value = state.copy(
            settings = state.settings.copy(
                captainPicksMode = true,
                captain1Id = captain1Id,
                captain2Id = captain2Id
            ),
            draftState = draftState,
            teamAPlayers = listOf(captain1),
            teamBPlayers = listOf(captain2)
        )

        startPickTimer()
    }

    /**
     * Capitao escolhe um jogador.
     */
    fun captainPickPlayer(playerId: String) {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return
        val draftState = state.draftState as? DraftState.InProgress ?: return

        if (playerId !in draftState.remainingPlayers) return

        val pickedPlayer = currentPlayers.find { it.id == playerId } ?: return

        val newTeam1Picks = if (draftState.isTeam1Turn) {
            draftState.team1Picks + playerId
        } else draftState.team1Picks

        val newTeam2Picks = if (!draftState.isTeam1Turn) {
            draftState.team2Picks + playerId
        } else draftState.team2Picks

        val newRemaining = draftState.remainingPlayers - playerId

        // Verificar se o draft terminou
        if (newRemaining.isEmpty()) {
            finishCaptainDraft(newTeam1Picks, newTeam2Picks)
            return
        }

        // Proximo turno (snake draft: 1,2,2,1,1,2,2...)
        val nextPickNumber = draftState.pickNumber + 1
        val roundNumber = (nextPickNumber - 1) / 2
        val isNextTeam1Turn = if (roundNumber % 2 == 0) {
            (nextPickNumber - 1) % 2 == 0
        } else {
            (nextPickNumber - 1) % 2 == 1
        }

        val nextCaptainId = if (isNextTeam1Turn) state.settings.captain1Id else state.settings.captain2Id
        val nextCaptain = currentPlayers.find { it.id == nextCaptainId }

        val newDraftState = DraftState.InProgress(
            currentPickerId = nextCaptainId ?: "",
            currentPickerName = nextCaptain?.name ?: "",
            pickNumber = nextPickNumber,
            team1Picks = newTeam1Picks,
            team2Picks = newTeam2Picks,
            remainingPlayers = newRemaining,
            timerSeconds = CAPTAIN_PICK_TIMER_SECONDS,
            isTeam1Turn = isNextTeam1Turn
        )

        val teamAPlayers = newTeam1Picks.mapNotNull { id -> currentPlayers.find { it.id == id } }
        val teamBPlayers = newTeam2Picks.mapNotNull { id -> currentPlayers.find { it.id == id } }

        _uiState.value = state.copy(
            draftState = newDraftState,
            teamAPlayers = teamAPlayers,
            teamBPlayers = teamBPlayers
        )

        // Reiniciar timer
        startPickTimer()
    }

    private fun finishCaptainDraft(team1Picks: List<String>, team2Picks: List<String>) {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return

        timerJob?.cancel()

        val teamAPlayers = team1Picks.mapNotNull { id -> currentPlayers.find { it.id == id } }
        val teamBPlayers = team2Picks.mapNotNull { id -> currentPlayers.find { it.id == id } }

        // Calcular forcas
        val teamAForBalancing = teamAPlayers.map { it.toPlayerForBalancing() }
        val teamBForBalancing = teamBPlayers.map { it.toPlayerForBalancing() }

        val teamAStrength = enhancedBalancer.calculateTeamStrength("A", "Time A", teamAForBalancing)
        val teamBStrength = enhancedBalancer.calculateTeamStrength("B", "Time B", teamBForBalancing)

        _uiState.value = state.copy(
            draftState = DraftState.Completed(team1Picks, team2Picks),
            teamAPlayers = teamAPlayers,
            teamBPlayers = teamBPlayers,
            teamAStrength = teamAStrength,
            teamBStrength = teamBStrength
        )
    }

    private fun startPickTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            var seconds = CAPTAIN_PICK_TIMER_SECONDS
            while (seconds > 0) {
                delay(1000)
                seconds--

                val state = _uiState.value as? TeamFormationUiState.Ready ?: return@launch
                val draftState = state.draftState as? DraftState.InProgress ?: return@launch

                _uiState.value = state.copy(
                    draftState = draftState.copy(timerSeconds = seconds)
                )
            }

            // Tempo esgotado - escolher automaticamente
            autoPickForCaptain()
        }
    }

    private fun autoPickForCaptain() {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return
        val draftState = state.draftState as? DraftState.InProgress ?: return

        if (draftState.remainingPlayers.isNotEmpty()) {
            // Escolher o melhor jogador disponivel
            val bestPlayer = draftState.remainingPlayers
                .mapNotNull { id -> currentPlayers.find { it.id == id } }
                .maxByOrNull { it.overallRating }

            if (bestPlayer != null) {
                captainPickPlayer(bestPlayer.id)
            }
        }
    }

    /**
     * Move um jogador entre times (drag and drop).
     */
    fun movePlayerToTeam(playerId: String, targetTeamIndex: Int) {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return

        val player = currentPlayers.find { it.id == playerId } ?: return

        val newTeamA = state.teamAPlayers.toMutableList()
        val newTeamB = state.teamBPlayers.toMutableList()

        // Remover do time atual
        newTeamA.removeAll { it.id == playerId }
        newTeamB.removeAll { it.id == playerId }

        // Adicionar ao time destino
        if (targetTeamIndex == 0) {
            newTeamA.add(player)
        } else {
            newTeamB.add(player)
        }

        // Recalcular forcas
        val teamAForBalancing = newTeamA.map { it.toPlayerForBalancing() }
        val teamBForBalancing = newTeamB.map { it.toPlayerForBalancing() }

        val teamAStrength = enhancedBalancer.calculateTeamStrength("A", "Time A", teamAForBalancing)
        val teamBStrength = enhancedBalancer.calculateTeamStrength("B", "Time B", teamBForBalancing)

        _uiState.value = state.copy(
            teamAPlayers = newTeamA,
            teamBPlayers = newTeamB,
            teamAStrength = teamAStrength,
            teamBStrength = teamBStrength
        )
    }

    /**
     * Salva a formacao atual como favorita.
     */
    fun saveFormation(name: String) {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return

        if (state.teamAPlayers.isEmpty() || state.teamBPlayers.isEmpty()) {
            _uiState.value = state.copy(userMessage = "Defina os times antes de salvar")
            return
        }

        viewModelScope.launch {
            val currentUserId = authRepository.getCurrentUserId() ?: return@launch

            val formation = SavedTeamFormation(
                ownerId = currentUserId,
                name = name,
                team1PlayerIds = state.teamAPlayers.map { it.id },
                team2PlayerIds = state.teamBPlayers.map { it.id },
                team1Color = state.teamAColor.name,
                team2Color = state.teamBColor.name
            )

            val result = savedFormationRepository.saveFormation(formation)
            if (result.isSuccess) {
                val updatedFormations = savedFormationRepository.getSavedFormations(currentUserId)
                    .getOrNull() ?: state.savedFormations

                _uiState.value = state.copy(
                    savedFormations = updatedFormations,
                    userMessage = "Formacao salva com sucesso"
                )
            } else {
                _uiState.value = state.copy(userMessage = "Erro ao salvar formacao")
            }
        }
    }

    /**
     * Carrega uma formacao salva.
     */
    fun loadFormation(formationId: String) {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return

        val formation = state.savedFormations.find { it.id == formationId } ?: return

        // Verificar se todos os jogadores da formacao estao disponiveis
        val team1Players = formation.team1PlayerIds.mapNotNull { id ->
            currentPlayers.find { it.id == id }
        }
        val team2Players = formation.team2PlayerIds.mapNotNull { id ->
            currentPlayers.find { it.id == id }
        }

        if (team1Players.isEmpty() && team2Players.isEmpty()) {
            _uiState.value = state.copy(userMessage = "Nenhum jogador desta formacao esta disponivel")
            return
        }

        // Calcular forcas
        val teamAForBalancing = team1Players.map { it.toPlayerForBalancing() }
        val teamBForBalancing = team2Players.map { it.toPlayerForBalancing() }

        val teamAStrength = enhancedBalancer.calculateTeamStrength("A", "Time A", teamAForBalancing)
        val teamBStrength = enhancedBalancer.calculateTeamStrength("B", "Time B", teamBForBalancing)

        _uiState.value = state.copy(
            teamAPlayers = team1Players,
            teamBPlayers = team2Players,
            teamAColor = toKmpTeamColor(formation.getTeam1ColorEnum()),
            teamBColor = toKmpTeamColor(formation.getTeam2ColorEnum()),
            teamAStrength = teamAStrength,
            teamBStrength = teamBStrength
        )

        // Atualizar uso da formacao
        viewModelScope.launch {
            savedFormationRepository.incrementFormationUsage(formationId)
        }
    }

    /**
     * Exclui uma formacao salva.
     */
    fun deleteFormation(formationId: String) {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return

        viewModelScope.launch {
            val result = savedFormationRepository.deleteFormation(formationId)
            if (result.isSuccess) {
                val updatedFormations = state.savedFormations.filter { it.id != formationId }
                _uiState.value = state.copy(savedFormations = updatedFormations)
            }
        }
    }

    /**
     * Confirma e salva os times no jogo.
     */
    fun confirmTeams() {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return

        if (state.teamAPlayers.isEmpty() || state.teamBPlayers.isEmpty()) {
            _uiState.value = state.copy(userMessage = "Defina os times antes de confirmar")
            return
        }

        viewModelScope.launch {
            val team1 = Team(
                gameId = gameId,
                name = "Time 1",
                color = state.teamAColor.hexValue.toString(16),
                playerIds = state.teamAPlayers.map { it.id },
                score = 0
            )

            val team2 = Team(
                gameId = gameId,
                name = "Time 2",
                color = state.teamBColor.hexValue.toString(16),
                playerIds = state.teamBPlayers.map { it.id },
                score = 0
            )

            // Limpar times existentes e criar novos
            gameRepository.clearGameTeams(gameId)
            val result = gameRepository.generateTeams(gameId, 2, false)

            if (result.isSuccess) {
                // Atualizar com nossos times customizados
                gameRepository.updateTeams(listOf(team1, team2))
                _uiState.value = state.copy(userMessage = "Times confirmados com sucesso")
            } else {
                _uiState.value = state.copy(userMessage = "Erro ao confirmar times")
            }
        }
    }

    /**
     * Limpa a mensagem do usuario.
     */
    fun clearUserMessage() {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return
        _uiState.value = state.copy(userMessage = null)
    }

    /**
     * Reseta o draft para o estado inicial.
     */
    fun resetDraft() {
        val state = _uiState.value as? TeamFormationUiState.Ready ?: return

        timerJob?.cancel()
        draftJob?.cancel()

        _uiState.value = state.copy(
            teamAPlayers = emptyList(),
            teamBPlayers = emptyList(),
            teamAStrength = null,
            teamBStrength = null,
            draftState = null,
            rotationSuggestions = emptyList()
        )

        _draftAnimationState.value = DraftAnimationState.Idle
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
        draftJob?.cancel()
        timerJob?.cancel()
    }

    /**
     * Converte TeamColor de data.model para domain.model.
     */
    private fun toKmpTeamColor(androidColor: com.futebadosparcas.data.model.TeamColor): TeamColor {
        return when (androidColor) {
            com.futebadosparcas.data.model.TeamColor.RED -> TeamColor.RED
            com.futebadosparcas.data.model.TeamColor.BLUE -> TeamColor.BLUE
            com.futebadosparcas.data.model.TeamColor.GREEN -> TeamColor.GREEN
            com.futebadosparcas.data.model.TeamColor.YELLOW -> TeamColor.YELLOW
            com.futebadosparcas.data.model.TeamColor.ORANGE -> TeamColor.ORANGE
            com.futebadosparcas.data.model.TeamColor.PURPLE -> TeamColor.PURPLE
            com.futebadosparcas.data.model.TeamColor.BLACK -> TeamColor.BLACK
            com.futebadosparcas.data.model.TeamColor.WHITE -> TeamColor.WHITE
            com.futebadosparcas.data.model.TeamColor.PINK -> TeamColor.PINK
            com.futebadosparcas.data.model.TeamColor.CYAN -> TeamColor.CYAN
        }
    }

    /**
     * Converte TeamColor de domain.model para data.model (inverso).
     */
    private fun toAndroidTeamColor(kmpColor: TeamColor): com.futebadosparcas.data.model.TeamColor {
        return when (kmpColor) {
            TeamColor.RED -> com.futebadosparcas.data.model.TeamColor.RED
            TeamColor.BLUE -> com.futebadosparcas.data.model.TeamColor.BLUE
            TeamColor.GREEN -> com.futebadosparcas.data.model.TeamColor.GREEN
            TeamColor.YELLOW -> com.futebadosparcas.data.model.TeamColor.YELLOW
            TeamColor.ORANGE -> com.futebadosparcas.data.model.TeamColor.ORANGE
            TeamColor.PURPLE -> com.futebadosparcas.data.model.TeamColor.PURPLE
            TeamColor.BLACK -> com.futebadosparcas.data.model.TeamColor.BLACK
            TeamColor.WHITE -> com.futebadosparcas.data.model.TeamColor.WHITE
            TeamColor.PINK -> com.futebadosparcas.data.model.TeamColor.PINK
            TeamColor.CYAN -> com.futebadosparcas.data.model.TeamColor.CYAN
        }
    }
}

/**
 * Estado da UI da tela de formacao de times.
 */
sealed class TeamFormationUiState {
    object Loading : TeamFormationUiState()

    data class Ready(
        val gameId: String,
        val players: List<DraftPlayer>,
        val existingTeams: List<Team>,
        val pairs: List<PlayerPair>,
        val settings: DraftSettings,
        val savedFormations: List<SavedTeamFormation>,
        val teamAPlayers: List<DraftPlayer>,
        val teamBPlayers: List<DraftPlayer>,
        val teamAColor: TeamColor,
        val teamBColor: TeamColor,
        val teamAStrength: TeamStrength?,
        val teamBStrength: TeamStrength?,
        val headToHead: HeadToHeadHistory? = null,
        val rotationSuggestions: List<SwapSuggestion> = emptyList(),
        val draftState: DraftState? = null,
        val userMessage: String? = null
    ) : TeamFormationUiState()

    data class Error(val message: String) : TeamFormationUiState()
}

/**
 * Estado da animacao do draft.
 */
sealed class DraftAnimationState {
    object Idle : DraftAnimationState()
    object Starting : DraftAnimationState()
    data class Revealing(val current: DraftRevealAnimation) : DraftAnimationState()
    object Completed : DraftAnimationState()
}
