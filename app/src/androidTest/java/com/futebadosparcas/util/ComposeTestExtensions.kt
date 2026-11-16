package com.futebadosparcas.util

import androidx.annotation.StringRes
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.platform.app.InstrumentationRegistry

/**
 * Compose Test Extensions
 *
 * Provides convenient test helpers for Jetpack Compose UI testing.
 *
 * Usage:
 * ```kotlin
 * @Test
 * fun testLoginScreen() {
 *     composeTestRule.setContent {
 *         LoginScreen()
 *     }
 *
 *     composeTestRule.typeText("email_field", "test@example.com")
 *     composeTestRule.clickButton("Login")
 *     composeTestRule.assertDisplayed("Welcome")
 * }
 * ```
 */

// ============================================
// Find Nodes
// ============================================

fun ComposeTestRule.findByText(text: String): SemanticsNodeInteraction {
    return onNodeWithText(text, substring = true, ignoreCase = true)
}

fun ComposeTestRule.findByTag(tag: String): SemanticsNodeInteraction {
    return onNodeWithTag(tag)
}

fun ComposeTestRule.findByContentDescription(description: String): SemanticsNodeInteraction {
    return onNodeWithContentDescription(description, substring = true, ignoreCase = true)
}

// ============================================
// Assertions
// ============================================

fun ComposeTestRule.assertDisplayed(text: String) {
    findByText(text).assertIsDisplayed()
}

fun ComposeTestRule.assertNotDisplayed(text: String) {
    findByText(text).assertIsNotDisplayed()
}

fun ComposeTestRule.assertTextContains(tag: String, text: String) {
    findByTag(tag).assertTextContains(text, substring = true, ignoreCase = true)
}

// ============================================
// Actions
// ============================================

fun ComposeTestRule.clickText(text: String) {
    findByText(text).performClick()
}

fun ComposeTestRule.clickTag(tag: String) {
    findByTag(tag).performClick()
}

fun ComposeTestRule.clickButton(text: String) {
    clickText(text)
}

fun ComposeTestRule.typeText(tag: String, text: String) {
    findByTag(tag).performTextInput(text)
}

// ============================================
// Wait Helpers
// ============================================

fun ComposeTestRule.waitUntilDisplayed(
    text: String,
    timeoutMillis: Long = 5000
) {
    waitUntil(timeoutMillis) {
        try {
            findByText(text).assertExists()
            true
        } catch (e: AssertionError) {
            false
        }
    }
}

/**
 * Texto do app pelo recurso. Os testes de tela comparam com o `strings.xml`, e não com o texto digitado no
 * teste, para não quebrarem quando só a redação muda.
 */
fun appString(@StringRes id: Int, vararg args: Any): String =
    InstrumentationRegistry.getInstrumentation().targetContext.getString(id, *args)

/** Há pelo menos um nó visível com o texto. Serve para telas que repetem o mesmo texto em dois lugares. */
fun ComposeTestRule.assertTextoVisivel(text: String, substring: Boolean = false) {
    onAllNodesWithText(text, substring = substring).onFirst().assertIsDisplayed()
}

/** Nenhum nó com o texto. */
fun ComposeTestRule.assertTextoAusente(text: String, substring: Boolean = false) {
    onAllNodesWithText(text, substring = substring).assertCountEquals(0)
}
