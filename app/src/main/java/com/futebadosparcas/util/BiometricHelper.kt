package com.futebadosparcas.util

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

class BiometricHelper constructor(
    private val context: Context
) {

    // Constructor for non-DI usage (legacy)
    constructor(activity: FragmentActivity) : this(activity as Context)

    fun isBiometricAvailable(): Boolean {
        val biometricManager = BiometricManager.from(context)
        return biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
                BiometricManager.BIOMETRIC_SUCCESS
    }

    fun getBiometricAvailability(): BiometricAvailability {
        val biometricManager = BiometricManager.from(context)

        return when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS ->
                BiometricAvailability.Available

            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE ->
                BiometricAvailability.NoHardware

            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE ->
                BiometricAvailability.HardwareUnavailable

            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ->
                BiometricAvailability.NoneEnrolled

            else ->
                BiometricAvailability.Unknown
        }
    }

    // Legacy callback-based API
    fun showBiometricPrompt(
        activity: FragmentActivity,
        title: String,
        subtitle: String = "",
        negativeButtonText: String = "Cancelar",
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
        onFailed: () -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(context)

        val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    onSuccess()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    onError(errString.toString())
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    onFailed()
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText(negativeButtonText)
            .build()

        biometricPrompt.authenticate(promptInfo)
    }

    // New suspend API
    suspend fun authenticate(
        activity: FragmentActivity,
        title: String,
        subtitle: String = "",
        negativeButtonText: String = "Cancelar"
    ): BiometricResult = suspendCancellableCoroutine { continuation ->

        val executor = ContextCompat.getMainExecutor(context)

        val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    if (continuation.isActive) {
                        continuation.resume(BiometricResult.Success)
                    }
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    if (continuation.isActive) {
                        if (errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                            errorCode == BiometricPrompt.ERROR_USER_CANCELED) {
                            continuation.resume(BiometricResult.Cancelled)
                        } else {
                            continuation.resume(BiometricResult.Error(errString.toString(), errorCode))
                        }
                    }
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText(negativeButtonText)
            .build()

        biometricPrompt.authenticate(promptInfo)

        continuation.invokeOnCancellation {
            biometricPrompt.cancelAuthentication()
        }
    }

    fun shouldRequireBiometric(lastAuthTime: Long, sessionTimeoutMillis: Long = FOUR_HOURS_MS): Boolean {
        if (lastAuthTime == 0L) return true

        val currentTime = System.currentTimeMillis()
        val timeSinceAuth = currentTime - lastAuthTime

        return timeSinceAuth > sessionTimeoutMillis
    }

    companion object {
        private const val FOUR_HOURS_MS = 4 * 60 * 60 * 1000L
    }
}

sealed class BiometricAvailability {
    object Available : BiometricAvailability()
    object NoHardware : BiometricAvailability()
    object HardwareUnavailable : BiometricAvailability()
    object NoneEnrolled : BiometricAvailability()
    object Unknown : BiometricAvailability()

    val isAvailable: Boolean
        get() = this is Available
}

sealed class BiometricResult {
    object Success : BiometricResult()
    object Cancelled : BiometricResult()
    data class Error(val message: String, val errorCode: Int) : BiometricResult()

    val isSuccess: Boolean
        get() = this is Success
}
