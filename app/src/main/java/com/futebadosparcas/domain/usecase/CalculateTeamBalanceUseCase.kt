package com.futebadosparcas.domain.usecase

import com.futebadosparcas.data.datasource.FirebaseDataSource
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.Team
import com.futebadosparcas.domain.ai.AiTeamBalancer
import com.futebadosparcas.util.AppLogger

/**
 * Use Case para calcular balanceamento de times.
 *
 * Responsabilidades:
 * - Buscar confirmações de presença
 * - Validar dados necessários
 * - Executar algoritmo de balanceamento (TeamBalancer)
 * - Salvar times gerados
 */
class CalculateTeamBalanceUseCase constructor(
    private val firebaseDataSource: FirebaseDataSource,
    private val teamBalancer: AiTeamBalancer
) {
    companion object {
        private const val TAG = "CalculateTeamBalanceUseCase"
    }

    /**
     * Calcula e gera times balanceados para um jogo.
     *
     * @param gameId ID do jogo
     * @param numberOfTeams Número de times (padrão: 2)
     * @param saveTeams Se deve salvar os times no Firebase (padrão: true)
     * @return Result com lista de times gerados
     */
    suspend fun execute(
        gameId: String,
        numberOfTeams: Int = 2,
        saveTeams: Boolean = true
    ): Result<List<Team>> {
        AppLogger.d(TAG) {
            "Calculando balanceamento: gameId=$gameId, teams=$numberOfTeams, save=$saveTeams"
        }

        // 1. Validar parâmetros
        if (numberOfTeams < 2) {
            return Result.failure(
                IllegalArgumentException("Número de times deve ser pelo menos 2")
            )
        }

        // 2. Buscar confirmações de presença
        val confirmations = firebaseDataSource.getGameConfirmations(gameId)
            .getOrElse { return Result.failure(it) }

        // 3. Filtrar apenas jogadores confirmados
        val confirmedPlayers = confirmations.filter {
            it.getStatusEnum() == com.futebadosparcas.domain.model.ConfirmationStatus.CONFIRMED
        }

        if (confirmedPlayers.isEmpty()) {
            return Result.failure(
                IllegalStateException("Nenhum jogador confirmado para gerar times")
            )
        }

        if (confirmedPlayers.size < numberOfTeams) {
            return Result.failure(
                IllegalStateException(
                    "Número de jogadores (${confirmedPlayers.size}) menor que número de times ($numberOfTeams)"
                )
            )
        }

        AppLogger.d(TAG) {
            "Balanceando ${confirmedPlayers.size} jogadores em $numberOfTeams times"
        }

        // 4. Executar algoritmo de balanceamento
        val teams = teamBalancer.balanceTeams(
            gameId = gameId,
            players = confirmedPlayers,
            numberOfTeams = numberOfTeams
        ).getOrElse {
            AppLogger.e(TAG, "Erro ao balancear times", it)
            return Result.failure(it)
        }

        AppLogger.d(TAG) {
            "Times balanceados com sucesso: ${teams.size} times gerados"
        }

        // 5. Salvar times se solicitado
        if (saveTeams) {
            // Limpar times anteriores
            val clearResult = firebaseDataSource.clearGameTeams(gameId)
            if (clearResult.isFailure) {
                AppLogger.w(TAG) {
                    "Falha ao limpar times anteriores: ${clearResult.exceptionOrNull()?.message}"
                }
            }

            // Salvar novos times
            firebaseDataSource.saveTeams(gameId, teams)
                .getOrElse { return Result.failure(it) }

            AppLogger.d(TAG) { "Times salvos com sucesso no Firebase" }
        }

        return Result.success(teams)
    }

    /**
     * Busca times já gerados para um jogo.
     *
     * @param gameId ID do jogo
     * @return Result com lista de times
     */
    suspend fun getGeneratedTeams(gameId: String): Result<List<Team>> {
        AppLogger.d(TAG) { "Buscando times gerados: gameId=$gameId" }

        return firebaseDataSource.getGameTeams(gameId)
    }

    /**
     * Remove times gerados de um jogo.
     *
     * @param gameId ID do jogo
     * @return Result indicando sucesso ou falha
     */
    suspend fun clearTeams(gameId: String): Result<Unit> {
        AppLogger.d(TAG) { "Removendo times: gameId=$gameId" }

        return firebaseDataSource.clearGameTeams(gameId)
    }

    /**
     * Analisa balanceamento de times existentes.
     *
     * @param teams Lista de times para analisar
     * @return Análise do balanceamento
     */
    fun analyzeBalance(teams: List<Team>): BalanceAnalysis {
        if (teams.isEmpty()) {
            return BalanceAnalysis(
                isBalanced = false,
                teamSizes = emptyList(),
                averageSize = 0.0,
                sizeDifference = 0,
                balanceScore = 0.0
            )
        }

        val teamSizes = teams.map { it.playerIds.size }
        val maxSize = teamSizes.maxOrNull() ?: 0
        val minSize = teamSizes.minOrNull() ?: 0
        val averageSize = teamSizes.average()
        val sizeDifference = maxSize - minSize

        // Score de balanceamento (0.0 a 1.0, onde 1.0 = perfeitamente balanceado)
        val balanceScore = if (maxSize > 0) {
            1.0 - (sizeDifference.toDouble() / maxSize.toDouble())
        } else {
            0.0
        }

        val isBalanced = sizeDifference <= 1 // Diferença máxima de 1 jogador

        AppLogger.d(TAG) {
            "Análise: ${teams.size} times, tamanhos=$teamSizes, " +
            "diff=$sizeDifference, score=${"%.2f".format(balanceScore)}, balanced=$isBalanced"
        }

        return BalanceAnalysis(
            isBalanced = isBalanced,
            teamSizes = teamSizes,
            averageSize = averageSize,
            sizeDifference = sizeDifference,
            balanceScore = balanceScore
        )
    }

    /**
     * Análise de balanceamento de times.
     */
    data class BalanceAnalysis(
        val isBalanced: Boolean,
        val teamSizes: List<Int>,
        val averageSize: Double,
        val sizeDifference: Int,
        val balanceScore: Double
    )
}
