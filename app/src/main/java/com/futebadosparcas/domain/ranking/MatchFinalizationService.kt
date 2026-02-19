package com.futebadosparcas.domain.ranking

import com.futebadosparcas.app.domain.ranking.XPCalculator
import com.futebadosparcas.data.model.*
import com.futebadosparcas.data.repository.GameResult
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.WeekFields
import java.util.*

/**
 * Resultado do processamento de um jogador.
 */
data class PlayerProcessingResult(
    val userId: String,
    val xpEarned: Long,
    val xpBreakdown: Map<String, Long>,
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
 * - Atualizar streaks
 * - Marcar jogo como processado
 *
 * IMPORTANTE: Usa transações atômicas para evitar race conditions e garantir
 * consistência dos dados.
 */
class MatchFinalizationService constructor(
    private val firestore: FirebaseFirestore,
    private val settingsRepository: com.futebadosparcas.domain.repository.SettingsRepository,
    private val leagueService: LeagueService
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
     * Processa um jogo finalizado usando transação atômica.
     * Deve ser chamado quando o status do jogo muda para FINISHED.
     *
     * IMPORTANTE: Usa transação Firestore para garantir atomicidade e evitar
     * race conditions que poderiam causar XP duplicado.
     */
    suspend fun processGame(gameId: String): GameProcessingResult {
        AppLogger.d(TAG) { "Iniciando processamento do jogo $gameId" }

        return try {
            // Usar transação atômica para verificar e marcar como processado
            val result = firestore.runTransaction { transaction ->
                // 1. Buscar dados do jogo DENTRO da transação
                val gameRef = gamesCollection.document(gameId)
                val gameDoc = transaction.get(gameRef)
                val game = gameDoc.toObject(Game::class.java)
                    ?: throw Exception("Jogo nao encontrado")

                // 2. Verificar se ja foi processado (check atômico)
                if (game.xpProcessed) {
                    AppLogger.d(TAG) { "Jogo $gameId ja foi processado anteriormente" }
                    return@runTransaction GameProcessingResult(gameId, true, emptyList(), "Jogo ja processado")
                }

                // 3. Marcar como processado IMEDIATAMENTE para evitar race condition
                transaction.update(gameRef, mapOf(
                    "xp_processed" to true,
                    "xp_processed_at" to FieldValue.serverTimestamp()
                ))

                // Retornar game para processamento fora da transação
                game
            }.await()

            // Se já foi processado, retornar
            if (result is GameProcessingResult) {
                return result
            }

            val game = result as Game

            // 4. Buscar confirmacoes (fora da transação principal)
            val confirmationsSnapshot = confirmationsCollection
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", "CONFIRMED")
                .get()
                .await()

            val confirmations = confirmationsSnapshot.toObjects(GameConfirmation::class.java)

            // 5. Verificar minimo de jogadores
            if (confirmations.size < MIN_PLAYERS) {
                AppLogger.w(TAG) { "Jogo $gameId com menos de $MIN_PLAYERS jogadores. XP nao sera processado." }
                return GameProcessingResult(gameId, true, emptyList(), "Menos de $MIN_PLAYERS jogadores")
            }

            // 6. Buscar times e placar
            val teamsSnapshot = teamsCollection
                .whereEqualTo("game_id", gameId)
                .get()
                .await()
            val teams = teamsSnapshot.toObjects(Team::class.java)

            // 7. Buscar placar final
            val liveScoreDoc = liveScoresCollection.document(gameId).get().await()
            val liveScore = liveScoreDoc.toObject(LiveGameScore::class.java)

            // 8. Determinar resultado de cada time
            val teamResults = determineTeamResults(teams, liveScore)

            // 9. Buscar Temporada Ativa e Configuracoes de XP
            val activeSeason = getActiveSeason()
            val gamificationSettings = settingsRepository.getGamificationSettings().getOrNull()
                ?: com.futebadosparcas.domain.model.GamificationSettings().also {
                    AppLogger.w(TAG) { "GamificationSettings não encontrado, usando valores padrão" }
                }

            // 10. Processar cada jogador e persistir dados
            val results = mutableListOf<PlayerProcessingResult>()
            val batch = firestore.batch()

            for (confirmation in confirmations) {
                try {
                    val playerResult = processPlayer(
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
                    results.add(playerResult)
                } catch (e: Exception) {
                    AppLogger.e(TAG, "Erro ao processar jogador ${confirmation.userId}", e)
                }
            }

            // 11. Commit do batch com todas as atualizações
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
     * Corrigido para lidar com casos onde liveScore tem IDs diferentes dos teams.
     */
    private fun determineTeamResults(
        teams: List<Team>,
        liveScore: LiveGameScore?
    ): Map<String, GameResult> {
        // Criar mapa de resultados incluindo todos os times
        val results = mutableMapOf<String, GameResult>()

        if (teams.size < 2) {
            // Menos de 2 times, todos empate
            teams.forEach { results[it.id] = GameResult.DRAW }
            return results
        }

        // Tentar usar liveScore primeiro
        if (liveScore != null) {
            val team1Score = liveScore.team1Score
            val team2Score = liveScore.team2Score

            val team1Result = when {
                team1Score > team2Score -> GameResult.WIN
                team2Score > team1Score -> GameResult.LOSS
                else -> GameResult.DRAW
            }
            val team2Result = when {
                team2Score > team1Score -> GameResult.WIN
                team1Score > team2Score -> GameResult.LOSS
                else -> GameResult.DRAW
            }

            // Mapear pelos IDs do liveScore
            results[liveScore.team1Id] = team1Result
            results[liveScore.team2Id] = team2Result

            // Também mapear pelos IDs dos teams (podem ser diferentes)
            teams.forEachIndexed { index, team ->
                if (!results.containsKey(team.id)) {
                    // Tentar associar por posição se ID não bater
                    results[team.id] = if (index == 0) team1Result else team2Result
                }
            }
        } else {
            // Fallback: usar scores dos times se disponivel
            val team1 = teams[0]
            val team2 = teams[1]

            when {
                team1.score > team2.score -> {
                    results[team1.id] = GameResult.WIN
                    results[team2.id] = GameResult.LOSS
                }
                team2.score > team1.score -> {
                    results[team1.id] = GameResult.LOSS
                    results[team2.id] = GameResult.WIN
                }
                else -> {
                    results[team1.id] = GameResult.DRAW
                    results[team2.id] = GameResult.DRAW
                }
            }
        }

        // Garantir que todos os times tenham um resultado
        teams.forEach { team ->
            if (!results.containsKey(team.id)) {
                results[team.id] = GameResult.DRAW
            }
        }

        return results
    }

    /**
     * Processa um jogador individual e adiciona escritas ao Batch.
     * Inclui persistência de XP, estatísticas, milestones, streaks e ranking deltas.
     */
    private suspend fun processPlayer(
        gameId: String,
        game: Game,
        confirmation: GameConfirmation,
        teams: List<Team>,
        teamResults: Map<String, GameResult>,
        liveScore: LiveGameScore?,
        activeSeason: Season?,
        settings: com.futebadosparcas.domain.model.GamificationSettings,
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

        // 3. Buscar e atualizar streak
        val streakResult = updateUserStreak(userId, game.date, batch)
        val currentStreak = streakResult.first
        val streakDocId = streakResult.second

        // 4. Verificar MVP e worst player da confirmação
        val isMvp = game.mvpId == userId || confirmation.isMvp
        val isWorstPlayer = confirmation.isWorstPlayer

        val playerStatsSnapshot = firestore.collection("player_stats")
            .whereEqualTo("game_id", gameId)
            .whereEqualTo("user_id", userId)
            .get()
            .await()
        val hasBestGoal = playerStatsSnapshot.documents.firstOrNull()
            ?.getBoolean("best_goal") ?: false

        // 5. Calcular XP em Dispatchers.Default (operação CPU-intensiva)
        // PERF_001 P2 #22: Cálculos não devem executar em thread de I/O ou Main
        val xpResult = withContext(Dispatchers.Default) {
            XPCalculator.calculateFromConfirmation(
                confirmation = confirmation,
                teamWon = playerTeamResult == GameResult.WIN,
                teamDrew = playerTeamResult == GameResult.DRAW,
                opponentsGoals = goalsConceded,
                isMvp = isMvp,
                isWorstPlayer = isWorstPlayer,
                hasBestGoal = hasBestGoal,
                currentStreak = currentStreak,
                settings = settings
            )
        }

        // 6. Buscar dados atuais do usuario
        val userDoc = usersCollection.document(userId).get().await()
        val currentXp = userDoc.getLong("experience_points") ?: 0L
        val currentLevel = userDoc.getLong("level")?.toInt() ?: 0
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
            bestPlayerCount = if (isMvp) currentStats.bestPlayerCount + 1 else currentStats.bestPlayerCount,
            worstPlayerCount = if (isWorstPlayer) currentStats.worstPlayerCount + 1 else currentStats.worstPlayerCount
        )

        // 9. Verificar milestones (usando lista atualizada para evitar duplicatas)
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
                breakdown = xpResult.breakdown.copy(milestones = milestonesXp.toLong())
            ),
            xpBefore = currentXp,
            levelBefore = currentLevel,
            levelAfter = newLevel,
            milestonesUnlocked = milestoneResult.newMilestones.map { it.name },
            goals = confirmation.goals,
            assists = confirmation.assists,
            saves = confirmation.saves
        )

        // ========== PERSISTÊNCIA DOS DADOS ==========

        // 12. Update Confirmation com XP ganho
        val confId = "${gameId}_${userId}"
        val confRef = confirmationsCollection.document(confId)
        batch.update(confRef, mapOf(
            "xp_earned" to totalXpEarned.toInt(),
            "is_mvp" to isMvp
        ))

        // 13. Update User (XP, Level, Milestones)
        val userUpdates = mutableMapOf<String, Any>(
            "experience_points" to newXp,
            "level" to newLevel
        )
        if (milestoneResult.newMilestones.isNotEmpty()) {
            userUpdates["milestones_achieved"] = FieldValue.arrayUnion(
                *milestoneResult.newMilestones.map { it.name }.toTypedArray()
            )
        }
        batch.update(usersCollection.document(userId), userUpdates)

        // 14. Update/Create Global Statistics
        batch.set(statisticsCollection.document(userId), newStats, SetOptions.merge())

        // 15. Create XP Log
        batch.set(xpLogsCollection.document(), xpLog)

        // 16. Update Ranking Deltas (Week & Month)
        updateRankingDeltas(batch, userId, confirmation, playerTeamResult, totalXpEarned, isMvp)

        // 17. Update Season Participation (se houver temporada ativa)
        if (activeSeason != null) {
            // Bug #1 e #4 Fix: Usar LeagueService para atualizar dados da liga com GoalDifference correto
            val goalDiff = confirmation.goals - goalsConceded
            
            // Nota: updateLeague agora adiciona operacoes ao batch passado
            leagueService.updateLeague(
                batch = batch,
                userId = userId,
                seasonId = activeSeason.id,
                xpEarned = totalXpEarned,
                won = playerTeamResult == GameResult.WIN,
                drew = playerTeamResult == GameResult.DRAW,
                goalDiff = goalDiff,
                wasMvp = isMvp,
                gameId = gameId
            )
        }

        // 18. Auto-award Badges (HAT_TRICK, PAREDAO)
        awardBadgesAutomatically(batch, userId, confirmation, goalsConceded)

        // Retornar resultado
        return PlayerProcessingResult(
            userId = userId,
            xpEarned = totalXpEarned,
            xpBreakdown = xpResult.breakdown.copy(milestones = milestonesXp.toLong()).toDisplayMap(),
            newLevel = newLevel,
            leveledUp = leveledUp,
            milestonesUnlocked = milestoneResult.newMilestones,
            gameResult = playerTeamResult
        )
    }

    /**
     * Atualiza a streak do usuário.
     * Retorna o streak atual (após atualização) e o ID do documento.
     */
    private suspend fun updateUserStreak(
        userId: String,
        gameDate: String,
        batch: com.google.firebase.firestore.WriteBatch
    ): Pair<Int, String> {
        val streakQuery = userStreaksCollection
            .whereEqualTo("user_id", userId)
            .limit(1)
            .get()
            .await()

        val streakDocId = "${userId}_streak"
        val streakRef = userStreaksCollection.document(streakDocId)

        val existingStreak = streakQuery.documents.firstOrNull()
            ?.toObject(UserStreak::class.java)

        if (existingStreak == null) {
            // Criar novo streak
            val newStreak = UserStreak(
                id = streakDocId,
                userId = userId,
                currentStreak = 1,
                longestStreak = 1,
                lastGameDate = gameDate,
                streakStartedAt = gameDate
            )
            batch.set(streakRef, newStreak)
            return Pair(1, streakDocId)
        }

        // Calcular se é jogo consecutivo (CORRIGIDO: verifica diferença em dias)
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val lastDate = existingStreak.lastGameDate

        val isConsecutive = try {
            val lastParsed = dateFormat.parse(lastDate)
            val currentParsed = dateFormat.parse(gameDate)
            val diffInDays = ((currentParsed.time - lastParsed.time) / (24 * 60 * 60 * 1000)).toInt()
            // Mesmo dia (0) ou dia seguinte (1) conta como consecutivo
            diffInDays in 0..1
        } catch (e: Exception) {
            AppLogger.w(TAG) { "Erro ao parsear datas para streak: $lastDate, $gameDate" }
            false
        }

        val newCurrentStreak = if (isConsecutive) {
            existingStreak.currentStreak + 1
        } else {
            1 // Streak quebrado - reinicia com 1 (jogo atual conta)
        }

        val newLongestStreak = maxOf(existingStreak.longestStreak, newCurrentStreak)

        batch.update(streakRef, mapOf(
            "current_streak" to newCurrentStreak,
            "longest_streak" to newLongestStreak,
            "last_game_date" to gameDate
        ))

        return Pair(newCurrentStreak, streakDocId)
    }



    private fun updateRankingDeltas(
        batch: com.google.firebase.firestore.WriteBatch,
        userId: String,
        confirmation: GameConfirmation,
        result: GameResult,
        totalXp: Long,
        isMvp: Boolean
    ) {
        val weekKey = getCurrentWeekKey()
        val monthKey = getCurrentMonthKey()

        val baseUpdates = mapOf(
            "user_id" to userId,
            "goals_added" to FieldValue.increment(confirmation.goals.toLong()),
            "assists_added" to FieldValue.increment(confirmation.assists.toLong()),
            "saves_added" to FieldValue.increment(confirmation.saves.toLong()),
            "xp_added" to FieldValue.increment(totalXp),
            "games_added" to FieldValue.increment(1),
            "wins_added" to FieldValue.increment(if (result == GameResult.WIN) 1L else 0L),
            "mvp_added" to FieldValue.increment(if (isMvp) 1L else 0L),
            "updated_at" to FieldValue.serverTimestamp()
        )

        // Week Delta
        val weekId = "week_${weekKey}_$userId"
        batch.set(
            rankingDeltasCollection.document(weekId),
            baseUpdates.plus(mapOf("period" to "week", "period_key" to weekKey)),
            SetOptions.merge()
        )

        // Month Delta
        val monthId = "month_${monthKey}_$userId"
        batch.set(
            rankingDeltasCollection.document(monthId),
            baseUpdates.plus(mapOf("period" to "month", "period_key" to monthKey)),
            SetOptions.merge()
        )
    }

    private fun getCurrentWeekKey(): String {
        val now = LocalDate.now()
        val weekFields = WeekFields.of(Locale.getDefault())
        val weekNumber = now.get(weekFields.weekOfWeekBasedYear())
        return "${now.year}-W${weekNumber.toString().padStart(2, '0')}"
    }

    private fun getCurrentMonthKey(): String {
        return LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"))
    }

    /**
     * Concede badges automaticamente baseado no desempenho no jogo.
     *
     * Badges automaticos:
     * - HAT_TRICK: Jogador fez 3+ gols no jogo
     * - PAREDAO: Goleiro nao sofreu gols (clean sheet)
     */
    private fun awardBadgesAutomatically(
        batch: com.google.firebase.firestore.WriteBatch,
        userId: String,
        confirmation: GameConfirmation,
        goalsConceded: Int
    ) {
        val userBadgesCollection = firestore.collection("user_badges")

        // HAT_TRICK: 3+ gols em um jogo
        if (confirmation.goals >= 3) {
            val badgeId = "HAT_TRICK"
            val docId = "${userId}_${badgeId}_${System.currentTimeMillis()}"
            val badgeData = mapOf(
                "user_id" to userId,
                "badge_id" to badgeId,
                "game_id" to confirmation.gameId,
                "unlocked_at" to FieldValue.serverTimestamp(),
                "goals_scored" to confirmation.goals
            )
            batch.set(userBadgesCollection.document(docId), badgeData)
            AppLogger.d(TAG) { "Badge HAT_TRICK concedido para $userId (${confirmation.goals} gols)" }
        }

        // PAREDAO: Goleiro com clean sheet (nao sofreu gols)
        val isGoalkeeper = confirmation.position == "GOALKEEPER" ||
                           confirmation.position == "GK" ||
                           confirmation.position.uppercase().contains("GOLEIRO")
        if (isGoalkeeper && goalsConceded == 0 && confirmation.saves > 0) {
            val badgeId = "PAREDAO"
            val docId = "${userId}_${badgeId}_${System.currentTimeMillis()}"
            val badgeData = mapOf(
                "user_id" to userId,
                "badge_id" to badgeId,
                "game_id" to confirmation.gameId,
                "unlocked_at" to FieldValue.serverTimestamp(),
                "saves_made" to confirmation.saves
            )
            batch.set(userBadgesCollection.document(docId), badgeData)
            AppLogger.d(TAG) { "Badge PAREDAO concedido para $userId (${confirmation.saves} defesas, 0 gols sofridos)" }
        }

        // ARTILHEIRO_JOGO: Maior artilheiro do jogo (opcional - verificar em outro lugar)
        // FOMINHA: Jogou X jogos em uma semana (verificar streak semanal)
    }
}
