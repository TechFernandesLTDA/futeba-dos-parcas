package com.futebadosparcas.data

import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.domain.model.XpLog
import com.futebadosparcas.domain.repository.GameResult
import com.futebadosparcas.domain.repository.RankingOrderBy
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.datetime.Clock
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.minus
import kotlinx.datetime.toLocalDateTime

/**
 * Implementacao Android do StatisticsRepository usando FirebaseDataSource.
 *
 * Esta implementacao fornece todas as operacoes de estatisticas necessarias
 * para o app, incluindo ranking, historico e atualizacao de estatisticas.
 */
class StatisticsRepositoryImpl(
    private val dataSource: FirebaseDataSource
) : StatisticsRepository {

    override suspend fun getMyStatistics(): Result<Statistics> {
        val userId = dataSource.getCurrentUserId()
            ?: return Result.failure(Exception("Usuario nao autenticado"))

        return getUserStatistics(userId)
    }

    override suspend fun getUserStatistics(userId: String): Result<Statistics> {
        return dataSource.getUserStatistics(userId)
    }

    override fun observeStatistics(userId: String): Flow<Statistics?> {
        return dataSource.getUserStatisticsFlow(userId)
            .map { result ->
                result.getOrNull()
            }
    }

    override suspend fun updateStatistics(
        userId: String,
        goals: Int,
        assists: Int,
        saves: Int,
        yellowCards: Int,
        redCards: Int,
        isBestPlayer: Boolean,
        isWorstPlayer: Boolean,
        hasBestGoal: Boolean,
        gameResult: GameResult
    ): Result<Statistics> {
        return try {
            // Buscar estatisticas atuais
            val currentStatsResult = dataSource.getUserStatistics(userId)
            val currentStats = if (currentStatsResult.isSuccess) {
                currentStatsResult.getOrNull() ?: Statistics(userId = userId)
            } else {
                Statistics(userId = userId)
            }

            // Calcular novas estatisticas
            val updatedStats = currentStats.copy(
                totalGames = currentStats.totalGames + 1,
                totalGoals = currentStats.totalGoals + goals,
                totalAssists = currentStats.totalAssists + assists,
                totalSaves = currentStats.totalSaves + saves,
                yellowCards = currentStats.yellowCards + yellowCards,
                redCards = currentStats.redCards + redCards,
                totalWins = currentStats.totalWins + if (gameResult == GameResult.WIN) 1 else 0,
                totalLosses = currentStats.totalLosses + if (gameResult == GameResult.LOSS) 1 else 0,
                totalDraws = currentStats.totalDraws + if (gameResult == GameResult.DRAW) 1 else 0,
                mvpCount = currentStats.mvpCount + if (isBestPlayer) 1 else 0,
                worstPlayerCount = currentStats.worstPlayerCount + if (isWorstPlayer) 1 else 0,
                updatedAt = Clock.System.now().toEpochMilliseconds()
            )

            // Atualizar no Firestore
            val updates: Map<String, Any> = mapOf(
                "total_games" to (updatedStats.totalGames ?: 0),
                "total_goals" to (updatedStats.totalGoals ?: 0),
                "total_assists" to (updatedStats.totalAssists ?: 0),
                "total_saves" to (updatedStats.totalSaves ?: 0),
                "yellow_cards" to (updatedStats.yellowCards ?: 0),
                "red_cards" to (updatedStats.redCards ?: 0),
                "total_wins" to (updatedStats.totalWins ?: 0),
                "total_losses" to (updatedStats.totalLosses ?: 0),
                "total_draws" to (updatedStats.totalDraws ?: 0),
                "mvp_count" to (updatedStats.mvpCount ?: 0),
                "worst_player_count" to (updatedStats.worstPlayerCount ?: 0),
                "updated_at" to (updatedStats.updatedAt ?: 0L)
            )

            val updateResult = dataSource.updateUserStatistics(userId, updates)
            if (updateResult.isSuccess) {
                Result.success(updatedStats)
            } else {
                Result.failure(updateResult.exceptionOrNull() ?: Exception("Falha ao atualizar estatisticas"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getTopScorers(limit: Int): Result<List<Statistics>> {
        return getGlobalRanking(RankingOrderBy.GOALS, limit)
    }

    override suspend fun getTopGoalkeepers(limit: Int): Result<List<Statistics>> {
        return getGlobalRanking(RankingOrderBy.ASSISTS, limit) // Como nao temos saves separado, usar assists
    }

    override suspend fun getBestPlayers(limit: Int): Result<List<Statistics>> {
        return getGlobalRanking(RankingOrderBy.MVP_COUNT, limit)
    }

    override suspend fun getGoalsHistory(userId: String): Result<Map<String, Int>> {
        return try {
            // Buscar jogos confirmados do usuario
            val confirmedGamesResult = dataSource.getConfirmedGamesForUser(userId)
            if (confirmedGamesResult.isFailure) {
                return Result.success(emptyMap())
            }

            val games = confirmedGamesResult.getOrNull() ?: emptyList()

            val goalsHistory = buildLast6MonthsMap()

            for (game in games) {
                try {
                    val gameDate = game.createdAt
                    if (gameDate != null) {
                        val monthKey = monthKeyFromEpochMs(gameDate)

                        if (goalsHistory.containsKey(monthKey)) {
                            val confirmationsResult = dataSource.getGameConfirmations(game.id)
                            val confirmations = confirmationsResult.getOrNull() ?: emptyList()

                            val userConfirmation = confirmations.find { it.userId == userId }
                            if (userConfirmation != null) {
                                goalsHistory[monthKey] = (goalsHistory[monthKey] ?: 0) + userConfirmation.goals
                            }
                        }
                    }
                } catch (e: Exception) {
                    continue
                }
            }

            Result.success(goalsHistory)
        } catch (e: Exception) {
            Result.success(buildLast6MonthsMap())
        }
    }

    /**
     * Constrói mapa "M/yyyy" -> 0 dos últimos 6 meses (cronológico).
     * Usa kotlinx.datetime para portabilidade Android+iOS.
     */
    private fun buildLast6MonthsMap(): LinkedHashMap<String, Int> {
        val zone = TimeZone.currentSystemDefault()
        val today: LocalDate = Clock.System.now().toLocalDateTime(zone).date
        val map = LinkedHashMap<String, Int>()
        for (offset in 5 downTo 0) {
            val d = today.minus(offset, DateTimeUnit.MONTH)
            map["${d.monthNumber}/${d.year}"] = 0
        }
        return map
    }

    private fun monthKeyFromEpochMs(epochMs: Long): String {
        val zone = TimeZone.currentSystemDefault()
        val ldt = Instant.fromEpochMilliseconds(epochMs).toLocalDateTime(zone)
        return "${ldt.monthNumber}/${ldt.year}"
    }

    override suspend fun getXpHistory(userId: String, limit: Int): Result<List<XpLog>> {
        return dataSource.getUserXpLogs(userId, limit)
    }

    override suspend fun saveXpLog(xpLog: XpLog): Result<Unit> {
        return try {
            dataSource.createXpLog(xpLog)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getGlobalRanking(
        orderBy: RankingOrderBy,
        limit: Int
    ): Result<List<Statistics>> {
        return try {
            // Mapear enum para campo do Firestore
            val orderByField = when (orderBy) {
                RankingOrderBy.GOALS -> "total_goals"
                RankingOrderBy.ASSISTS -> "total_assists"
                RankingOrderBy.GAMES -> "total_games"
                RankingOrderBy.WINS -> "total_wins"
                RankingOrderBy.MVP_COUNT -> "mvp_count"
                RankingOrderBy.WIN_RATE -> "total_wins" // Ordenar por wins, calcular rate no app
            }

            dataSource.getStatisticsRanking(orderByField, limit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
