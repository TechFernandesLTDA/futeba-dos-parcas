package com.futebadosparcas.platform.review

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import platform.StoreKit.SKStoreReviewController
import platform.UIKit.UIApplication
import platform.UIKit.UISceneActivationStateForegroundActive
import platform.UIKit.UIWindowScene

/** `SKStoreReviewController.requestReviewInScene` na cena ativa. */
actual class NativeReviewLauncher {

    actual suspend fun launch(): Boolean = withContext(Dispatchers.Main) {
        try {
            val scene = UIApplication.sharedApplication.connectedScenes
                .filterIsInstance<UIWindowScene>()
                .firstOrNull { it.activationState == UISceneActivationStateForegroundActive }
                ?: return@withContext false
            SKStoreReviewController.requestReviewInScene(scene)
            true
        } catch (_: Exception) {
            false
        }
    }
}
