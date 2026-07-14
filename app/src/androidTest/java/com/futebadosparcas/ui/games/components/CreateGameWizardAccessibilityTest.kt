package com.futebadosparcas.ui.games.components

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.futebadosparcas.R
import com.futebadosparcas.ui.games.CreateGameStep
import com.futebadosparcas.ui.theme.FutebaTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CreateGameWizardAccessibilityTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun passoConcluidoTemAlvoSemanticaEAcao() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        var clickedStep: CreateGameStep? = null

        composeTestRule.setContent {
            FutebaTheme {
                WizardStepIndicator(
                    currentStep = CreateGameStep.DETAILS,
                    steps = CreateGameStep.entries,
                    onStepClick = { clickedStep = it }
                )
            }
        }

        val description = context.getString(
            R.string.create_game_step_description,
            1,
            context.getString(R.string.create_game_step_location)
        )
        val completed = context.getString(R.string.create_game_step_status_completed)

        composeTestRule.onNodeWithContentDescription(description)
            .assertIsDisplayed()
            .assertHasClickAction()
            .assertWidthIsAtLeast(48.dp)
            .assert(
                SemanticsMatcher.expectValue(
                    SemanticsProperties.StateDescription,
                    completed
                )
            )
            .performClick()

        composeTestRule.runOnIdle {
            assertEquals(CreateGameStep.LOCATION, clickedStep)
        }
    }
}
