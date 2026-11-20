package com.futebadosparcas.platform.review

import android.app.Activity
import com.google.android.play.core.review.ReviewInfo
import com.google.android.play.core.review.ReviewManagerFactory
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/** Play In-App Review. [activityProvider] devolve a Activity em primeiro plano (ou nulo). */
actual class NativeReviewLauncher(private val activityProvider: () -> Activity?) {

    actual suspend fun launch(): Boolean {
        val activity = activityProvider() ?: return false
        return try {
            val manager = ReviewManagerFactory.create(activity)
            val info = suspendCancellableCoroutine<ReviewInfo?> { cont ->
                manager.requestReviewFlow().addOnCompleteListener { task ->
                    cont.resume(if (task.isSuccessful) task.result else null)
                }
            } ?: return false
            if (activity.isFinishing || activity.isDestroyed) return false
            suspendCancellableCoroutine<Unit> { cont ->
                manager.launchReviewFlow(activity, info).addOnCompleteListener { cont.resume(Unit) }
            }
            true
        } catch (_: Exception) {
            false
        }
    }
}
