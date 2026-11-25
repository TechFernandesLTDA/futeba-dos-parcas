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
            name = tryGet<String>("name") ?: "",
            address = tryGet<String>("address") ?: "",

            // Endereço Estruturado
            cep = tryGet<String>("cep") ?: "",
            street = tryGet<String>("street") ?: "",
            number = tryGet<String>("number") ?: "",
            complement = tryGet<String>("complement") ?: "",
            district = tryGet<String>("district") ?: "",
            city = tryGet<String>("city") ?: "",
            state = tryGet<String>("state") ?: "",
            country = tryGet<String>("country") ?: "Brasil",

            // Localização detalhada
            neighborhood = tryGet<String>("neighborhood") ?: "",
            region = tryGet<String>("region") ?: "",
            latitude = tryGet<Double>("latitude"),
            longitude = tryGet<Double>("longitude"),
            placeId = tryGet<String>("place_id") ?: tryGet<String>("placeId"),

            // Proprietário
            ownerId = tryGet<String>("owner_id") ?: tryGet<String>("ownerId") ?: "",
            managers = (getStringList("managers"))?.mapNotNull { it as? String } ?: emptyList(),
            isVerified = tryGet<Boolean>("is_verified") ?: tryGet<Boolean>("isVerified") ?: false,
            isActive = tryGet<Boolean>("is_active") ?: tryGet<Boolean>("isActive") ?: true,

            // Status comercial/publicacao
            publicationStatus = tryGet<String>("publication_status") ?: tryGet<String>("publicationStatus") ?: "DRAFT",
            commercialStatus = tryGet<String>("commercial_status") ?: tryGet<String>("commercialStatus") ?: "TRIAL",
            subscriptionStatus = tryGet<String>("subscription_status") ?: tryGet<String>("subscriptionStatus") ?: "TRIAL",
            billingPlanCode = tryGet<String>("billing_plan_code") ?: tryGet<String>("billingPlanCode"),
            billingPlanLabel = tryGet<String>("billing_plan_label") ?: tryGet<String>("billingPlanLabel"),
            billingCycle = tryGet<String>("billing_cycle") ?: tryGet<String>("billingCycle"),
            billingBaseFeeCents = tryGet<Long>("billing_base_fee_cents") ?: tryGet<Long>("billingBaseFeeCents"),
            monthlyFeeCents = tryGet<Long>("monthly_fee_cents") ?: tryGet<Long>("monthlyFeeCents"),
            billingDueDay = tryGet<Long>("billing_due_day")?.toInt() ?: tryGet<Long>("billingDueDay")?.toInt(),
            billingStartsAt = safeLongLocation("billing_starts_at") ?: safeLongLocation("billingStartsAt"),
            billingExpiresAt = safeLongLocation("billing_expires_at") ?: safeLongLocation("billingExpiresAt"),
            billingExceptionNote = tryGet<String>("billing_exception_note") ?: tryGet<String>("billingExceptionNote"),
            venueAccountId = tryGet<String>("venue_account_id") ?: tryGet<String>("venueAccountId"),
            venueAccountStatus = tryGet<String>("venue_account_status") ?: tryGet<String>("venueAccountStatus"),
            venueAccountChargeScope = tryGet<String>("venue_account_charge_scope") ?: tryGet<String>("venueAccountChargeScope"),
            venueAccountPlanCode = tryGet<String>("venue_account_plan_code") ?: tryGet<String>("venueAccountPlanCode"),
            venueAccountPlanLabel = tryGet<String>("venue_account_plan_label") ?: tryGet<String>("venueAccountPlanLabel"),
            venueAccountMonthlyTotalCents = tryGet<Long>("venue_account_monthly_total_cents")
                ?: tryGet<Long>("venueAccountMonthlyTotalCents"),
            venueAccountLinkedLocationsCount = tryGet<Long>("venue_account_linked_locations_count")?.toInt()
                ?: tryGet<Long>("venueAccountLinkedLocationsCount")?.toInt() ?: 0,
            venueAccountActiveFieldsCount = tryGet<Long>("venue_account_active_fields_count")?.toInt()
                ?: tryGet<Long>("venueAccountActiveFieldsCount")?.toInt() ?: 0,
            publishedAt = safeLongLocation("published_at") ?: safeLongLocation("publishedAt"),
            publishedBy = tryGet<String>("published_by") ?: tryGet<String>("publishedBy"),
            unpublishedReason = tryGet<String>("unpublished_reason") ?: tryGet<String>("unpublishedReason"),
            ownerNotes = tryGet<String>("owner_notes") ?: tryGet<String>("ownerNotes"),
            adminNotes = tryGet<String>("admin_notes") ?: tryGet<String>("adminNotes"),

            // Avaliação
            rating = tryGet<Double>("rating") ?: 0.0,
            ratingCount = tryGet<Long>("rating_count")?.toInt() ?: tryGet<Long>("ratingCount")?.toInt() ?: 0,

            // Descrição e mídia
            description = tryGet<String>("description") ?: "",
            photoUrl = tryGet<String>("photo_url") ?: tryGet<String>("photoUrl"),

            // Infraestrutura
            amenities = (getStringList("amenities"))?.mapNotNull { it as? String } ?: emptyList(),

            // Contato
            phone = tryGet<String>("phone"),
            website = tryGet<String>("website"),
            instagram = tryGet<String>("instagram"),

            // Horário de funcionamento
            openingTime = tryGet<String>("opening_time") ?: tryGet<String>("openingTime") ?: "08:00",
            closingTime = tryGet<String>("closing_time") ?: tryGet<String>("closingTime") ?: "23:00",
            operatingDays = (getIntList("operating_days") ?: getIntList("operatingDays"))
                ?.mapNotNull { (it as? Number)?.toInt() } ?: listOf(1, 2, 3, 4, 5, 6, 7),
            minGameDurationMinutes = tryGet<Long>("min_game_duration_minutes")?.toInt()
                ?: tryGet<Long>("minGameDurationMinutes")?.toInt() ?: 60,

            timeZone = tryGet<String>("time_zone") ?: tryGet<String>("timeZone"),

            // Dados denormalizados de Fields
            fieldCount = tryGet<Long>("field_count")?.toInt() ?: tryGet<Long>("fieldCount")?.toInt() ?: 0,
            activeFieldCount = tryGet<Long>("active_field_count")?.toInt() ?: tryGet<Long>("activeFieldCount")?.toInt() ?: 0,
            activeFieldTypes = (getStringList("active_field_types") ?: getStringList("activeFieldTypes"))
                ?.mapNotNull { it as? String } ?: emptyList(),
            activeFieldAmenities = (getStringList("active_field_amenities") ?: getStringList("activeFieldAmenities"))
                ?.mapNotNull { it as? String } ?: emptyList(),
            primaryFieldType = tryGet<String>("primary_field_type") ?: tryGet<String>("primaryFieldType"),
            hasActiveFields = tryGet<Boolean>("has_active_fields") ?: tryGet<Boolean>("hasActiveFields") ?: false,
            minHourlyPriceCents = tryGet<Long>("min_hourly_price_cents") ?: tryGet<Long>("minHourlyPriceCents"),
            averageHourlyPriceCents = tryGet<Long>("average_hourly_price_cents") ?: tryGet<Long>("averageHourlyPriceCents"),
            gamesCount = tryGet<Long>("games_count")?.toInt() ?: tryGet<Long>("gamesCount")?.toInt() ?: 0,
            finishedGamesCount = tryGet<Long>("finished_games_count")?.toInt()
                ?: tryGet<Long>("finishedGamesCount")?.toInt() ?: 0,
            upcomingGamesCount = tryGet<Long>("upcoming_games_count")?.toInt()
                ?: tryGet<Long>("upcomingGamesCount")?.toInt() ?: 0,
            gamesThisWeekCount = tryGet<Long>("games_this_week_count")?.toInt()
                ?: tryGet<Long>("gamesThisWeekCount")?.toInt() ?: 0,
            gamesLast30DaysCount = tryGet<Long>("games_last_30_days_count")?.toInt()
                ?: tryGet<Long>("gamesLast30DaysCount")?.toInt() ?: 0,
            lastGameAt = safeLongLocation("last_game_at") ?: safeLongLocation("lastGameAt"),
            lastActivityAt = safeLongLocation("last_activity_at") ?: safeLongLocation("lastActivityAt"),
            locationStatsUpdatedAt = safeLongLocation("location_stats_updated_at")
                ?: safeLongLocation("locationStatsUpdatedAt"),

            createdAt = safeLongLocation("created_at") ?: safeLongLocation("createdAt"),
            updatedAt = safeLongLocation("updated_at") ?: safeLongLocation("updatedAt")
        )
    } catch (e: Exception) {
        logLocationDeserializationError(id, tryGet<String>("owner_id"), e)
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
            locationId = tryGet<String>("location_id") ?: tryGet<String>("locationId") ?: "",
            name = tryGet<String>("name") ?: "",
            type = (tryGet<String>("type") ?: "SOCIETY").uppercase(),
            description = tryGet<String>("description"),
            photoUrl = tryGet<String>("photo_url") ?: tryGet<String>("photoUrl"),
            isActive = tryGet<Boolean>("is_active") ?: tryGet<Boolean>("isActive") ?: true,
            hourlyPrice = tryGet<Double>("hourly_price") ?: tryGet<Double>("hourlyPrice") ?: tryGet<Double>("price_per_hour") ?: tryGet<Double>("pricePerHour") ?: 0.0,
            photos = (getStringList("photos"))?.mapNotNull { it as? String } ?: emptyList(),
            managers = (getStringList("managers"))?.mapNotNull { it as? String } ?: emptyList(),
            surface = tryGet<String>("surface"),
            isCovered = tryGet<Boolean>("is_covered") ?: tryGet<Boolean>("isCovered") ?: false,
            dimensions = tryGet<String>("dimensions")
        )
    } catch (e: Exception) {
        logFieldDeserializationError(id, tryGet<String>("location_id"), e)
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
            locationId = tryGet<String>("location_id") ?: tryGet<String>("locationId") ?: "",
            userId = tryGet<String>("user_id") ?: tryGet<String>("userId") ?: "",
            userName = tryGet<String>("user_name") ?: tryGet<String>("userName") ?: "",
            userPhotoUrl = tryGet<String>("user_photo_url") ?: tryGet<String>("userPhotoUrl"),
            rating = tryGet<Double>("rating")?.toFloat() ?: tryGet<Long>("rating")?.toFloat() ?: 0f,
            comment = tryGet<String>("comment") ?: "",
            createdAt = safeLongLocation("created_at")
        )
    } catch (e: Exception) {
        logLocationReviewDeserializationError(id, tryGet<String>("location_id"), e)
        null
    }
}

/**
 * Converte DocumentSnapshot para LocationAuditLog.
 */
internal fun DocumentSnapshot.toLocationAuditLogOrNull(): LocationAuditLog? {
    if (!exists) return null

    return try {
        val changesMap = (getLooseMap("changes"))?.mapNotNull { (key, value) ->
            val fieldKey = key as? String ?: return@mapNotNull null
            val fieldValue = value as? Map<*, *> ?: return@mapNotNull null
            val before = fieldValue["before"] as? String
            val after = fieldValue["after"] as? String
            fieldKey to FieldChange(before = before, after = after)
        }?.toMap()

        LocationAuditLog(
            id = id,
            locationId = tryGet<String>("location_id") ?: "",
            userId = tryGet<String>("user_id") ?: "",
            userName = tryGet<String>("user_name") ?: "",
            action = LocationAuditAction.valueOf(
                tryGet<String>("action")?.uppercase() ?: "UPDATE"
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
    val value = getScalar(field)
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
