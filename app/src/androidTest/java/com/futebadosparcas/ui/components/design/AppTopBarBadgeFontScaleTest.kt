package com.futebadosparcas.ui.components.design

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpRect
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.ui.theme.FutebaTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.math.abs

/**
 * Gate de regressao do #4108: o badge de notificacoes da [AppTopBar.Root] era um
 * circulo fixo de 16dp com texto em sp e recortava "9+" a partir de fontScale 1,287.
 *
 * Renderiza a TopBar real com `unreadCount = 15` sob fontScale 1,3 (topo do slider
 * padrao do Android) e 2,0 (maximo do Android 14) e verifica que:
 * - o badge tem pelo menos a largura intrinseca do rotulo + padding do M3;
 * - NENHUM ancestral o recorta (bounds recortados == bounds nao recortados) —
 *   pega tanto o circulo fixo antigo quanto um `IconButton { BadgedBox }`, cujo
 *   container de 40dp e clipado;
 * - ele cresce para dentro do slot de 48dp (nao invade a acao vizinha).
 */
@RunWith(AndroidJUnit4::class)
class AppTopBarBadgeFontScaleTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun badgeExibe15InteiroComFontScale1_3() {
        assertBadgeNaoRecorta(unreadCount = 15, expectedLabel = "15", fontScale = 1.3f)
    }

    @Test
    fun badgeExibe15InteiroComFontScale2_0() {
        assertBadgeNaoRecorta(unreadCount = 15, expectedLabel = "15", fontScale = 2.0f)
    }

    @Test
    fun badgeLimitadoEm99NaoRecortaComFontScale2_0() {
        assertBadgeNaoRecorta(unreadCount = 150, expectedLabel = "99+", fontScale = 2.0f)
    }

    @Test
    fun contagemEAnunciadaNoProprioBotaoDeNotificacoes() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext

        composeTestRule.setContent {
            FutebaTheme(themeConfig = AppThemeConfig()) {
                AppTopBar.Root(
                    unreadCount = 15,
                    onNavigateNotifications = {},
                    onNavigateGroups = {},
                    onNavigateMap = {}
                )
            }
        }

        // Arvore fundida: o botao anuncia "Notificacoes" + estado "15" num unico no.
        composeTestRule
            .onNodeWithContentDescription(context.getString(R.string.cd_notifications))
            .assertIsDisplayed()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "15"))
    }

    @Test
    fun semNotificacoesNaoHaBadgeNemEstado() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext

        composeTestRule.setContent {
            FutebaTheme(themeConfig = AppThemeConfig()) {
                AppTopBar.Root(
                    unreadCount = 0,
                    onNavigateNotifications = {},
                    onNavigateGroups = {},
                    onNavigateMap = {}
                )
            }
        }

        composeTestRule.onNodeWithTag(NOTIFICATION_BADGE_TEST_TAG, useUnmergedTree = true).assertDoesNotExist()
        composeTestRule
            .onNodeWithContentDescription(context.getString(R.string.cd_notifications))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.StateDescription))
    }

    private fun assertBadgeNaoRecorta(unreadCount: Int, expectedLabel: String, fontScale: Float) {
        var minBadgeWidth: Dp = 0.dp
        var minBadgeHeight: Dp = 0.dp

        composeTestRule.setContent {
            val baseDensity = LocalDensity.current
            CompositionLocalProvider(
                LocalDensity provides Density(density = baseDensity.density, fontScale = fontScale)
            ) {
                FutebaTheme(themeConfig = AppThemeConfig()) {
                    // Tamanho intrinseco do rotulo com o mesmo estilo que o Badge do M3 aplica (labelSmall).
                    val measured = rememberTextMeasurer().measure(
                        AnnotatedString(expectedLabel),
                        style = MaterialTheme.typography.labelSmall,
                        softWrap = false,
                        maxLines = 1
                    ).size
                    with(LocalDensity.current) {
                        minBadgeWidth = measured.width.toDp() + BADGE_HORIZONTAL_PADDING * 2
                        minBadgeHeight = measured.height.toDp()
                    }

                    AppTopBar.Root(
                        unreadCount = unreadCount,
                        onNavigateNotifications = {},
                        onNavigateGroups = {},
                        onNavigateMap = {}
                    )
                }
            }
        }
        composeTestRule.waitForIdle()
        check(minBadgeWidth > BADGE_HORIZONTAL_PADDING * 2) { "Falha ao medir o rotulo \"$expectedLabel\"" }

        val badge = composeTestRule.onNodeWithTag(NOTIFICATION_BADGE_TEST_TAG, useUnmergedTree = true)
        badge
            .assertIsDisplayed()
            .assertWidthIsAtLeast(minBadgeWidth)
            .assertHeightIsAtLeast(minBadgeHeight)

        val clipped = badge.getBoundsInRoot()
        val unclipped = badge.getUnclippedBoundsInRoot()
        assertTrue(
            "fontScale=$fontScale: badge recortado por um ancestral (visivel=$clipped, real=$unclipped)",
            clipped.approximatelyEquals(unclipped)
        )

        val slot = composeTestRule
            .onNodeWithTag(NOTIFICATION_SLOT_TEST_TAG, useUnmergedTree = true)
            .getUnclippedBoundsInRoot()
        assertTrue(
            "fontScale=$fontScale: badge ($unclipped) deve crescer para dentro do slot de 48dp ($slot)",
            slot.contains(unclipped)
        )
    }

    private fun DpRect.approximatelyEquals(other: DpRect): Boolean =
        abs((left - other.left).value) <= TOLERANCE_DP &&
            abs((top - other.top).value) <= TOLERANCE_DP &&
            abs((right - other.right).value) <= TOLERANCE_DP &&
            abs((bottom - other.bottom).value) <= TOLERANCE_DP

    private fun DpRect.contains(other: DpRect): Boolean =
        other.left.value >= left.value - TOLERANCE_DP &&
            other.top.value >= top.value - TOLERANCE_DP &&
            other.right.value <= right.value + TOLERANCE_DP &&
            other.bottom.value <= bottom.value + TOLERANCE_DP

    private companion object {
        /** Padding horizontal interno do Badge com conteudo (M3 BadgeWithContentHorizontalPadding). */
        val BADGE_HORIZONTAL_PADDING = 4.dp

        /** Tolerancia de arredondamento px -> dp. */
        const val TOLERANCE_DP = 0.5f
    }
}
