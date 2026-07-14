package com.futebadosparcas.ui.components.lists

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.futebadosparcas.R
import com.futebadosparcas.ui.theme.FutebaTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RankingListLocalizationTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun rankingVazioUsaRecursoLocalizadoCompartilhado() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext

        composeTestRule.setContent {
            FutebaTheme {
                RankingList(
                    entries = emptyMap(),
                    onPlayerClick = {}
                )
            }
        }

        composeTestRule.onNodeWithText(context.getString(R.string.ranking_list_empty))
            .assertIsDisplayed()
    }
}
