package com.futebadosparcas.util

import android.content.Context
import android.net.Uri
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * File Helper
 *
 * Provides file management utilities for cache, storage, and temporary files.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var fileHelper: FileHelper
 *
 * // Create temporary file
 * val tempFile = fileHelper.createTempFile("photo", ".jpg")
 *
 * // Clear old cache files
 * fileHelper.clearOldCacheFiles(maxAgeDays = 7)
 * ```
 */
@Singleton
class FileHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    /**
     * Create temporary file in cache directory
     */
    fun createTempFile(prefix: String, suffix: String): File {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        return File.createTempFile("${prefix}_$timestamp", suffix, context.cacheDir)
    }

    /**
     * Create file from URI (copy to cache)
     */
    fun createFileFromUri(uri: Uri, fileName: String): File? {
        return try {
            val inputStream = context.contentResolver.openInputStream(uri) ?: return null
            val outputFile = File(context.cacheDir, fileName)

            FileOutputStream(outputFile).use { output ->
                inputStream.use { input ->
                    input.copyTo(output)
                }
            }

            outputFile
        } catch (e: Exception) {
            android.util.Log.e("FileHelper", "Error creating file from URI", e)
            null
        }
    }

    /**
     * Get file size in human-readable format
     */
    fun getFileSizeFormatted(file: File): String {
        val bytes = file.length()
        return when {
            bytes < 1024 -> "$bytes B"
            bytes < 1024 * 1024 -> "${bytes / 1024} KB"
            bytes < 1024 * 1024 * 1024 -> "${bytes / (1024 * 1024)} MB"
            else -> "${bytes / (1024 * 1024 * 1024)} GB"
        }
    }

    /**
     * Clear old cache files (older than maxAgeDays)
     */
    fun clearOldCacheFiles(maxAgeDays: Int = 7): Int {
        val maxAgeMillis = maxAgeDays * 24 * 60 * 60 * 1000L
        val now = System.currentTimeMillis()
        var deletedCount = 0

        context.cacheDir.listFiles()?.forEach { file ->
            if (now - file.lastModified() > maxAgeMillis) {
                if (file.delete()) {
                    deletedCount++
                }
            }
        }

        return deletedCount
    }

    /**
     * Get cache directory size
     */
    fun getCacheSize(): Long {
        return context.cacheDir.walkTopDown()
            .filter { it.isFile }
            .map { it.length() }
            .sum()
    }

    /**
     * Get cache size formatted
     */
    fun getCacheSizeFormatted(): String {
        val bytes = getCacheSize()
        return when {
            bytes < 1024 * 1024 -> "${bytes / 1024} KB"
            bytes < 1024 * 1024 * 1024 -> "${bytes / (1024 * 1024)} MB"
            else -> "${bytes / (1024 * 1024 * 1024)} GB"
        }
    }

    /**
     * Clear all cache files
     */
    fun clearAllCache(): Boolean {
        return context.cacheDir.deleteRecursively()
    }

    /**
     * Save text to file
     */
    fun saveTextToFile(text: String, fileName: String, directory: File = context.filesDir): File {
        val file = File(directory, fileName)
        file.writeText(text)
        return file
    }

    /**
     * Read text from file
     */
    fun readTextFromFile(file: File): String? {
        return try {
            file.readText()
        } catch (e: Exception) {
            android.util.Log.e("FileHelper", "Error reading file", e)
            null
        }
    }

    /**
     * Delete file safely
     */
    fun deleteFileSafely(file: File): Boolean {
        return try {
            file.delete()
        } catch (e: Exception) {
            android.util.Log.e("FileHelper", "Error deleting file", e)
            false
        }
    }

    /**
     * Check if file exists and is readable
     */
    fun isFileValid(file: File): Boolean {
        return file.exists() && file.canRead() && file.length() > 0
    }
}
