package com.futebadosparcas.ui.home

import com.futebadosparcas.domain.model.Activity
import com.futebadosparcas.domain.model.ActivityType
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@DisplayName("RewardActivityCelebration")
class RewardActivityCelebrationTest {

    @Test
    fun `classifica level up como celebracao de nivel`() {
        val activity = Activity(type = ActivityType.LEVEL_UP)

        assertEquals(RewardActivityCelebrationKind.LEVEL, activity.rewardCelebrationKind())
    }

    @Test
    fun `classifica conquistas como celebracao de badge`() {
        val rewardTypes = listOf(
            ActivityType.BADGE_EARNED,
            ActivityType.MILESTONE_REACHED,
            ActivityType.STREAK_MILESTONE,
            ActivityType.CHALLENGE_COMPLETED
        )

        rewardTypes.forEach { type ->
            assertEquals(RewardActivityCelebrationKind.BADGE, Activity(type = type).rewardCelebrationKind())
        }
    }

    @Test
    fun `classifica MVP como celebracao de MVP`() {
        val activity = Activity(type = ActivityType.MVP_EARNED)

        assertEquals(RewardActivityCelebrationKind.MVP, activity.rewardCelebrationKind())
    }

    @Test
    fun `ignora atividades que nao representam recompensa visual`() {
        val nonRewardTypes = listOf(
            ActivityType.GAME_FINISHED,
            ActivityType.HAT_TRICK,
            ActivityType.CLEAN_SHEET
        )

        nonRewardTypes.forEach { type ->
            assertNull(Activity(type = type).rewardCelebrationKind())
        }
    }
}
