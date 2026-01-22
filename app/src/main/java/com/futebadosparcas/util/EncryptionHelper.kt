package com.futebadosparcas.util

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Encryption Helper
 *
 * Provides secure encryption/decryption using Android Keystore.
 * Uses AES-256 with GCM mode for authenticated encryption.
 *
 * Benefits:
 * - Keys stored in hardware-backed Keystore (tamper-resistant)
 * - Authenticated encryption (detects tampering)
 * - No keys in app memory
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var encryptionHelper: EncryptionHelper
 *
 * // Encrypt sensitive data
 * val encrypted = encryptionHelper.encrypt("my_secret_data")
 *
 * // Decrypt
 * val decrypted = encryptionHelper.decrypt(encrypted)
 * ```
 */
@Singleton
class EncryptionHelper @Inject constructor() {

    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply {
        load(null)
    }

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "FutebaDosParças_EncryptionKey"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_TAG_LENGTH = 128
    }

    init {
        // Create key if it doesn't exist
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            createKey()
        }
    }

    /**
     * Create encryption key in Android Keystore
     */
    private fun createKey() {
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        )

        val keyGenParameterSpec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()

        keyGenerator.init(keyGenParameterSpec)
        keyGenerator.generateKey()
    }

    /**
     * Get encryption key from Keystore
     */
    private fun getKey(): SecretKey {
        return keyStore.getKey(KEY_ALIAS, null) as SecretKey
    }

    /**
     * Encrypt plaintext
     *
     * @param plaintext String to encrypt
     * @return Base64-encoded encrypted data (includes IV)
     */
    fun encrypt(plaintext: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getKey())

        val iv = cipher.iv
        val encryptedBytes = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

        // Combine IV + encrypted data
        val combined = iv + encryptedBytes

        return Base64.encodeToString(combined, Base64.DEFAULT)
    }

    /**
     * Decrypt ciphertext
     *
     * @param ciphertext Base64-encoded encrypted data (includes IV)
     * @return Decrypted plaintext
     */
    fun decrypt(ciphertext: String): String {
        val combined = Base64.decode(ciphertext, Base64.DEFAULT)

        // Extract IV (first 12 bytes for GCM)
        val iv = combined.sliceArray(0 until 12)
        val encryptedBytes = combined.sliceArray(12 until combined.size)

        val cipher = Cipher.getInstance(TRANSFORMATION)
        val gcmParameterSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.DECRYPT_MODE, getKey(), gcmParameterSpec)

        val decryptedBytes = cipher.doFinal(encryptedBytes)
        return String(decryptedBytes, Charsets.UTF_8)
    }

    /**
     * Encrypt byte array
     */
    fun encryptBytes(data: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getKey())

        val iv = cipher.iv
        val encryptedBytes = cipher.doFinal(data)

        // Combine IV + encrypted data
        return iv + encryptedBytes
    }

    /**
     * Decrypt byte array
     */
    fun decryptBytes(encryptedData: ByteArray): ByteArray {
        // Extract IV
        val iv = encryptedData.sliceArray(0 until 12)
        val encryptedBytes = encryptedData.sliceArray(12 until encryptedData.size)

        val cipher = Cipher.getInstance(TRANSFORMATION)
        val gcmParameterSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.DECRYPT_MODE, getKey(), gcmParameterSpec)

        return cipher.doFinal(encryptedBytes)
    }

    /**
     * Check if encryption is available
     */
    fun isEncryptionAvailable(): Boolean {
        return try {
            keyStore.containsAlias(KEY_ALIAS) || run {
                createKey()
                true
            }
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Delete encryption key (use with caution!)
     */
    fun deleteKey() {
        if (keyStore.containsAlias(KEY_ALIAS)) {
            keyStore.deleteEntry(KEY_ALIAS)
        }
    }
}
