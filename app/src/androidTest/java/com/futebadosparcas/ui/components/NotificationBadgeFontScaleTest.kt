package com.futebadosparcas.ui.components

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import com.futebadosparcas.ui.components.design.AppTopBar
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.domain.model.AppThemeConfig
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class NotificationBadgeFontScaleTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun notificationBadgeFitsAtFontScale130() = assertBadgeFits(1.3f)

    @Test
    fun notificationBadgeFitsAtFontScale200() = assertBadgeFits(2.0f)

    private fun assertBadgeFits(fontScale: Float) {
        composeRule.setContent {
            CompositionLocalProvider(
                LocalDensity provides Density(LocalDensity.current.density, fontScale)
            ) {
                FutebaTheme(themeConfig = AppThemeConfig()) {
                    AppTopBar.Root(
                        unreadCount = 15,
                        onNavigateNotifications = {},
                        onNavigateGroups = {},
                        onNavigateMap = {}
                    )
                }
            }
        }
        val layouts = mutableListOf<TextLayoutResult>()
        composeRule.onNodeWithText("9+", useUnmergedTree = true)
            .assertIsDisplayed()
            .performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
        assertTrue("The badge must expose its rendered text layout", layouts.isNotEmpty())
        assertFalse("9+ must not overflow at fontScale=$fontScale", layouts.single().hasVisualOverflow)
    }
}
