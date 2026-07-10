package com.futebadosparcas.util

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.suspendCancellableCoroutine
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
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
                    if (result.cryptoObject?.cipher != null) onSuccess()
                    else onError("Autenticação biométrica sem vínculo criptográfico")
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
            .setConfirmationRequired(true)
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
            )
            .build()

        val cryptoObject = runCatching {
            BiometricPrompt.CryptoObject(createAuthenticationCipher())
        }.getOrElse { error ->
            onError(error.message ?: "Não foi possível proteger a autenticação biométrica")
            return
        }
        biometricPrompt.authenticate(promptInfo, cryptoObject)
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
                        if (result.cryptoObject?.cipher != null) {
                            continuation.resume(BiometricResult.Success)
                        } else {
                            continuation.resume(BiometricResult.Error(
                                "Autenticação biométrica sem vínculo criptográfico",
                                CRYPTO_AUTH_ERROR
                            ))
                        }
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
            .setConfirmationRequired(true)
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
            )
            .build()

        val cryptoObject = runCatching {
            BiometricPrompt.CryptoObject(createAuthenticationCipher())
        }.getOrElse { error ->
            continuation.resume(BiometricResult.Error(
                error.message ?: "Não foi possível proteger a autenticação biométrica",
                CRYPTO_AUTH_ERROR
            ))
            return@suspendCancellableCoroutine
        }
        biometricPrompt.authenticate(promptInfo, cryptoObject)

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

    private fun createAuthenticationCipher(): Cipher {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        var key = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
        if (key == null) key = generateAuthenticationKey()
        return try {
            newCipher().apply { init(Cipher.ENCRYPT_MODE, key) }
        } catch (_: KeyPermanentlyInvalidatedException) {
            keyStore.deleteEntry(KEY_ALIAS)
            newCipher().apply { init(Cipher.ENCRYPT_MODE, generateAuthenticationKey()) }
        }
    }

    private fun generateAuthenticationKey(): SecretKey {
        val builder = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
        } else {
            @Suppress("DEPRECATION")
            builder.setUserAuthenticationValidityDurationSeconds(-1)
        }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE).run {
            init(builder.build())
            generateKey()
        }
    }

    private fun newCipher(): Cipher = Cipher.getInstance(
        "${KeyProperties.KEY_ALGORITHM_AES}/${KeyProperties.BLOCK_MODE_GCM}/${KeyProperties.ENCRYPTION_PADDING_NONE}"
    )

    companion object {
        private const val FOUR_HOURS_MS = 4 * 60 * 60 * 1000L
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "futeba_local_auth_key"
        private const val CRYPTO_AUTH_ERROR = -1000
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
