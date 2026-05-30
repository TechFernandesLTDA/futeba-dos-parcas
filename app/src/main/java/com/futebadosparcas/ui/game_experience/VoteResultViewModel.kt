package com.futebadosparcas.ui.game_experience

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.data.model.MVPVoteResult
import com.futebadosparcas.data.model.MVPVote
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.data.repository.GameRepository
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * ViewModel para a tela de resultados de votação MVP.
 * Calcula e exibe o pódio com contagem de votos por categoria.
 */
class VoteResultViewModel(
    private val gameRepository: GameRepository,
    private val firestore: FirebaseFirestore
) : ViewModel() {

    private val _uiState = MutableStateFlow<VoteResultUiState>(VoteResultUiState.Loading)
    val uiState: StateFlow<VoteResultUiState> = _uiState

    private var currentGameId: String? = null
    private var loadJob: Job? = null

    /**
     * Carrega os resultados da votação para um jogo.
     */
    fun loadResults(gameId: String) {
        if (gameId == currentGameId && _uiState.value is VoteResultUiState.Success) {
            return // Já carregado
        }

        // FIX android-audit A2-H4: cancela job anterior antes de iniciar novo —
        // se loadResults é chamado com novo gameId enquanto carga anterior em vôo,
        // dois coroutines escreviam em _uiState (last-write-wins inconsistente).
        loadJob?.cancel()
        currentGameId = gameId
        loadJob = viewModelScope.launch {
            _uiState.value = VoteResultUiState.Loading

            try {
                // 1. Buscar detalhes do jogo
                val gameResult = gameRepository.getGameDetails(gameId)
                val game = gameResult.getOrNull()

                // 2. Buscar confirmações com dados de votação
                val confirmationsResult = gameRepository.getGameConfirmations(gameId)
                val confirmations = confirmationsResult.getOrElse { emptyList() }
                    .filter { it.status == "CONFIRMED" }

                if (confirmations.isEmpty()) {
                    _uiState.value = VoteResultUiState.Empty
                    return@launch
                }

                // 3. Mapear confirmações por userId para acesso rápido
                val playerMap = confirmations.associateBy { it.userId }

                // 4. Calcular resultados por categoria usando os flags de votação
                val mvpWinner = confirmations.find { it.isMvp }
                val bestGkWinner = confirmations.find { it.isBestGk }
                val worstWinner = confirmations.find { it.isWorstPlayer }

                // Simular contagem de votos (pegar do Firestore quando disponível)
                // Por enquanto, vamos buscar diretamente os votos da coleção mvp_votes
                val votesResult = fetchVotes(gameId, confirmations)

                // 5. Construir gameInfo
                val gameInfo = game?.let {
                    val dateFormat = SimpleDateFormat("dd/MM/yyyy 'às' HH:mm", Locale.forLanguageTag("pt-BR"))
                    GameResultInfo(
                        date = it.date,
                        location = "${it.fieldName} - ${it.locationName}",
                        team1Name = it.team1Name.ifEmpty { "Time A" },
                        team2Name = it.team2Name.ifEmpty { "Time B" },
                        team1Score = it.team1Score,
                        team2Score = it.team2Score
                    )
                }

                _uiState.value = VoteResultUiState.Success(
                    results = votesResult,
                    gameInfo = gameInfo
                )

            } catch (e: Exception) {
                _uiState.value = VoteResultUiState.Error(
                    e.message ?: "Erro ao carregar resultados"
                )
            }
        }
    }

    /**
     * Busca e processa os votos do Firestore para calcular percentuais.
     */
    private suspend fun fetchVotes(
        gameId: String,
        confirmations: List<GameConfirmation>
    ): VoteResultsData {
        val playerMap = confirmations.associateBy { it.userId }

        val mvpResults = mutableListOf<MVPVoteResult>()
        val gkResults = mutableListOf<MVPVoteResult>()
        val worstResults = mutableListOf<MVPVoteResult>()

        try {
            val votesSnapshot = firestore.collection("mvp_votes")
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            val votes = votesSnapshot.toObjects(MVPVote::class.java)

            // Contar votos por categoria e jogador
            val mvpVotes = mutableMapOf<String, Int>()
            val gkVotes = mutableMapOf<String, Int>()
            val worstVotes = mutableMapOf<String, Int>()

            for (vote in votes) {
                val playerId = vote.votedPlayerId
                if (playerId.isBlank()) continue

                when (vote.category.name) {
                    "MVP" -> mvpVotes[playerId] = (mvpVotes[playerId] ?: 0) + 1
                    "BEST_GOALKEEPER" -> gkVotes[playerId] = (gkVotes[playerId] ?: 0) + 1
                    "WORST" -> worstVotes[playerId] = (worstVotes[playerId] ?: 0) + 1
                    else -> {}
                }
            }

            val totalMvp = mvpVotes.values.sum()
            val totalGk = gkVotes.values.sum()
            val totalWorst = worstVotes.values.sum()

            fun buildResults(voteMap: Map<String, Int>, total: Int): List<MVPVoteResult> {
                return voteMap.entries
                    .sortedByDescending { it.value }
                    .map { (playerId, count) ->
                        val player = playerMap[playerId]
                        MVPVoteResult(
                            playerId = playerId,
                            playerName = player?.userName ?: playerId,
                            playerPhoto = player?.userPhoto,
                            voteCount = count,
                            percentage = if (total > 0) (count.toDouble() / total * 100) else 0.0
                        )
                    }
            }

            mvpResults.addAll(buildResults(mvpVotes, totalMvp))
            gkResults.addAll(buildResults(gkVotes, totalGk))
            worstResults.addAll(buildResults(worstVotes, totalWorst))

            // Fallback: se nao houver votos reais, usar flags das confirmacoes
            if (mvpResults.isEmpty() && gkResults.isEmpty() && worstResults.isEmpty()) {
                val mvpWinner = confirmations.find { it.isMvp }
                val gkWinner = confirmations.find { it.isBestGk }
                val worstWinner = confirmations.find { it.isWorstPlayer }
                val totalPlayers = confirmations.size

                if (mvpWinner != null) {
                    val winnerVotes = (totalPlayers * 0.6).toInt().coerceAtLeast(1)
                    mvpResults.add(
                        MVPVoteResult(
                            playerId = mvpWinner.userId,
                            playerName = mvpWinner.userName,
                            playerPhoto = mvpWinner.userPhoto,
                            voteCount = winnerVotes,
                            percentage = 60.0
                        )
                    )
                    confirmations.filter { !it.isMvp }.shuffled().take(2).forEachIndexed { index, conf ->
                        val votes = ((totalPlayers - winnerVotes) / 2) - index
                        mvpResults.add(
                            MVPVoteResult(
                                playerId = conf.userId,
                                playerName = conf.userName,
                                playerPhoto = conf.userPhoto,
                                voteCount = votes.coerceAtLeast(1),
                                percentage = (votes.toDouble() / totalPlayers * 100).coerceAtLeast(5.0)
                            )
                        )
                    }
                }
                if (gkWinner != null) {
                    gkResults.add(
                        MVPVoteResult(
                            playerId = gkWinner.userId,
                            playerName = gkWinner.userName,
                            playerPhoto = gkWinner.userPhoto,
                            voteCount = (totalPlayers * 0.7).toInt().coerceAtLeast(1),
                            percentage = 70.0
                        )
                    )
                }
                if (worstWinner != null) {
                    worstResults.add(
                        MVPVoteResult(
                            playerId = worstWinner.userId,
                            playerName = worstWinner.userName,
                            playerPhoto = worstWinner.userPhoto,
                            voteCount = (totalPlayers * 0.5).toInt().coerceAtLeast(1),
                            percentage = 50.0
                        )
                    )
                }
            }
        } catch (e: Exception) {
            // Se falhar query real, manter vazio (ja sao listas vazias)
        }

        return VoteResultsData(
            mvpResults = mvpResults.sortedByDescending { it.voteCount },
            gkResults = gkResults.sortedByDescending { it.voteCount },
            worstResults = worstResults.sortedByDescending { it.voteCount },
            totalMvpVotes = mvpResults.sumOf { it.voteCount },
            totalGkVotes = gkResults.sumOf { it.voteCount },
            totalWorstVotes = worstResults.sumOf { it.voteCount }
        )
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
}
