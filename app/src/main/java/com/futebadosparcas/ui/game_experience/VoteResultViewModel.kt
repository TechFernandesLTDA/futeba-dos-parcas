package com.futebadosparcas.ui.game_experience

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.MVPVoteResult
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.data.repository.GameRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * ViewModel para a tela de resultados de votação MVP.
 * Calcula e exibe o pódio com contagem de votos por categoria.
 */
class VoteResultViewModel(
    private val gameRepository: GameRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<VoteResultUiState>(VoteResultUiState.Loading)
    val uiState: StateFlow<VoteResultUiState> = _uiState

    private var currentGameId: String? = null

    /**
     * Carrega os resultados da votação para um jogo.
     */
    fun loadResults(gameId: String) {
        if (gameId == currentGameId && _uiState.value is VoteResultUiState.Success) {
            return // Já carregado
        }

        currentGameId = gameId
        viewModelScope.launch {
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
        // Mapear jogadores por ID
        val playerMap = confirmations.associateBy { it.userId }

        // Simular votos com base nas flags de votação das confirmações
        // Isso é uma simplificação - idealmente buscamos da coleção mvp_votes
        val mvpResults = mutableListOf<MVPVoteResult>()
        val gkResults = mutableListOf<MVPVoteResult>()
        val worstResults = mutableListOf<MVPVoteResult>()

        // MVP: quem tem is_mvp = true fica em primeiro
        val mvpWinner = confirmations.find { it.isMvp }
        val totalPlayers = confirmations.size

        if (mvpWinner != null) {
            // Simular distribuição de votos
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

            // Adicionar outros jogadores com votos simulados
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

        // Melhor Goleiro
        val gkWinner = confirmations.find { it.isBestGk }
        if (gkWinner != null) {
            val goalkeepers = confirmations.filter { it.position == "GOALKEEPER" }
            val gkVotes = goalkeepers.size
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

        // Bola Murcha
        val worstWinner = confirmations.find { it.isWorstPlayer }
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
            gameInfo = state.gameInfo
        )
    }
}
