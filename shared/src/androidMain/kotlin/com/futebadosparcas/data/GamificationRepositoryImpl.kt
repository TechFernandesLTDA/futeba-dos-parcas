package com.futebadosparcas.data

import com.futebadosparcas.domain.model.*
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.text.SimpleDateFormat
import java.util.*

/**
 * Implementação Android do GamificationRepository usando FirebaseDataSource.
 *
 * Esta implementação fornece todas as operações de gamificação necessárias
 * para o app, incluindo streaks, badges, temporadas e desafios.
 */
class GamificationRepositoryImpl(
    private val dataSource: FirebaseDataSource
) : GamificationRepository {

    companion object {
        private const val TAG = "GamificationRepositoryImpl"
        private val DATE_FORMAT = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    }

    // ========== STREAKS ==========

    override suspend fun updateStreak(userId: String, gameDate: String): Result<UserStreak> {
        return try {
            // Buscar streak atual
            val currentStreakResult = dataSource.getUserStreak(userId)
            val currentStreak = currentStreakResult.getOrNull()

            // Calcular novo streak
            val newStreak = calculateNewStreak(currentStreak, gameDate, userId)

            // Salvar
            dataSource.saveUserStreak(newStreak)

            Result.success(newStreak)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getUserStreak(userId: String): Result<UserStreak?> {
        return dataSource.getUserStreak(userId)
    }

    /**
     * Calcula o novo streak baseado na última data jogada.
     */
    private fun calculateNewStreak(
        currentStreak: UserStreak?,
        gameDate: String,
        userId: String
    ): UserStreak {
        val gameDateParsed = try {
            DATE_FORMAT.parse(gameDate) ?: Date()
        } catch (e: Exception) {
            Date()
        }

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

        // Parse última data jogada
        val lastPlayedDate = try {
            currentStreak.lastGameDate?.let { DATE_FORMAT.parse(it) } ?: Date()
        } catch (e: Exception) {
            Date()
        }

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

    // ========== BADGES ==========

    override suspend fun awardBadge(userId: String, badgeId: String): Result<UserBadge> {
        return try {
            // Buscar badges existentes do usuário
            val existingBadgesResult = dataSource.getUserBadges(userId)
            val existingBadges = existingBadgesResult.getOrNull() ?: emptyList()

            val existing = existingBadges.find { it.badgeId == badgeId }

            if (existing == null) {
                // Criar novo badge
                val newBadge = UserBadge(
                    userId = userId,
                    badgeId = badgeId,
                    unlockedAt = System.currentTimeMillis(),
                    unlockCount = 1
                )

                dataSource.createUserBadge(newBadge)
                Result.success(newBadge)
            } else {
                // Incrementar contador
                val updatedBadge = existing.copy(
                    unlockCount = existing.unlockCount + 1,
                    unlockedAt = System.currentTimeMillis()
                )

                dataSource.updateUserBadge(updatedBadge)
                Result.success(updatedBadge)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getUserBadges(userId: String): Result<List<UserBadge>> {
        return dataSource.getUserBadges(userId)
    }

    override suspend fun getAvailableBadges(): Result<List<BadgeDefinition>> {
        return dataSource.getAvailableBadges()
    }

    override suspend fun getRecentBadges(userId: String, limit: Int): Result<List<UserBadge>> {
        return dataSource.getRecentBadges(userId, limit)
    }

    // ========== SEASONS & LEAGUE ==========

    override suspend fun getActiveSeason(): Result<Season?> {
        return dataSource.getActiveSeason()
    }

    override suspend fun getAllSeasons(): Result<List<Season>> {
        return dataSource.getAllSeasons()
    }

    override suspend fun getSeasonRanking(seasonId: String, limit: Int): Result<List<SeasonParticipation>> {
        return dataSource.getSeasonRanking(seasonId, limit)
    }

    override fun observeSeasonRanking(seasonId: String, limit: Int): Flow<List<SeasonParticipation>> {
        return dataSource.observeSeasonRanking(seasonId, limit)
    }

    override suspend fun getUserParticipation(userId: String, seasonId: String): Result<SeasonParticipation?> {
        return dataSource.getSeasonParticipation(seasonId, userId)
    }

    override suspend fun updateSeasonParticipation(
        userId: String,
        seasonId: String,
        won: Boolean,
        draw: Boolean,
        goalsScored: Int,
        goalsConceded: Int,
        assists: Int,
        isMVP: Boolean
    ): Result<SeasonParticipation> {
        return try {
            // Buscar participação existente
            val existingResult = dataSource.getSeasonParticipation(seasonId, userId)
            val existing = existingResult.getOrNull()

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
                    goals = existing.goals + goalsScored,
                    assists = existing.assists + assists,
                    mvpCount = if (isMVP) existing.mvpCount + 1 else existing.mvpCount,
                    updatedAt = System.currentTimeMillis()
                )
            } else {
                SeasonParticipation(
                    userId = userId,
                    seasonId = seasonId,
                    gamesPlayed = 1,
                    wins = if (won) 1 else 0,
                    draws = if (draw) 1 else 0,
                    losses = if (!won && !draw) 1 else 0,
                    points = pointsGained,
                    goals = goalsScored,
                    assists = assists,
                    mvpCount = if (isMVP) 1 else 0,
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis()
                )
            }

            dataSource.saveSeasonParticipation(participation)
            Result.success(participation)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== CHALLENGES ==========

    override suspend fun getActiveChallenges(): Result<List<WeeklyChallenge>> {
        return dataSource.getActiveChallenges()
    }

    override suspend fun getChallengesProgress(
        userId: String,
        challengeIds: List<String>
    ): Result<List<UserChallengeProgress>> {
        return dataSource.getChallengesProgress(userId, challengeIds)
    }
}
