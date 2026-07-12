package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import com.futebadosparcas.platform.logging.PlatformLogger
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

            // Status comercial/publicacao
            publicationStatus = get<String?>("publication_status") ?: get<String?>("publicationStatus") ?: "DRAFT",
            commercialStatus = get<String?>("commercial_status") ?: get<String?>("commercialStatus") ?: "TRIAL",
            subscriptionStatus = get<String?>("subscription_status") ?: get<String?>("subscriptionStatus") ?: "TRIAL",
            billingPlanCode = get<String?>("billing_plan_code") ?: get<String?>("billingPlanCode"),
            billingPlanLabel = get<String?>("billing_plan_label") ?: get<String?>("billingPlanLabel"),
            billingCycle = get<String?>("billing_cycle") ?: get<String?>("billingCycle"),
            billingBaseFeeCents = get<Long?>("billing_base_fee_cents") ?: get<Long?>("billingBaseFeeCents"),
            monthlyFeeCents = get<Long?>("monthly_fee_cents") ?: get<Long?>("monthlyFeeCents"),
            billingDueDay = get<Long?>("billing_due_day")?.toInt() ?: get<Long?>("billingDueDay")?.toInt(),
            billingStartsAt = safeLongLocation("billing_starts_at") ?: safeLongLocation("billingStartsAt"),
            billingExpiresAt = safeLongLocation("billing_expires_at") ?: safeLongLocation("billingExpiresAt"),
            billingExceptionNote = get<String?>("billing_exception_note") ?: get<String?>("billingExceptionNote"),
            venueAccountId = get<String?>("venue_account_id") ?: get<String?>("venueAccountId"),
            venueAccountStatus = get<String?>("venue_account_status") ?: get<String?>("venueAccountStatus"),
            venueAccountChargeScope = get<String?>("venue_account_charge_scope") ?: get<String?>("venueAccountChargeScope"),
            venueAccountPlanCode = get<String?>("venue_account_plan_code") ?: get<String?>("venueAccountPlanCode"),
            venueAccountPlanLabel = get<String?>("venue_account_plan_label") ?: get<String?>("venueAccountPlanLabel"),
            venueAccountMonthlyTotalCents = get<Long?>("venue_account_monthly_total_cents")
                ?: get<Long?>("venueAccountMonthlyTotalCents"),
            venueAccountLinkedLocationsCount = get<Long?>("venue_account_linked_locations_count")?.toInt()
                ?: get<Long?>("venueAccountLinkedLocationsCount")?.toInt() ?: 0,
            venueAccountActiveFieldsCount = get<Long?>("venue_account_active_fields_count")?.toInt()
                ?: get<Long?>("venueAccountActiveFieldsCount")?.toInt() ?: 0,
            publishedAt = safeLongLocation("published_at") ?: safeLongLocation("publishedAt"),
            publishedBy = get<String?>("published_by") ?: get<String?>("publishedBy"),
            unpublishedReason = get<String?>("unpublished_reason") ?: get<String?>("unpublishedReason"),
            ownerNotes = get<String?>("owner_notes") ?: get<String?>("ownerNotes"),
            adminNotes = get<String?>("admin_notes") ?: get<String?>("adminNotes"),

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

            timeZone = get<String?>("time_zone") ?: get<String?>("timeZone"),

            // Dados denormalizados de Fields
            fieldCount = get<Long?>("field_count")?.toInt() ?: get<Long?>("fieldCount")?.toInt() ?: 0,
            activeFieldCount = get<Long?>("active_field_count")?.toInt() ?: get<Long?>("activeFieldCount")?.toInt() ?: 0,
            activeFieldTypes = (get<List<*>?>("active_field_types") ?: get<List<*>?>("activeFieldTypes"))
                ?.mapNotNull { it as? String } ?: emptyList(),
            activeFieldAmenities = (get<List<*>?>("active_field_amenities") ?: get<List<*>?>("activeFieldAmenities"))
                ?.mapNotNull { it as? String } ?: emptyList(),
            primaryFieldType = get<String?>("primary_field_type") ?: get<String?>("primaryFieldType"),
            hasActiveFields = get<Boolean?>("has_active_fields") ?: get<Boolean?>("hasActiveFields") ?: false,
            minHourlyPriceCents = get<Long?>("min_hourly_price_cents") ?: get<Long?>("minHourlyPriceCents"),
            averageHourlyPriceCents = get<Long?>("average_hourly_price_cents") ?: get<Long?>("averageHourlyPriceCents"),
            gamesCount = get<Long?>("games_count")?.toInt() ?: get<Long?>("gamesCount")?.toInt() ?: 0,
            finishedGamesCount = get<Long?>("finished_games_count")?.toInt()
                ?: get<Long?>("finishedGamesCount")?.toInt() ?: 0,
            upcomingGamesCount = get<Long?>("upcoming_games_count")?.toInt()
                ?: get<Long?>("upcomingGamesCount")?.toInt() ?: 0,
            gamesThisWeekCount = get<Long?>("games_this_week_count")?.toInt()
                ?: get<Long?>("gamesThisWeekCount")?.toInt() ?: 0,
            gamesLast30DaysCount = get<Long?>("games_last_30_days_count")?.toInt()
                ?: get<Long?>("gamesLast30DaysCount")?.toInt() ?: 0,
            lastGameAt = safeLongLocation("last_game_at") ?: safeLongLocation("lastGameAt"),
            lastActivityAt = safeLongLocation("last_activity_at") ?: safeLongLocation("lastActivityAt"),
            locationStatsUpdatedAt = safeLongLocation("location_stats_updated_at")
                ?: safeLongLocation("locationStatsUpdatedAt"),

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
            type = (get<String?>("type") ?: "SOCIETY").uppercase(),
            description = get<String?>("description"),
            photoUrl = get<String?>("photo_url") ?: get<String?>("photoUrl"),
            isActive = get<Boolean?>("is_active") ?: get<Boolean?>("isActive") ?: true,
            hourlyPrice = get<Double?>("hourly_price") ?: get<Double?>("hourlyPrice") ?: get<Double?>("price_per_hour") ?: get<Double?>("pricePerHour") ?: 0.0,
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
        PlatformLogger.e("LocationMapper", "LocationAuditLog deserialization error [id=$id]: ${e.message}", e)
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
    PlatformLogger.e("LocationMapper", "Location deserialization error [id=$documentId, owner=$ownerId]: ${error.message}", error)
}

/**
 * Registra erro de deserializacao de Field.
 */
internal fun logFieldDeserializationError(
    documentId: String,
    locationId: String?,
    error: Throwable
) {
    PlatformLogger.e("LocationMapper", "Field deserialization error [id=$documentId, locationId=$locationId]: ${error.message}", error)
}

/**
 * Registra erro de deserializacao de LocationReview.
 */
internal fun logLocationReviewDeserializationError(
    documentId: String,
    locationId: String?,
    error: Throwable
) {
    PlatformLogger.e("LocationMapper", "LocationReview deserialization error [id=$documentId, locationId=$locationId]: ${error.message}", error)
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
    PlatformLogger.e("LocationQuery", "Location query error [query=$queryName, $contextStr]: ${error.message}", error)
}

/**
 * Registra erro de atualizacao de Location.
 */
internal fun logLocationUpdateError(
    locationId: String,
    operation: String,
    error: Throwable
) {
    PlatformLogger.e("LocationUpdate", "Location $operation error [id=$locationId]: ${error.message}", error)
}
