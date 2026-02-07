package com.futebadosparcas.ui.game_experience

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.MVPVote
import com.futebadosparcas.data.model.VoteCategory
import com.futebadosparcas.data.repository.GameExperienceRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.domain.ranking.MatchFinalizationService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class MVPVoteViewModel @Inject constructor(
    private val gameRepository: GameRepository,
    private val gameExperienceRepository: GameExperienceRepository,
    private val userRepository: UserRepository,
    private val matchFinalizationService: MatchFinalizationService
) : ViewModel() {

    private val _uiState = MutableStateFlow<MVPVoteUiState>(MVPVoteUiState.Loading())
    val uiState: StateFlow<MVPVoteUiState> = _uiState

    private var loadJob: Job? = null
    private var voteJob: Job? = null
    private var finalizeJob: Job? = null

    private var allConfirmations: List<GameConfirmation> = emptyList()

    fun loadCandidates(gameId: String) {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            // Keep loading but maybe we don't know owner yet. Default false.
            _uiState.value = MVPVoteUiState.Loading(isOwner = false)
            
            // 1. Check Owner
            val currentUser = userRepository.getCurrentUserId()
            var isOwner = false
            var isFinished = false
            if (currentUser != null) {
                val gameResult = gameRepository.getGameDetails(gameId)
                gameResult.onSuccess { game ->
                    isOwner = (game.ownerId == currentUser)
                    isFinished = (game.status == com.futebadosparcas.data.model.GameStatus.FINISHED.name)
                }
            }

            if (isFinished) {
                _uiState.value = MVPVoteUiState.Finished(isOwner)
                return@launch
            }

            // 2. Check if voted
            if (currentUser != null) {
                val hasVotedResult = gameExperienceRepository.hasUserVoted(gameId, currentUser)
                if (hasVotedResult.getOrNull() == true) {
                    _uiState.value = MVPVoteUiState.AlreadyVoted(isOwner)
                    return@launch
                }
            }

            gameRepository.getGameConfirmations(gameId).fold(
                onSuccess = { confirmations ->
                    allConfirmations = confirmations.filter { it.status == "CONFIRMED" }
                    
                    if (allConfirmations.isEmpty()) {
                        _uiState.value = MVPVoteUiState.Error("Nenhum jogador confirmado para votar.", isOwner)
                    } else {
                        // Initial Category: MVP
                        val category = VoteCategory.MVP
                        val filteredCandidates = getCandidatesForCategory(category)
                        
                        _uiState.value = MVPVoteUiState.Voting(
                            candidates = filteredCandidates,
                            currentCategory = category,
                            isOwner = isOwner
                        )
                    }
                },
                onFailure = {
                    _uiState.value = MVPVoteUiState.Error(it.message ?: "Erro ao carregar candidatos", isOwner)
                }
            )
        }
    }

    private fun getCandidatesForCategory(category: VoteCategory): List<GameConfirmation> {
        return when (category) {
            VoteCategory.BEST_GOALKEEPER -> {
                allConfirmations.filter { it.position == "GOALKEEPER" }
            }
            else -> allConfirmations
        }
    }
    
    // Helper to determine next category skipping empty ones
    private fun getNextCategory(current: VoteCategory): VoteCategory? {
        var next: VoteCategory? = when(current) {
            VoteCategory.MVP -> VoteCategory.BEST_GOALKEEPER
            VoteCategory.BEST_GOALKEEPER -> VoteCategory.WORST
            VoteCategory.WORST -> null
            VoteCategory.CUSTOM -> null
        }
        
        // Skip BEST_GOALKEEPER if no candidates
        if (next == VoteCategory.BEST_GOALKEEPER) {
             val candidates = getCandidatesForCategory(next)
             if (candidates.isEmpty()) {
                 return getNextCategory(next) // Skip recursively
             }
        }
        return next
    }

    fun submitVote(gameId: String, votedPlayerId: String, category: VoteCategory) {
        // We need to preserve isOwner. It's on current state.
        val currentState = _uiState.value
        val isOwner = currentState.isOwner
        
        if (currentState !is MVPVoteUiState.Voting) return

        voteJob?.cancel()
        voteJob = viewModelScope.launch {
             val currentUser = userRepository.getCurrentUserId() ?: return@launch
             
             val vote = MVPVote(
                 gameId = gameId,
                 voterId = currentUser,
                 votedPlayerId = votedPlayerId,
                 category = category
             )

             gameExperienceRepository.submitVote(vote)
                 .onSuccess {
                     // Move to next category or finish
                     val nextCategory = getNextCategory(category)

                     if (nextCategory != null) {
                         val nextCandidates = getCandidatesForCategory(nextCategory)
                         _uiState.value = currentState.copy(
                             currentCategory = nextCategory,
                             candidates = nextCandidates,
                             isOwner = isOwner
                         )
                     } else {
                         _uiState.value = MVPVoteUiState.Finished(isOwner)

                         // Verifica se todos votaram para finalizar automaticamente
                         gameExperienceRepository.checkAllVoted(gameId)
                            .onSuccess { allVoted ->
                                if (allVoted) {
                                     finalizeVoting(gameId)
                                }
                            }
                     }
                 }
                 .onFailure { error ->
                     _uiState.value = MVPVoteUiState.Error(
                         error.message ?: "Erro ao enviar voto",
                         isOwner
                     )
                 }
        }
    }

    fun finalizeVoting(gameId: String) {
        finalizeJob?.cancel()
        finalizeJob = viewModelScope.launch {
            val currentState = _uiState.value
            _uiState.value = MVPVoteUiState.Loading(currentState.isOwner)

            gameExperienceRepository.concludeVoting(gameId)
                .onSuccess {
                    // PERF_001 P2 #22: Processar XP em IO thread (não Main)
                    // Evita bloqueio da UI durante cálculo intensivo
                    withContext(Dispatchers.IO) {
                        matchFinalizationService.processGame(gameId)
                    }

                    _uiState.value = MVPVoteUiState.Finished(currentState.isOwner)
                }
                .onFailure {
                    _uiState.value = MVPVoteUiState.Error("Erro ao concluir votação: ${it.message}", currentState.isOwner)
                }
        }
    }
    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
        voteJob?.cancel()
        finalizeJob?.cancel()
    }
}

sealed class MVPVoteUiState {
    abstract val isOwner: Boolean

    data class Loading(override val isOwner: Boolean = false) : MVPVoteUiState()
    data class AlreadyVoted(override val isOwner: Boolean) : MVPVoteUiState()
    data class Voting(
        val candidates: List<GameConfirmation>,
        val currentCategory: VoteCategory,
        override val isOwner: Boolean
    ) : MVPVoteUiState()
    data class Finished(override val isOwner: Boolean) : MVPVoteUiState()
    data class Error(val message: String, override val isOwner: Boolean = false) : MVPVoteUiState()
}
