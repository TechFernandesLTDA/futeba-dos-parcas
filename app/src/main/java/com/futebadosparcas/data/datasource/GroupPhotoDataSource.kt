package com.futebadosparcas.data.datasource

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.core.graphics.scale
import com.futebadosparcas.util.AppLogger
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageMetadata
import com.google.firebase.storage.storageMetadata
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import javax.inject.Inject
import javax.inject.Singleton

/**
 * DataSource para gerenciar upload e processamento de fotos de grupos.
 *
 * Implementa o mesmo padrão de qualidade do ProfilePhotoDataSource:
 * - Validação de tamanho máximo (2MB)
 * - Validação de magic bytes (JPEG, PNG, WebP)
 * - Compressão adaptativa baseada no tamanho original
 * - Redimensionamento para 600x600 (grupos podem precisar de mais resolução)
 * - Geração de thumbnail (200x200) para listagens
 * - Metadados de upload (uploader_id, timestamp, compression_ratio)
 * - Cache-Control headers (30 dias)
 * - Progress tracking via Flow
 *
 * Path no Storage: groups/{groupId}/logo.jpg + groups/{groupId}/thumb.jpg
 */
@Singleton
class GroupPhotoDataSource @Inject constructor(
    private val storage: FirebaseStorage,
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "GroupPhotoDataSource"

        // Limites de tamanho
        private const val MAX_FILE_SIZE_MB = 2
        private const val MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

        // Dimensões otimizadas (grupos podem precisar de mais resolução que perfil)
        private const val GROUP_PHOTO_SIZE = 600  // 600x600 para logo
        private const val THUMBNAIL_SIZE = 200     // Para listagens

        // Qualidade de compressão
        private const val HIGH_QUALITY = 90
        private const val MEDIUM_QUALITY = 85
        private const val LOW_QUALITY = 75

        // Paths padronizados
        private const val GROUPS_PATH = "groups"
        private const val LOGO_NAME = "logo.jpg"
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
     * Processa e faz upload de uma foto de grupo com progresso.
     *
     * @param groupId ID do grupo
     * @param imageUri URI da imagem selecionada
     * @return Flow<UploadResult> com progresso e resultado final
     */
    fun uploadGroupPhotoWithProgress(groupId: String, imageUri: Uri): Flow<UploadResult> = callbackFlow {
        try {
            AppLogger.d(TAG) { "Starting group photo upload for group: $groupId" }

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

            AppLogger.d(TAG) { "Processing complete - Main: ${processedData.bytes.size / 1024}KB, Thumb: ${thumbnailData.size / 1024}KB" }

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
                .child("$GROUPS_PATH/$groupId/$LOGO_NAME")

            val uploadTask = storageRef.putBytes(processedData.bytes, metadata)

            // Listener de progresso
            uploadTask.addOnProgressListener { snapshot ->
                val progress = UploadResult.Progress(
                    bytesTransferred = snapshot.bytesTransferred,
                    totalBytes = snapshot.totalByteCount
                )
                trySend(progress)
            }.addOnSuccessListener {
                // Upload completo - obter URL
                storageRef.downloadUrl.addOnSuccessListener { uri ->
                    // Upload do thumbnail em background
                    CoroutineScope(Dispatchers.IO).launch {
                        val thumbUrl = uploadThumbnail(groupId, thumbnailData)
                        trySend(UploadResult.Success(uri.toString(), thumbUrl))
                        close()
                    }
                }.addOnFailureListener { e ->
                    AppLogger.e(TAG, "Failed to get download URL", e)
                    val errorMessage = parseStorageError(e)
                    trySend(UploadResult.Error(errorMessage.first, errorMessage.second))
                    close()
                }
            }.addOnFailureListener { e ->
                AppLogger.e(TAG, "Upload failed", e)
                val errorMessage = parseStorageError(e)
                trySend(UploadResult.Error(errorMessage.first, errorMessage.second))
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
     * Processa e faz upload de uma foto de grupo (versão simplificada sem progresso).
     *
     * @param groupId ID do grupo
     * @param imageUri URI da imagem selecionada
     * @return UploadResult com URL da foto ou erro
     */
    suspend fun uploadGroupPhoto(groupId: String, imageUri: Uri): UploadResult {
        return withContext(Dispatchers.IO) {
            try {
                AppLogger.d(TAG) { "Starting group photo upload for group: $groupId" }

                // 1. Validar arquivo
                val validationResult = validateImageFile(imageUri)
                if (validationResult != null) {
                    return@withContext validationResult
                }

                // 2. Decodificar e processar imagem
                val processedData = processImage(imageUri)

                AppLogger.d(TAG) { "Processing complete - Size: ${processedData.bytes.size / 1024}KB, " +
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
                    .child("$GROUPS_PATH/$groupId/$LOGO_NAME")

                AppLogger.d(TAG) { "Uploading to: $GROUPS_PATH/$groupId/$LOGO_NAME" }

                val uploadTask = storageRef.putBytes(processedData.bytes, metadata).await()
                val downloadUrl = uploadTask.storage.downloadUrl.await().toString()

                // 5. Upload do thumbnail
                val thumbnailData = createThumbnail(processedData.bitmap)
                val thumbUrl = uploadThumbnail(groupId, thumbnailData)

                // 6. Liberar bitmap
                processedData.bitmap.recycle()

                AppLogger.d(TAG) { "Upload successful: $downloadUrl" }

                UploadResult.Success(downloadUrl, thumbUrl)

            } catch (e: Exception) {
                AppLogger.e(TAG, "Error uploading group photo", e)

                // Mapear erros específicos do Firebase Storage para mensagens amigáveis
                val errorMessage = e.message ?: ""
                val (message, isRecoverable) = when {
                    // Erro de permissão (403) - pode ser rate limiting do App Check
                    errorMessage.contains("403") ||
                    errorMessage.contains("permission", ignoreCase = true) ||
                    errorMessage.contains("not authorized", ignoreCase = true) -> {
                        "Sem permissão para fazer upload. Tente novamente em alguns minutos." to false
                    }
                    // Erro de autenticação
                    errorMessage.contains("401") ||
                    errorMessage.contains("unauthenticated", ignoreCase = true) -> {
                        "Sessão expirada. Faça login novamente." to false
                    }
                    // Rate limiting
                    errorMessage.contains("Too many", ignoreCase = true) ||
                    errorMessage.contains("rate", ignoreCase = true) -> {
                        "Muitas tentativas. Aguarde alguns minutos e tente novamente." to true
                    }
                    // Erro de rede
                    errorMessage.contains("network", ignoreCase = true) ||
                    errorMessage.contains("timeout", ignoreCase = true) ||
                    errorMessage.contains("connection", ignoreCase = true) -> {
                        "Erro de conexão. Verifique sua internet e tente novamente." to true
                    }
                    // Cota excedida
                    errorMessage.contains("quota", ignoreCase = true) -> {
                        "Limite de armazenamento atingido." to false
                    }
                    // Erro genérico
                    else -> {
                        "Erro ao fazer upload da foto. Tente novamente." to true
                    }
                }

                UploadResult.Error(message = message, isRecoverable = isRecoverable)
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
            ?: throw IllegalStateException("Não foi possível abrir a imagem")
        val originalSize = inputStream.available()
        val originalBitmap = BitmapFactory.decodeStream(inputStream)
            ?: throw IllegalStateException("Não foi possível decodificar a imagem")
        inputStream.close()

        AppLogger.d(TAG) { "Original: ${originalBitmap.width}x${originalBitmap.height}, ${originalSize / 1024}KB" }

        // Redimensionar para tamanho otimizado mantendo aspect ratio (não forçar quadrado)
        val resizedBitmap = resizeToMaxDimension(originalBitmap, GROUP_PHOTO_SIZE)

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
     * Redimensiona a imagem mantendo aspect ratio para que a maior dimensão seja maxDimension.
     */
    private fun resizeToMaxDimension(bitmap: Bitmap, maxDimension: Int): Bitmap {
        val width = bitmap.width
        val height = bitmap.height

        if (width <= maxDimension && height <= maxDimension) {
            return bitmap
        }

        val ratio = minOf(maxDimension.toFloat() / width, maxDimension.toFloat() / height)
        val newWidth = (width * ratio).toInt()
        val newHeight = (height * ratio).toInt()

        return bitmap.scale(newWidth, newHeight, true)
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
        val ratio = minOf(THUMBNAIL_SIZE.toFloat() / bitmap.width, THUMBNAIL_SIZE.toFloat() / bitmap.height)
        val newWidth = (bitmap.width * ratio).toInt()
        val newHeight = (bitmap.height * ratio).toInt()

        val thumbBitmap = bitmap.scale(newWidth, newHeight, true)
        val stream = ByteArrayOutputStream()
        thumbBitmap.compress(Bitmap.CompressFormat.JPEG, MEDIUM_QUALITY, stream)
        thumbBitmap.recycle()
        return stream.toByteArray()
    }

    /**
     * Faz upload do thumbnail.
     */
    private suspend fun uploadThumbnail(groupId: String, bytes: ByteArray): String? {
        return try {
            val thumbRef = storage.reference
                .child("$GROUPS_PATH/$groupId/$THUMBNAIL_NAME")

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
            setCustomMetadata("compression_ratio", "${((1 - compressedSize.toFloat() / originalSize) * 100).toInt()}%")
        }
    }

    /**
     * Obtém o ID do usuário atual.
     */
    private fun getCurrentUserId(): String {
        return try {
            com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid
                ?: "unknown"
        } catch (e: Exception) {
            "unknown"
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
     * Converte erros do Firebase Storage em mensagens amigáveis.
     * @return Pair(mensagem, isRecoverable)
     */
    private fun parseStorageError(e: Exception): Pair<String, Boolean> {
        val errorMessage = e.message ?: ""
        return when {
            // Erro de permissão (403)
            errorMessage.contains("403") ||
            errorMessage.contains("permission", ignoreCase = true) ||
            errorMessage.contains("not authorized", ignoreCase = true) -> {
                "Sem permissão para fazer upload. Tente novamente em alguns minutos." to false
            }
            // Erro de autenticação
            errorMessage.contains("401") ||
            errorMessage.contains("unauthenticated", ignoreCase = true) -> {
                "Sessão expirada. Faça login novamente." to false
            }
            // Rate limiting
            errorMessage.contains("Too many", ignoreCase = true) ||
            errorMessage.contains("rate", ignoreCase = true) -> {
                "Muitas tentativas. Aguarde alguns minutos e tente novamente." to true
            }
            // Erro de rede
            errorMessage.contains("network", ignoreCase = true) ||
            errorMessage.contains("timeout", ignoreCase = true) ||
            errorMessage.contains("connection", ignoreCase = true) -> {
                "Erro de conexão. Verifique sua internet e tente novamente." to true
            }
            // Cota excedida
            errorMessage.contains("quota", ignoreCase = true) -> {
                "Limite de armazenamento atingido." to false
            }
            // Erro genérico
            else -> {
                "Erro ao fazer upload da foto. Tente novamente." to true
            }
        }
    }

    /**
     * Obtém a URL da foto do grupo.
     */
    suspend fun getGroupPhotoUrl(groupId: String): String? {
        return try {
            val storageRef = storage.reference.child("$GROUPS_PATH/$groupId/$LOGO_NAME")
            storageRef.downloadUrl.await().toString()
        } catch (e: Exception) {
            AppLogger.d(TAG) { "No photo found for group: $groupId" }
            null
        }
    }

    /**
     * Obtém a URL do thumbnail do grupo.
     */
    suspend fun getThumbnailUrl(groupId: String): String? {
        return try {
            val storageRef = storage.reference.child("$GROUPS_PATH/$groupId/$THUMBNAIL_NAME")
            storageRef.downloadUrl.await().toString()
        } catch (e: Exception) {
            // Fallback para foto principal se thumbnail não existir
            getGroupPhotoUrl(groupId)
        }
    }

    /**
     * Deleta a foto do grupo.
     */
    suspend fun deleteGroupPhoto(groupId: String): Boolean {
        return try {
            val photoRef = storage.reference.child("$GROUPS_PATH/$groupId/$LOGO_NAME")
            val thumbRef = storage.reference.child("$GROUPS_PATH/$groupId/$THUMBNAIL_NAME")

            // Deletar ambos (ignorar erro se não existir)
            try { photoRef.delete().await() } catch (e: Exception) { /* ignore */ }
            try { thumbRef.delete().await() } catch (e: Exception) { /* ignore */ }

            AppLogger.d(TAG) { "Group photo deleted for group: $groupId" }
            true
        } catch (e: Exception) {
            AppLogger.e(TAG, "Error deleting group photo", e)
            false
        }
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
