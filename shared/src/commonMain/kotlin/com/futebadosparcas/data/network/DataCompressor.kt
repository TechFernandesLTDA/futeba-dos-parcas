package com.futebadosparcas.data.network

import kotlinx.datetime.Clock

/**
 * Utilitários de Compressão de Dados para transferência de rede.
 * Minimiza uso de banda em conexões lentas ou limitadas.
 */

// ==================== Models ====================

/**
 * Algoritmo de compressão.
 */
enum class CompressionAlgorithm {
    NONE,       // Sem compressão
    GZIP,       // GZIP padrão
    DEFLATE,    // Deflate
    LZ4         // LZ4 (mais rápido, menos compressão)
}

/**
 * Configuração de compressão.
 */
data class CompressionConfig(
    val algorithm: CompressionAlgorithm = CompressionAlgorithm.GZIP,
    val level: Int = 6,                     // 1-9, 6 é padrão
    val minSizeToCompress: Int = 1024,      // Não comprimir se menor que 1KB
    val enableForUpload: Boolean = true,
    val enableForDownload: Boolean = true
)

/**
 * Resultado da compressão.
 */
data class CompressionResult(
    val originalSize: Int,
    val compressedSize: Int,
    val algorithm: CompressionAlgorithm,
    val compressionTimeMs: Long
) {
    val compressionRatio: Float
        get() = if (originalSize > 0) {
            1 - (compressedSize.toFloat() / originalSize)
        } else 0f

    val savedBytes: Int
        get() = originalSize - compressedSize
}

/**
 * Estatísticas de compressão.
 */
data class CompressionStats(
    val totalOriginalBytes: Long = 0,
    val totalCompressedBytes: Long = 0,
    val totalOperations: Int = 0,
    val averageCompressionRatio: Float = 0f
) {
    val totalSavedBytes: Long
        get() = totalOriginalBytes - totalCompressedBytes
}

// ==================== Interface ====================

/**
 * Interface do compressor de dados.
 */
interface DataCompressor {

    /**
     * Comprime dados.
     */
    fun compress(data: ByteArray): ByteArray

    /**
     * Descomprime dados.
     */
    fun decompress(data: ByteArray): ByteArray

    /**
     * Comprime com informações detalhadas.
     */
    fun compressWithStats(data: ByteArray): Pair<ByteArray, CompressionResult>

    /**
     * Verifica se dados estão comprimidos.
     */
    fun isCompressed(data: ByteArray): Boolean

    /**
     * Retorna estatísticas acumuladas.
     */
    fun getStats(): CompressionStats

    /**
     * Reseta estatísticas.
     */
    fun resetStats()
}

// ==================== Implementation ====================

/**
 * Implementação padrão do compressor.
 * Nota: Em Kotlin Multiplatform, a implementação real varia por plataforma.
 * Esta é a interface comum.
 */
class DefaultDataCompressor(
    private val config: CompressionConfig = CompressionConfig()
) : DataCompressor {

    private var stats = CompressionStats()

    override fun compress(data: ByteArray): ByteArray {
        if (data.size < config.minSizeToCompress) {
            return data
        }

        // Implementação simplificada - em produção, usar java.util.zip no Android
        // ou biblioteca específica da plataforma
        return when (config.algorithm) {
            CompressionAlgorithm.NONE -> data
            CompressionAlgorithm.GZIP -> compressGzip(data)
            CompressionAlgorithm.DEFLATE -> compressDeflate(data)
            CompressionAlgorithm.LZ4 -> data // Requer biblioteca externa
        }
    }

    override fun decompress(data: ByteArray): ByteArray {
        if (!isCompressed(data)) {
            return data
        }

        return when {
            isGzipCompressed(data) -> decompressGzip(data)
            isDeflateCompressed(data) -> decompressDeflate(data)
            else -> data
        }
    }

    override fun compressWithStats(data: ByteArray): Pair<ByteArray, CompressionResult> {
        val startTime = Clock.System.now().toEpochMilliseconds()
        val compressed = compress(data)
        val endTime = Clock.System.now().toEpochMilliseconds()

        val result = CompressionResult(
            originalSize = data.size,
            compressedSize = compressed.size,
            algorithm = if (compressed.size < data.size) config.algorithm else CompressionAlgorithm.NONE,
            compressionTimeMs = endTime - startTime
        )

        // Atualiza estatísticas
        updateStats(result)

        return Pair(compressed, result)
    }

    override fun isCompressed(data: ByteArray): Boolean {
        return isGzipCompressed(data) || isDeflateCompressed(data)
    }

    override fun getStats(): CompressionStats = stats

    override fun resetStats() {
        stats = CompressionStats()
    }

    // ==================== Internal ====================

    private fun compressGzip(data: ByteArray): ByteArray {
        // Placeholder - implementação real usa java.util.zip.GZIPOutputStream no Android
        // Para KMP, usar expect/actual
        return data
    }

    private fun compressDeflate(data: ByteArray): ByteArray {
        // Placeholder - implementação real usa java.util.zip.Deflater no Android
        return data
    }

    private fun decompressGzip(data: ByteArray): ByteArray {
        // Placeholder - implementação real usa java.util.zip.GZIPInputStream
        return data
    }

    private fun decompressDeflate(data: ByteArray): ByteArray {
        // Placeholder - implementação real usa java.util.zip.Inflater
        return data
    }

    private fun isGzipCompressed(data: ByteArray): Boolean {
        // Magic bytes do GZIP: 1f 8b
        return data.size >= 2 &&
               data[0] == 0x1f.toByte() &&
               data[1] == 0x8b.toByte()
    }

    private fun isDeflateCompressed(data: ByteArray): Boolean {
        // Deflate não tem magic bytes definitivos
        // Heurística simplificada
        return false
    }

    private fun updateStats(result: CompressionResult) {
        val newTotal = stats.totalOperations + 1
        val newOriginalBytes = stats.totalOriginalBytes + result.originalSize
        val newCompressedBytes = stats.totalCompressedBytes + result.compressedSize

        stats = CompressionStats(
            totalOriginalBytes = newOriginalBytes,
            totalCompressedBytes = newCompressedBytes,
            totalOperations = newTotal,
            averageCompressionRatio = if (newOriginalBytes > 0) {
                1 - (newCompressedBytes.toFloat() / newOriginalBytes)
            } else 0f
        )
    }
}

// ==================== Utilities ====================

/**
 * Helpers para compressão de JSON.
 */
object JsonCompressor {

    /**
     * Minifica JSON removendo espaços desnecessários.
     */
    fun minify(json: String): String {
        return json
            .replace(Regex("\\s+"), " ")
            .replace(": ", ":")
            .replace(", ", ",")
            .replace("{ ", "{")
            .replace(" }", "}")
            .replace("[ ", "[")
            .replace(" ]", "]")
            .trim()
    }

    /**
     * Estima economia de compressão para JSON.
     */
    fun estimateCompressionRatio(json: String): Float {
        // JSON geralmente comprime bem (40-70%)
        val size = json.length
        return when {
            size < 100 -> 0.1f
            size < 1000 -> 0.4f
            size < 10000 -> 0.6f
            else -> 0.7f
        }
    }
}

/**
 * Helpers para compressão de imagens.
 */
object ImageCompressor {

    /**
     * Calcula qualidade ideal baseado no tamanho alvo.
     */
    fun calculateOptimalQuality(
        currentSizeKB: Int,
        targetSizeKB: Int,
        currentQuality: Int = 100
    ): Int {
        if (currentSizeKB <= targetSizeKB) return currentQuality

        val ratio = targetSizeKB.toFloat() / currentSizeKB
        val estimatedQuality = (currentQuality * ratio * 1.2f).toInt() // 1.2x para margem

        return estimatedQuality.coerceIn(10, 95)
    }

    /**
     * Estima tamanho após redimensionamento.
     */
    fun estimateSizeAfterResize(
        currentSizeKB: Int,
        currentWidth: Int,
        currentHeight: Int,
        newWidth: Int,
        newHeight: Int
    ): Int {
        val currentPixels = currentWidth * currentHeight
        val newPixels = newWidth * newHeight

        if (currentPixels == 0) return currentSizeKB

        val ratio = newPixels.toFloat() / currentPixels
        return (currentSizeKB * ratio).toInt()
    }
}
