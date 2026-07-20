package com.futebadosparcas.ui.home

import com.futebadosparcas.data.model.MilestoneType
import com.futebadosparcas.domain.model.LevelTable
import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.ranking.MilestoneChecker

data class HomeProgressInsights(
    val nearLevel: NearLevelProgress? = null,
    val nearMilestones: List<NearMilestoneProgress> = emptyList()
) {
    val hasContent: Boolean
        get() = nearLevel != null || nearMilestones.isNotEmpty()
}

data class NearLevelProgress(
    val currentLevel: Int,
    val nextLevel: Int,
    val nextLevelName: String,
    val xpRemaining: Long,
    val progressPercent: Int
)

data class NearMilestoneProgress(
    val milestone: MilestoneType,
    val current: Int,
    val target: Int,
    val remaining: Int,
    val progressPercent: Int
)

internal object HomeProgressInsightsBuilder {
    private const val NEAR_LEVEL_XP_THRESHOLD = 100L
    private const val NEAR_BADGE_PROGRESS_THRESHOLD = 80

    private val supportedFields = listOf(
        "totalGoals",
        "totalAssists",
        "totalSaves",
        "gamesWon"
    )

    fun build(
        user: User,
        statistics: Statistics?
    ): HomeProgressInsights {
        return HomeProgressInsights(
            nearLevel = buildNearLevel(user),
            nearMilestones = buildNearMilestones(user, statistics)
        )
    }

    private fun buildNearLevel(user: User): NearLevelProgress? {
        if (LevelTable.isMaxLevel(user.level)) return null

        val (progressXp, neededXp) = LevelTable.getXpProgress(user.experiencePoints)
        val xpRemaining = (neededXp - progressXp).coerceAtLeast(0L)
        if (xpRemaining <= 0L || xpRemaining >= NEAR_LEVEL_XP_THRESHOLD) return null

        val nextLevel = user.level + 1
        return NearLevelProgress(
            currentLevel = user.level,
            nextLevel = nextLevel,
            nextLevelName = LevelTable.getLevelName(nextLevel),
            xpRemaining = xpRemaining,
            progressPercent = LevelTable.getProgressPercent(user.experiencePoints)
        )
    }

    private fun buildNearMilestones(
        user: User,
        statistics: Statistics?
    ): List<NearMilestoneProgress> {
        if (statistics == null) return emptyList()

        return MilestoneChecker.getNextMilestones(
            stats = statistics,
            achievedMilestones = user.milestonesAchieved
        )
            .filter { it.field in supportedFields }
            .mapNotNull { milestone ->
                val (current, target) = MilestoneChecker.getProgress(statistics, milestone)
                val progressPercent = MilestoneChecker.getProgressPercent(statistics, milestone)
                if (progressPercent < NEAR_BADGE_PROGRESS_THRESHOLD) {
                    null
                } else {
                    NearMilestoneProgress(
                        milestone = milestone,
                        current = current,
                        target = target,
                        remaining = (target - current).coerceAtLeast(0),
                        progressPercent = progressPercent
                    )
                }
            }
            .sortedWith(
                compareByDescending<NearMilestoneProgress> { it.progressPercent }
                    .thenBy { it.remaining }
                    .thenBy { supportedFields.indexOf(it.milestone.field) }
                    .thenBy { it.milestone.threshold }
            )
    }
}
