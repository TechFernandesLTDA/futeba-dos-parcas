package com.futebadosparcas.ui.groups

import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.ui.theme.FutebaTheme
import androidx.test.platform.app.InstrumentationRegistry
import com.futebadosparcas.R
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class WallPostComposerTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun draftPermaneceAteConfirmacaoDeSucesso() {
        val clearDraftSignal = mutableIntStateOf(0)

        composeTestRule.setContent {
            FutebaTheme {
                WallPostComposer(
                    sending = false,
                    clearDraftSignal = clearDraftSignal.intValue,
                    onSubmit = { _, _ -> }
                )
            }
        }

        composeTestRule.onNodeWithText("Escreva algo para o grupo…")
            .performTextInput("Rascunho importante")
        composeTestRule.onNodeWithContentDescription("Publicar").performClick()
        composeTestRule.onNodeWithText("Rascunho importante").assertIsDisplayed()

        composeTestRule.runOnIdle { clearDraftSignal.intValue++ }
        composeTestRule.onNodeWithText("Escreva algo para o grupo…").assertIsDisplayed()
    }

    @Test
    fun compositorOfereceSeletorUnicoDeFotoOuVideo() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        composeTestRule.setContent {
            FutebaTheme {
                WallPostComposer(sending = false, onSubmit = { _, _ -> })
            }
        }

        composeTestRule.onNodeWithContentDescription(
            context.getString(R.string.group_wall_add_media)
        ).assertIsDisplayed()
    }
}
