package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StatisticsRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) : IStatisticsRepository, StatisticsRepository {
    private val statisticsCollection = firestore.collection("statistics")

    override suspend fun getMyStatistics(): Result<UserStatistics> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            val doc = statisticsCollection.document(uid).get().await()

            if (doc.exists()) {
                val stats = doc.toObject(UserStatistics::class.java)
                    ?: UserStatistics(id = uid)
                Result.success(stats)
            } else {
                val emptyStats = UserStatistics(id = uid)
                statisticsCollection.document(uid).set(emptyStats).await()
                Result.success(emptyStats)
            }
        } catch (e: Exception) {
            // BUG FIX: Retornar failure em vez de success com dados vazios
            Result.failure(e)
        }
    }

    override suspend fun getUserStatistics(userId: String): Result<UserStatistics> {
        return try {
            val doc = statisticsCollection.document(userId).get().await()

            if (doc.exists()) {
                val stats = doc.toObject(UserStatistics::class.java)
                    ?: UserStatistics(id = userId)
                Result.success(stats)
            } else {
                Result.success(UserStatistics(id = userId))
            }
        } catch (e: Exception) {
            // BUG FIX: Retornar failure em vez de success com dados vazios
            Result.failure(e)
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
    ): Result<UserStatistics> {
        return try {
            val doc = statisticsCollection.document(userId).get().await()

            val currentStats = if (doc.exists()) {
                doc.toObject(UserStatistics::class.java) ?: UserStatistics(id = userId)
            } else {
                UserStatistics(id = userId)
            }

            val updatedStats = currentStats.copy(
                totalGames = currentStats.totalGames + 1,
                totalGoals = currentStats.totalGoals + goals,
                totalAssists = currentStats.totalAssists + assists,
                totalSaves = currentStats.totalSaves + saves,
                totalYellowCards = currentStats.totalYellowCards + yellowCards,
                totalRedCards = currentStats.totalRedCards + redCards,
                bestPlayerCount = currentStats.bestPlayerCount + if (isBestPlayer) 1 else 0,
                worstPlayerCount = currentStats.worstPlayerCount + if (isWorstPlayer) 1 else 0,
                bestGoalCount = currentStats.bestGoalCount + if (hasBestGoal) 1 else 0,
                gamesWon = currentStats.gamesWon + if (gameResult == GameResult.WIN) 1 else 0,
                gamesLost = currentStats.gamesLost + if (gameResult == GameResult.LOSS) 1 else 0,
                gamesDraw = currentStats.gamesDraw + if (gameResult == GameResult.DRAW) 1 else 0
            )

            statisticsCollection.document(userId).set(updatedStats, SetOptions.merge()).await()
            Result.success(updatedStats)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getTopScorers(limit: Int): Result<List<UserStatistics>> {
        return try {
            val snapshot = statisticsCollection
                .orderBy("totalGoals", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val stats = snapshot.documents.mapNotNull { it.toObject(UserStatistics::class.java) }
            Result.success(stats)
        } catch (e: Exception) {
            AppLogger.e("StatisticsRepo", "Erro ao buscar top scorers", e)
            Result.failure(e)
        }
    }

    override suspend fun getTopGoalkeepers(limit: Int): Result<List<UserStatistics>> {
        return try {
            val snapshot = statisticsCollection
                .orderBy("totalSaves", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val stats = snapshot.documents.mapNotNull { it.toObject(UserStatistics::class.java) }
            Result.success(stats)
        } catch (e: Exception) {
            AppLogger.e("StatisticsRepo", "Erro ao buscar top goalkeepers", e)
            Result.failure(e)
        }
    }

    override suspend fun getBestPlayers(limit: Int): Result<List<UserStatistics>> {
        return try {
            val snapshot = statisticsCollection
                .orderBy("bestPlayerCount", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val stats = snapshot.documents.mapNotNull { it.toObject(UserStatistics::class.java) }
            Result.success(stats)
        } catch (e: Exception) {
            AppLogger.e("StatisticsRepo", "Erro ao buscar best players", e)
            Result.failure(e)
        }
    }

    override suspend fun getGoalsHistory(userId: String): Result<Map<String, Int>> {
        return try {
            // Busca dados reais do Firestore
            // PERF P1 #12: Adicionado .limit(100) para evitar leitura ilimitada
            val gameStatsCollection = firestore.collection("games")
            val playerStatsSnapshots = gameStatsCollection
                .whereEqualTo("players", userId)
                .limit(100) // Limita a 100 jogos mais recentes
                .get()
                .await()

            val goalsHistory = LinkedHashMap<String, Int>()
            val cal = java.util.Calendar.getInstance()
            cal.add(java.util.Calendar.MONTH, -5)

            // Inicializar últimos 6 meses com 0
            for (i in 0 until 6) {
                val monthKey = "${cal.get(java.util.Calendar.MONTH) + 1}/${cal.get(java.util.Calendar.YEAR)}"
                goalsHistory[monthKey] = 0
                cal.add(java.util.Calendar.MONTH, 1)
            }

            // Processar cada jogo
            for (doc in playerStatsSnapshots.documents) {
                try {
                    val playerStats = doc.toObject(com.futebadosparcas.data.model.PlayerStats::class.java)
                    if (playerStats != null && playerStats.userId == userId) {
                        val gameDate = doc.getDate("dateTime") as? java.util.Date
                        if (gameDate != null) {
                            val calDate = java.util.Calendar.getInstance().apply {
                                time = gameDate
                            }
                            val monthKey = "${calDate.get(java.util.Calendar.MONTH) + 1}/${calDate.get(java.util.Calendar.YEAR)}"

                            // Se estiver nos últimos 6 meses, adicionar gols
                            if (goalsHistory.containsKey(monthKey)) {
                                goalsHistory[monthKey] = (goalsHistory[monthKey] ?: 0) + playerStats.goals
                            }
                        }
                    }
                } catch (e: Exception) {
                    // Ignorar documento malformado e continuar
                    continue
                }
            }

            Result.success(goalsHistory)
        } catch (e: Exception) {
            // Retornar dados vazios em caso de erro, não falhar completamente
            val emptyHistory = LinkedHashMap<String, Int>()
            val cal = java.util.Calendar.getInstance()
            cal.add(java.util.Calendar.MONTH, -5)

            for (i in 0 until 6) {
                val key = "${cal.get(java.util.Calendar.MONTH) + 1}/${cal.get(java.util.Calendar.YEAR)}"
                emptyHistory[key] = 0
                cal.add(java.util.Calendar.MONTH, 1)
            }

            Result.success(emptyHistory)
        }
    }
}