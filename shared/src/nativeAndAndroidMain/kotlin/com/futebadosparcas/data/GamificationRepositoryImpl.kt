package com.futebadosparcas.data

import com.futebadosparcas.domain.model.*
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.datetime.Clock
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.daysUntil
import kotlinx.datetime.toLocalDateTime

/**
 * Implementação compartilhada Android+iOS do GamificationRepository.
 *
 * Operações de gamificação: streaks, badges, temporadas, desafios.
 * Usa kotlinx.datetime (cross-platform) para manipulação de datas.
 */
class GamificationRepositoryImpl(
    private val dataSource: FirebaseDataSource
) : GamificationRepository {

    companion object {
        private const val TAG = "GamificationRepositoryImpl"
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
     * Calcula o novo streak baseado na última data jogada (formato ISO yyyy-MM-dd).
     */
    private fun calculateNewStreak(
        currentStreak: UserStreak?,
        gameDate: String,
        userId: String
    ): UserStreak {
        if (currentStreak == null) {
            return UserStreak(
                userId = userId,
                currentStreak = 1,
                longestStreak = 1,
                lastGameDate = gameDate,
                streakStartedAt = gameDate
            )
        }

        val gameDateParsed = parseLocalDateOrToday(gameDate)
        val lastPlayedDate = currentStreak.lastGameDate
            ?.let { parseLocalDateOrToday(it) }
            ?: gameDateParsed

        val diffInDays = lastPlayedDate.daysUntil(gameDateParsed)

        val newCurrentStreak = when {
            diffInDays == 0 -> currentStreak.currentStreak
            diffInDays == 1 -> currentStreak.currentStreak + 1
            else -> 1
        }

        val newLongestStreak = maxOf(newCurrentStreak, currentStreak.longestStreak)

        return currentStreak.copy(
            currentStreak = newCurrentStreak,
            longestStreak = newLongestStreak,
            lastGameDate = gameDate,
            streakStartedAt = if (diffInDays > 1) gameDate else currentStreak.streakStartedAt
        )
    }

    private fun parseLocalDateOrToday(iso: String): LocalDate {
        return try {
            LocalDate.parse(iso)
        } catch (_: Exception) {
            Clock.System.now()
                .toLocalDateTime(TimeZone.currentSystemDefault())
                .date
        }
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
                    unlockedAt = Clock.System.now().toEpochMilliseconds(),
                    unlockCount = 1
                )

                dataSource.createUserBadge(newBadge)
                Result.success(newBadge)
            } else {
                // Incrementar contador
                val updatedBadge = existing.copy(
                    unlockCount = existing.unlockCount + 1,
                    unlockedAt = Clock.System.now().toEpochMilliseconds()
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
                    updatedAt = Clock.System.now().toEpochMilliseconds()
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
                    createdAt = Clock.System.now().toEpochMilliseconds(),
                    updatedAt = Clock.System.now().toEpochMilliseconds()
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
