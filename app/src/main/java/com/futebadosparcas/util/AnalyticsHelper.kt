package com.futebadosparcas.util

import android.os.Bundle
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.analytics
import com.google.firebase.Firebase

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

    // ============================================
    // Onboarding Tour Events (Fase 1)
    // ============================================

    fun logOnboardingStarted() {
        analytics.logEvent("onboarding_started", Bundle())
    }

    fun logOnboardingSlideViewed(slideIndex: Int, slideId: String) {
        analytics.logEvent("onboarding_slide_viewed", Bundle().apply {
            putInt("slide_index", slideIndex)
            putString("slide_id", slideId)
        })
    }

    fun logOnboardingSkipped(atSlideIndex: Int) {
        analytics.logEvent("onboarding_skipped", Bundle().apply {
            putInt("at_slide_index", atSlideIndex)
        })
    }

    fun logOnboardingCarouselCompleted(durationMs: Long) {
        analytics.logEvent("onboarding_carousel_completed", Bundle().apply {
            putLong("duration_ms", durationMs)
        })
    }

    fun logChecklistStepCompleted(stepId: String, timeSinceStartMs: Long) {
        analytics.logEvent("checklist_step_completed", Bundle().apply {
            putString("step_id", stepId)
            putLong("time_since_start_ms", timeSinceStartMs)
        })
    }

    fun logChecklistCompleted(totalDurationMs: Long) {
        analytics.logEvent("checklist_completed", Bundle().apply {
            putLong("total_duration_ms", totalDurationMs)
        })
    }

    fun logChecklistDismissed(stepsDone: Int, stepsTotal: Int) {
        analytics.logEvent("checklist_dismissed", Bundle().apply {
            putInt("steps_done", stepsDone)
            putInt("steps_total", stepsTotal)
        })
    }

    fun logOnboardingRewardGranted(rewardType: String) {
        analytics.logEvent("onboarding_reward_granted", Bundle().apply {
            putString("reward_type", rewardType)
        })
    }

    // ============================================
    // Novidades / What's New (spec feat-2026-05-22)
    // ============================================

    /** Pop-up "Novidades" exibido automaticamente no boot pós-atualização. */
    fun logWhatsNewPopupShown(version: String, platform: String) {
        analytics.logEvent("whats_new_popup_shown", Bundle().apply {
            putString("version", version)
            putString("platform", platform)
        })
    }

    /** Tela "Novidades" aberta manualmente (ex.: via Ajustes/Sobre). */
    fun logWhatsNewOpened(source: String) {
        analytics.logEvent("whats_new_opened", Bundle().apply {
            putString("source", source)
        })
    }

    /** Pop-up "Novidades" fechado pelo usuário. */
    fun logWhatsNewDismissed(version: String) {
        analytics.logEvent("whats_new_dismissed", Bundle().apply {
            putString("version", version)
        })
    }
}
