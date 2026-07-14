package com.futebadosparcas.ui

import com.futebadosparcas.R
import com.futebadosparcas.ui.components.avatar.AvatarBadge
import com.futebadosparcas.ui.components.avatar.AvatarFrame
import com.futebadosparcas.ui.components.avatar.Expression
import com.futebadosparcas.ui.components.avatar.FacialHair
import com.futebadosparcas.ui.components.avatar.Glasses
import com.futebadosparcas.ui.components.avatar.HairColor
import com.futebadosparcas.ui.components.avatar.HairStyle
import com.futebadosparcas.ui.components.avatar.SkinTone
import com.futebadosparcas.ui.components.gamification.FlameLevel
import com.futebadosparcas.ui.statistics.ComparisonCategory
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class AndroidEnumLabelResourcesTest {

    @Test
    fun `canonical enum identities map one-to-one to localized resources`() {
        assertEquals(
            listOf(
                "GAMES",
                "WINS",
                "WIN_RATE",
                "GOALS",
                "GOALS_PER_GAME",
                "ASSISTS",
                "ASSISTS_PER_GAME",
                "SAVES",
                "MVP",
                "STREAK"
            ),
            ComparisonCategory.entries.map { it.name }
        )
        assertEquals(
            listOf(
                R.string.comparison_category_games,
                R.string.comparison_category_wins,
                R.string.comparison_category_win_rate,
                R.string.comparison_category_goals,
                R.string.comparison_category_goals_per_game,
                R.string.comparison_category_assists,
                R.string.comparison_category_assists_per_game,
                R.string.comparison_category_saves,
                R.string.comparison_category_mvp,
                R.string.comparison_category_streak
            ),
            ComparisonCategory.entries.map { it.displayNameRes }
        )
        assertEquals(
            listOf(0, 1, 4, 7, 10, 20),
            FlameLevel.entries.map { it.minStreak }
        )
        assertEquals(
            listOf(
                R.string.streak_level_none,
                R.string.streak_level_warming,
                R.string.streak_level_hot,
                R.string.streak_level_burning,
                R.string.streak_level_inferno,
                R.string.streak_level_legendary
            ),
            FlameLevel.entries.map { it.displayNameRes }
        )
    }

    @Test
    fun `every avatar enum exposes a distinct label resource per option`() {
        val labelGroups = listOf(
            SkinTone.entries.map { it.labelRes },
            HairStyle.entries.map { it.labelRes },
            HairColor.entries.map { it.labelRes },
            FacialHair.entries.map { it.labelRes },
            Glasses.entries.map { it.labelRes },
            Expression.entries.map { it.labelRes },
            AvatarBadge.entries.map { it.labelRes },
            AvatarFrame.entries.map { it.labelRes }
        )

        labelGroups.forEach { resources ->
            assertTrue(resources.all { it != 0 })
            assertEquals(resources.size, resources.distinct().size)
        }
        assertTrue(AvatarBadge.entries.all { it.requirementRes != 0 })
        assertEquals(null, AvatarFrame.NONE.requirementRes)
        assertTrue(AvatarFrame.entries.drop(1).all { it.requirementRes != null })
    }

    @Test
    fun `new localized labels have key parity in Portuguese English and Spanish`() {
        val portuguese = readStrings("values")
        val english = readStrings("values-en")
        val spanish = readStrings("values-es")
        val expectedKeys = portuguese.keys.filter(::isNewLocalizedKey).toSet()

        assertTrue(expectedKeys.isNotEmpty())
        assertEquals(expectedKeys, english.keys.filter(::isNewLocalizedKey).toSet())
        assertEquals(expectedKeys, spanish.keys.filter(::isNewLocalizedKey).toSet())
        assertTrue(expectedKeys.all { portuguese.getValue(it).isNotBlank() })
        assertTrue(expectedKeys.all { english.getValue(it).isNotBlank() })
        assertTrue(expectedKeys.all { spanish.getValue(it).isNotBlank() })

        assertEquals("Jogos", portuguese.getValue("comparison_category_games"))
        assertEquals("Games", english.getValue("comparison_category_games"))
        assertEquals("Partidos", spanish.getValue("comparison_category_games"))
        assertNotEquals(
            portuguese.getValue("user_card_menu_promote_admin"),
            english.getValue("user_card_menu_promote_admin")
        )
        assertNotEquals(
            portuguese.getValue("streak_level_warming"),
            spanish.getValue("streak_level_warming")
        )
    }

    private fun readStrings(valuesDirectory: String): Map<String, String> {
        val resourceRoot = sequenceOf(Path.of("src/main/res"), Path.of("app/src/main/res"))
            .firstOrNull(Files::isDirectory)
            ?: error("Android resource directory not found")
        val xml = String(
            Files.readAllBytes(resourceRoot.resolve(valuesDirectory).resolve("strings.xml")),
            StandardCharsets.UTF_8
        )
        return STRING_RESOURCE.findAll(xml).associate { match ->
            match.groupValues[1] to match.groupValues[2]
        }
    }

    private fun isNewLocalizedKey(key: String): Boolean = when {
        key.startsWith("comparison_category_") -> true
        key.startsWith("social_comparison_") -> true
        key.startsWith("user_card_menu_") -> true
        key.startsWith("streak_level_") -> true
        key.startsWith("streak_games_") -> true
        key in STREAK_CONTEXT_KEYS -> true
        key in AVATAR_CONTEXT_KEYS -> true
        key.startsWith("avatar_skin_") -> key != "avatar_skin_tone"
        key.startsWith("avatar_hair_style_") -> true
        key.startsWith("avatar_hair_color_") -> key != "avatar_hair_color"
        key.startsWith("avatar_facial_hair_") -> key != "avatar_facial_hair"
        key.startsWith("avatar_glasses_") -> key != "avatar_glasses"
        key.startsWith("avatar_expression_") -> key != "avatar_expression"
        key.startsWith("avatar_badge_") -> key != "avatar_badge"
        key.startsWith("avatar_frame_") -> key != "avatar_frame"
        else -> false
    }

    private companion object {
        val STRING_RESOURCE = Regex("""<string name="([^"]+)">(.*?)</string>""")
        val STREAK_CONTEXT_KEYS = setOf(
            "streak_next_level",
            "streak_record",
            "streak_unlocked"
        )
        val AVATAR_CONTEXT_KEYS = setOf(
            "avatar_skin_tone",
            "avatar_expression",
            "avatar_style",
            "avatar_hair_color",
            "avatar_glasses",
            "avatar_facial_hair",
            "avatar_shirt_color",
            "avatar_number",
            "avatar_frame",
            "avatar_badge",
            "avatar_none"
        )
    }
}
