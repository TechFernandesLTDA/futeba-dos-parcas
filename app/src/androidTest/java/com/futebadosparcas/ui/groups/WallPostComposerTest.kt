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
import com.futebadosparcas.R
import com.futebadosparcas.util.appString
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

        // Textos pelo recurso: o app tem tradução (values-en, values-es) e o aparelho de teste pode
        // não estar em português.
        val dica = appString(R.string.group_wall_input_hint)
        composeTestRule.onNodeWithText(dica).performTextInput("Rascunho importante")
        composeTestRule.onNodeWithContentDescription(appString(R.string.group_wall_send)).performClick()
        composeTestRule.onNodeWithText("Rascunho importante").assertIsDisplayed()

        composeTestRule.runOnIdle { clearDraftSignal.intValue++ }
        composeTestRule.onNodeWithText(dica).assertIsDisplayed()
    }

    @Test
    fun compositorOfereceSeletorUnicoDeFotoOuVideo() {
        composeTestRule.setContent {
            FutebaTheme {
                WallPostComposer(sending = false, onSubmit = { _, _ -> })
            }
        }

        composeTestRule.onNodeWithContentDescription(
            appString(R.string.group_wall_add_media)
        ).assertIsDisplayed()
    }
}
