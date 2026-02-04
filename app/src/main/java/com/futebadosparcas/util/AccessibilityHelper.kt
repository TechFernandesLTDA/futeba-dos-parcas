package com.futebadosparcas.util

import android.content.Context
import android.view.View
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Accessibility Helper
 *
 * Provides utilities for improving app accessibility for users with disabilities.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var accessibilityHelper: AccessibilityHelper
 *
 * // Check if TalkBack/screen reader is enabled
 * if (accessibilityHelper.isScreenReaderEnabled()) {
 *     // Provide alternative UI or additional announcements
 * }
 *
 * // Announce message to screen reader
 * accessibilityHelper.announce(view, "Jogo criado com sucesso")
 * ```
 */
@Singleton
class AccessibilityHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private val accessibilityManager: AccessibilityManager =
        context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager

    /**
     * Check if any accessibility service is enabled
     */
    fun isAccessibilityEnabled(): Boolean {
        return accessibilityManager.isEnabled
    }

    /**
     * Check if screen reader (TalkBack) is enabled
     */
    fun isScreenReaderEnabled(): Boolean {
        return accessibilityManager.isEnabled &&
                accessibilityManager.isTouchExplorationEnabled
    }

    /**
     * Announce message to screen reader
     */
    fun announce(view: View, message: String) {
        view.announceForAccessibility(message)
    }

    /**
     * Announce message using event
     */
    fun announceWithEvent(message: String) {
        if (!isScreenReaderEnabled()) return

        val event = AccessibilityEvent.obtain(AccessibilityEvent.TYPE_ANNOUNCEMENT).apply {
            text.add(message)
            className = this@AccessibilityHelper.javaClass.name
            packageName = context.packageName
        }

        accessibilityManager.sendAccessibilityEvent(event)
    }

    /**
     * Get recommended minimum touch target size (48dp)
     */
    fun getMinimumTouchTargetSizePx(): Int {
        val density = context.resources.displayMetrics.density
        return (MIN_TOUCH_TARGET_DP * density).toInt()
    }

    /**
     * Get recommended minimum touch target size in DP
     */
    fun getMinimumTouchTargetSizeDp(): Int = MIN_TOUCH_TARGET_DP

    /**
     * Build content description for game score
     */
    fun buildGameScoreDescription(teamA: String, scoreA: Int, teamB: String, scoreB: Int): String {
        return "$teamA $scoreA x $scoreB $teamB"
    }

    /**
     * Build content description for XP gain
     */
    fun buildXpGainDescription(xp: Int): String {
        return "Você ganhou $xp pontos de experiência"
    }

    /**
     * Build content description for badge
     */
    fun buildBadgeDescription(badgeName: String, badgeDescription: String): String {
        return "Badge $badgeName desbloqueado. $badgeDescription"
    }

    /**
     * Build content description for position in ranking
     */
    fun buildRankingPositionDescription(position: Int, total: Int): String {
        val suffix = when (position) {
            1 -> "primeiro"
            2 -> "segundo"
            3 -> "terceiro"
            else -> "${position}º"
        }
        return "Sua posição no ranking: $suffix de $total jogadores"
    }

    /**
     * Build content description for player rating
     */
    fun buildPlayerRatingDescription(rating: Double): String {
        val ratingText = String.format(Locale.getDefault(), "%.1f", rating)
        return "Avaliação do jogador: $ratingText estrelas de 5"
    }

    companion object {
        private const val MIN_TOUCH_TARGET_DP = 48
    }
}

/**
 * Compose extension for accessibility
 */
@Composable
fun rememberAccessibilityHelper(): AccessibilityHelper {
    val context = LocalContext.current
    return remember {
        AccessibilityHelper(context.applicationContext)
    }
}

/**
 * Check if screen reader is enabled (Compose)
 */
@Composable
fun isScreenReaderEnabled(): Boolean {
    val accessibilityHelper = rememberAccessibilityHelper()
    return remember { accessibilityHelper.isScreenReaderEnabled() }
}
