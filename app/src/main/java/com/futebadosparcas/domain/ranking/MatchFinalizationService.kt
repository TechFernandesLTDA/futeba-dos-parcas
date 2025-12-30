package com.futebadosparcas.domain.ranking

import com.futebadosparcas.data.model.*
import com.futebadosparcas.data.repository.GameResult
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Resultado do processamento de um jogador.
 */
data class PlayerProcessingResult(
    val userId: String,
    val xpEarned: Int,
    val xpBreakdown: Map<String, Int>,
    val newLevel: Int,
    val leveledUp: Boolean,
    val milestonesUnlocked: List<MilestoneType>,
    val gameResult: GameResult
)

/**
 * Resultado do processamento do jogo.
 */
data class GameProcessingResult(
    val gameId: String,
    val success: Boolean,
    val playersProcessed: List<PlayerProcessingResult>,
    val error: String? = null
)

/**
 * Service responsavel por processar a finalizacao de um jogo:
 * - Calcular XP para cada jogador
 * - Atualizar estatisticas (Global e Season)
 * - Verificar milestones
 * - Atualizar rankings (Deltas)
 * - Marcar jogo como processado
 */
@Singleton
class MatchFinalizationService @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val settingsRepository: com.futebadosparcas.data.repository.SettingsRepository
) {
    companion object {
        private const val TAG = "MatchFinalizationService"
        const val MIN_PLAYERS = 6
    }

    private val gamesCollection = firestore.collection("games")
    private val confirmationsCollection = firestore.collection("confirmations")
    private val usersCollection = firestore.collection("users")
    private val statisticsCollection = firestore.collection("statistics")
    private val teamsCollection = firestore.collection("teams")
    private val xpLogsCollection = firestore.collection("xp_logs")
    private val rankingDeltasCollection = firestore.collection("ranking_deltas")
    private val liveScoresCollection = firestore.collection("live_scores")
    private val userStreaksCollection = firestore.collection("user_streaks")
    private val seasonsCollection = firestore.collection("seasons")
    private val seasonParticipationCollection = firestore.collection("season_participation")

    /**
     * Processa um jogo finalizado.
     * Deve ser chamado quando o status do jogo muda para FINISHED.
     */
    suspend fun processGame(gameId: String): GameProcessingResult {
        AppLogger.d(TAG) { "Iniciando processamento do jogo $gameId" }

        return try {
            // 1. Buscar dados do jogo
            val gameDoc = gamesCollection.document(gameId).get().await()
            val game = gameDoc.toObject(Game::class.java)
                ?: return GameProcessingResult(gameId, false, emptyList(), "Jogo nao encontrado")

            // 2. Verificar se ja foi processado
            if (game.xpProcessed) {
                AppLogger.d(TAG) { "Jogo $gameId ja foi processado anteriormente" }
                return GameProcessingResult(gameId, true, emptyList(), "Jogo ja processado")
            }

            // 3. Buscar confirmacoes
            val confirmationsSnapshot = confirmationsCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", "CONFIRMED")
                .get()
                .await()

            val confirmations = confirmationsSnapshot.toObjects(GameConfirmation::class.java)

            // 4. Verificar minimo de jogadores
            if (confirmations.size < MIN_PLAYERS) {
                AppLogger.w(TAG) { "Jogo $gameId com menos de $MIN_PLAYERS jogadores. XP nao sera processado." }
                // Marcar como processado para nao tentar novamente
                gamesCollection.document(gameId).update(
                    mapOf(
                        "xp_processed" to true,
                        "xp_processed_at" to FieldValue.serverTimestamp()
                    )
                ).await()
                return GameProcessingResult(gameId, true, emptyList(), "Menos de $MIN_PLAYERS jogadores")
            }

            // 5. Buscar times e placar
            val teamsSnapshot = teamsCollection
                .whereEqualTo("game_id", gameId)
                .get()
                .await()
            val teams = teamsSnapshot.toObjects(Team::class.java)

            // 6. Buscar placar final
            val liveScoreDoc = liveScoresCollection.document(gameId).get().await()
            val liveScore = liveScoreDoc.toObject(LiveGameScore::class.java)

            // 7. Determinar resultado de cada time
            val teamResults = determineTeamResults(teams, liveScore)
            
            // 8. Buscar Temporada Ativa e Configuracoes de XP
            val activeSeason = getActiveSeason()
            val gamificationSettings = settingsRepository.getGamificationSettings().getOrNull() ?: GamificationSettings()

            // 9. Processar cada jogador
            val results = mutableListOf<PlayerProcessingResult>()
            val batch = firestore.batch()

            for (confirmation in confirmations) {
                try {
                    val result = processPlayer(
                        gameId = gameId,
                        game = game,
                        confirmation = confirmation,
                        teams = teams,
                        teamResults = teamResults,
                        liveScore = liveScore,
                        activeSeason = activeSeason,
                        settings = gamificationSettings,
                        batch = batch
                    )
                    results.add(result)
                } catch (e: Exception) {
                    AppLogger.e(TAG, "Erro ao processar jogador ${confirmation.userId}", e)
                }
            }

            // 10. Atualizar flags do jogo no Batch
            val gameRef = gamesCollection.document(gameId)
            batch.update(gameRef, mapOf(
                "xp_processed" to true,
                "xp_processed_at" to FieldValue.serverTimestamp()
            ))

            // 11. Commit Atomico
            batch.commit().await()

            AppLogger.d(TAG) { "Jogo $gameId processado com sucesso. ${results.size} jogadores." }
            GameProcessingResult(gameId, true, results)

        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao processar jogo $gameId", e)
            GameProcessingResult(gameId, false, emptyList(), e.message)
        }
    }

    /**
     * Busca a temporada ativa.
     */
    private suspend fun getActiveSeason(): Season? {
        return try {
            val snapshot = seasonsCollection
                .whereEqualTo("is_active", true)
                .limit(1)
                .get()
                .await()
            snapshot.documents.firstOrNull()?.toObject(Season::class.java)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar season ativa", e)
            null
        }
    }

    /**
     * Determina o resultado (vitoria/empate/derrota) de cada time.
     */
    private fun determineTeamResults(
        teams: List<Team>,
        liveScore: LiveGameScore?
    ): Map<String, GameResult> {
        if (liveScore == null || teams.size < 2) {
            // Fallback: tentar usar scores dos times se disponivel
            if (teams.size >= 2) {
                val team1 = teams[0]
                val team2 = teams[1]
                return when {
                    team1.score > team2.score -> mapOf(team1.id to GameResult.WIN, team2.id to GameResult.LOSS)
                    team2.score > team1.score -> mapOf(team1.id to GameResult.LOSS, team2.id to GameResult.WIN)
                    else -> mapOf(team1.id to GameResult.DRAW, team2.id to GameResult.DRAW)
                }
            }
            return teams.associate { it.id to GameResult.DRAW }
        }

        val team1Score = liveScore.team1Score
        val team2Score = liveScore.team2Score

        return when {
            team1Score > team2Score -> mapOf(
                liveScore.team1Id to GameResult.WIN,
                liveScore.team2Id to GameResult.LOSS
            )
            team2Score > team1Score -> mapOf(
                liveScore.team1Id to GameResult.LOSS,
                liveScore.team2Id to GameResult.WIN
            )
            else -> mapOf(
                liveScore.team1Id to GameResult.DRAW,
                liveScore.team2Id to GameResult.DRAW
            )
        }
    }

    /**
     * Processa um jogador individual e adiciona escritas ao Batch.
     */
    private suspend fun processPlayer(
        gameId: String,
        game: Game,
        confirmation: GameConfirmation,
        teams: List<Team>,
        teamResults: Map<String, GameResult>,
        liveScore: LiveGameScore?,
        activeSeason: Season?,
        settings: GamificationSettings,
        batch: com.google.firebase.firestore.WriteBatch
    ): PlayerProcessingResult {
        val userId = confirmation.userId

        // 1. Identificar time do jogador
        val playerTeam = teams.find { it.playerIds.contains(userId) }
        val playerTeamResult = playerTeam?.let { teamResults[it.id] } ?: GameResult.DRAW

        // 2. Calcular gols sofridos (para clean sheet)
        val goalsConceded = if (playerTeam != null && liveScore != null) {
            if (playerTeam.id == liveScore.team1Id) liveScore.team2Score else liveScore.team1Score
        } else {
            0
        }

        // 3. Buscar streak atual (leitura necessaria para calculo de XP)
        val streakDoc = userStreaksCollection
            .whereEqualTo("user_id", userId)
            .get()
            .await()
        val currentStreak = streakDoc.documents.firstOrNull()
            ?.toObject(UserStreak::class.java)?.currentStreak ?: 0

        // 4. Verificar MVP e Melhor Gol (leitura player_stats)
        val isMvp = game.mvpId == userId
        
        val playerStatsSnapshot = firestore.collection("player_stats")
            .whereEqualTo("game_id", gameId)
            .whereEqualTo("user_id", userId)
            .get()
            .await()
        val hasBestGoal = playerStatsSnapshot.documents.firstOrNull()
            ?.getBoolean("best_goal") ?: false

        // 5. Calcular XP
        val xpResult = XPCalculator.calculateFromConfirmation(
            confirmation = confirmation,
            teamWon = playerTeamResult == GameResult.WIN,
            teamDrew = playerTeamResult == GameResult.DRAW,
            opponentsGoals = goalsConceded,
            isMvp = isMvp,
            hasBestGoal = hasBestGoal,
            currentStreak = currentStreak,
            settings = settings
        )

        // 6. Buscar dados atuais do usuario
        val userDoc = usersCollection.document(userId).get().await()
        val currentXp = userDoc.getLong("experience_points")?.toInt() ?: 0
        val currentLevel = userDoc.getLong("level")?.toInt() ?: 1
        val achievedMilestones = (userDoc.get("milestones_achieved") as? List<*>)
            ?.filterIsInstance<String>() ?: emptyList()

        // 7. Buscar estatisticas globais
        val statsDoc = statisticsCollection.document(userId).get().await()
        val currentStats = if (statsDoc.exists()) {
            statsDoc.toObject(UserStatistics::class.java) ?: UserStatistics(id = userId)
        } else {
            UserStatistics(id = userId)
        }

        // 8. Calcular novas estatisticas globais
        val newStats = currentStats.copy(
            totalGames = currentStats.totalGames + 1,
            totalGoals = currentStats.totalGoals + confirmation.goals,
            totalAssists = currentStats.totalAssists + confirmation.assists,
            totalSaves = currentStats.totalSaves + confirmation.saves,
            totalYellowCards = currentStats.totalYellowCards + confirmation.yellowCards,
            totalRedCards = currentStats.totalRedCards + confirmation.redCards,
            gamesWon = currentStats.gamesWon + if (playerTeamResult == GameResult.WIN) 1 else 0,
            gamesLost = currentStats.gamesLost + if (playerTeamResult == GameResult.LOSS) 1 else 0,
            gamesDraw = currentStats.gamesDraw + if (playerTeamResult == GameResult.DRAW) 1 else 0,
            bestPlayerCount = if (isMvp) currentStats.bestPlayerCount + 1 else currentStats.bestPlayerCount
        )

        // 9. Verificar milestones
        val milestoneResult = MilestoneChecker.check(newStats, achievedMilestones)
        val milestonesXp = milestoneResult.totalXpFromMilestones

        // 10. Calcular Totais Finais (XP e Nivel)
        val totalXpEarned = xpResult.totalXp + milestonesXp
        val newXp = currentXp + totalXpEarned
        val newLevel = LevelTable.getLevelForXp(newXp)
        val leveledUp = newLevel > currentLevel

        // 11. Criar XP Log
        val xpLog = XPCalculator.createXpLog(
            userId = userId,
            gameId = gameId,
            calculationResult = xpResult.copy(
                totalXp = totalXpEarned,
                breakdown = xpResult.breakdown.copy(milestones = milestonesXp)
            ),
            xpBefore = currentXp,
            levelBefore = currentLevel,
            levelAfter = newLevel,
            milestonesUnlocked = milestoneResult.newMilestones.map { it.name },
            goals = confirmation.goals,
            assists = confirmation.assists,
            saves = confirmation.saves
        )

        // 12. Preparar Season Participation (Se houver temporada ativa)
        if (activeSeason != null) {
            prepareSeasonUpdate(
                batch = batch,
                userId = userId,
                seasonId = activeSeason.id,
                result = playerTeamResult,
                goals = confirmation.goals,
                assists = confirmation.assists,
                conceded = goalsConceded,
                isMvp = isMvp
            )
        }

        // ------------------------------------------------------------
        // Adicionar operações ao Batch
        // ------------------------------------------------------------

        // Update Confirmation
        val confRef = confirmationsCollection.document("${gameId}_${userId}")
        batch.update(confRef, "xp_earned", totalXpEarned)

        // Update User
        batch.update(usersCollection.document(userId), mapOf(
            "experience_points" to newXp,
            "level" to newLevel,
            "milestones_achieved" to FieldValue.arrayUnion(*milestoneResult.newMilestones.map { it.name }.toTypedArray())
        ))

        // Update Global Statistics
        batch.set(statisticsCollection.document(userId), newStats, SetOptions.merge())

        // Create XP Log
        batch.set(xpLogsCollection.document(), xpLog)

        // Update Ranking Deltas (Week & Month)
        updateRankingDeltas(batch, userId, confirmation, playerTeamResult, totalXpEarned, isMvp)

        // Retornar resultado
        return PlayerProcessingResult(
            userId = userId,
            xpEarned = totalXpEarned,
            xpBreakdown = xpResult.breakdown.copy(milestones = milestonesXp).toDisplayMap(),
            newLevel = newLevel,
            leveledUp = leveledUp,
            milestonesUnlocked = milestoneResult.newMilestones,
            gameResult = playerTeamResult
        )
    }

    /**
     * Prepara a atualização da SeasonParticipation no batch.
     */
    private suspend fun prepareSeasonUpdate(
        batch: com.google.firebase.firestore.WriteBatch,
        userId: String,
        seasonId: String,
        result: GameResult,
        goals: Int,
        assists: Int,
        conceded: Int,
        isMvp: Boolean
    ) {
        // Tentar buscar documento existente (pode ser lento dentro do loop, mas é necessario)
        // Otimização: Usar ID deterministico seasonId_userId se possivel
        // Como o repositorio original usava ID aleatorio, precisamos buscar primeiro para nao duplicar
        
        val snapshot = seasonParticipationCollection
            .whereEqualTo("season_id", seasonId)
            .whereEqualTo("user_id", userId)
            .get()
            .await()

        val pointsToAdd = when (result) {
            GameResult.WIN -> 3
            GameResult.DRAW -> 1
            GameResult.LOSS -> 0
        }

        if (snapshot.isEmpty) {
            // Criar novo com ID determinístico para facilitar futuro
            val docId = "${seasonId}_${userId}"
            val newParticipation = SeasonParticipationV2(
                id = docId,
                userId = userId,
                seasonId = seasonId,
                gamesPlayed = 1,
                wins = if (result == GameResult.WIN) 1 else 0,
                draws = if (result == GameResult.DRAW) 1 else 0,
                losses = if (result == GameResult.LOSS) 1 else 0,
                points = pointsToAdd,
                goalsScored = goals,
                goalsConceded = conceded,
                assists = assists,
                mvpCount = if (isMvp) 1 else 0,
                lastCalculatedAt = Date()
            )
            batch.set(seasonParticipationCollection.document(docId), newParticipation)
        } else {
            // Atualizar existente
            val doc = snapshot.documents.first()
            val ref = seasonParticipationCollection.document(doc.id)
            
            // Usar FieldValue.increment para garantir atomicidade
            batch.update(ref, mapOf(
                "games_played" to FieldValue.increment(1),
                "wins" to FieldValue.increment(if (result == GameResult.WIN) 1L else 0L),
                "draws" to FieldValue.increment(if (result == GameResult.DRAW) 1L else 0L),
                "losses" to FieldValue.increment(if (result == GameResult.LOSS) 1L else 0L),
                "points" to FieldValue.increment(pointsToAdd.toLong()),
                "goals_scored" to FieldValue.increment(goals.toLong()),
                "goals_conceded" to FieldValue.increment(conceded.toLong()),
                "assists" to FieldValue.increment(assists.toLong()),
                "mvp_count" to FieldValue.increment(if (isMvp) 1L else 0L),
                "last_calculated_at" to FieldValue.serverTimestamp()
            ))
        }
    }

    private fun updateRankingDeltas(
        batch: com.google.firebase.firestore.WriteBatch,
        userId: String,
        confirmation: GameConfirmation,
        result: GameResult,
        totalXp: Int,
        isMvp: Boolean
    ) {
        val weekKey = getCurrentWeekKey()
        val monthKey = getCurrentMonthKey()

        val updates = mapOf(
            "user_id" to userId,
            "period" to "week", // Overwritten below
            "period_key" to weekKey, // Overwritten below
            "goals_added" to FieldValue.increment(confirmation.goals.toLong()),
            "assists_added" to FieldValue.increment(confirmation.assists.toLong()),
            "saves_added" to FieldValue.increment(confirmation.saves.toLong()),
            "xp_added" to FieldValue.increment(totalXp.toLong()),
            "games_added" to FieldValue.increment(1),
            "wins_added" to FieldValue.increment(if (result == GameResult.WIN) 1L else 0L),
            "mvp_added" to FieldValue.increment(if (isMvp) 1L else 0L),
            "updated_at" to FieldValue.serverTimestamp()
        )

        // Week Delta
        val weekId = "week_${weekKey}_$userId"
        batch.set(
            rankingDeltasCollection.document(weekId), 
            updates.plus(mapOf("period" to "week", "period_key" to weekKey)), 
            SetOptions.merge()
        )

        // Month Delta
        val monthId = "month_${monthKey}_$userId"
        batch.set(
            rankingDeltasCollection.document(monthId), 
            updates.plus(mapOf("period" to "month", "period_key" to monthKey)), 
            SetOptions.merge()
        )
    }

    private fun getCurrentWeekKey(): String {
        val cal = Calendar.getInstance()
        val year = cal.get(Calendar.YEAR)
        val week = cal.get(Calendar.WEEK_OF_YEAR)
        return "$year-W${week.toString().padStart(2, '0')}"
    }

    private fun getCurrentMonthKey(): String {
        val sdf = SimpleDateFormat("yyyy-MM", Locale.getDefault())
        return sdf.format(Date())
    }
}
