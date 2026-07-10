package com.futebadosparcas.ui.game_experience

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.MVPVote
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.domain.repository.GameExperienceRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.domain.ranking.MatchFinalizationService
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class MVPVoteViewModel(
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
    private var currentUserId: String? = null
    private var submittedCategories: Set<VoteCategory> = emptySet()

    fun loadCandidates(gameId: String) {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.value = MVPVoteUiState.Loading(isOwner = false)
            currentUserId = userRepository.getCurrentUserId()
            val uid = currentUserId
            if (uid == null) {
                _uiState.value = MVPVoteUiState.Error(
                    errorResId = R.string.mvp_vote_error_not_auth
                )
                return@launch
            }

            combine(
                gameRepository.getGameDetailsFlow(gameId),
                gameRepository.getGameConfirmationsFlow(gameId)
            ) { gameResult, confirmationsResult ->
                gameResult.getOrThrow() to confirmationsResult.getOrThrow()
            }
                .catch {
                    _uiState.value = MVPVoteUiState.Error(
                        errorResId = R.string.mvp_vote_error_load_candidates
                    )
                }
                .collectLatest { (game, confirmations) ->
                    val isOwner = game.ownerId == uid ||
                        uid in game.coOrganizers
                    if (game.status != com.futebadosparcas.domain.model.GameStatus.FINISHED.name) {
                        _uiState.value = MVPVoteUiState.Error(
                            isOwner = isOwner,
                            errorResId = R.string.mvp_vote_error_game_not_finished
                        )
                        return@collectLatest
                    }
                    if (game.votingStatus == "CONCLUDED" || game.votingConcluded) {
                        _uiState.value = MVPVoteUiState.Finished(isOwner)
                        return@collectLatest
                    }

                    allConfirmations = confirmations.filter {
                        it.status == "CONFIRMED" && it.userId != uid
                    }
                    if (allConfirmations.isEmpty()) {
                        _uiState.value = MVPVoteUiState.Error(
                            isOwner = isOwner,
                            errorResId = R.string.mvp_vote_error_no_players
                        )
                        return@collectLatest
                    }

                    val categoriesResult = gameExperienceRepository
                        .getUserVoteCategories(gameId, uid)
                    if (categoriesResult.isFailure) {
                        _uiState.value = MVPVoteUiState.Error(
                            isOwner = isOwner,
                            errorResId = R.string.mvp_vote_error_load_votes
                        )
                        return@collectLatest
                    }
                    submittedCategories = categoriesResult.getOrDefault(emptySet())
                    if (hasCompletedRequiredBallot()) {
                        _uiState.value = MVPVoteUiState.AlreadyVoted(isOwner)
                        return@collectLatest
                    }

                    val currentCategory = firstPendingCategory()
                    if (currentCategory == null) {
                        _uiState.value = MVPVoteUiState.AlreadyVoted(isOwner)
                        return@collectLatest
                    }
                    _uiState.value = MVPVoteUiState.Voting(
                        candidates = getCandidatesForCategory(currentCategory),
                        currentCategory = currentCategory,
                        isOwner = isOwner
                    )
                }
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
    
    private fun hasCompletedRequiredBallot(): Boolean {
        return VoteCategory.MVP in submittedCategories &&
            VoteCategory.WORST in submittedCategories
    }

    private fun firstPendingCategory(): VoteCategory? {
        return listOf(
            VoteCategory.MVP,
            VoteCategory.BEST_GOALKEEPER,
            VoteCategory.WORST
        ).firstOrNull { category ->
            category !in submittedCategories &&
                getCandidatesForCategory(category).isNotEmpty()
        }
    }

    fun submitVote(gameId: String, votedPlayerId: String, category: VoteCategory) {
        val currentState = _uiState.value
        if (currentState !is MVPVoteUiState.Voting) return
        if (currentState.isSubmitting || voteJob?.isActive == true) return
        if (category != currentState.currentCategory) return
        if (currentState.candidates.none { it.userId == votedPlayerId }) return
        val isOwner = currentState.isOwner

        voteJob = viewModelScope.launch {
             _uiState.value = currentState.copy(isSubmitting = true)
             val currentUser = userRepository.getCurrentUserId()
             if (currentUser == null) {
                 _uiState.value = MVPVoteUiState.Error(
                     isOwner = isOwner,
                     errorResId = R.string.mvp_vote_error_not_auth
                 )
                 return@launch
             }
             
             val vote = MVPVote(
                 gameId = gameId,
                 voterId = currentUser,
                 votedPlayerId = votedPlayerId,
                 category = category
             )

             gameExperienceRepository.submitVote(vote)
                 .onSuccess {
                     submittedCategories = submittedCategories + category
                     val nextCategory = firstPendingCategory()

                     if (!hasCompletedRequiredBallot() && nextCategory != null) {
                         val nextCandidates = getCandidatesForCategory(nextCategory)
                         _uiState.value = currentState.copy(
                             currentCategory = nextCategory,
                             candidates = nextCandidates,
                             isOwner = isOwner,
                             isSubmitting = false
                         )
                     } else {
                         _uiState.value = MVPVoteUiState.AlreadyVoted(isOwner)

                         // Só gestores podem chamar concludeMvpVoting. O contador
                         // autoritativo atualiza em tempo real para o CTA do gestor.
                         if (isOwner) gameExperienceRepository.checkAllVoted(gameId)
                            .onSuccess { allVoted ->
                                if (allVoted) {
                                     finalizeVoting(gameId)
                                }
                            }
                     }
                 }
                 .onFailure {
                     _uiState.value = MVPVoteUiState.Error(
                         isOwner = isOwner,
                         errorResId = R.string.mvp_vote_error_submit
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
                    // Processar XP após conclusão da votação
                    matchFinalizationService.processGame(gameId)

                    _uiState.value = MVPVoteUiState.Finished(currentState.isOwner)
                }
                .onFailure {
                    _uiState.value = MVPVoteUiState.Error(
                        isOwner = currentState.isOwner,
                        errorResId = R.string.mvp_vote_error_finalize_generic
                    )
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
        override val isOwner: Boolean,
        val isSubmitting: Boolean = false
    ) : MVPVoteUiState()
    data class Finished(override val isOwner: Boolean) : MVPVoteUiState()
    data class Error(
        val message: String = "",
        override val isOwner: Boolean = false,
        @StringRes val errorResId: Int? = null
    ) : MVPVoteUiState()
}
