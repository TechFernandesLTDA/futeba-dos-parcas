package com.futebadosparcas.ui.game_experience

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.MVPVoteResult
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.ui.components.reactions.SocialReactionEmojis
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.Date

/**
 * ViewModel para a tela de resultados de votação MVP.
 * Calcula e exibe o pódio com contagem de votos por categoria.
 */
class VoteResultViewModel(
    private val gameRepository: GameRepository,
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) : ViewModel() {

    private val _uiState = MutableStateFlow<VoteResultUiState>(VoteResultUiState.Loading)
    val uiState: StateFlow<VoteResultUiState> = _uiState

    private var currentGameId: String? = null
    private var loadJob: Job? = null

    /**
     * Carrega os resultados da votação para um jogo.
     */
    fun loadResults(gameId: String) {
        if (
            gameId == currentGameId &&
            loadJob?.isActive == true &&
            _uiState.value !is VoteResultUiState.Error
        ) {
            return
        }

        loadJob?.cancel()
        currentGameId = gameId

        loadJob = viewModelScope.launch {
            _uiState.value = VoteResultUiState.Loading
            combine(
                gameRepository.getGameDetailsFlow(gameId),
                gameRepository.getGameConfirmationsFlow(gameId)
            ) { gameResult, confirmationsResult ->
                gameResult.getOrThrow() to confirmationsResult.getOrThrow()
            }
                .catch { error ->
                    _uiState.value = VoteResultUiState.Error(
                        error.message ?: "Erro ao carregar resultados"
                    )
                }
                .collectLatest { (game, rawConfirmations) ->
                    val confirmations = rawConfirmations
                        .filter { it.status == "CONFIRMED" }
                    if (confirmations.isEmpty()) {
                        _uiState.value = VoteResultUiState.Empty
                        return@collectLatest
                    }
                    val players = confirmations.associateBy { it.userId }

                    fun winner(
                        playerId: String?,
                        votes: Int,
                        total: Int
                    ): List<MVPVoteResult> {
                        val player = playerId?.let(players::get) ?: return emptyList()
                        return listOf(
                            MVPVoteResult(
                                playerId = player.userId,
                                playerName = player.userName,
                                playerPhoto = player.userPhoto,
                                voteCount = votes,
                                percentage = if (total > 0) {
                                    votes.toDouble() / total * 100.0
                                } else 0.0
                            )
                        )
                    }

                    val results = VoteResultsData(
                            mvpResults = winner(game.mvpId, game.mvpVotes, game.mvpTotalVotes),
                            gkResults = winner(game.bestGkId, game.bestGkVotes, game.bestGkTotalVotes),
                            worstResults = winner(
                                game.worstPlayerId,
                                game.worstPlayerVotes,
                                game.worstPlayerTotalVotes
                            ),
                            totalMvpVotes = game.mvpTotalVotes,
                            totalGkVotes = game.bestGkTotalVotes,
                            totalWorstVotes = game.worstPlayerTotalVotes
                        )
                    if (
                        results.mvpResults.isEmpty() &&
                        results.gkResults.isEmpty() &&
                        results.worstResults.isEmpty()
                    ) {
                        _uiState.value = VoteResultUiState.Empty
                        return@collectLatest
                    }
                    _uiState.value = VoteResultUiState.Success(
                        results = results,
                        gameInfo = GameResultInfo(
                            date = game.date,
                            location = "${game.fieldName} - ${game.locationName}",
                            team1Name = game.team1Name.ifEmpty { "Time A" },
                            team2Name = game.team2Name.ifEmpty { "Time B" },
                            team1Score = game.team1Score,
                            team2Score = game.team2Score
                        ),
                        voteResultReactions = game.voteResultReactions,
                        votingConcludedAt = game.votingConcludedAt?.let(::Date),
                        currentUserId = auth.currentUser?.uid
                    )
                }
        }
    }

    /**
     * Compartilha o card de resultado de uma categoria.
     */
    fun shareResultCard(context: Context, gameId: String, category: VoteCategory) {
        val state = _uiState.value
        if (state !is VoteResultUiState.Success) return

        val results = when (category) {
            VoteCategory.MVP -> state.results.mvpResults
            VoteCategory.BEST_GOALKEEPER -> state.results.gkResults
            VoteCategory.WORST -> state.results.worstResults
            VoteCategory.CUSTOM -> emptyList()
        }

        if (results.isEmpty()) return

        // Usa o ShareMVPCardHelper para gerar e compartilhar o card
        ShareMVPCardHelper.shareResultCard(
            context = context,
            category = category,
            results = results,
            gameInfo = state.gameInfo,
            scope = viewModelScope
        )
    }

    fun toggleVoteResultReaction(gameId: String, emoji: String) {
        val state = _uiState.value as? VoteResultUiState.Success ?: return
        val uid = auth.currentUser?.uid ?: return
        if (emoji !in SocialReactionEmojis) return

        viewModelScope.launch {
            val currentEmoji = SocialReactionEmojis.firstOrNull { reaction ->
                state.voteResultReactions[reaction].orEmpty().contains(uid)
            }
            val updates = mutableMapOf<String, Any>()
            SocialReactionEmojis.forEach { reaction ->
                if (currentEmoji == emoji || reaction != emoji) {
                    updates["vote_result_reactions.$reaction"] = FieldValue.arrayRemove(uid)
                }
            }
            if (currentEmoji != emoji) {
                updates["vote_result_reactions.$emoji"] = FieldValue.arrayUnion(uid)
            }
            runCatching {
                firestore.collection("games").document(gameId).update(updates).await()
            }.onFailure { error ->
                _uiState.value = VoteResultUiState.Error(
                    error.message ?: "Erro ao atualizar reação"
                )
            }
        }
    }

    override fun onCleared() {
        loadJob?.cancel()
        super.onCleared()
    }
}
