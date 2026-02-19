package com.futebadosparcas.domain.recommendation

/**
 * Motor de Recomendações "Para Você" do Futeba dos Parças.
 * Sugere jogos, jogadores e grupos baseado no histórico e preferências do usuário.
 */

// ==================== Models ====================

enum class RecommendationType {
    GAME, PLAYER, GROUP, LOCATION, TIME_SLOT
}

enum class RecommendationReason {
    FREQUENT_LOCATION, SIMILAR_PLAYERS, FRIEND_PLAYS_HERE,
    AVAILABLE_TIME, HIGH_RATING, NEARBY, MISSING_PLAYERS,
    TRENDING, STREAK_OPPORTUNITY, LEVEL_MATCH
}

data class Recommendation(
    val id: String,
    val type: RecommendationType,
    val entityId: String,
    val title: String,
    val subtitle: String?,
    val score: Float,
    val reasons: List<RecommendationReason>,
    val metadata: Map<String, String> = emptyMap()
)

data class RecommendationConfig(
    val maxResults: Int = 10,
    val includeTypes: Set<RecommendationType> = RecommendationType.entries.toSet(),
    val minScore: Float = 0.3f,
    val locationWeight: Float = 0.25f,
    val timeWeight: Float = 0.20f,
    val socialWeight: Float = 0.30f,
    val levelWeight: Float = 0.25f
)

data class UserRecommendationProfile(
    val userId: String,
    val level: Int,
    val preferredLocations: List<String>,
    val preferredTimeSlots: List<TimeSlot>,
    val friendIds: List<String>,
    val groupIds: List<String>,
    val gamesPlayed: Int,
    val averageRating: Float,
    val preferredGameTypes: List<String>,
    val lastActiveAt: Long
)

data class TimeSlot(
    val dayOfWeek: Int,
    val startHour: Int,
    val endHour: Int,
    val frequency: Float
)

enum class InteractionType {
    VIEWED, CLICKED, CONFIRMED, INVITED, JOINED, DISMISSED, REPORTED
}

// ==================== Engine Interface ====================

interface RecommendationEngine {
    suspend fun getRecommendations(
        userProfile: UserRecommendationProfile,
        config: RecommendationConfig = RecommendationConfig()
    ): List<Recommendation>

    suspend fun getGameRecommendations(
        userProfile: UserRecommendationProfile,
        limit: Int = 5
    ): List<Recommendation>

    suspend fun getPlayerRecommendations(
        userProfile: UserRecommendationProfile,
        gameId: String,
        limit: Int = 10
    ): List<Recommendation>

    suspend fun getGroupRecommendations(
        userProfile: UserRecommendationProfile,
        limit: Int = 5
    ): List<Recommendation>

    suspend fun recordInteraction(
        userId: String,
        recommendationId: String,
        interactionType: InteractionType
    )
}

// ==================== Default Implementation ====================

class DefaultRecommendationEngine : RecommendationEngine {

    override suspend fun getRecommendations(
        userProfile: UserRecommendationProfile,
        config: RecommendationConfig
    ): List<Recommendation> {
        val recommendations = mutableListOf<Recommendation>()

        if (RecommendationType.GAME in config.includeTypes) {
            recommendations.addAll(getGameRecommendations(userProfile, config.maxResults / 2))
        }
        if (RecommendationType.GROUP in config.includeTypes) {
            recommendations.addAll(getGroupRecommendations(userProfile, config.maxResults / 4))
        }

        return recommendations
            .filter { it.score >= config.minScore }
            .sortedByDescending { it.score }
            .take(config.maxResults)
    }

    override suspend fun getGameRecommendations(
        userProfile: UserRecommendationProfile,
        limit: Int
    ): List<Recommendation> = emptyList()

    override suspend fun getPlayerRecommendations(
        userProfile: UserRecommendationProfile,
        gameId: String,
        limit: Int
    ): List<Recommendation> = emptyList()

    override suspend fun getGroupRecommendations(
        userProfile: UserRecommendationProfile,
        limit: Int
    ): List<Recommendation> = emptyList()

    override suspend fun recordInteraction(
        userId: String,
        recommendationId: String,
        interactionType: InteractionType
    ) { /* Em produção, registrar no Firestore */ }
}

// ==================== Score Calculators ====================

object ScoreCalculators {

    fun calculateLocationScore(
        userLatLng: Pair<Double, Double>,
        gameLatLng: Pair<Double, Double>,
        maxDistanceKm: Double = 50.0
    ): Float {
        val distance = haversineDistance(
            userLatLng.first, userLatLng.second,
            gameLatLng.first, gameLatLng.second
        )
        return if (distance > maxDistanceKm) 0f
        else (1 - (distance / maxDistanceKm)).toFloat()
    }

    fun calculateTimeScore(
        preferredSlots: List<TimeSlot>,
        gameDay: Int,
        gameHour: Int
    ): Float {
        val matchingSlot = preferredSlots.find { slot ->
            slot.dayOfWeek == gameDay &&
            gameHour >= slot.startHour &&
            gameHour <= slot.endHour
        }
        return matchingSlot?.frequency ?: 0.1f
    }

    fun calculateSocialScore(
        friendIds: List<String>,
        confirmedPlayerIds: List<String>
    ): Float {
        if (friendIds.isEmpty()) return 0.5f
        val friendsConfirmed = confirmedPlayerIds.count { it in friendIds }
        return (friendsConfirmed.toFloat() / friendIds.size.coerceAtMost(5))
            .coerceAtMost(1f)
    }

    fun calculateLevelScore(
        userLevel: Int,
        averagePlayerLevel: Float,
        levelTolerance: Int = 3
    ): Float {
        val diff = kotlin.math.abs(userLevel - averagePlayerLevel)
        return if (diff > levelTolerance) 0.2f
        else (1 - (diff / levelTolerance)).toFloat()
    }

    private fun haversineDistance(
        lat1: Double, lon1: Double,
        lat2: Double, lon2: Double
    ): Double {
        val r = 6371.0
        val dLat = (lat2 - lat1) * kotlin.math.PI / 180.0
        val dLon = (lon2 - lon1) * kotlin.math.PI / 180.0
        val a = kotlin.math.sin(dLat / 2) * kotlin.math.sin(dLat / 2) +
                kotlin.math.cos(lat1 * kotlin.math.PI / 180.0) *
                kotlin.math.cos(lat2 * kotlin.math.PI / 180.0) *
                kotlin.math.sin(dLon / 2) * kotlin.math.sin(dLon / 2)
        val c = 2 * kotlin.math.atan2(kotlin.math.sqrt(a), kotlin.math.sqrt(1 - a))
        return r * c
    }
}

object RecommendationRanker {

    fun calculateFinalScore(
        locationScore: Float,
        timeScore: Float,
        socialScore: Float,
        levelScore: Float,
        config: RecommendationConfig = RecommendationConfig()
    ): Float {
        return (locationScore * config.locationWeight) +
               (timeScore * config.timeWeight) +
               (socialScore * config.socialWeight) +
               (levelScore * config.levelWeight)
    }

    fun determineReasons(
        locationScore: Float,
        timeScore: Float,
        socialScore: Float,
        levelScore: Float,
        threshold: Float = 0.6f
    ): List<RecommendationReason> {
        val reasons = mutableListOf<RecommendationReason>()
        if (locationScore >= threshold) reasons.add(RecommendationReason.NEARBY)
        if (timeScore >= threshold) reasons.add(RecommendationReason.AVAILABLE_TIME)
        if (socialScore >= threshold) reasons.add(RecommendationReason.FRIEND_PLAYS_HERE)
        if (levelScore >= threshold) reasons.add(RecommendationReason.LEVEL_MATCH)
        return reasons.ifEmpty { listOf(RecommendationReason.TRENDING) }
    }
}
