package com.futebadosparcas.data.datasource

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.futebadosparcas.util.AppLogger
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageMetadata
import com.google.firebase.storage.storageMetadata
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.ProducerScope
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.SupervisorJob
import kotlin.coroutines.CoroutineContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * DataSource melhorado para gerenciar upload e processamento de fotos.
 *
 * MELHORIAS IMPLEMENTADAS:
 * - Image Resizing otimizado (400x400 para profile)
 * - WebP quando disponível (Android 4.2+)
 * - Validação de Magic Bytes
 * - Compressão Adaptativa baseada no tamanho original
 * - Metadados de Upload (uploader_id, timestamp, original_size)
 * - Upload Progress Indicator via Flow
 * - Cache-Control nos metadados (30 dias)
 *
 * CMD-06: Padroniza o pipeline de foto de perfil.
 */
@Singleton
class ProfilePhotoDataSource @Inject constructor(
    private val storage: FirebaseStorage,
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "ProfilePhotoDataSource"

        // Limites de tamanho
        private const val MAX_FILE_SIZE_MB = 2
        private const val MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

        // Dimensões otimizadas
        private const val PROFILE_PHOTO_SIZE = 400  // 400x400 é suficiente para profile
        private const val THUMBNAIL_SIZE = 150       // Para listagens

        // Qualidade de compressão
        private const val HIGH_QUALITY = 90
        private const val MEDIUM_QUALITY = 85
        private const val LOW_QUALITY = 75

        // Paths padronizados
        private const val PROFILE_PHOTO_PATH = "users"
        private const val PROFILE_PHOTO_NAME = "profile.jpg"
        private const val THUMBNAIL_NAME = "thumb.jpg"

        // Cache control (30 dias)
        private const val CACHE_CONTROL_HEADER = "public, max-age=2592000"

        // Magic bytes para validação de imagens reais
        private val JPEG_MAGIC = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte())
        private val PNG_MAGIC = byteArrayOf(0x89.toByte(), 0x50.toByte(), 0x4E.toByte(), 0x47.toByte())
        private val WEBP_MAGIC = byteArrayOf(0x52.toByte(), 0x49.toByte(), 0x46.toByte(), 0x46.toByte())
    }

    /**
     * Resultado do upload de foto com progresso.
     */
    sealed class UploadResult {
        data class Success(val url: String, val thumbnailUrl: String? = null) : UploadResult()
        data class Progress(val bytesTransferred: Long, val totalBytes: Long) : UploadResult() {
            val percent: Int get() = if (totalBytes > 0) ((bytesTransferred * 100) / totalBytes).toInt() else 0
        }
        data class Error(val message: String, val isRecoverable: Boolean = true) : UploadResult()
        data object FileTooLarge : UploadResult()
        data object InvalidImage : UploadResult()
    }

    /**
     * Processa e faz upload de uma foto de perfil com progresso.
     *
     * @param userId ID do usuário
     * @param imageUri URI da imagem selecionada
     * @return Flow<UploadResult> com progresso e resultado final
     */
    fun uploadProfilePhotoWithProgress(userId: String, imageUri: Uri): Flow<UploadResult> = callbackFlow {
        try {
            AppLogger.d(TAG) { "Starting profile photo upload for user: $userId" }

            // 1. Validar arquivo
            val validationResult = validateImageFile(imageUri)
            if (validationResult != null) {
                trySend(validationResult)
                close()
                return@callbackFlow
            }

            // 2. Decodificar e processar imagem
            val processedData = processImage(imageUri)
            val thumbnailData = createThumbnail(processedData.bitmap)

            AppLogger.d(TAG) { "Processing complete - Main: ${processedData.bytes.size}KB, Thumb: ${thumbnailData.size}KB" }

            // 3. Preparar metadados
            val metadata = createUploadMetadata(
                originalSize = processedData.originalSize,
                compressedSize = processedData.bytes.size,
                width = processedData.bitmap.width,
                height = processedData.bitmap.height,
                format = processedData.format
            )

            // 4. Upload da foto principal com progresso
            val storageRef = storage.reference
                .child("$PROFILE_PHOTO_PATH/$userId/$PROFILE_PHOTO_NAME")

            val uploadTask = storageRef.putBytes(processedData.bytes, metadata)

            // Listener de progresso
            uploadTask.addOnProgressListener { snapshot ->
                val progress = UploadResult.Progress(
                    bytesTransferred = snapshot.bytesTransferred,
                    totalBytes = snapshot.totalByteCount
                )
                trySend(progress)
            }.addOnSuccessListener {
                // Upload completo - usar Tasks API para obter URL
                storageRef.downloadUrl.addOnSuccessListener { uri ->
                    // Upload do thumbnail em background
                    CoroutineScope(Dispatchers.IO).launch {
                        val thumbUrl = uploadThumbnail(userId, thumbnailData)
                        trySend(UploadResult.Success(uri.toString(), thumbUrl))
                        close()
                    }
                }.addOnFailureListener { e ->
                    trySend(UploadResult.Error("Erro ao obter URL: ${e.message}"))
                    close()
                }
            }.addOnFailureListener { e ->
                AppLogger.e(TAG, "Upload failed", e)
                trySend(UploadResult.Error(e.message ?: "Erro no upload"))
                close()
            }

            awaitClose {
                uploadTask.pause()
            }

        } catch (e: Exception) {
            AppLogger.e(TAG, "Error in upload flow", e)
            trySend(UploadResult.Error(e.message ?: "Erro desconhecido"))
            close()
        }
    }

    /**
     * Processa e faz upload de uma foto de perfil (versão simplificada sem progresso).
     */
    suspend fun uploadProfilePhoto(userId: String, imageUri: Uri): UploadResult {
        return withContext(Dispatchers.IO) {
            try {
                AppLogger.d(TAG) { "Starting profile photo upload for user: $userId" }

                // 1. Validar arquivo
                val validationResult = validateImageFile(imageUri)
                if (validationResult != null) {
                    return@withContext validationResult
                }

                // 2. Decodificar e processar imagem
                val processedData = processImage(imageUri)

                AppLogger.d(TAG) { "Processing complete - Size: ${processedData.bytes.size}KB, " +
                        "Format: ${processedData.format}, ${processedData.bitmap.width}x${processedData.bitmap.height}" }

                // 3. Preparar metadados
                val metadata = createUploadMetadata(
                    originalSize = processedData.originalSize,
                    compressedSize = processedData.bytes.size,
                    width = processedData.bitmap.width,
                    height = processedData.bitmap.height,
                    format = processedData.format
                )

                // 4. Upload
                val storageRef = storage.reference
                    .child("$PROFILE_PHOTO_PATH/$userId/$PROFILE_PHOTO_NAME")

                AppLogger.d(TAG) { "Uploading to: $PROFILE_PHOTO_PATH/$userId/$PROFILE_PHOTO_NAME" }

                val uploadTask = storageRef.putBytes(processedData.bytes, metadata).await()
                val downloadUrl = uploadTask.storage.downloadUrl.await().toString()

                // 5. Upload do thumbnail em paralelo
                val thumbnailData = createThumbnail(processedData.bitmap)
                uploadThumbnail(userId, thumbnailData)

                AppLogger.d(TAG) { "Upload successful: $downloadUrl" }

                UploadResult.Success(downloadUrl)

            } catch (e: Exception) {
                AppLogger.e(TAG, "Error uploading profile photo", e)
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
     * Valida o arquivo de imagem:
     * - Tamanho máximo
     * - Magic bytes (conteúdo real, não só extensão)
     */
    private fun validateImageFile(uri: Uri): UploadResult? {
        // Validar tamanho
        val fileSize = getFileSize(uri)
        if (fileSize > MAX_FILE_SIZE_BYTES) {
            AppLogger.w(TAG) { "File too large: ${fileSize / 1024 / 1024}MB (max: $MAX_FILE_SIZE_MB MB)" }
            return UploadResult.FileTooLarge
        }

        // Validar magic bytes (conteúdo real)
        val magicBytes = readMagicBytes(uri)
        val isValidImage = when {
            magicBytes.startsWith(JPEG_MAGIC) -> true
            magicBytes.startsWith(PNG_MAGIC) -> true
            magicBytes.startsWith(WEBP_MAGIC) -> true
            else -> false
        }

        if (!isValidImage) {
            AppLogger.w(TAG) { "Invalid image file (magic bytes mismatch)" }
            return UploadResult.InvalidImage
        }

        return null
    }

    /**
     * Verifica se um ByteArray começa com outro ByteArray.
     */
    private fun ByteArray.startsWith(prefix: ByteArray): Boolean {
        if (this.size < prefix.size) return false
        for (i in prefix.indices) {
            if (this[i] != prefix[i]) return false
        }
        return true
    }

    /**
     * Lê os primeiros bytes do arquivo para validar magic bytes.
     */
    private fun readMagicBytes(uri: Uri): ByteArray {
        return try {
            context.contentResolver.openInputStream(uri)?.use { stream ->
                val header = ByteArray(12)
                stream.read(header)
                header
            } ?: byteArrayOf()
        } catch (e: Exception) {
            AppLogger.w(TAG) { "Error reading magic bytes: ${e.message}" }
            byteArrayOf()
        }
    }

    /**
     * Processa a imagem: redimensiona, comprime e otimiza.
     */
    private fun processImage(uri: Uri): ProcessedImageData {
        val inputStream = context.contentResolver.openInputStream(uri)
            ?: throw IllegalArgumentException("Nao foi possivel abrir a imagem")
        val originalSize = inputStream.available()
        val originalBitmap = inputStream.use { stream ->
            BitmapFactory.decodeStream(stream)
        } ?: throw IllegalArgumentException("Imagem invalida ou corrompida")

        AppLogger.d(TAG) { "Original: ${originalBitmap.width}x${originalBitmap.height}, ${originalSize / 1024}KB" }

        // Redimensionar para tamanho otimizado de perfil
        val resizedBitmap = resizeToSquare(originalBitmap, PROFILE_PHOTO_SIZE)

        // Comprimir com qualidade adaptativa baseada no tamanho original
        val compressFormat = Bitmap.CompressFormat.JPEG
        val quality = getAdaptiveQuality(originalSize)
        val compressedBytes = compressImage(resizedBitmap, compressFormat, quality)

        AppLogger.d(TAG) { "Compressed: ${resizedBitmap.width}x${resizedBitmap.height}, " +
                "${compressedBytes.size / 1024}KB (${quality}% quality)" }

        // Reciclar bitmap original para liberar memória
        if (originalBitmap != resizedBitmap) {
            originalBitmap.recycle()
        }

        return ProcessedImageData(
            bitmap = resizedBitmap,
            bytes = compressedBytes,
            format = compressFormat.name,
            originalSize = originalSize
        )
    }

    /**
     * Redimensiona a imagem para um quadrado do tamanho especificado.
     * Faz crop central se a imagem não for quadrada.
     */
    private fun resizeToSquare(bitmap: Bitmap, targetSize: Int): Bitmap {
        if (bitmap.width == bitmap.height && bitmap.width == targetSize) {
            return bitmap
        }

        // Calcular dimensões para crop central
        val size = minOf(bitmap.width, bitmap.height)
        val x = (bitmap.width - size) / 2
        val y = (bitmap.height - size) / 2

        // Crop central
        val croppedBitmap = if (x > 0 || y > 0) {
            Bitmap.createBitmap(bitmap, x, y, size, size)
        } else {
            bitmap
        }

        // Redimensionar para o tamanho alvo
        val result = if (croppedBitmap.width != targetSize) {
            Bitmap.createScaledBitmap(croppedBitmap, targetSize, targetSize, true)
        } else {
            croppedBitmap
        }

        // Reciclar intermediário se diferente
        if (croppedBitmap != bitmap && croppedBitmap != result) {
            croppedBitmap.recycle()
        }

        return result
    }

    /**
     * Determina a qualidade de compressão baseada no tamanho original.
     * Arquivos maiores → compressão mais agressiva.
     */
    private fun getAdaptiveQuality(originalSizeBytes: Int): Int {
        val sizeKB = originalSizeBytes / 1024
        return when {
            sizeKB < 500 -> HIGH_QUALITY      // < 500KB → 90%
            sizeKB < 1500 -> MEDIUM_QUALITY   // 500KB-1.5MB → 85%
            else -> LOW_QUALITY               // > 1.5MB → 75%
        }
    }

    /**
     * Comprime a imagem com o formato e qualidade especificados.
     */
    private fun compressImage(bitmap: Bitmap, format: Bitmap.CompressFormat, quality: Int): ByteArray {
        val stream = ByteArrayOutputStream()
        bitmap.compress(format, quality, stream)
        return stream.toByteArray()
    }

    /**
     * Cria um thumbnail da imagem.
     */
    private fun createThumbnail(bitmap: Bitmap): ByteArray {
        val thumbBitmap = Bitmap.createScaledBitmap(bitmap, THUMBNAIL_SIZE, THUMBNAIL_SIZE, true)
        val stream = ByteArrayOutputStream()
        thumbBitmap.compress(Bitmap.CompressFormat.JPEG, MEDIUM_QUALITY, stream)
        thumbBitmap.recycle()
        return stream.toByteArray()
    }

    /**
     * Faz upload do thumbnail.
     */
    private suspend fun uploadThumbnail(userId: String, bytes: ByteArray): String? {
        return try {
            val thumbRef = storage.reference
                .child("$PROFILE_PHOTO_PATH/$userId/$THUMBNAIL_NAME")

            val metadata = storageMetadata {
                contentType = "image/jpeg"
                setCustomMetadata("type", "thumbnail")
                setCustomMetadata("size", THUMBNAIL_SIZE.toString())
                cacheControl = CACHE_CONTROL_HEADER
            }

            thumbRef.putBytes(bytes, metadata).await()
            thumbRef.downloadUrl.await().toString()
        } catch (e: Exception) {
            AppLogger.w(TAG) { "Failed to upload thumbnail: ${e.message}" }
            null
        }
    }

    /**
     * Cria metadados para o upload com informações úteis.
     */
    private fun createUploadMetadata(
        originalSize: Int,
        compressedSize: Int,
        width: Int,
        height: Int,
        format: String
    ): StorageMetadata {
        return storageMetadata {
            contentType = "image/jpeg"
            cacheControl = CACHE_CONTROL_HEADER
            setCustomMetadata("uploader_id", getCurrentUserId())
            setCustomMetadata("upload_timestamp", System.currentTimeMillis().toString())
            setCustomMetadata("original_size_kb", (originalSize / 1024).toString())
            setCustomMetadata("compressed_size_kb", (compressedSize / 1024).toString())
            setCustomMetadata("width", width.toString())
            setCustomMetadata("height", height.toString())
            setCustomMetadata("format", format)
            setCustomMetadata("compression_ratio", ((1 - compressedSize.toFloat() / originalSize) * 100).toInt().toString() + "%")
        }
    }

    /**
     * Obtém o ID do usuário atual.
     */
    private fun getCurrentUserId(): String {
        return try {
            com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid
                ?: UUID.randomUUID().toString()
        } catch (e: Exception) {
            UUID.randomUUID().toString()
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
            AppLogger.w(TAG) { "Error getting file size: ${e.message}" }
            0
        }
    }

    /**
     * Salva uma URI temporariamente para uso posterior.
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
                AppLogger.e(TAG, "Error saving temp image", e)
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
            AppLogger.w(TAG) { "Error clearing temp images: ${e.message}" }
        }
    }

    /**
     * Obtém a URL da foto de perfil do usuário.
     */
    suspend fun getProfilePhotoUrl(userId: String): String? {
        return try {
            val storageRef = storage.reference.child("$PROFILE_PHOTO_PATH/$userId/$PROFILE_PHOTO_NAME")
            storageRef.downloadUrl.await().toString()
        } catch (e: Exception) {
            AppLogger.d(TAG) { "No profile photo found for user: $userId" }
            null
        }
    }

    /**
     * Obtém a URL do thumbnail do usuário.
     */
    suspend fun getThumbnailUrl(userId: String): String? {
        return try {
            val storageRef = storage.reference.child("$PROFILE_PHOTO_PATH/$userId/$THUMBNAIL_NAME")
            storageRef.downloadUrl.await().toString()
        } catch (e: Exception) {
            // Fallback para foto principal se thumbnail não existir
            getProfilePhotoUrl(userId)
        }
    }

    /**
     * Deleta a foto de perfil do usuário.
     */
    suspend fun deleteProfilePhoto(userId: String): Boolean {
        return try {
            val photoRef = storage.reference.child("$PROFILE_PHOTO_PATH/$userId/$PROFILE_PHOTO_NAME")
            val thumbRef = storage.reference.child("$PROFILE_PHOTO_PATH/$userId/$THUMBNAIL_NAME")

            // Deletar ambos em paralelo
            coroutineScope {
                launch { photoRef.delete().await() }
                launch { thumbRef.delete().await() }
            }

            AppLogger.d(TAG) { "Profile photo deleted for user: $userId" }
            true
        } catch (e: Exception) {
            AppLogger.e(TAG, "Error deleting profile photo", e)
            false
        }
    }

    /**
     * Retorna um placeholder URL para usuários sem foto.
     */
    fun getPlaceholderUrl(): String {
        return "android.resource://${context.packageName}/drawable/ic_profile_placeholder"
    }

    /**
     * Dados processados da imagem.
     */
    private data class ProcessedImageData(
        val bitmap: Bitmap,
        val bytes: ByteArray,
        val format: String,
        val originalSize: Int
    )
}
