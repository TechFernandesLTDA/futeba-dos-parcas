package com.futebadosparcas.data.datasource

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
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
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * DataSource para gerenciar upload e processamento de fotos de quadras (fields).
 *
 * Implementa o mesmo padrão de qualidade do ProfilePhotoDataSource:
 * - Validação de tamanho máximo (3MB - quadras podem precisar de mais detalhe)
 * - Validação de magic bytes (JPEG, PNG, WebP)
 * - Compressão adaptativa baseada no tamanho original
 * - Redimensionamento para 1200x800 (landscape típico para quadras)
 * - Geração de thumbnail (400x300) para listagens
 * - Metadados de upload (uploader_id, timestamp, compression_ratio)
 * - Cache-Control headers (30 dias)
 * - Progress tracking via Flow
 *
 * Path no Storage: locations/{locationId}/fields/{fieldId}/photo.jpg
 *                 + locations/{locationId}/fields/{fieldId}/thumb.jpg
 */
@Singleton
class FieldPhotoDataSource @Inject constructor(
    private val storage: FirebaseStorage,
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "FieldPhotoDataSource"

        // Limites de tamanho (quadras podem precisar de mais detalhe)
        private const val MAX_FILE_SIZE_MB = 3
        private const val MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

        // Dimensões otimizadas (landscape para fotos de quadras)
        private const val FIELD_PHOTO_MAX_WIDTH = 1200
        private const val FIELD_PHOTO_MAX_HEIGHT = 800
        private const val THUMBNAIL_MAX_WIDTH = 400
        private const val THUMBNAIL_MAX_HEIGHT = 300

        // Qualidade de compressão
        private const val HIGH_QUALITY = 90
        private const val MEDIUM_QUALITY = 85
        private const val LOW_QUALITY = 75

        // Paths padronizados
        private const val LOCATIONS_PATH = "locations"
        private const val FIELDS_FOLDER = "fields"
        private const val PHOTO_NAME = "photo.jpg"
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
     * Processa e faz upload de uma foto de quadra com progresso.
     *
     * @param locationId ID do local
     * @param fieldId ID da quadra (ou timestamp se nova quadra)
     * @param imageUri URI da imagem selecionada
     * @return Flow<UploadResult> com progresso e resultado final
     */
    fun uploadFieldPhotoWithProgress(
        locationId: String,
        fieldId: String,
        imageUri: Uri
    ): Flow<UploadResult> = callbackFlow {
        try {
            Log.d(TAG, "Starting field photo upload for location: $locationId, field: $fieldId")

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

            Log.d(TAG, "Processing complete - Main: ${processedData.bytes.size / 1024}KB, Thumb: ${thumbnailData.size / 1024}KB")

            // 3. Preparar metadados
            val metadata = createUploadMetadata(
                originalSize = processedData.originalSize,
                compressedSize = processedData.bytes.size,
                width = processedData.bitmap.width,
                height = processedData.bitmap.height,
                format = processedData.format
            )

            // 4. Upload da foto principal com progresso
            val storagePath = "$LOCATIONS_PATH/$locationId/$FIELDS_FOLDER/$fieldId/$PHOTO_NAME"
            val storageRef = storage.reference.child(storagePath)

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
                        val thumbUrl = uploadThumbnail(locationId, fieldId, thumbnailData)
                        trySend(UploadResult.Success(uri.toString(), thumbUrl))
                        close()
                    }
                }.addOnFailureListener { e ->
                    trySend(UploadResult.Error("Erro ao obter URL: ${e.message}"))
                    close()
                }
            }.addOnFailureListener { e ->
                Log.e(TAG, "Upload failed", e)
                trySend(UploadResult.Error(e.message ?: "Erro no upload"))
                close()
            }

            awaitClose {
                uploadTask.pause()
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error in upload flow", e)
            trySend(UploadResult.Error(e.message ?: "Erro desconhecido"))
            close()
        }
    }

    /**
     * Processa e faz upload de uma foto de quadra (versão simplificada sem progresso).
     *
     * @param locationId ID do local
     * @param fieldId ID da quadra (ou timestamp se nova quadra)
     * @param imageUri URI da imagem selecionada (pode ser content:// ou file://)
     * @return UploadResult com URL da foto ou erro
     */
    suspend fun uploadFieldPhoto(
        locationId: String,
        fieldId: String,
        imageUri: Uri
    ): UploadResult {
        return withContext(Dispatchers.IO) {
            try {
                Log.d(TAG, "Starting field photo upload for location: $locationId, field: $fieldId")

                // 1. Validar arquivo
                val validationResult = validateImageFile(imageUri)
                if (validationResult != null) {
                    return@withContext validationResult
                }

                // 2. Decodificar e processar imagem
                val processedData = processImage(imageUri)

                Log.d(TAG, "Processing complete - Size: ${processedData.bytes.size / 1024}KB, " +
                        "Format: ${processedData.format}, ${processedData.bitmap.width}x${processedData.bitmap.height}")

                // 3. Preparar metadados
                val metadata = createUploadMetadata(
                    originalSize = processedData.originalSize,
                    compressedSize = processedData.bytes.size,
                    width = processedData.bitmap.width,
                    height = processedData.bitmap.height,
                    format = processedData.format
                )

                // 4. Upload
                val storagePath = "$LOCATIONS_PATH/$locationId/$FIELDS_FOLDER/$fieldId/$PHOTO_NAME"
                val storageRef = storage.reference.child(storagePath)

                Log.d(TAG, "Uploading to: $storagePath")

                val uploadTask = storageRef.putBytes(processedData.bytes, metadata).await()
                val downloadUrl = uploadTask.storage.downloadUrl.await().toString()

                // 5. Upload do thumbnail
                val thumbnailData = createThumbnail(processedData.bitmap)
                val thumbUrl = uploadThumbnail(locationId, fieldId, thumbnailData)

                // 6. Liberar bitmap
                processedData.bitmap.recycle()

                Log.d(TAG, "Upload successful: $downloadUrl")

                UploadResult.Success(downloadUrl, thumbUrl)

            } catch (e: Exception) {
                Log.e(TAG, "Error uploading field photo", e)
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
     * Processa e faz upload a partir de um file path (compatibilidade com API existente).
     *
     * @param locationId ID do local
     * @param fieldId ID da quadra
     * @param filePath Caminho do arquivo (content:// ou file://)
     * @return UploadResult com URL da foto ou erro
     */
    suspend fun uploadFieldPhotoFromPath(
        locationId: String,
        fieldId: String,
        filePath: String
    ): UploadResult {
        val uri = when {
            filePath.startsWith("content://") -> Uri.parse(filePath)
            filePath.startsWith("file://") -> Uri.parse(filePath)
            else -> Uri.fromFile(File(filePath))
        }
        return uploadFieldPhoto(locationId, fieldId, uri)
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
            Log.w(TAG, "File too large: ${fileSize / 1024 / 1024}MB (max: $MAX_FILE_SIZE_MB MB)")
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
            Log.w(TAG, "Invalid image file (magic bytes mismatch)")
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
            Log.w(TAG, "Error reading magic bytes", e)
            byteArrayOf()
        }
    }

    /**
     * Processa a imagem: redimensiona, comprime e otimiza.
     */
    private fun processImage(uri: Uri): ProcessedImageData {
        val inputStream = context.contentResolver.openInputStream(uri)!!
        val originalSize = inputStream.available()
        val originalBitmap = BitmapFactory.decodeStream(inputStream)!!
        inputStream.close()

        Log.d(TAG, "Original: ${originalBitmap.width}x${originalBitmap.height}, ${originalSize / 1024}KB")

        // Redimensionar mantendo aspect ratio
        val resizedBitmap = resizeToMaxDimensions(
            originalBitmap,
            FIELD_PHOTO_MAX_WIDTH,
            FIELD_PHOTO_MAX_HEIGHT
        )

        // Comprimir com qualidade adaptativa baseada no tamanho original
        val compressFormat = Bitmap.CompressFormat.JPEG
        val quality = getAdaptiveQuality(originalSize)
        val compressedBytes = compressImage(resizedBitmap, compressFormat, quality)

        Log.d(TAG, "Compressed: ${resizedBitmap.width}x${resizedBitmap.height}, " +
                "${compressedBytes.size / 1024}KB (${quality}% quality)")

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
     * Redimensiona a imagem mantendo aspect ratio para caber nas dimensões máximas.
     */
    private fun resizeToMaxDimensions(bitmap: Bitmap, maxWidth: Int, maxHeight: Int): Bitmap {
        val width = bitmap.width
        val height = bitmap.height

        if (width <= maxWidth && height <= maxHeight) {
            return bitmap
        }

        val ratio = minOf(maxWidth.toFloat() / width, maxHeight.toFloat() / height)
        val newWidth = (width * ratio).toInt()
        val newHeight = (height * ratio).toInt()

        return Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
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
        val ratio = minOf(
            THUMBNAIL_MAX_WIDTH.toFloat() / bitmap.width,
            THUMBNAIL_MAX_HEIGHT.toFloat() / bitmap.height
        )
        val newWidth = (bitmap.width * ratio).toInt()
        val newHeight = (bitmap.height * ratio).toInt()

        val thumbBitmap = Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
        val stream = ByteArrayOutputStream()
        thumbBitmap.compress(Bitmap.CompressFormat.JPEG, MEDIUM_QUALITY, stream)
        thumbBitmap.recycle()
        return stream.toByteArray()
    }

    /**
     * Faz upload do thumbnail.
     */
    private suspend fun uploadThumbnail(
        locationId: String,
        fieldId: String,
        bytes: ByteArray
    ): String? {
        return try {
            val thumbPath = "$LOCATIONS_PATH/$locationId/$FIELDS_FOLDER/$fieldId/$THUMBNAIL_NAME"
            val thumbRef = storage.reference.child(thumbPath)

            val metadata = storageMetadata {
                contentType = "image/jpeg"
                setCustomMetadata("type", "thumbnail")
                setCustomMetadata("max_width", THUMBNAIL_MAX_WIDTH.toString())
                setCustomMetadata("max_height", THUMBNAIL_MAX_HEIGHT.toString())
                cacheControl = CACHE_CONTROL_HEADER
            }

            thumbRef.putBytes(bytes, metadata).await()
            thumbRef.downloadUrl.await().toString()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to upload thumbnail", e)
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
            Log.w(TAG, "Error getting file size", e)
            0
        }
    }

    /**
     * Obtém a URL da foto da quadra.
     */
    suspend fun getFieldPhotoUrl(locationId: String, fieldId: String): String? {
        return try {
            val storagePath = "$LOCATIONS_PATH/$locationId/$FIELDS_FOLDER/$fieldId/$PHOTO_NAME"
            val storageRef = storage.reference.child(storagePath)
            storageRef.downloadUrl.await().toString()
        } catch (e: Exception) {
            Log.d(TAG, "No photo found for field: $fieldId")
            null
        }
    }

    /**
     * Obtém a URL do thumbnail da quadra.
     */
    suspend fun getThumbnailUrl(locationId: String, fieldId: String): String? {
        return try {
            val thumbPath = "$LOCATIONS_PATH/$locationId/$FIELDS_FOLDER/$fieldId/$THUMBNAIL_NAME"
            val storageRef = storage.reference.child(thumbPath)
            storageRef.downloadUrl.await().toString()
        } catch (e: Exception) {
            // Fallback para foto principal se thumbnail não existir
            getFieldPhotoUrl(locationId, fieldId)
        }
    }

    /**
     * Deleta a foto da quadra.
     */
    suspend fun deleteFieldPhoto(locationId: String, fieldId: String): Boolean {
        return try {
            val photoPath = "$LOCATIONS_PATH/$locationId/$FIELDS_FOLDER/$fieldId/$PHOTO_NAME"
            val thumbPath = "$LOCATIONS_PATH/$locationId/$FIELDS_FOLDER/$fieldId/$THUMBNAIL_NAME"

            val photoRef = storage.reference.child(photoPath)
            val thumbRef = storage.reference.child(thumbPath)

            // Deletar ambos (ignorar erro se não existir)
            try { photoRef.delete().await() } catch (e: Exception) { /* ignore */ }
            try { thumbRef.delete().await() } catch (e: Exception) { /* ignore */ }

            Log.d(TAG, "Field photo deleted for field: $fieldId")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error deleting field photo", e)
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
