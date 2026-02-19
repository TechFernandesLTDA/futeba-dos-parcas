package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import dev.gitlive.firebase.firestore.DocumentSnapshot
import dev.gitlive.firebase.firestore.Timestamp

// ========== MAPEAMENTO HELPERS ==========

/**
 * Converte DocumentSnapshot para Location.
 */
internal fun DocumentSnapshot.toLocationOrNull(): Location? {
    if (!exists) return null

    return try {
        Location(
            id = id,
            name = get<String?>("name") ?: "",
            address = get<String?>("address") ?: "",

            // Endereço Estruturado
            cep = get<String?>("cep") ?: "",
            street = get<String?>("street") ?: "",
            number = get<String?>("number") ?: "",
            complement = get<String?>("complement") ?: "",
            district = get<String?>("district") ?: "",
            city = get<String?>("city") ?: "",
            state = get<String?>("state") ?: "",
            country = get<String?>("country") ?: "Brasil",

            // Localização detalhada
            neighborhood = get<String?>("neighborhood") ?: "",
            region = get<String?>("region") ?: "",
            latitude = get<Double?>("latitude"),
            longitude = get<Double?>("longitude"),
            placeId = get<String?>("place_id") ?: get<String?>("placeId"),

            // Proprietário
            ownerId = get<String?>("owner_id") ?: get<String?>("ownerId") ?: "",
            managers = (get<List<*>?>("managers"))?.mapNotNull { it as? String } ?: emptyList(),
            isVerified = get<Boolean?>("is_verified") ?: get<Boolean?>("isVerified") ?: false,
            isActive = get<Boolean?>("is_active") ?: get<Boolean?>("isActive") ?: true,

            // Avaliação
            rating = get<Double?>("rating") ?: 0.0,
            ratingCount = get<Long?>("rating_count")?.toInt() ?: get<Long?>("ratingCount")?.toInt() ?: 0,

            // Descrição e mídia
            description = get<String?>("description") ?: "",
            photoUrl = get<String?>("photo_url") ?: get<String?>("photoUrl"),

            // Infraestrutura
            amenities = (get<List<*>?>("amenities"))?.mapNotNull { it as? String } ?: emptyList(),

            // Contato
            phone = get<String?>("phone"),
            website = get<String?>("website"),
            instagram = get<String?>("instagram"),

            // Horário de funcionamento
            openingTime = get<String?>("opening_time") ?: get<String?>("openingTime") ?: "08:00",
            closingTime = get<String?>("closing_time") ?: get<String?>("closingTime") ?: "23:00",
            operatingDays = (get<List<*>?>("operating_days") ?: get<List<*>?>("operatingDays"))
                ?.mapNotNull { (it as? Number)?.toInt() } ?: listOf(1, 2, 3, 4, 5, 6, 7),
            minGameDurationMinutes = get<Long?>("min_game_duration_minutes")?.toInt()
                ?: get<Long?>("minGameDurationMinutes")?.toInt() ?: 60,

            // Dados denormalizados de Fields
            fieldCount = get<Long?>("field_count")?.toInt() ?: get<Long?>("fieldCount")?.toInt() ?: 0,
            primaryFieldType = get<String?>("primary_field_type") ?: get<String?>("primaryFieldType"),
            hasActiveFields = get<Boolean?>("has_active_fields") ?: get<Boolean?>("hasActiveFields") ?: false,

            createdAt = safeLongLocation("created_at") ?: safeLongLocation("createdAt"),
            updatedAt = safeLongLocation("updated_at") ?: safeLongLocation("updatedAt")
        )
    } catch (e: Exception) {
        logLocationDeserializationError(id, get<String?>("owner_id"), e)
        null
    }
}

/**
 * Converte DocumentSnapshot para Field.
 */
internal fun DocumentSnapshot.toFieldOrNull(): Field? {
    if (!exists) return null

    return try {
        Field(
            id = id,
            locationId = get<String?>("location_id") ?: get<String?>("locationId") ?: "",
            name = get<String?>("name") ?: "",
            type = get<String?>("type") ?: "SOCIETY",
            description = get<String?>("description"),
            photoUrl = get<String?>("photo_url") ?: get<String?>("photoUrl"),
            isActive = get<Boolean?>("is_active") ?: get<Boolean?>("isActive") ?: true,
            hourlyPrice = get<Double?>("hourly_price") ?: get<Double?>("hourlyPrice") ?: 0.0,
            photos = (get<List<*>?>("photos"))?.mapNotNull { it as? String } ?: emptyList(),
            managers = (get<List<*>?>("managers"))?.mapNotNull { it as? String } ?: emptyList(),
            surface = get<String?>("surface"),
            isCovered = get<Boolean?>("is_covered") ?: get<Boolean?>("isCovered") ?: false,
            dimensions = get<String?>("dimensions")
        )
    } catch (e: Exception) {
        logFieldDeserializationError(id, get<String?>("location_id"), e)
        null
    }
}

/**
 * Converte DocumentSnapshot para LocationReview.
 */
internal fun DocumentSnapshot.toLocationReviewOrNull(): LocationReview? {
    if (!exists) return null

    return try {
        LocationReview(
            id = id,
            locationId = get<String?>("location_id") ?: get<String?>("locationId") ?: "",
            userId = get<String?>("user_id") ?: get<String?>("userId") ?: "",
            userName = get<String?>("user_name") ?: get<String?>("userName") ?: "",
            userPhotoUrl = get<String?>("user_photo_url") ?: get<String?>("userPhotoUrl"),
            rating = get<Double?>("rating")?.toFloat() ?: get<Long?>("rating")?.toFloat() ?: 0f,
            comment = get<String?>("comment") ?: "",
            createdAt = safeLongLocation("created_at")
        )
    } catch (e: Exception) {
        logLocationReviewDeserializationError(id, get<String?>("location_id"), e)
        null
    }
}

/**
 * Converte DocumentSnapshot para LocationAuditLog.
 */
internal fun DocumentSnapshot.toLocationAuditLogOrNull(): LocationAuditLog? {
    if (!exists) return null

    return try {
        val changesMap = (get<Map<*, *>?>("changes"))?.mapNotNull { (key, value) ->
            val fieldKey = key as? String ?: return@mapNotNull null
            val fieldValue = value as? Map<*, *> ?: return@mapNotNull null
            val before = fieldValue["before"] as? String
            val after = fieldValue["after"] as? String
            fieldKey to FieldChange(before = before, after = after)
        }?.toMap()

        LocationAuditLog(
            id = id,
            locationId = get<String?>("location_id") ?: "",
            userId = get<String?>("user_id") ?: "",
            userName = get<String?>("user_name") ?: "",
            action = LocationAuditAction.valueOf(
                get<String?>("action")?.uppercase() ?: "UPDATE"
            ),
            changes = changesMap,
            timestamp = safeLongLocation("timestamp") ?: 0L
        )
    } catch (e: Exception) {
        println("FirebaseDataSource: Erro ao deserializar LocationAuditLog $id: ${e.message}")
        null
    }
}

/**
 * Helper para pegar Long de forma segura para campos de Location.
 * Trata Number, Timestamp do GitLive ou String.
 */
internal fun DocumentSnapshot.safeLongLocation(field: String): Long? {
    val value = get<Any?>(field)
    return when (value) {
        is Number -> value.toLong()
        is Timestamp -> value.seconds * 1000L
        is String -> value.toLongOrNull()
        else -> null
    }
}

// ========== HELPERS DE LOG ==========

/**
 * Registra erro de deserializacao de Location.
 */
internal fun logLocationDeserializationError(
    documentId: String,
    ownerId: String?,
    error: Throwable
) {
    println("FirebaseDataSource: Location deserialization error [id=$documentId, owner=$ownerId]: ${error.message}")
}

/**
 * Registra erro de deserializacao de Field.
 */
internal fun logFieldDeserializationError(
    documentId: String,
    locationId: String?,
    error: Throwable
) {
    println("FirebaseDataSource: Field deserialization error [id=$documentId, locationId=$locationId]: ${error.message}")
}

/**
 * Registra erro de deserializacao de LocationReview.
 */
internal fun logLocationReviewDeserializationError(
    documentId: String,
    locationId: String?,
    error: Throwable
) {
    println("FirebaseDataSource: LocationReview deserialization error [id=$documentId, locationId=$locationId]: ${error.message}")
}

/**
 * Registra erro de query de Location.
 */
internal fun logLocationQueryError(
    queryName: String,
    error: Throwable,
    context: Map<String, String> = emptyMap()
) {
    val contextStr = if (context.isNotEmpty()) {
        context.entries.joinToString(", ") { "${it.key}=${it.value}" }
    } else ""
    println("FirebaseDataSource: Location query error [query=$queryName, $contextStr]: ${error.message}")
}

/**
 * Registra erro de atualizacao de Location.
 */
internal fun logLocationUpdateError(
    locationId: String,
    operation: String,
    error: Throwable
) {
    println("FirebaseDataSource: Location $operation error [id=$locationId]: ${error.message}")
}
