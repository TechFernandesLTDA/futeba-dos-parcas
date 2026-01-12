package com.futebadosparcas.data.datasource

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import com.futebadosparcas.util.AppLogger
import com.google.firebase.storage.FirebaseStorage
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject
import javax.inject.Singleton

/**
 * DataSource para gerenciar upload e processamento de fotos de perfil.
 *
 * CMD-06: Padroniza o pipeline de foto de perfil:
 * - Permissões
 * - Seleção
 * - Compressão
 * - Upload (Storage)
 * - URL no perfil
 * - Placeholders e estados de erro
 *
 * Compatibilidade KMP: isolado em expect/actual para Android.
 */
@Singleton
class ProfilePhotoDataSource @Inject constructor(
    private val storage: FirebaseStorage,
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "ProfilePhotoDataSource"
        private const val MAX_FILE_SIZE_MB = 10
        private const val MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
        private const val COMPRESS_QUALITY = 85
        private const val MAX_DIMENSION = 1024
        private const val PROFILE_IMAGES_PATH = "profile_images"
    }

    /**
     * Resultado do upload de foto de perfil.
     */
    sealed class UploadResult {
        data class Success(val url: String) : UploadResult()
        data class Error(val message: String, val isRecoverable: Boolean = true) : UploadResult()
        data object FileTooLarge : UploadResult()
        data object InvalidImage : UploadResult()
    }

    /**
     * Processa e faz upload de uma foto de perfil.
     *
     * Fluxo:
     * 1. Valida o tamanho do arquivo
     * 2. Decodifica a imagem
     * 3. Redimensiona se necessário
     * 4. Comprime
     * 5. Faz upload para Firebase Storage
     * 6. Retorna a URL pública
     *
     * @param userId ID do usuário
     * @param imageUri URI da imagem selecionada
     * @return UploadResult com URL ou erro
     */
    suspend fun uploadProfilePhoto(userId: String, imageUri: Uri): UploadResult {
        return withContext(Dispatchers.IO) {
            try {
                Log.d(TAG, "Starting profile photo upload for user: $userId")

                // 1. Validar tamanho do arquivo
                val fileSize = getFileSize(imageUri)
                if (fileSize > MAX_FILE_SIZE_BYTES) {
                    Log.w(TAG, "File too large: ${fileSize / 1024 / 1024}MB (max: $MAX_FILE_SIZE_MB MB)")
                    return@withContext UploadResult.FileTooLarge
                }

                // 2. Decodificar a imagem
                val inputStream = context.contentResolver.openInputStream(imageUri)
                val originalBitmap = BitmapFactory.decodeStream(inputStream)
                    ?: return@withContext UploadResult.InvalidImage

                inputStream?.close()

                Log.d(TAG, "Original bitmap: ${originalBitmap.width}x${originalBitmap.height}")

                // 3. Redimensionar se necessário
                val processedBitmap = resizeIfNeeded(originalBitmap)

                // 4. Comprimir
                val compressedBytes = compressImage(processedBitmap)
                Log.d(TAG, "Compressed size: ${compressedBytes.size / 1024}KB")

                // 5. Fazer upload para Firebase Storage
                val storageRef = storage.reference
                    .child("$PROFILE_IMAGES_PATH/$userId")

                Log.d(TAG, "Uploading to: $PROFILE_IMAGES_PATH/$userId")

                val uploadTask = storageRef.putBytes(compressedBytes).await()
                val downloadUrl = uploadTask.storage.downloadUrl.await().toString()

                Log.d(TAG, "Upload successful: $downloadUrl")

                UploadResult.Success(downloadUrl)

            } catch (e: Exception) {
                Log.e(TAG, "Error uploading profile photo", e)
                val isRecoverable = when {
                    e.message?.contains("network", ignoreCase = true) == true -> true
                    e.message?.contains("timeout", ignoreCase = true) == true -> true
                    e.message?.contains("storage", ignoreCase = true) == true -> false
                    else -> true
                }
                UploadResult.Error(
                    message = e.message ?: "Erro ao fazer upload da foto",
                    isRecoverable = isRecoverable
                )
            }
        }
    }

    /**
     * Obtém o tamanho do arquivo em bytes.
     */
    private fun getFileSize(uri: Uri): Long {
        return try {
            context.contentResolver.openFileDescriptor(uri, "r")?.use { pfd ->
                pfd.statSize
            } ?: 0
        } catch (e: Exception) {
            Log.w(TAG, "Error getting file size", e)
            0
        }
    }

    /**
     * Redimensiona a imagem se ela for maior que MAX_DIMENSION.
     * Mantém a proporção (aspect ratio).
     */
    private fun resizeIfNeeded(bitmap: Bitmap): Bitmap {
        if (bitmap.width <= MAX_DIMENSION && bitmap.height <= MAX_DIMENSION) {
            return bitmap
        }

        val ratio = bitmap.width.toFloat() / bitmap.height.toFloat()
        val newWidth: Int
        val newHeight: Int

        if (bitmap.width > bitmap.height) {
            newWidth = MAX_DIMENSION
            newHeight = (MAX_DIMENSION / ratio).toInt()
        } else {
            newHeight = MAX_DIMENSION
            newWidth = (MAX_DIMENSION * ratio).toInt()
        }

        Log.d(TAG, "Resizing to ${newWidth}x$newHeight")

        return Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
    }

    /**
     * Comprime a imagem para JPEG com qualidade fixa.
     */
    private fun compressImage(bitmap: Bitmap): ByteArray {
        val stream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, COMPRESS_QUALITY, stream)
        return stream.toByteArray()
    }

    /**
     * Salva uma URI temporariamente para uso posterior (ex: após rotação de tela).
     *
     * @param uri URI da imagem
     * @return Caminho do arquivo temporário
     */
    suspend fun saveTempImage(uri: Uri): String? {
        return withContext(Dispatchers.IO) {
            try {
                val inputStream = context.contentResolver.openInputStream(uri) ?: return@withContext null
                val tempFile = File(context.cacheDir, "temp_profile_photo_${System.currentTimeMillis()}.jpg")

                inputStream.use { input ->
                    FileOutputStream(tempFile).use { output ->
                        input.copyTo(output)
                    }
                }

                tempFile.absolutePath
            } catch (e: Exception) {
                Log.e(TAG, "Error saving temp image", e)
                null
            }
        }
    }

    /**
     * Limpa arquivos temporários de foto de perfil.
     */
    fun clearTempImages() {
        try {
            val cacheDir = context.cacheDir
            cacheDir.listFiles()?.forEach { file ->
                if (file.name.startsWith("temp_profile_photo_")) {
                    file.delete()
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error clearing temp images", e)
        }
    }

    /**
     * Obtém a URL da foto de perfil atual do usuário.
     *
     * @param userId ID do usuário
     * @return URL da foto ou null se não existir
     */
    suspend fun getProfilePhotoUrl(userId: String): String? {
        return try {
            val storageRef = storage.reference.child("$PROFILE_IMAGES_PATH/$userId")
            storageRef.downloadUrl.await().toString()
        } catch (e: Exception) {
            // Foto não existe ou erro de permissão
            Log.d(TAG, "No profile photo found for user: $userId")
            null
        }
    }

    /**
     * Deleta a foto de perfil do usuário.
     *
     * @param userId ID do usuário
     * @return true se deletou com sucesso, false caso contrário
     */
    suspend fun deleteProfilePhoto(userId: String): Boolean {
        return try {
            val storageRef = storage.reference.child("$PROFILE_IMAGES_PATH/$userId")
            storageRef.delete().await()
            Log.d(TAG, "Profile photo deleted for user: $userId")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error deleting profile photo", e)
            false
        }
    }

    /**
     * Retorna um placeholder URL para usuários sem foto.
     * Pode ser usado com UI components como Coil.
     */
    fun getPlaceholderUrl(): String {
        // Pode ser substituído por uma imagem asset ou URL de placeholder
        return "android.resource://${context.packageName}/drawable/ic_profile_placeholder"
    }
}
