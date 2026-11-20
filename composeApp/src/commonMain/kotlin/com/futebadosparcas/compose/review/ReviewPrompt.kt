package com.futebadosparcas.compose.review

import com.futebadosparcas.domain.review.PreferencesReviewStateStore
import com.futebadosparcas.domain.review.ReviewPromptCoordinator
import com.futebadosparcas.platform.review.NativeReviewLauncher
import com.futebadosparcas.platform.storage.PreferencesService

/** Lançador nativo da plataforma (iOS: SKStoreReviewController; harness Android: inerte). */
internal expect fun createNativeReviewLauncher(): NativeReviewLauncher

internal fun createReviewPromptCoordinator(preferences: PreferencesService): ReviewPromptCoordinator {
    val launcher = createNativeReviewLauncher()
    return ReviewPromptCoordinator(PreferencesReviewStateStore(preferences), launcher::launch)
}
