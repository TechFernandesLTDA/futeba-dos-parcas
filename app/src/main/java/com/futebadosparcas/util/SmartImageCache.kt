package com.futebadosparcas.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.URL
import java.security.MessageDigest

/**
 * Cache Inteligente de Imagens.
 * Implementa cache de 2 níveis (memória + disco) com gerenciamento automático.
 */

// ==================== Models ====================

/**
 * Configuração do cache de imagens.
 */
data class ImageCacheConfig(
    val memoryCacheSizeMB: Int = 32,
    val diskCacheSizeMB: Int = 100,
    val maxImageWidth: Int = 1080,
    val maxImageHeight: Int = 1920,
    val compressionQuality: Int = 85,       // 0-100
    val cacheDirectory: String = "image_cache",
    val maxAgeHours: Int = 168              // 7 dias
)

/**
 * Estatísticas do cache.
 */
data class CacheStats(
    val memoryCacheSize: Int,
    val memoryCacheHits: Int,
    val memoryCacheMisses: Int,
    val diskCacheSize: Long,
    val diskCacheHits: Int,
    val diskCacheMisses: Int
) {
    val memoryHitRate: Float
        get() = if (memoryCacheHits + memoryCacheMisses > 0) {
            memoryCacheHits.toFloat() / (memoryCacheHits + memoryCacheMisses)
        } else 0f

    val diskHitRate: Float
        get() = if (diskCacheHits + diskCacheMisses > 0) {
            diskCacheHits.toFloat() / (diskCacheHits + diskCacheMisses)
        } else 0f
}

/**
 * Resultado do carregamento de imagem.
 */
sealed class ImageLoadResult {
    data class Success(val bitmap: Bitmap, val source: ImageSource) : ImageLoadResult()
    data class Error(val message: String) : ImageLoadResult()
}

enum class ImageSource {
    MEMORY_CACHE,
    DISK_CACHE,
    NETWORK
}

// ==================== Main Cache Class ====================

/**
 * Cache inteligente de imagens com dois níveis.
 */
class SmartImageCache(
    private val context: Context,
    private val config: ImageCacheConfig = ImageCacheConfig()
) {
    // Cache de memória (L1)
    private val memoryCache: LruCache<String, Bitmap>

    // Estatísticas
    private var memoryCacheHits = 0
    private var memoryCacheMisses = 0
    private var diskCacheHits = 0
    private var diskCacheMisses = 0

    // Diretório de cache em disco
    private val cacheDir: File

    init {
        // Configura cache de memória
        val maxMemory = (Runtime.getRuntime().maxMemory() / 1024).toInt()
        val cacheSize = minOf(
            config.memoryCacheSizeMB * 1024,
            maxMemory / 4  // No máximo 1/4 da memória disponível
        )

        memoryCache = object : LruCache<String, Bitmap>(cacheSize) {
            override fun sizeOf(key: String, bitmap: Bitmap): Int {
                return bitmap.byteCount / 1024
            }
        }

        // Configura diretório de cache em disco
        cacheDir = File(context.cacheDir, config.cacheDirectory)
        if (!cacheDir.exists()) {
            cacheDir.mkdirs()
        }
    }

    // ==================== Public API ====================

    /**
     * Carrega imagem com cache inteligente.
     */
    suspend fun loadImage(url: String): ImageLoadResult {
        val key = generateKey(url)

        // Tenta cache de memória (L1)
        memoryCache.get(key)?.let { bitmap ->
            memoryCacheHits++
            return ImageLoadResult.Success(bitmap, ImageSource.MEMORY_CACHE)
        }
        memoryCacheMisses++

        // Tenta cache de disco (L2)
        val diskBitmap = loadFromDisk(key)
        if (diskBitmap != null) {
            diskCacheHits++
            // Promove para cache de memória
            memoryCache.put(key, diskBitmap)
            return ImageLoadResult.Success(diskBitmap, ImageSource.DISK_CACHE)
        }
        diskCacheMisses++

        // Carrega da rede
        return try {
            val networkBitmap = loadFromNetwork(url)
            if (networkBitmap != null) {
                // Salva nos dois níveis de cache
                memoryCache.put(key, networkBitmap)
                saveToDisk(key, networkBitmap)
                ImageLoadResult.Success(networkBitmap, ImageSource.NETWORK)
            } else {
                ImageLoadResult.Error("Failed to decode image")
            }
        } catch (e: Exception) {
            ImageLoadResult.Error(e.message ?: "Unknown error")
        }
    }

    /**
     * Pré-carrega uma lista de URLs.
     */
    suspend fun preload(urls: List<String>) {
        urls.forEach { url ->
            loadImage(url)
        }
    }

    /**
     * Verifica se uma imagem está em cache.
     */
    fun isCached(url: String): Boolean {
        val key = generateKey(url)
        return memoryCache.get(key) != null || getDiskFile(key).exists()
    }

    /**
     * Remove uma imagem específica do cache.
     */
    fun evict(url: String) {
        val key = generateKey(url)
        memoryCache.remove(key)
        getDiskFile(key).delete()
    }

    /**
     * Limpa todo o cache de memória.
     */
    fun clearMemoryCache() {
        memoryCache.evictAll()
    }

    /**
     * Limpa todo o cache de disco.
     */
    suspend fun clearDiskCache() = withContext(Dispatchers.IO) {
        cacheDir.listFiles()?.forEach { it.delete() }
    }

    /**
     * Limpa cache de disco antigo.
     */
    suspend fun trimDiskCache() = withContext(Dispatchers.IO) {
        val cutoffTime = System.currentTimeMillis() - (config.maxAgeHours * 60 * 60 * 1000L)
        cacheDir.listFiles()?.forEach { file ->
            if (file.lastModified() < cutoffTime) {
                file.delete()
            }
        }

        // Se ainda estiver acima do limite, remove os mais antigos
        val maxSize = config.diskCacheSizeMB * 1024L * 1024L
        var currentSize = cacheDir.listFiles()?.sumOf { it.length() } ?: 0L

        if (currentSize > maxSize) {
            cacheDir.listFiles()
                ?.sortedBy { it.lastModified() }
                ?.forEach { file ->
                    if (currentSize > maxSize) {
                        currentSize -= file.length()
                        file.delete()
                    }
                }
        }
    }

    /**
     * Retorna estatísticas do cache.
     */
    fun getStats(): CacheStats {
        return CacheStats(
            memoryCacheSize = memoryCache.size(),
            memoryCacheHits = memoryCacheHits,
            memoryCacheMisses = memoryCacheMisses,
            diskCacheSize = cacheDir.listFiles()?.sumOf { it.length() } ?: 0L,
            diskCacheHits = diskCacheHits,
            diskCacheMisses = diskCacheMisses
        )
    }

    // ==================== Internal ====================

    private fun generateKey(url: String): String {
        val digest = MessageDigest.getInstance("MD5")
        digest.update(url.toByteArray())
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun getDiskFile(key: String): File {
        return File(cacheDir, "$key.jpg")
    }

    private suspend fun loadFromDisk(key: String): Bitmap? = withContext(Dispatchers.IO) {
        val file = getDiskFile(key)
        if (file.exists()) {
            try {
                BitmapFactory.decodeFile(file.absolutePath)
            } catch (e: Exception) {
                file.delete()
                null
            }
        } else null
    }

    private suspend fun saveToDisk(key: String, bitmap: Bitmap) = withContext(Dispatchers.IO) {
        try {
            val file = getDiskFile(key)
            FileOutputStream(file).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, config.compressionQuality, out)
            }
        } catch (e: Exception) {
            // Ignora erros de salvamento
        }
    }

    private suspend fun loadFromNetwork(url: String): Bitmap? = withContext(Dispatchers.IO) {
        try {
            val connection = URL(url).openConnection()
            connection.connectTimeout = 10000
            connection.readTimeout = 15000

            connection.getInputStream().use { input ->
                // Primeiro, obtém dimensões
                val options = BitmapFactory.Options().apply {
                    inJustDecodeBounds = true
                }
                BitmapFactory.decodeStream(input, null, options)

                // Calcula sample size para redimensionar
                options.inSampleSize = calculateInSampleSize(
                    options.outWidth,
                    options.outHeight,
                    config.maxImageWidth,
                    config.maxImageHeight
                )
                options.inJustDecodeBounds = false

                // Reabre conexão e decodifica
                val newConnection = URL(url).openConnection()
                newConnection.getInputStream().use { newInput ->
                    BitmapFactory.decodeStream(newInput, null, options)
                }
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun calculateInSampleSize(
        actualWidth: Int,
        actualHeight: Int,
        reqWidth: Int,
        reqHeight: Int
    ): Int {
        var inSampleSize = 1
        if (actualHeight > reqHeight || actualWidth > reqWidth) {
            val halfHeight = actualHeight / 2
            val halfWidth = actualWidth / 2
            while ((halfHeight / inSampleSize) >= reqHeight &&
                   (halfWidth / inSampleSize) >= reqWidth) {
                inSampleSize *= 2
            }
        }
        return inSampleSize
    }
}

// ==================== Singleton Helper ====================

/**
 * Singleton do SmartImageCache para uso global.
 */
object ImageCacheManager {
    private var instance: SmartImageCache? = null

    fun initialize(context: Context, config: ImageCacheConfig = ImageCacheConfig()) {
        if (instance == null) {
            instance = SmartImageCache(context.applicationContext, config)
        }
    }

    fun getInstance(): SmartImageCache {
        return instance ?: throw IllegalStateException(
            "ImageCacheManager not initialized. Call initialize() first."
        )
    }
}
