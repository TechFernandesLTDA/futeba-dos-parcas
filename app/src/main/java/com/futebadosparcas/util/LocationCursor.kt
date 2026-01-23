package com.futebadosparcas.util

import android.util.Base64
import com.futebadosparcas.domain.model.LocationSortField
import org.json.JSONObject

/**
 * Utilitário para codificação e decodificação de cursores de paginação para Locations.
 *
 * O cursor armazena informações suficientes para reproduzir a posição exata na query do Firestore.
 * Usa Base64 para codificação segura em URLs e transferência de dados.
 *
 * Estrutura do cursor decodificado (JSON):
 * {
 *   "documentPath": "locations/abc123",
 *   "sortField": "NAME",
 *   "lastValue": "Nome do Local",
 *   "timestamp": 1700000000000
 * }
 *
 * @see CursorData
 * @see LocationSortField
 */
object LocationCursor {

    private const val TAG = "LocationCursor"
    private const val KEY_DOCUMENT_PATH = "documentPath"
    private const val KEY_SORT_FIELD = "sortField"
    private const val KEY_LAST_VALUE = "lastValue"
    private const val KEY_TIMESTAMP = "timestamp"

    /**
     * Tempo de expiração do cursor em milissegundos (15 minutos).
     * Cursores expirados devem ser ignorados para evitar inconsistências.
     */
    private const val CURSOR_EXPIRATION_MS = 15 * 60 * 1000L

    /**
     * Codifica dados de cursor para uma string Base64.
     *
     * @param documentPath Caminho do documento no Firestore (ex: "locations/abc123")
     * @param sortField Campo usado para ordenação na query
     * @param lastValue Valor do campo de ordenação no último documento
     * @return String codificada em Base64 representando o cursor
     */
    fun encode(
        documentPath: String,
        sortField: LocationSortField,
        lastValue: Any?
    ): String {
        val json = JSONObject().apply {
            put(KEY_DOCUMENT_PATH, documentPath)
            put(KEY_SORT_FIELD, sortField.name)
            put(KEY_LAST_VALUE, lastValue?.toString() ?: "")
            put(KEY_TIMESTAMP, System.currentTimeMillis())
        }

        return Base64.encodeToString(
            json.toString().toByteArray(Charsets.UTF_8),
            Base64.URL_SAFE or Base64.NO_WRAP
        )
    }

    /**
     * Decodifica uma string de cursor para CursorData.
     *
     * @param cursor String codificada do cursor
     * @return CursorData se o cursor for válido, null caso contrário
     * @throws CursorExpiredException Se o cursor expirou
     * @throws InvalidCursorException Se o cursor é inválido ou corrompido
     */
    fun decode(cursor: String): CursorData {
        try {
            val jsonString = String(
                Base64.decode(cursor, Base64.URL_SAFE),
                Charsets.UTF_8
            )

            val json = JSONObject(jsonString)

            // Verificar expiração
            val timestamp = json.optLong(KEY_TIMESTAMP, 0)
            if (timestamp > 0 && System.currentTimeMillis() - timestamp > CURSOR_EXPIRATION_MS) {
                throw CursorExpiredException("Cursor expirado após ${CURSOR_EXPIRATION_MS / 1000 / 60} minutos")
            }

            return CursorData(
                documentPath = json.getString(KEY_DOCUMENT_PATH),
                sortField = LocationSortField.fromString(json.optString(KEY_SORT_FIELD, "NAME")),
                lastValue = json.optString(KEY_LAST_VALUE).takeIf { it.isNotEmpty() },
                timestamp = timestamp
            )
        } catch (e: CursorExpiredException) {
            throw e
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao decodificar cursor: ${e.message}", e)
            throw InvalidCursorException("Cursor inválido ou corrompido", e)
        }
    }

    /**
     * Tenta decodificar um cursor de forma segura.
     *
     * @param cursor String codificada do cursor
     * @return CursorData se válido, null se inválido ou expirado
     */
    fun decodeOrNull(cursor: String?): CursorData? {
        if (cursor.isNullOrBlank()) return null
        return try {
            decode(cursor)
        } catch (e: Exception) {
            AppLogger.w(TAG) { "Cursor inválido ou expirado, ignorando: ${e.message}" }
            null
        }
    }

    /**
     * Verifica se um cursor ainda é válido (não expirado).
     *
     * @param cursor String codificada do cursor
     * @return true se válido, false caso contrário
     */
    fun isValid(cursor: String?): Boolean {
        if (cursor.isNullOrBlank()) return false
        return decodeOrNull(cursor) != null
    }
}

/**
 * Dados decodificados de um cursor de paginação.
 *
 * @property documentPath Caminho completo do documento no Firestore
 * @property sortField Campo usado para ordenação
 * @property lastValue Último valor do campo de ordenação (usado com startAfter)
 * @property timestamp Timestamp de criação do cursor
 */
data class CursorData(
    val documentPath: String,
    val sortField: LocationSortField,
    val lastValue: String?,
    val timestamp: Long
) {
    /**
     * Extrai o ID do documento do caminho.
     * Ex: "locations/abc123" -> "abc123"
     */
    val documentId: String
        get() = documentPath.substringAfterLast("/")

    /**
     * Extrai a coleção do caminho.
     * Ex: "locations/abc123" -> "locations"
     */
    val collection: String
        get() = documentPath.substringBeforeLast("/")
}

/**
 * Exceção lançada quando um cursor expirou.
 */
class CursorExpiredException(message: String) : Exception(message)

/**
 * Exceção lançada quando um cursor é inválido ou corrompido.
 */
class InvalidCursorException(message: String, cause: Throwable? = null) : Exception(message, cause)
