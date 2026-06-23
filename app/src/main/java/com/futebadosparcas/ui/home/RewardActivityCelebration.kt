package com.futebadosparcas.ui.home

import com.futebadosparcas.domain.model.Activity
import com.futebadosparcas.domain.model.ActivityType

internal enum class RewardActivityCelebrationKind {
    LEVEL,
    BADGE,
    MVP
}

internal fun Activity.rewardCelebrationKind(): RewardActivityCelebrationKind? {
    return when (type) {
        ActivityType.LEVEL_UP -> RewardActivityCelebrationKind.LEVEL
        ActivityType.BADGE_EARNED,
        ActivityType.MILESTONE_REACHED,
        ActivityType.STREAK_MILESTONE,
        ActivityType.CHALLENGE_COMPLETED -> RewardActivityCelebrationKind.BADGE
        ActivityType.MVP_EARNED -> RewardActivityCelebrationKind.MVP
        ActivityType.GAME_FINISHED,
        ActivityType.HAT_TRICK,
        ActivityType.CLEAN_SHEET -> null
    }
}
