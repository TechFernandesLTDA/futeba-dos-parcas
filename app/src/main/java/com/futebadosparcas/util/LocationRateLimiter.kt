package com.futebadosparcas.util

import android.content.SharedPreferences
import androidx.core.content.edit
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Rate limiter para criacao de locais.
 *
 * Previne spam e uso abusivo limitando a criacao de locais a um
 * maximo de [MAX_LOCATIONS_PER_HOUR] por hora por usuario.
 *
 * Os timestamps de criacao sao armazenados de forma segura em
 * EncryptedSharedPreferences para persistir entre sessoes.
 *
 * Uso:
 * ```kotlin
 * if (rateLimiter.canCreateLocation()) {
 *     // Criar local
 *     rateLimiter.recordCreation()
 * } else {
 *     // Mostrar erro com rateLimiter.getResetTimeMs()
 * }
 * ```
 *
 * @param preferencesManager Gerenciador de preferencias encriptadas
 */
@Singleton
class LocationRateLimiter @Inject constructor(
    private val preferencesManager: PreferencesManager
) {
    companion object {
        /** Numero maximo de locais que podem ser criados por hora */
        const val MAX_LOCATIONS_PER_HOUR = 10

        /** Janela de rate limit em milissegundos (1 hora) */
        const val RATE_LIMIT_WINDOW_MS = 3600000L

        /** Chave para armazenamento dos timestamps */
        private const val KEY_CREATION_TIMESTAMPS = "location_creation_timestamps"
    }

    // Acesso direto ao SharedPreferences encriptado via PreferencesManager
    private val encryptedPrefs: SharedPreferences
        get() = preferencesManager.getSecurePreferences()

    /**
     * Verifica se o usuario pode criar um novo local.
     *
     * @return true se ainda houver quota disponivel, false se o limite foi atingido
     */
    fun canCreateLocation(): Boolean {
        val timestamps = getCreationTimestamps()
        return timestamps.size < MAX_LOCATIONS_PER_HOUR
    }

    /**
     * Registra a criacao de um local.
     *
     * Deve ser chamado APOS a criacao bem-sucedida de um local.
     * Adiciona o timestamp atual a lista de criacoes.
     */
    fun recordCreation() {
        val currentTimestamps = getCreationTimestampsRaw()
        val now = System.currentTimeMillis()
        val updatedTimestamps = currentTimestamps + now

        saveTimestamps(updatedTimestamps)
        AppLogger.d("LocationRateLimiter") {
            "Criacao registrada. Quota restante: ${MAX_LOCATIONS_PER_HOUR - getCreationTimestamps().size}"
        }
    }

    /**
     * Retorna a quantidade de criacoes ainda disponiveis na janela atual.
     *
     * @return Numero de locais que ainda podem ser criados
     */
    fun getRemainingQuota(): Int {
        val timestamps = getCreationTimestamps()
        return (MAX_LOCATIONS_PER_HOUR - timestamps.size).coerceAtLeast(0)
    }

    /**
     * Retorna o tempo em milissegundos ate o reset do proximo slot de quota.
     *
     * Se a quota nao estiver esgotada, retorna 0.
     * Se estiver esgotada, retorna o tempo ate o timestamp mais antigo expirar.
     *
     * @return Tempo em milissegundos ate liberacao de quota, ou 0 se houver quota
     */
    fun getResetTimeMs(): Long {
        val timestamps = getCreationTimestamps()

        if (timestamps.size < MAX_LOCATIONS_PER_HOUR) {
            return 0L
        }

        // O timestamp mais antigo eh o que vai expirar primeiro
        val oldestTimestamp = timestamps.minOrNull() ?: return 0L
        val expirationTime = oldestTimestamp + RATE_LIMIT_WINDOW_MS
        val now = System.currentTimeMillis()

        return (expirationTime - now).coerceAtLeast(0L)
    }

    /**
     * Retorna os timestamps de criacao validos (dentro da janela de rate limit).
     *
     * Remove automaticamente timestamps expirados antes de retornar.
     *
     * @return Lista de timestamps de criacao ainda validos
     */
    private fun getCreationTimestamps(): List<Long> {
        val allTimestamps = getCreationTimestampsRaw()
        val validTimestamps = cleanOldTimestamps(allTimestamps)

        // Salvar timestamps limpos se houve mudanca
        if (validTimestamps.size != allTimestamps.size) {
            saveTimestamps(validTimestamps)
        }

        return validTimestamps
    }

    private val gson = Gson()
    private val listType = object : TypeToken<List<Long>>() {}.type

    /**
     * Retorna os timestamps brutos sem limpeza.
     */
    private fun getCreationTimestampsRaw(): List<Long> {
        return try {
            val jsonString = encryptedPrefs.getString(KEY_CREATION_TIMESTAMPS, null)
            if (jsonString.isNullOrBlank()) {
                emptyList()
            } else {
                gson.fromJson<List<Long>>(jsonString, listType) ?: emptyList()
            }
        } catch (e: Exception) {
            AppLogger.e("LocationRateLimiter", "Erro ao ler timestamps", e)
            emptyList()
        }
    }

    /**
     * Remove timestamps que estao fora da janela de rate limit.
     *
     * @param timestamps Lista de timestamps a filtrar
     * @return Lista de timestamps ainda validos
     */
    private fun cleanOldTimestamps(timestamps: List<Long>): List<Long> {
        val cutoffTime = System.currentTimeMillis() - RATE_LIMIT_WINDOW_MS
        return timestamps.filter { it > cutoffTime }
    }

    /**
     * Salva os timestamps no armazenamento encriptado.
     */
    private fun saveTimestamps(timestamps: List<Long>) {
        try {
            val jsonString = gson.toJson(timestamps)
            encryptedPrefs.edit { putString(KEY_CREATION_TIMESTAMPS, jsonString) }
        } catch (e: Exception) {
            AppLogger.e("LocationRateLimiter", "Erro ao salvar timestamps", e)
        }
    }

    /**
     * Limpa todos os timestamps de criacao.
     *
     * Usado principalmente para testes ou reset administrativo.
     */
    fun clearTimestamps() {
        encryptedPrefs.edit { remove(KEY_CREATION_TIMESTAMPS) }
        AppLogger.d("LocationRateLimiter") { "Timestamps limpos" }
    }

    /**
     * Retorna informacoes de debug sobre o rate limiter.
     */
    fun getDebugInfo(): String {
        val timestamps = getCreationTimestamps()
        val remaining = getRemainingQuota()
        val resetTime = getResetTimeMs()

        return buildString {
            appendLine("=== LocationRateLimiter Debug ===")
            appendLine("Criacoes na ultima hora: ${timestamps.size}")
            appendLine("Quota restante: $remaining")
            appendLine("Tempo para reset: ${resetTime / 1000}s")
            appendLine("Timestamps ativos:")
            timestamps.forEachIndexed { index, ts ->
                val age = (System.currentTimeMillis() - ts) / 1000
                appendLine("  [$index] ${age}s atras")
            }
        }
    }
}
