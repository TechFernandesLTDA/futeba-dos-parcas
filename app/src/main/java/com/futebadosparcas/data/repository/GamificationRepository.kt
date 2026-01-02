package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.*
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository para gerenciar gamificação: streaks, badges, ligas, etc
 */
@Singleton
class GamificationRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val authRepository: AuthRepository,
    private val seasonGuardian: com.futebadosparcas.domain.gamification.SeasonGuardian
) {

    companion object {
        private const val TAG = "GamificationRepository"
        private const val COLLECTION_USER_STREAKS = "user_streaks"
        private const val COLLECTION_BADGES = "badges"
        private const val COLLECTION_USER_BADGES = "user_badges"
        private const val COLLECTION_SEASONS = "seasons"
        private const val COLLECTION_SEASON_PARTICIPATION = "season_participation"
        private const val COLLECTION_CHALLENGES = "challenges"
        private const val COLLECTION_CHALLENGE_PROGRESS = "challenge_progress"
    }

    /**
     * Atualiza o streak do usuário após confirmar presença em um jogo
     */
    suspend fun updateStreak(userId: String, gameDate: String): Result<UserStreak> {
        return try {
            // Buscar streak atual
            val streakSnapshot = firestore.collection(COLLECTION_USER_STREAKS)
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            val currentStreak = streakSnapshot.documents.firstOrNull()?.toObject(UserStreak::class.java)

            // Calcular novo streak
            val newStreak = calculateNewStreak(currentStreak, gameDate, userId)

            // Salvar - usar o id do documento existente ou criar novo
            val docId = streakSnapshot.documents.firstOrNull()?.id
                ?: firestore.collection(COLLECTION_USER_STREAKS).document().id

            firestore.collection(COLLECTION_USER_STREAKS)
                .document(docId)
                .set(newStreak)
                .await()

            AppLogger.d(TAG) { "Streak atualizado: ${newStreak.currentStreak} dias" }
            Result.success(newStreak)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar streak", e)
            Result.failure(e)
        }
    }

    /**
     * Calcula o novo streak baseado na última data jogada
     */
    private fun calculateNewStreak(
        currentStreak: UserStreak?,
        gameDate: String,
        userId: String
    ): UserStreak {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val gameDateParsed = dateFormat.parse(gameDate) ?: Date()

        if (currentStreak == null) {
            // Primeiro jogo
            return UserStreak(
                userId = userId,
                currentStreak = 1,
                longestStreak = 1,
                lastGameDate = gameDate,
                streakStartedAt = gameDate
            )
        }

        // Parse last played date
        val lastPlayedDate = currentStreak.lastGameDate?.let { dateFormat.parse(it) } ?: Date()

        // Calcular diferença em dias
        val diffInMillis = gameDateParsed.time - lastPlayedDate.time
        val diffInDays = (diffInMillis / (1000 * 60 * 60 * 24)).toInt()

        val newCurrentStreak = when {
            diffInDays == 0 -> currentStreak.currentStreak // Mesmo dia, mantém
            diffInDays == 1 -> currentStreak.currentStreak + 1 // Dia consecutivo
            else -> 1 // Streak quebrado, reinicia
        }

        val newLongestStreak = maxOf(newCurrentStreak, currentStreak.longestStreak)

        return currentStreak.copy(
            currentStreak = newCurrentStreak,
            longestStreak = newLongestStreak,
            lastGameDate = gameDate,
            streakStartedAt = if (diffInDays > 1) gameDate else currentStreak.streakStartedAt
        )
    }

    /**
     * Busca o streak atual do usuário
     */
    suspend fun getUserStreak(userId: String): Result<UserStreak?> {
        return try {
            val snapshot = firestore.collection(COLLECTION_USER_STREAKS)
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            val streak = snapshot.documents.firstOrNull()?.toObject(UserStreak::class.java)
            Result.success(streak)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar streak", e)
            Result.failure(e)
        }
    }

    /**
     * Premia um badge ao usuário
     */
    suspend fun awardBadge(userId: String, badgeId: String): Result<UserBadge> {
        return try {
            // Verificar se já tem esse badge
            val existingBadges = firestore.collection(COLLECTION_USER_BADGES)
                .whereEqualTo("user_id", userId)
                .whereEqualTo("badge_id", badgeId)
                .get()
                .await()

            if (existingBadges.isEmpty) {
                // Criar novo badge
                val docId = firestore.collection(COLLECTION_USER_BADGES).document().id
                val userBadge = UserBadge(
                    userId = userId,
                    badgeId = badgeId,
                    unlockedAt = Date(),
                    count = 1,
                    lastEarnedAt = Date()
                )

                firestore.collection(COLLECTION_USER_BADGES)
                    .document(docId)
                    .set(userBadge)
                    .await()

                AppLogger.d(TAG) { "Badge $badgeId conquistado!" }
                Result.success(userBadge)
            } else {
                // Incrementar contador
                val existing = existingBadges.documents.first().toObject(UserBadge::class.java)!!
                val docId = existingBadges.documents.first().id
                val updated = existing.copy(
                    count = existing.count + 1,
                    lastEarnedAt = Date()
                )

                firestore.collection(COLLECTION_USER_BADGES)
                    .document(docId)
                    .set(updated)
                    .await()

                AppLogger.d(TAG) { "Badge $badgeId incrementado: ${updated.count}x" }
                Result.success(updated)
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao premiar badge", e)
            Result.failure(e)
        }
    }

    /**
     * Busca todos os badges do usuário
     */
    suspend fun getUserBadges(userId: String): Result<List<UserBadge>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_USER_BADGES)
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            val badges = snapshot.toObjects(UserBadge::class.java)
            Result.success(badges)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar badges", e)
            Result.failure(e)
        }
    }

    /**
     * Busca os badges mais recentes do usuário
     */
    suspend fun getRecentBadges(userId: String, limit: Int = 5): Result<List<UserBadge>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_USER_BADGES)
                .whereEqualTo("user_id", userId)
                .orderBy("unlockedAt", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val badges = snapshot.toObjects(UserBadge::class.java)
            Result.success(badges)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar badges recentes", e)
            Result.failure(e)
        }
    }

    /**
     * Busca a temporada ativa
     */

    suspend fun getActiveSeason(): Result<Season?> {
        return try {
            // Gatilho de Automação: Se o usuário logado for Admin ou Dono, garante temporadas vivas
            authRepository.getCurrentUser().getOrNull()?.let { user ->
                if (user.isAdmin() || user.isFieldOwner()) {
                    seasonGuardian.guardSeasons()
                }
            }

            // Busca todas as temporadas
            val snapshot = firestore.collection(COLLECTION_SEASONS)
                .get()
                .await()

            AppLogger.d(TAG) { "Total de temporadas encontradas no banco: ${snapshot.size()}" }

            // Filtra por is_active ou isActive (suporte a legado)
            val seasons = snapshot.documents.mapNotNull { doc ->
                try {
                    val season = doc.toObject(Season::class.java)
                    val active = doc.getBoolean("is_active") ?: doc.getBoolean("isActive") ?: false
                    
                    AppLogger.d(TAG) { "Temporada ${doc.id}: Active=$active, Nome=${season?.name}" }
                    
                    if (season != null && active) season else null
                } catch (e: Exception) {
                    AppLogger.e(TAG, "Erro ao converter temporada ${doc.id}", e)
                    null
                }
            }

            
            AppLogger.d(TAG) { "Temporadas ativas após filtro: ${seasons.size}" }

            // Lógica de Prioridade:
            // 1. Priorizar Monthly sobre Annual? Depende da regra de negócio. Geralmente Monthly é o foco.
            // 2. Priorizar a data de fim mais distante (ou mais recente?)
            // Vamos ordenar por Data de Fim Decrescente (pegar a última que termina)
            // E se empatar, usar o ID mensal.
            val selectedSeason = seasons.sortedWith(
                compareByDescending<Season> { it.endDate }
                    .thenByDescending { it.id.startsWith("monthly") } // True (monthly) vem antes
                    .thenByDescending { it.id }
            ).firstOrNull()
            
            AppLogger.d(TAG) { "Temporada selecionada: ${selectedSeason?.id} - ${selectedSeason?.name}" }

            Result.success(selectedSeason)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar temporada ativa", e)
            Result.failure(e)
        }
    }

    /**
     * Busca ranking da temporada
     */
    suspend fun getSeasonRanking(seasonId: String, limit: Int = 50): Result<List<SeasonParticipationV2>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_SEASON_PARTICIPATION)
                .whereEqualTo("season_id", seasonId)
                .orderBy("points", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val ranking = snapshot.toObjects(SeasonParticipationV2::class.java)
            Result.success(ranking)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar ranking", e)
            Result.failure(e)
        }
    }

    suspend fun getUserParticipation(userId: String, seasonId: String): Result<SeasonParticipationV2?> {
        return try {
            val snapshot = firestore.collection(COLLECTION_SEASON_PARTICIPATION)
                .whereEqualTo("season_id", seasonId)
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            val participation = snapshot.documents.firstOrNull()?.toObject(SeasonParticipationV2::class.java)
            Result.success(participation)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar participação do usuário", e)
            Result.failure(e)
        }
    }

    /**
     * Atualiza participação na temporada após jogo
     */
    suspend fun updateSeasonParticipation(
        userId: String,
        seasonId: String,
        won: Boolean,
        draw: Boolean,
        goalsScored: Int = 0,
        goalsConceded: Int = 0,
        assists: Int = 0,
        isMVP: Boolean = false
    ): Result<SeasonParticipationV2> {
        return try {
            // Buscar participação existente
            val snapshot = firestore.collection(COLLECTION_SEASON_PARTICIPATION)
                .whereEqualTo("season_id", seasonId)
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            val existing = snapshot.documents.firstOrNull()?.toObject(SeasonParticipationV2::class.java)
            val docId = snapshot.documents.firstOrNull()?.id
                ?: firestore.collection(COLLECTION_SEASON_PARTICIPATION).document().id

            val pointsGained = when {
                won -> 3
                draw -> 1
                else -> 0
            }

            val participation = if (existing != null) {
                existing.copy(
                    gamesPlayed = existing.gamesPlayed + 1,
                    wins = if (won) existing.wins + 1 else existing.wins,
                    draws = if (draw) existing.draws + 1 else existing.draws,
                    losses = if (!won && !draw) existing.losses + 1 else existing.losses,
                    points = existing.points + pointsGained,
                    goalsScored = existing.goalsScored + goalsScored,
                    goalsConceded = existing.goalsConceded + goalsConceded,
                    assists = existing.assists + assists,
                    mvpCount = if (isMVP) existing.mvpCount + 1 else existing.mvpCount,
                    lastCalculatedAt = Date()
                )
            } else {
                SeasonParticipationV2(
                    userId = userId,
                    seasonId = seasonId,
                    gamesPlayed = 1,
                    wins = if (won) 1 else 0,
                    draws = if (draw) 1 else 0,
                    losses = if (!won && !draw) 1 else 0,
                    points = pointsGained,
                    goalsScored = goalsScored,
                    goalsConceded = goalsConceded,
                    assists = assists,
                    mvpCount = if (isMVP) 1 else 0,
                    division = LeagueDivision.BRONZE,
                    lastCalculatedAt = Date()
                )
            }

            firestore.collection(COLLECTION_SEASON_PARTICIPATION)
                .document(docId)
                .set(participation)
                .await()

            Result.success(participation)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar participação na temporada", e)
            Result.failure(e)
        }
    }


    suspend fun getActiveChallenges(): Result<List<WeeklyChallenge>> {
        return try {
            val now = Date()
            val snapshot = firestore.collection(COLLECTION_CHALLENGES)
                .whereLessThanOrEqualTo("startDate", now)
                .orderBy("startDate", Query.Direction.DESCENDING)
                .limit(20)
                .get()
                .await()

            val challenges = snapshot.documents.mapNotNull { doc ->
                doc.toObject(WeeklyChallenge::class.java)?.copy(id = doc.id)
            }.filter { challenge ->
                 // Simple string comparison for ISO dates or parse if needed.
                 // Assuming YYYY-MM-DD format which is comparable as string.
                 // Or better, logic: if endDate is empty/null, it's ongoing.
                 // User 'now' is Date.
                 // We need to parse challenge.endDate (String) to Date.
                 try {
                     if (challenge.endDate.isEmpty()) return@filter true
                     val end = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).parse(challenge.endDate)
                     end?.after(now) ?: true
                 } catch (e: Exception) {
                     true // If parse fails, assume active
                 }
            }
            
            Result.success(challenges)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar desafios ativos", e)
            Result.failure(e)
        }
    }

    suspend fun getChallengesProgress(userId: String, challengeIds: List<String>): Result<List<UserChallengeProgress>> {
        if (challengeIds.isEmpty()) return Result.success(emptyList())
        return try {
             // Firestore limit for 'IN' query is 10
             val chunks = challengeIds.chunked(10)
             val allProgress = mutableListOf<UserChallengeProgress>()
             
             for (chunk in chunks) {
                 val snapshot = firestore.collection(COLLECTION_CHALLENGE_PROGRESS)
                     .whereEqualTo("userId", userId)
                     .whereIn("challengeId", chunk)
                     .get()
                     .await()
                 allProgress.addAll(snapshot.toObjects(UserChallengeProgress::class.java))
             }
             Result.success(allProgress)
        } catch (e: Exception) {
             AppLogger.e(TAG, "Erro ao buscar progresso dos desafios", e)
             // Non-critical, return empty if fails? Or propagate error
             Result.failure(e)
        }
    }
}
