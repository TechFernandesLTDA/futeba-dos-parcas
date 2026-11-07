package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.FirebaseAuth
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toInstant
import kotlinx.datetime.toLocalDateTime

internal class FirebaseGamificationDataSource(
    private val firestore: FirebaseFirestore = Firebase.firestore,
    private val auth: FirebaseAuth = Firebase.auth
) {
    // ========== XP LOGS ==========

    suspend fun getUserXpLogs(userId: String, limit: Int): Result<List<XpLog>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_XP_LOGS)
                .where { "user_id" equalTo userId }
                .orderBy("created_at", Direction.DESCENDING)
                .limit(limit)
                .get()

            val logs = snapshot.documents.mapNotNull { it.toXpLogOrNull() }
            Result.success(logs)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== XP/GAMIFICATION ==========

    suspend fun createXpLog(xpLog: XpLog): Result<XpLog> {
        return try {
            val docRef = firestore.collection(COLLECTION_XP_LOGS).document
            val xpLogData = mapOf(
                "id" to docRef.id,
                "user_id" to xpLog.userId,
                "game_id" to xpLog.gameId,
                "xp_earned" to xpLog.xpEarned,
                "xp_before" to xpLog.xpBefore,
                "xp_after" to xpLog.xpAfter,
                "level_before" to xpLog.levelBefore,
                "level_after" to xpLog.levelAfter,
                "xp_participation" to xpLog.xpParticipation,
                "xp_goals" to xpLog.xpGoals,
                "xp_assists" to xpLog.xpAssists,
                "xp_saves" to xpLog.xpSaves,
                "xp_result" to xpLog.xpResult,
                "xp_mvp" to xpLog.xpMvp,
                "xp_milestones" to xpLog.xpMilestones,
                "xp_streak" to xpLog.xpStreak,
                "goals" to xpLog.goals,
                "assists" to xpLog.assists,
                "saves" to xpLog.saves,
                "was_mvp" to xpLog.wasMvp,
                "game_result" to xpLog.gameResult,
                "milestones_unlocked" to xpLog.milestonesUnlocked,
                "created_at" to FieldValue.serverTimestamp
            )
            docRef.set(xpLogData)
            Result.success(xpLog.copy(id = docRef.id))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateUserLevel(userId: String, level: Int, xp: Long): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(mapOf(
                    "level" to level,
                    "experience_points" to xp
                ))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun awardBadge(userId: String, badgeId: String): Result<Unit> {
        return try {
            val docRef = firestore.collection("user_badges").document
            val badgeData = mapOf(
                "id" to docRef.id,
                "user_id" to userId,
                "badge_id" to badgeId,
                "unlocked_at" to FieldValue.serverTimestamp
            )
            docRef.set(badgeData)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // REMOVIDO #1283: actual updateStreak(Long) gravava epoch-ms violando contrato String "yyyy-MM-dd"
    // de user_streaks.last_game_date. Sem caller vivo. Path vivo: GamificationRepositoryImpl.updateStreak(String).

    suspend fun unlockMilestone(userId: String, milestoneId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(mapOf(
                    "milestones_achieved" to FieldValue.arrayUnion(milestoneId)
                ))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }


    // ========== RANKINGS ==========

    suspend fun getRankingByCategory(category: String, field: String, limit: Int): Result<List<Triple<String, Long, Int>>> {
        return try {
            val collection = if (category == "XP") COLLECTION_USERS else COLLECTION_STATISTICS
            val snapshot = firestore.collection(collection).orderBy(field, Direction.DESCENDING).limit(limit).get()
            Result.success(snapshot.documents.mapNotNull { doc ->
                val value = if (category == "XP") doc.get<Long?>("experience_points") ?: 0L else doc.get<Long?>(field) ?: 0L
                val games = if (category == "XP") 0 else doc.get<Long?>("totalGames")?.toInt() ?: doc.get<Long?>("total_games")?.toInt() ?: 0
                Triple(doc.id, value, games)
            })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar ranking $category: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun getRankingDeltas(periodName: String, periodKey: String, deltaField: String, minGames: Int, limit: Int): Result<List<Triple<String, Long, Int>>> {
        return try {
            val snapshot = firestore.collection("ranking_deltas")
                .where { "period" equalTo periodName }.where { "period_key" equalTo periodKey }
                .orderBy(deltaField, Direction.DESCENDING).limit(limit).get()
            Result.success(snapshot.documents.mapNotNull { doc ->
                val userId = doc.get<String?>("user_id") ?: return@mapNotNull null
                Triple(userId, doc.get<Long?>(deltaField) ?: 0L, doc.get<Long?>("games_added")?.toInt() ?: 0)
            }.filter { (_, _, g) -> g >= minGames })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar ranking deltas: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun getUsersStatistics(userIds: List<String>): Result<Map<String, Statistics>> {
        return try {
            if (userIds.isEmpty()) return Result.success(emptyMap())
            val map = mutableMapOf<String, Statistics>()
            userIds.chunked(10).forEach { chunk ->
                firestore.collection(COLLECTION_STATISTICS).where { FieldPath.documentId inArray chunk }.get()
                    .documents.forEach { doc -> doc.toRankingStatisticsOrNull()?.let { map[doc.id] = it } }
            }
            Result.success(map)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar estatísticas em batch: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun getStatisticsRanking(orderByField: String, limit: Int): Result<List<Statistics>> {
        return try {
            Result.success(firestore.collection(COLLECTION_STATISTICS).orderBy(orderByField, Direction.DESCENDING).limit(limit).get()
                .documents.mapNotNull { it.toRankingStatisticsOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar ranking de estatísticas: ${e.message}")
            Result.failure(e)
        }
    }


    // ========== GAMIFICATION - STREAKS ==========

    suspend fun getUserStreak(userId: String): Result<UserStreak?> {
        return try {
            val snapshot = firestore.collection("user_streaks").where { "user_id" equalTo userId }.get()
            Result.success(snapshot.documents.firstOrNull()?.toUserStreakOrNull())
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun saveUserStreak(streak: UserStreak): Result<Unit> {
        return try {
            val existing = firestore.collection("user_streaks").where { "user_id" equalTo streak.userId }.get()
            val docId = existing.documents.firstOrNull()?.id ?: firestore.collection("user_streaks").document.id
            firestore.collection("user_streaks").document(docId).set(streak)
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    // ========== GAMIFICATION - BADGES ==========

    suspend fun getAvailableBadges(): Result<List<BadgeDefinition>> {
        return try {
            Result.success(firestore.collection("badges").get().documents.mapNotNull { it.toBadgeDefinitionOrNull() })
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getUserBadges(userId: String): Result<List<UserBadge>> {
        return try {
            Result.success(firestore.collection("user_badges").where { "user_id" equalTo userId }.get().documents.mapNotNull { it.toUserBadgeOrNull() })
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getRecentBadges(userId: String, limit: Int): Result<List<UserBadge>> {
        return try {
            Result.success(firestore.collection("user_badges").where { "user_id" equalTo userId }
                .orderBy("unlocked_at", Direction.DESCENDING).limit(limit).get().documents.mapNotNull { it.toUserBadgeOrNull() })
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun createUserBadge(userBadge: UserBadge): Result<UserBadge> {
        return try {
            val docRef = firestore.collection("user_badges").document
            val badgeWithId = userBadge.copy(id = docRef.id)
            docRef.set(badgeWithId)
            Result.success(badgeWithId)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun updateUserBadge(userBadge: UserBadge): Result<Unit> {
        return try {
            firestore.collection("user_badges").document(userBadge.id).set(userBadge)
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    // ========== GAMIFICATION - SEASONS ==========

    suspend fun getActiveSeason(): Result<Season?> {
        return try {
            val now = Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault())
            val year = now.year; val month = now.monthNumber
            val seasonId = "monthly_${year}_${month.toString().padStart(2, '0')}"
            val doc = firestore.collection("seasons").document(seasonId).get()
            val season = if (doc.exists) {
                doc.toSeasonOrNull()
            } else {
                val startMillis = kotlinx.datetime.LocalDateTime(year, month, 1, 0, 0, 0).toInstant(TimeZone.currentSystemDefault()).toEpochMilliseconds()
                val ny = if (month == 12) year + 1 else year; val nm = if (month == 12) 1 else month + 1
                val endMillis = kotlinx.datetime.LocalDateTime(ny, nm, 1, 0, 0, 0).toInstant(TimeZone.currentSystemDefault()).toEpochMilliseconds() - 1
                val portugueseMonths = listOf("Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro")
                val seasonName = "${portugueseMonths[month - 1]} $year"
                val newSeason = Season(id = seasonId, name = seasonName, startDate = startMillis, endDate = endMillis, isActive = true)
                firestore.collection("seasons").document(seasonId).set(mapOf(
                    "id" to newSeason.id, "name" to newSeason.name,
                    "start_date" to Timestamp(startMillis / 1000, 0),
                    "end_date" to Timestamp(endMillis / 1000, 0),
                    "is_active" to true, "created_at" to FieldValue.serverTimestamp
                ))
                newSeason
            }
            Result.success(season)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getAllSeasons(): Result<List<Season>> {
        return try {
            val seasons = firestore.collection("seasons").get().documents.mapNotNull { it.toSeasonOrNull() }
                .sortedWith(compareByDescending<Season> { it.endDate }.thenByDescending { it.startDate }.thenByDescending { it.id })
            Result.success(seasons)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getSeasonRanking(seasonId: String, limit: Int): Result<List<SeasonParticipation>> {
        return try {
            Result.success(firestore.collection("season_participation").where { "season_id" equalTo seasonId }
                .orderBy("points", Direction.DESCENDING).limit(limit).get().documents.mapNotNull { it.toSeasonParticipationOrNull() })
        } catch (e: Exception) { Result.failure(e) }
    }

    fun observeSeasonRanking(seasonId: String, limit: Int, gender: String?): Flow<List<SeasonParticipation>> {
        // Fase 4b: segmentação por gênero. null/inválido = combinado (campos
        // planos, comportamento histórico). MALE/FEMALE/MIXED = segmentado:
        // ordena por `by_gender.{G}.points` (índices da Fase 4a) e sobrepõe as
        // stats do sub-mapa. Docs sem aquele gênero não têm o campo → ficam
        // naturalmente fora da query.
        val genderKey = normalizeSeasonGenderKey(gender)
        val orderField = if (genderKey != null) "by_gender.$genderKey.points" else "points"
        return firestore.collection("season_participation").where { "season_id" equalTo seasonId }
            .orderBy(orderField, Direction.DESCENDING).limit(limit).snapshots()
            .map { it.documents.mapNotNull { d -> d.toSeasonParticipationOrNull(genderKey) } }
            .catch { emit(emptyList()) }
    }

    suspend fun getSeasonParticipation(seasonId: String, userId: String): Result<SeasonParticipation?> {
        return try {
            val snapshot = firestore.collection("season_participation")
                .where { "season_id" equalTo seasonId }.where { "user_id" equalTo userId }.get()
            Result.success(snapshot.documents.firstOrNull()?.toSeasonParticipationOrNull())
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun saveSeasonParticipation(participation: SeasonParticipation): Result<Unit> {
        return try {
            val existing = firestore.collection("season_participation")
                .where { "season_id" equalTo participation.seasonId }.where { "user_id" equalTo participation.userId }.get()
            val docId = existing.documents.firstOrNull()?.id ?: firestore.collection("season_participation").document.id
            firestore.collection("season_participation").document(docId).set(participation)
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    // ========== GAMIFICATION - CHALLENGES ==========

    suspend fun getActiveChallenges(): Result<List<WeeklyChallenge>> {
        return try {
            val nowMillis = Clock.System.now().toEpochMilliseconds()
            val nowTs = Timestamp(nowMillis / 1000, 0)
            val snapshot = firestore.collection("challenges")
                .where { "start_date" lessThanOrEqualTo nowTs }
                .orderBy("start_date", Direction.DESCENDING).limit(20).get()
            val nowDateStr = Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault()).let {
                "${it.year}-${it.monthNumber.toString().padStart(2,'0')}-${it.dayOfMonth.toString().padStart(2,'0')}"
            }
            val challenges = snapshot.documents.mapNotNull { it.toWeeklyChallengeOrNull() }.filter { challenge ->
                if (challenge.endDate.isEmpty()) true
                else try { challenge.endDate >= nowDateStr } catch (e: Exception) { true }
            }
            Result.success(challenges)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getChallengesProgress(userId: String, challengeIds: List<String>): Result<List<UserChallengeProgress>> {
        return try {
            if (challengeIds.isEmpty()) return Result.success(emptyList())
            val allProgress = mutableListOf<UserChallengeProgress>()
            challengeIds.chunked(10).forEach { chunk ->
                allProgress.addAll(firestore.collection("challenge_progress")
                    .where { "user_id" equalTo userId }.where { "challenge_id" inArray chunk }.get()
                    .documents.mapNotNull { it.toUserChallengeProgressOrNull() })
            }
            Result.success(allProgress)
        } catch (e: Exception) { Result.failure(e) }
    }

}
