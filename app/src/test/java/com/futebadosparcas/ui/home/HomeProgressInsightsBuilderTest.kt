package com.futebadosparcas.ui.home

import com.futebadosparcas.data.model.MilestoneType
import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.domain.model.User
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@DisplayName("HomeProgressInsightsBuilder Tests")
class HomeProgressInsightsBuilderTest {

    @Test
    fun `shows near level when fewer than one hundred xp remain`() {
        val user = User(
            id = "user-1",
            name = "Joao",
            level = 1,
            experiencePoints = 251L
        )

        val insights = HomeProgressInsightsBuilder.build(user, statistics = null)

        val nearLevel = insights.nearLevel
        assertNotNull(nearLevel)
        assertEquals(99L, nearLevel?.xpRemaining)
        assertEquals(2, nearLevel?.nextLevel)
        assertTrue(insights.nearMilestones.isEmpty())
    }

    @Test
    fun `does not show near level when exactly one hundred xp remain`() {
        val user = User(
            id = "user-1",
            name = "Joao",
            level = 1,
            experiencePoints = 250L
        )

        val insights = HomeProgressInsightsBuilder.build(user, statistics = null)

        assertNull(insights.nearLevel)
    }

    @Test
    fun `returns only near unearned badge milestones for tracked categories`() {
        val user = User(
            id = "user-1",
            name = "Joao",
            milestonesAchieved = listOf(MilestoneType.GOALS_10.name)
        )
        val statistics = Statistics(
            userId = "user-1",
            totalGoals = 22,
            totalAssists = 20,
            totalSaves = 20,
            totalWins = 9
        )

        val insights = HomeProgressInsightsBuilder.build(user, statistics)

        assertEquals(
            listOf(
                MilestoneType.WINS_10,
                MilestoneType.GOALS_25,
                MilestoneType.ASSISTS_25,
                MilestoneType.SAVES_25
            ),
            insights.nearMilestones.map { it.milestone }
        )
        assertTrue(insights.nearMilestones.all { it.progressPercent >= 80 })
        assertEquals(1, insights.nearMilestones.first().remaining)
    }
}
