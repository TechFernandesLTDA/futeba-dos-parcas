package com.futebadosparcas.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.core.graphics.scale
import android.media.ExifInterface
import android.net.Uri
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Image Helper
 *
 * Provides image processing utilities like resizing, compression, and rotation.
 * Optimizes images before upload to reduce storage and bandwidth costs.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var imageHelper: ImageHelper
 *
 * val optimizedUri = imageHelper.optimizeImage(
 *     originalUri,
 *     maxWidth = 1080,
 *     quality = 85
 * )
 * ```
 */
@Singleton
class ImageHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    companion object {
        const val DEFAULT_MAX_WIDTH = 1080
        const val DEFAULT_MAX_HEIGHT = 1920
        const val DEFAULT_QUALITY = 85
        const val PROFILE_PICTURE_SIZE = 512
    }

    /**
     * Optimize image for upload
     */
    fun optimizeImage(
        imageUri: Uri,
        maxWidth: Int = DEFAULT_MAX_WIDTH,
        maxHeight: Int = DEFAULT_MAX_HEIGHT,
        quality: Int = DEFAULT_QUALITY
    ): Uri? {
        return try {
            val inputStream = context.contentResolver.openInputStream(imageUri)
            val bitmap = BitmapFactory.decodeStream(inputStream)
            inputStream?.close()

            // Auto-rotate based on EXIF
            val rotatedBitmap = rotateImageIfRequired(bitmap, imageUri)

            // Resize if needed
            val resizedBitmap = resizeBitmap(rotatedBitmap, maxWidth, maxHeight)

            // Compress and save to file
            val outputFile = File(context.cacheDir, "optimized_${System.currentTimeMillis()}.jpg")
            val outputStream = outputFile.outputStream()
            resizedBitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream)
            outputStream.close()

            // Clean up
            if (rotatedBitmap != bitmap) {
                rotatedBitmap.recycle()
            }
            if (resizedBitmap != rotatedBitmap) {
                resizedBitmap.recycle()
            }
            bitmap.recycle()

            Uri.fromFile(outputFile)
        } catch (e: Exception) {
            AppLogger.e("ImageHelper", "Error optimizing image: ${e.message}", e)
            null
        }
    }

    /**
     * Resize bitmap while maintaining aspect ratio
     */
    private fun resizeBitmap(bitmap: Bitmap, maxWidth: Int, maxHeight: Int): Bitmap {
        val width = bitmap.width
        val height = bitmap.height

        if (width <= maxWidth && height <= maxHeight) {
            return bitmap
        }

        val ratio = minOf(maxWidth.toFloat() / width, maxHeight.toFloat() / height)
        val newWidth = (width * ratio).toInt()
        val newHeight = (height * ratio).toInt()

        return bitmap.scale(newWidth, newHeight, true)
    }

    /**
     * Rotate bitmap based on EXIF orientation
     */
    private fun rotateImageIfRequired(bitmap: Bitmap, imageUri: Uri): Bitmap {
        val inputStream = context.contentResolver.openInputStream(imageUri) ?: return bitmap

        return try {
            val exif = ExifInterface(inputStream)
            val orientation = exif.getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_UNDEFINED
            )

            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> rotateBitmap(bitmap, 90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> rotateBitmap(bitmap, 180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> rotateBitmap(bitmap, 270f)
                else -> bitmap
            }
        } catch (e: IOException) {
            bitmap
        } finally {
            inputStream.close()
        }
    }

    /**
     * Rotate bitmap by degrees
     */
    private fun rotateBitmap(bitmap: Bitmap, degrees: Float): Bitmap {
        val matrix = Matrix()
        matrix.postRotate(degrees)
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    /**
     * Convert bitmap to byte array
     */
    fun bitmapToByteArray(bitmap: Bitmap, quality: Int = DEFAULT_QUALITY): ByteArray {
        val outputStream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream)
        return outputStream.toByteArray()
    }

    /**
     * Optimize profile picture (square crop + resize to 512x512)
     */
    fun optimizeProfilePicture(imageUri: Uri): Uri? {
        return try {
            val inputStream = context.contentResolver.openInputStream(imageUri)
            val bitmap = BitmapFactory.decodeStream(inputStream)
            inputStream?.close()

            // Auto-rotate
            val rotatedBitmap = rotateImageIfRequired(bitmap, imageUri)

            // Center crop to square
            val size = minOf(rotatedBitmap.width, rotatedBitmap.height)
            val x = (rotatedBitmap.width - size) / 2
            val y = (rotatedBitmap.height - size) / 2
            val squareBitmap = Bitmap.createBitmap(rotatedBitmap, x, y, size, size)

            // Resize to profile size
            val resizedBitmap = squareBitmap.scale(
                PROFILE_PICTURE_SIZE,
                PROFILE_PICTURE_SIZE,
                true
            )

            // Save
            val outputFile = File(context.cacheDir, "profile_${System.currentTimeMillis()}.jpg")
            val outputStream = outputFile.outputStream()
            resizedBitmap.compress(Bitmap.CompressFormat.JPEG, 90, outputStream)
            outputStream.close()

            // Clean up
            bitmap.recycle()
            if (rotatedBitmap != bitmap) rotatedBitmap.recycle()
            if (squareBitmap != rotatedBitmap) squareBitmap.recycle()
            if (resizedBitmap != squareBitmap) resizedBitmap.recycle()

            Uri.fromFile(outputFile)
        } catch (e: Exception) {
            AppLogger.e("ImageHelper", "Error optimizing profile picture: ${e.message}", e)
            null
        }
    }

    /**
     * Clear optimized image cache
     */
    fun clearImageCache() {
        context.cacheDir.listFiles()?.forEach { file ->
            if (file.name.startsWith("optimized_") || file.name.startsWith("profile_")) {
                file.delete()
            }
        }
    }
}
