package com.futebadosparcas.util

import android.os.Bundle
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.ktx.analytics
import com.google.firebase.ktx.Firebase

/**
 * Analytics Helper
 *
 * Centralized analytics tracking with Firebase Analytics.
 * Provides type-safe event logging with standardized naming.
 *
 * Benefits:
 * - Type-safe event names (no typos)
 * - Consistent parameter naming
 * - Easy to test (can inject mock)
 * - Single source of truth for analytics
 *
 * Usage:
 * ```kotlin
 * lateinit var analytics: AnalyticsHelper
 *
 * analytics.logGameCreated(gameId, playerCount)
 * analytics.logScreenView("HomeScreen")
 * ```
 */
class AnalyticsHelper constructor() {

    private val analytics: FirebaseAnalytics = Firebase.analytics

    // ============================================
    // Screen Tracking
    // ============================================

    fun logScreenView(screenName: String, screenClass: String? = null) {
        analytics.logEvent(FirebaseAnalytics.Event.SCREEN_VIEW, Bundle().apply {
            putString(FirebaseAnalytics.Param.SCREEN_NAME, screenName)
            screenClass?.let { putString(FirebaseAnalytics.Param.SCREEN_CLASS, it) }
        })
    }

    // ============================================
    // Game Events
    // ============================================

    fun logGameCreated(gameId: String, playerCount: Int) {
        analytics.logEvent("game_created", Bundle().apply {
            putString("game_id", gameId)
            putInt("player_count", playerCount)
        })
    }

    fun logGameJoined(gameId: String) {
        analytics.logEvent("game_joined", Bundle().apply {
            putString("game_id", gameId)
        })
    }

    fun logGameFinished(gameId: String, duration: Long) {
        analytics.logEvent("game_finished", Bundle().apply {
            putString("game_id", gameId)
            putLong("duration_minutes", duration)
        })
    }

    // ============================================
    // User Events
    // ============================================

    fun logLogin(method: String) {
        analytics.logEvent(FirebaseAnalytics.Event.LOGIN, Bundle().apply {
            putString(FirebaseAnalytics.Param.METHOD, method)
        })
    }

    fun logSignUp(method: String) {
        analytics.logEvent(FirebaseAnalytics.Event.SIGN_UP, Bundle().apply {
            putString(FirebaseAnalytics.Param.METHOD, method)
        })
    }

    fun logProfileEdit() {
        analytics.logEvent("profile_edited", Bundle())
    }

    // ============================================
    // Social Events
    // ============================================

    fun logGroupCreated(groupId: String) {
        analytics.logEvent("group_created", Bundle().apply {
            putString("group_id", groupId)
        })
    }

    fun logGroupJoined(groupId: String) {
        analytics.logEvent("group_joined", Bundle().apply {
            putString("group_id", groupId)
        })
    }

    fun logInviteSent(groupId: String) {
        analytics.logEvent(FirebaseAnalytics.Event.SHARE, Bundle().apply {
            putString("content_type", "group_invite")
            putString("group_id", groupId)
        })
    }

    // ============================================
    // Gamification Events
    // ============================================

    fun logBadgeUnlocked(badgeId: String) {
        analytics.logEvent(FirebaseAnalytics.Event.UNLOCK_ACHIEVEMENT, Bundle().apply {
            putString(FirebaseAnalytics.Param.ACHIEVEMENT_ID, badgeId)
        })
    }

    fun logLevelUp(newLevel: Int, xp: Int) {
        analytics.logEvent(FirebaseAnalytics.Event.LEVEL_UP, Bundle().apply {
            putInt(FirebaseAnalytics.Param.LEVEL, newLevel)
            putInt("xp", xp)
        })
    }

    fun logLeaguePromotion(oldDivision: String, newDivision: String) {
        analytics.logEvent("league_promotion", Bundle().apply {
            putString("old_division", oldDivision)
            putString("new_division", newDivision)
        })
    }

    // ============================================
    // Error Tracking
    // ============================================

    fun logError(errorType: String, errorMessage: String, isFatal: Boolean = false) {
        analytics.logEvent("app_error", Bundle().apply {
            putString("error_type", errorType)
            putString("error_message", errorMessage)
            putBoolean("is_fatal", isFatal)
        })
    }

    // ============================================
    // User Properties
    // ============================================

    fun setUserProperty(name: String, value: String) {
        analytics.setUserProperty(name, value)
    }

    fun setUserId(userId: String) {
        analytics.setUserId(userId)
    }
}
