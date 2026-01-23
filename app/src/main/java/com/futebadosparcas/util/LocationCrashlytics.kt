package com.futebadosparcas.util

import android.util.Log
import com.google.firebase.crashlytics.FirebaseCrashlytics

/**
 * LocationCrashlytics
 *
 * Utilitario especializado para logging de erros de deserializacao e operacoes
 * relacionadas a Location no Firebase Crashlytics.
 *
 * Uso:
 * ```kotlin
 * try {
 *     val location = doc.toLocationOrNull()
 * } catch (e: Exception) {
 *     LocationCrashlytics.logDeserializationError(
 *         documentId = doc.id,
 *         error = e,
 *         context = mapOf("owner_id" to ownerId)
 *     )
 *     null
 * }
 * ```
 */
object LocationCrashlytics {

    private const val TAG = "LocationCrashlytics"

    private val crashlytics: FirebaseCrashlytics by lazy {
        FirebaseCrashlytics.getInstance()
    }

    /**
     * Registra erro de deserializacao de Location.
     *
     * @param documentId ID do documento Firestore
     * @param error Excecao capturada
     * @param context Contexto adicional (owner_id, field_name, etc.)
     */
    fun logDeserializationError(
        documentId: String,
        error: Throwable,
        context: Map<String, String> = emptyMap()
    ) {
        Log.e(TAG, "Erro de deserializacao de Location: $documentId", error)

        crashlytics.apply {
            setCustomKey("error_type", "location_deserialization")
            setCustomKey("location_id", documentId)

            context.forEach { (key, value) ->
                setCustomKey(key, value)
            }

            log("Location deserialization error for document: $documentId")
            recordException(error)
        }
    }

    /**
     * Registra erro de deserializacao de Field.
     *
     * @param documentId ID do documento Firestore
     * @param locationId ID do Location pai (se disponivel)
     * @param error Excecao capturada
     * @param context Contexto adicional
     */
    fun logFieldDeserializationError(
        documentId: String,
        locationId: String? = null,
        error: Throwable,
        context: Map<String, String> = emptyMap()
    ) {
        Log.e(TAG, "Erro de deserializacao de Field: $documentId", error)

        crashlytics.apply {
            setCustomKey("error_type", "field_deserialization")
            setCustomKey("field_id", documentId)
            locationId?.let { setCustomKey("location_id", it) }

            context.forEach { (key, value) ->
                setCustomKey(key, value)
            }

            log("Field deserialization error for document: $documentId")
            recordException(error)
        }
    }

    /**
     * Registra erro de deserializacao de LocationReview.
     *
     * @param documentId ID do documento Firestore
     * @param locationId ID do Location pai
     * @param error Excecao capturada
     */
    fun logReviewDeserializationError(
        documentId: String,
        locationId: String? = null,
        error: Throwable
    ) {
        Log.e(TAG, "Erro de deserializacao de LocationReview: $documentId", error)

        crashlytics.apply {
            setCustomKey("error_type", "location_review_deserialization")
            setCustomKey("review_id", documentId)
            locationId?.let { setCustomKey("location_id", it) }

            log("LocationReview deserialization error for document: $documentId")
            recordException(error)
        }
    }

    /**
     * Registra erro de query de Location.
     *
     * @param query Descricao da query (ex: "getAllLocations", "searchLocations:query")
     * @param error Excecao capturada
     * @param context Contexto adicional (filtros, parametros)
     */
    fun logQueryError(
        query: String,
        error: Throwable,
        context: Map<String, String> = emptyMap()
    ) {
        Log.e(TAG, "Erro de query de Location: $query", error)

        crashlytics.apply {
            setCustomKey("error_type", "location_query")
            setCustomKey("query_name", query)

            context.forEach { (key, value) ->
                setCustomKey(key, value)
            }

            log("Location query error: $query")
            recordException(error)
        }
    }

    /**
     * Registra erro de atualizacao de Location.
     *
     * @param locationId ID do Location sendo atualizado
     * @param error Excecao capturada
     * @param operation Tipo de operacao (update, create, delete)
     */
    fun logUpdateError(
        locationId: String,
        error: Throwable,
        operation: String = "update"
    ) {
        Log.e(TAG, "Erro de $operation de Location: $locationId", error)

        crashlytics.apply {
            setCustomKey("error_type", "location_$operation")
            setCustomKey("location_id", locationId)
            setCustomKey("operation", operation)

            log("Location $operation error for: $locationId")
            recordException(error)
        }
    }

    /**
     * Registra erro de atualizacao de Field.
     *
     * @param fieldId ID do Field sendo atualizado
     * @param locationId ID do Location pai (se disponivel)
     * @param error Excecao capturada
     * @param operation Tipo de operacao (update, create, delete)
     */
    fun logFieldUpdateError(
        fieldId: String,
        locationId: String? = null,
        error: Throwable,
        operation: String = "update"
    ) {
        Log.e(TAG, "Erro de $operation de Field: $fieldId", error)

        crashlytics.apply {
            setCustomKey("error_type", "field_$operation")
            setCustomKey("field_id", fieldId)
            locationId?.let { setCustomKey("location_id", it) }
            setCustomKey("operation", operation)

            log("Field $operation error for: $fieldId")
            recordException(error)
        }
    }

    /**
     * Registra erro de upload de foto de Location/Field.
     *
     * @param entityType Tipo de entidade (location ou field)
     * @param entityId ID da entidade
     * @param error Excecao capturada
     */
    fun logPhotoUploadError(
        entityType: String,
        entityId: String,
        error: Throwable
    ) {
        Log.e(TAG, "Erro de upload de foto de $entityType: $entityId", error)

        crashlytics.apply {
            setCustomKey("error_type", "${entityType}_photo_upload")
            setCustomKey("entity_type", entityType)
            setCustomKey("entity_id", entityId)

            log("$entityType photo upload error for: $entityId")
            recordException(error)
        }
    }

    /**
     * Registra erro generico relacionado a Location.
     *
     * @param operation Descricao da operacao
     * @param error Excecao capturada
     * @param context Contexto adicional
     */
    fun logError(
        operation: String,
        error: Throwable,
        context: Map<String, String> = emptyMap()
    ) {
        Log.e(TAG, "Erro de Location ($operation)", error)

        crashlytics.apply {
            setCustomKey("error_type", "location_generic")
            setCustomKey("operation", operation)

            context.forEach { (key, value) ->
                setCustomKey(key, value)
            }

            log("Location error in: $operation")
            recordException(error)
        }
    }
}
