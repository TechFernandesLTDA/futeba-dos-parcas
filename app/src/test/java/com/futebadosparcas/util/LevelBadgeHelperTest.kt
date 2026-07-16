package com.futebadosparcas.util

import com.futebadosparcas.R
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Test

class LevelBadgeHelperTest {

    @Test
    fun `niveis lenda usam os dez brasoes exclusivos`() {
        val expected = listOf(
            R.drawable.ic_level_badge_11,
            R.drawable.ic_level_badge_12,
            R.drawable.ic_level_badge_13,
            R.drawable.ic_level_badge_14,
            R.drawable.ic_level_badge_15,
            R.drawable.ic_level_badge_16,
            R.drawable.ic_level_badge_17,
            R.drawable.ic_level_badge_18,
            R.drawable.ic_level_badge_19,
            R.drawable.ic_level_badge_20,
        )

        assertEquals(expected, (11..20).map(LevelBadgeHelper::getBadgeForLevel))
        expected.forEach { assertNotEquals(LevelBadgeHelper.getFallbackBadge(), it) }
    }

    @Test
    fun `nivel acima do maximo permanece no brasao vinte`() {
        assertEquals(R.drawable.ic_level_badge_20, LevelBadgeHelper.getBadgeForLevel(99))
    }
}
