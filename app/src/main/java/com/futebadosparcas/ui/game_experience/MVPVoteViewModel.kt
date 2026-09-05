package com.futebadosparcas.ui.game_experience

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.AttributeRating
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.MVPVote
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.data.model.VoteCategory
import com.futebadosparcas.data.model.VoteResultWithPodium
import com.futebadosparcas.data.model.VotingSettings
import com.futebadosparcas.data.repository.GameExperienceRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.domain.ranking.MatchFinalizationService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit
import javax.inject.Inject

/**
 * ViewModel para a tela de votação MVP.
 *
 * Melhorias implementadas (Issues #51-60):
 * - #51: Votação anônima
 * - #52: Categorias customizáveis
 * - #53: Avaliação de atributos (1-5 estrelas)
 * - #54: Timeout de votação com countdown
 * - #55: Reveal animado de resultados
 * - #56: Opção de pular voto
 * - #57: Top 3 (podium) em vez de só 1
 * - #58: Compartilhar resultado
 * - #59: Badge MVP Streak
 * - #60: Votação separada goleiros/jogadores
 */
@HiltViewModel
class MVPVoteViewModel @Inject constructor(
    private val gameRepository: GameRepository,
    private val gameExperienceRepository: GameExperienceRepository,
    private val userRepository: UserRepository,
    private val matchFinalizationService: MatchFinalizationService
) : ViewModel() {

    private val _uiState = MutableStateFlow<MVPVoteUiState>(MVPVoteUiState.Loading())
    val uiState: StateFlow<MVPVoteUiState> = _uiState

    private var allConfirmations: List<GameConfirmation> = emptyList()
    private var votingSettings: VotingSettings = VotingSettings()
    private var enabledCategories: List<VoteCategory> = emptyList()
    private var currentCategoryIndex: Int = 0
    private var votedCategories: MutableSet<VoteCategory> = mutableSetOf()
    private var countdownJob: Job? = null
    private var currentGameId: String = ""
    private var isCurrentUserGoalkeeper: Boolean = false

    // Avaliação de atributos do jogador selecionado
    private var currentAttributeRatings: MutableMap<String, AttributeRating> = mutableMapOf()

    fun loadCandidates(gameId: String) {
        currentGameId = gameId
        viewModelScope.launch {
            _uiState.value = MVPVoteUiState.Loading(isOwner = false)

            // 1. Check Owner e estado do jogo
            val currentUser = userRepository.getCurrentUserId()
            var isOwner = false
            var isFinished = false
            var votingDeadlineMs: Long = 0
            var groupId: String? = null

            if (currentUser != null) {
                val gameResult = gameRepository.getGameDetails(gameId)
                gameResult.onSuccess { game ->
                    isOwner = (game.ownerId == currentUser)
                    isFinished = (game.status == com.futebadosparcas.data.model.GameStatus.FINISHED.name)
                    votingDeadlineMs = game.getVotingTimeRemainingMs()
                    groupId = game.groupId
                }
            }

            if (isFinished && votingDeadlineMs <= 0) {
                // Votação encerrada - mostrar resultados
                loadVoteResults(gameId, isOwner)
                return@launch
            }

            // 2. Carregar configurações de votação do grupo
            groupId?.let { gid ->
                gameExperienceRepository.getVotingSettings(gid).onSuccess { settings ->
                    if (settings != null) {
                        votingSettings = settings
                    }
                }
            }

            // 3. Determinar categorias habilitadas
            enabledCategories = votingSettings.enabledCategories.mapNotNull { categoryName ->
                try {
                    VoteCategory.valueOf(categoryName)
                } catch (e: Exception) {
                    null
                }
            }
            if (enabledCategories.isEmpty()) {
                enabledCategories = listOf(VoteCategory.MVP, VoteCategory.BEST_GOALKEEPER, VoteCategory.WORST)
            }

            // 4. Check if voted
            if (currentUser != null) {
                val hasVotedResult = gameExperienceRepository.hasUserVoted(gameId, currentUser)
                if (hasVotedResult.getOrNull() == true) {
                    _uiState.value = MVPVoteUiState.AlreadyVoted(isOwner, votingDeadlineMs)
                    startCountdown(votingDeadlineMs)
                    return@launch
                }
            }

            // 5. Carregar confirmados
            gameRepository.getGameConfirmations(gameId).fold(
                onSuccess = { confirmations ->
                    allConfirmations = confirmations.filter { it.status == "CONFIRMED" }

                    // Verificar se o usuário atual é goleiro
                    isCurrentUserGoalkeeper = allConfirmations.any {
                        it.userId == currentUser && it.position == PlayerPosition.GOALKEEPER.name
                    }

                    if (allConfirmations.isEmpty()) {
                        _uiState.value = MVPVoteUiState.Error("Nenhum jogador confirmado para votar.", isOwner)
                    } else {
                        currentCategoryIndex = 0
                        val category = getCurrentCategory()
                        val filteredCandidates = getCandidatesForCategory(category)

                        _uiState.value = MVPVoteUiState.Voting(
                            candidates = filteredCandidates,
                            currentCategory = category,
                            currentCategoryIndex = currentCategoryIndex,
                            totalCategories = enabledCategories.size,
                            isOwner = isOwner,
                            votingDeadlineMs = votingDeadlineMs,
                            allowSkipVote = votingSettings.allowSkipVote,
                            isAnonymous = votingSettings.isAnonymous,
                            separateGoalkeeperVoting = votingSettings.separateGoalkeeperVoting,
                            showAttributeRating = true
                        )

                        startCountdown(votingDeadlineMs)
                    }
                },
                onFailure = {
                    _uiState.value = MVPVoteUiState.Error(it.message ?: "Erro ao carregar candidatos", isOwner)
                }
            )
        }
    }

    private fun getCurrentCategory(): VoteCategory {
        return enabledCategories.getOrElse(currentCategoryIndex) { VoteCategory.MVP }
    }

    private fun getCandidatesForCategory(category: VoteCategory): List<GameConfirmation> {
        return when {
            // Votação separada para goleiros (#60)
            votingSettings.separateGoalkeeperVoting && category == VoteCategory.BEST_GOALKEEPER -> {
                // Somente goleiros votam em goleiros
                if (isCurrentUserGoalkeeper) {
                    allConfirmations.filter { it.position == PlayerPosition.GOALKEEPER.name }
                } else {
                    emptyList() // Jogadores de linha não votam nesta categoria
                }
            }
            votingSettings.separateGoalkeeperVoting && category == VoteCategory.MVP -> {
                // Somente jogadores de linha votam em MVP de linha
                if (!isCurrentUserGoalkeeper) {
                    allConfirmations.filter { it.position != PlayerPosition.GOALKEEPER.name }
                } else {
                    emptyList() // Goleiros não votam nesta categoria
                }
            }
            category == VoteCategory.BEST_GOALKEEPER -> {
                allConfirmations.filter { it.position == PlayerPosition.GOALKEEPER.name }
            }
            else -> allConfirmations
        }
    }

    private fun getNextCategory(): VoteCategory? {
        var nextIndex = currentCategoryIndex + 1

        while (nextIndex < enabledCategories.size) {
            val nextCategory = enabledCategories[nextIndex]
            val candidates = getCandidatesForCategory(nextCategory)

            // Pular categorias sem candidatos
            if (candidates.isEmpty()) {
                nextIndex++
                continue
            }

            currentCategoryIndex = nextIndex
            return nextCategory
        }

        return null
    }

    /**
     * Submete um voto para o candidato selecionado.
     */
    fun submitVote(gameId: String, votedPlayerId: String, category: VoteCategory) {
        val currentState = _uiState.value
        val isOwner = currentState.isOwner

        if (currentState !is MVPVoteUiState.Voting) return

        viewModelScope.launch {
            val currentUser = userRepository.getCurrentUserId() ?: return@launch

            val vote = MVPVote(
                gameId = gameId,
                voterId = currentUser,
                votedPlayerId = votedPlayerId,
                category = category,
                skipped = false
            )

            gameExperienceRepository.submitVote(vote)
            votedCategories.add(category)

            // Submeter avaliação de atributos se existir
            currentAttributeRatings[votedPlayerId]?.let { rating ->
                gameExperienceRepository.submitAttributeRating(rating.copy(
                    gameId = gameId,
                    raterId = currentUser,
                    ratedPlayerId = votedPlayerId
                ))
            }

            moveToNextCategoryOrFinish(isOwner, currentState.votingDeadlineMs)
        }
    }

    /**
     * Pula a votação na categoria atual (#56).
     */
    fun skipVote(gameId: String, category: VoteCategory) {
        val currentState = _uiState.value
        val isOwner = currentState.isOwner

        if (currentState !is MVPVoteUiState.Voting) return
        if (!votingSettings.allowSkipVote) return

        viewModelScope.launch {
            val currentUser = userRepository.getCurrentUserId() ?: return@launch

            // Registrar voto pulado
            val vote = MVPVote(
                gameId = gameId,
                voterId = currentUser,
                votedPlayerId = "",
                category = category,
                skipped = true
            )

            gameExperienceRepository.submitVote(vote)
            votedCategories.add(category)

            moveToNextCategoryOrFinish(isOwner, currentState.votingDeadlineMs)
        }
    }

    /**
     * Atualiza a avaliação de atributos para um jogador (#53).
     */
    fun updateAttributeRating(
        playerId: String,
        defense: Int = 0,
        attack: Int = 0,
        technique: Int = 0,
        hustle: Int = 0,
        fairPlay: Int = 0
    ) {
        val existing = currentAttributeRatings[playerId] ?: AttributeRating()
        currentAttributeRatings[playerId] = existing.copy(
            ratedPlayerId = playerId,
            defense = defense.coerceIn(0, 5),
            attack = attack.coerceIn(0, 5),
            technique = technique.coerceIn(0, 5),
            hustle = hustle.coerceIn(0, 5),
            fairPlay = fairPlay.coerceIn(0, 5)
        )
    }

    private fun moveToNextCategoryOrFinish(isOwner: Boolean, votingDeadlineMs: Long) {
        val nextCategory = getNextCategory()

        if (nextCategory != null) {
            val nextCandidates = getCandidatesForCategory(nextCategory)
            val currentState = _uiState.value

            _uiState.value = MVPVoteUiState.Voting(
                candidates = nextCandidates,
                currentCategory = nextCategory,
                currentCategoryIndex = currentCategoryIndex,
                totalCategories = enabledCategories.size,
                isOwner = isOwner,
                votingDeadlineMs = votingDeadlineMs,
                allowSkipVote = votingSettings.allowSkipVote,
                isAnonymous = votingSettings.isAnonymous,
                separateGoalkeeperVoting = votingSettings.separateGoalkeeperVoting,
                showAttributeRating = true
            )
        } else {
            _uiState.value = MVPVoteUiState.Finished(isOwner)

            // Check if ALL players voted to auto-finish
            viewModelScope.launch {
                gameExperienceRepository.checkAllVoted(currentGameId)
                    .onSuccess { allVoted ->
                        if (allVoted) {
                            finalizeVoting(currentGameId)
                        }
                    }
            }
        }
    }

    /**
     * Finaliza a votação (apenas owner).
     */
    fun finalizeVoting(gameId: String) {
        viewModelScope.launch {
            val currentState = _uiState.value
            _uiState.value = MVPVoteUiState.Loading(currentState.isOwner)

            gameExperienceRepository.concludeVoting(gameId)
                .onSuccess {
                    // Process XP and Stats
                    matchFinalizationService.processGame(gameId)

                    // Carregar resultados para exibição animada
                    loadVoteResults(gameId, currentState.isOwner)
                }
                .onFailure {
                    _uiState.value = MVPVoteUiState.Error("Erro ao concluir votação: ${it.message}", currentState.isOwner)
                }
        }
    }

    /**
     * Carrega os resultados da votação para exibição com podium (#55, #57).
     */
    private suspend fun loadVoteResults(gameId: String, isOwner: Boolean) {
        gameExperienceRepository.getVoteResults(gameId, votingSettings.isAnonymous)
            .onSuccess { results ->
                _uiState.value = MVPVoteUiState.ShowResults(
                    results = results,
                    isOwner = isOwner,
                    showTop3 = votingSettings.showTop3,
                    isAnonymous = votingSettings.isAnonymous
                )
            }
            .onFailure {
                _uiState.value = MVPVoteUiState.Finished(isOwner)
            }
    }

    /**
     * Inicia countdown para o prazo de votação (#54).
     */
    private fun startCountdown(remainingMs: Long) {
        countdownJob?.cancel()

        if (remainingMs <= 0) return

        countdownJob = viewModelScope.launch {
            var remaining = remainingMs

            while (remaining > 0) {
                delay(1000)
                remaining -= 1000

                // Atualizar o estado com o tempo restante
                when (val current = _uiState.value) {
                    is MVPVoteUiState.Voting -> {
                        _uiState.value = current.copy(votingDeadlineMs = remaining)
                    }
                    is MVPVoteUiState.AlreadyVoted -> {
                        _uiState.value = current.copy(votingDeadlineMs = remaining)
                    }
                    else -> { /* noop */ }
                }
            }

            // Votação expirou
            _uiState.value = MVPVoteUiState.VotingExpired(_uiState.value.isOwner)
        }
    }

    override fun onCleared() {
        super.onCleared()
        countdownJob?.cancel()
    }
}

/**
 * Estados da tela de votação MVP.
 */
sealed class MVPVoteUiState {
    abstract val isOwner: Boolean

    data class Loading(override val isOwner: Boolean = false) : MVPVoteUiState()

    data class AlreadyVoted(
        override val isOwner: Boolean,
        val votingDeadlineMs: Long = 0
    ) : MVPVoteUiState()

    data class Voting(
        val candidates: List<GameConfirmation>,
        val currentCategory: VoteCategory,
        val currentCategoryIndex: Int,
        val totalCategories: Int,
        override val isOwner: Boolean,
        val votingDeadlineMs: Long = 0,
        val allowSkipVote: Boolean = true,
        val isAnonymous: Boolean = false,
        val separateGoalkeeperVoting: Boolean = false,
        val showAttributeRating: Boolean = false
    ) : MVPVoteUiState()

    data class Finished(override val isOwner: Boolean) : MVPVoteUiState()

    data class VotingExpired(override val isOwner: Boolean) : MVPVoteUiState()

    data class ShowResults(
        val results: List<VoteResultWithPodium>,
        override val isOwner: Boolean,
        val showTop3: Boolean = true,
        val isAnonymous: Boolean = false
    ) : MVPVoteUiState()

    data class Error(val message: String, override val isOwner: Boolean = false) : MVPVoteUiState()
}

/**
 * Extensão para formatar tempo restante.
 */
fun Long.formatTimeRemaining(): String {
    if (this <= 0) return "00:00"

    val hours = TimeUnit.MILLISECONDS.toHours(this)
    val minutes = TimeUnit.MILLISECONDS.toMinutes(this) % 60
    val seconds = TimeUnit.MILLISECONDS.toSeconds(this) % 60

    return if (hours > 0) {
        String.format("%02d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format("%02d:%02d", minutes, seconds)
    }
}
