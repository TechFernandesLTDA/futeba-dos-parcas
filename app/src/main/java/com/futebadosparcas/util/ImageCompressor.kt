package com.futebadosparcas.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.core.graphics.scale
import androidx.exifinterface.media.ExifInterface
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.IOException

/**
 * ImageCompressor - Utilitário para compressão de imagens antes do upload.
 *
 * Features:
 * - Compressão com controle de tamanho máximo em KB
 * - Redimensionamento automático mantendo aspect ratio
 * - Correção de orientação EXIF
 * - Compressão iterativa até atingir tamanho alvo
 * - Execução em IO dispatcher para não bloquear main thread
 *
 * Uso:
 * ```kotlin
 * val compressedBytes = ImageCompressor.compressImage(
 *     context = context,
 *     uri = selectedImageUri,
 *     maxSizeKb = 500 // 500KB
 * )
 *
 * // Upload dos bytes comprimidos
 * storageRef.putBytes(compressedBytes)
 * ```
 *
 * Parâmetros de compressão:
 * - maxSizeKb: Tamanho máximo em kilobytes (padrão: 500)
 * - maxWidth: Largura máxima em pixels (padrão: 1920)
 * - maxHeight: Altura máxima em pixels (padrão: 1080)
 * - initialQuality: Qualidade JPEG inicial (padrão: 90)
 * - minQuality: Qualidade JPEG mínima (padrão: 30)
 */
object ImageCompressor {

    // Configurações padrão
    private const val DEFAULT_MAX_SIZE_KB = 500
    private const val DEFAULT_MAX_WIDTH = 1920
    private const val DEFAULT_MAX_HEIGHT = 1080
    private const val DEFAULT_INITIAL_QUALITY = 90
    private const val DEFAULT_MIN_QUALITY = 30
    private const val QUALITY_STEP = 5

    /**
     * Comprime uma imagem a partir de uma URI.
     *
     * O algoritmo segue os seguintes passos:
     * 1. Decodifica a imagem
     * 2. Aplica correção de orientação EXIF
     * 3. Redimensiona se necessário (mantendo aspect ratio)
     * 4. Comprime iterativamente até atingir o tamanho máximo
     *
     * @param context Contexto Android para acessar ContentResolver
     * @param uri URI da imagem a ser comprimida
     * @param maxSizeKb Tamanho máximo desejado em KB (padrão: 500)
     * @param maxWidth Largura máxima em pixels (padrão: 1920)
     * @param maxHeight Altura máxima em pixels (padrão: 1080)
     * @param initialQuality Qualidade JPEG inicial, 0-100 (padrão: 90)
     * @param minQuality Qualidade JPEG mínima, 0-100 (padrão: 30)
     * @return ByteArray da imagem comprimida
     * @throws IOException Se houver erro ao ler ou processar a imagem
     */
    suspend fun compressImage(
        context: Context,
        uri: Uri,
        maxSizeKb: Int = DEFAULT_MAX_SIZE_KB,
        maxWidth: Int = DEFAULT_MAX_WIDTH,
        maxHeight: Int = DEFAULT_MAX_HEIGHT,
        initialQuality: Int = DEFAULT_INITIAL_QUALITY,
        minQuality: Int = DEFAULT_MIN_QUALITY
    ): ByteArray = withContext(Dispatchers.IO) {
        // Valida parâmetros
        require(maxSizeKb > 0) { "maxSizeKb deve ser maior que 0" }
        require(maxWidth > 0) { "maxWidth deve ser maior que 0" }
        require(maxHeight > 0) { "maxHeight deve ser maior que 0" }
        require(initialQuality in 1..100) { "initialQuality deve estar entre 1 e 100" }
        require(minQuality in 1..100) { "minQuality deve estar entre 1 e 100" }
        require(minQuality <= initialQuality) { "minQuality não pode ser maior que initialQuality" }

        val maxSizeBytes = maxSizeKb * 1024

        // Passo 1: Decodificar bitmap
        val bitmap = decodeBitmap(context, uri)
            ?: throw IOException("Falha ao decodificar imagem")

        try {
            // Passo 2: Corrigir orientação
            val rotatedBitmap = rotateIfRequired(context, bitmap, uri)

            // Passo 3: Redimensionar se necessário
            val resizedBitmap = resizeBitmap(rotatedBitmap, maxWidth, maxHeight)

            // Passo 4: Comprimir iterativamente
            val compressedBytes = compressIteratively(
                bitmap = resizedBitmap,
                maxSizeBytes = maxSizeBytes,
                initialQuality = initialQuality,
                minQuality = minQuality
            )

            // Limpar bitmaps
            if (rotatedBitmap != bitmap) {
                rotatedBitmap.recycle()
            }
            if (resizedBitmap != rotatedBitmap) {
                resizedBitmap.recycle()
            }
            bitmap.recycle()

            compressedBytes
        } catch (e: Exception) {
            bitmap.recycle()
            throw e
        }
    }

    /**
     * Comprime um Bitmap diretamente.
     *
     * Útil quando você já tem um Bitmap em memória.
     *
     * @param bitmap Bitmap a ser comprimido
     * @param maxSizeKb Tamanho máximo desejado em KB (padrão: 500)
     * @param initialQuality Qualidade JPEG inicial, 0-100 (padrão: 90)
     * @param minQuality Qualidade JPEG mínima, 0-100 (padrão: 30)
     * @return ByteArray da imagem comprimida
     */
    suspend fun compressBitmap(
        bitmap: Bitmap,
        maxSizeKb: Int = DEFAULT_MAX_SIZE_KB,
        initialQuality: Int = DEFAULT_INITIAL_QUALITY,
        minQuality: Int = DEFAULT_MIN_QUALITY
    ): ByteArray = withContext(Dispatchers.IO) {
        val maxSizeBytes = maxSizeKb * 1024

        compressIteratively(
            bitmap = bitmap,
            maxSizeBytes = maxSizeBytes,
            initialQuality = initialQuality,
            minQuality = minQuality
        )
    }

    /**
     * Calcula o tamanho estimado de uma imagem após compressão.
     *
     * Útil para preview antes do upload.
     *
     * @param context Contexto Android
     * @param uri URI da imagem
     * @param quality Qualidade JPEG para estimativa
     * @return Tamanho estimado em bytes
     */
    suspend fun estimateCompressedSize(
        context: Context,
        uri: Uri,
        quality: Int = DEFAULT_INITIAL_QUALITY
    ): Long = withContext(Dispatchers.IO) {
        val bitmap = decodeBitmap(context, uri) ?: return@withContext 0L

        try {
            val outputStream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream)
            outputStream.size().toLong()
        } finally {
            bitmap.recycle()
        }
    }

    /**
     * Decodifica uma imagem de URI para Bitmap.
     */
    private fun decodeBitmap(context: Context, uri: Uri): Bitmap? {
        return try {
            context.contentResolver.openInputStream(uri)?.use { inputStream ->
                BitmapFactory.decodeStream(inputStream)
            }
        } catch (e: Exception) {
            AppLogger.e("ImageCompressor", "Erro ao decodificar bitmap", e)
            null
        }
    }

    /**
     * Corrige a orientação da imagem baseado nos metadados EXIF.
     */
    private fun rotateIfRequired(context: Context, bitmap: Bitmap, uri: Uri): Bitmap {
        return try {
            context.contentResolver.openInputStream(uri)?.use { inputStream ->
                val exif = ExifInterface(inputStream)
                val orientation = exif.getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_UNDEFINED
                )

                when (orientation) {
                    ExifInterface.ORIENTATION_ROTATE_90 -> rotateBitmap(bitmap, 90f)
                    ExifInterface.ORIENTATION_ROTATE_180 -> rotateBitmap(bitmap, 180f)
                    ExifInterface.ORIENTATION_ROTATE_270 -> rotateBitmap(bitmap, 270f)
                    ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> flipBitmap(bitmap, horizontal = true)
                    ExifInterface.ORIENTATION_FLIP_VERTICAL -> flipBitmap(bitmap, horizontal = false)
                    else -> bitmap
                }
            } ?: bitmap
        } catch (e: Exception) {
            AppLogger.w("ImageCompressor") { "Não foi possível ler EXIF, usando imagem original" }
            bitmap
        }
    }

    /**
     * Rotaciona um bitmap pelo ângulo especificado.
     */
    private fun rotateBitmap(bitmap: Bitmap, degrees: Float): Bitmap {
        val matrix = Matrix()
        matrix.postRotate(degrees)
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    /**
     * Espelha um bitmap horizontal ou verticalmente.
     */
    private fun flipBitmap(bitmap: Bitmap, horizontal: Boolean): Bitmap {
        val matrix = Matrix()
        if (horizontal) {
            matrix.postScale(-1f, 1f, bitmap.width / 2f, bitmap.height / 2f)
        } else {
            matrix.postScale(1f, -1f, bitmap.width / 2f, bitmap.height / 2f)
        }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    /**
     * Redimensiona um bitmap mantendo o aspect ratio.
     */
    private fun resizeBitmap(bitmap: Bitmap, maxWidth: Int, maxHeight: Int): Bitmap {
        val width = bitmap.width
        val height = bitmap.height

        // Se já está dentro dos limites, retorna o original
        if (width <= maxWidth && height <= maxHeight) {
            return bitmap
        }

        // Calcula o fator de escala mantendo aspect ratio
        val scaleWidth = maxWidth.toFloat() / width
        val scaleHeight = maxHeight.toFloat() / height
        val scaleFactor = minOf(scaleWidth, scaleHeight)

        val newWidth = (width * scaleFactor).toInt()
        val newHeight = (height * scaleFactor).toInt()

        return bitmap.scale(newWidth, newHeight, true)
    }

    /**
     * Comprime iterativamente reduzindo a qualidade até atingir o tamanho alvo.
     */
    private fun compressIteratively(
        bitmap: Bitmap,
        maxSizeBytes: Int,
        initialQuality: Int,
        minQuality: Int
    ): ByteArray {
        var quality = initialQuality
        var outputBytes: ByteArray

        do {
            val outputStream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream)
            outputBytes = outputStream.toByteArray()

            // Se atingiu o tamanho desejado ou qualidade mínima, para
            if (outputBytes.size <= maxSizeBytes || quality <= minQuality) {
                break
            }

            // Reduz qualidade e tenta novamente
            quality -= QUALITY_STEP
        } while (quality >= minQuality)

        AppLogger.d("ImageCompressor") {
            "Comprimido: ${bitmap.width}x${bitmap.height}, " +
                    "qualidade: $quality%, " +
                    "tamanho: ${outputBytes.size / 1024}KB"
        }

        return outputBytes
    }
}

/**
 * Extension function para facilitar a compressão de imagens.
 *
 * Uso:
 * ```kotlin
 * val bytes = imageUri.compressForUpload(context)
 * ```
 */
suspend fun Uri.compressForUpload(
    context: Context,
    maxSizeKb: Int = 500
): ByteArray = ImageCompressor.compressImage(
    context = context,
    uri = this,
    maxSizeKb = maxSizeKb
)
