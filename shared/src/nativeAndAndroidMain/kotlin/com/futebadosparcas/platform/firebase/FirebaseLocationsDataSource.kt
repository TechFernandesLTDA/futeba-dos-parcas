package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.FirebaseAuth
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.*
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.datetime.Clock
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

// ========== CURSOR PAGINATION CLASSES ==========

private data class CursorInfo(
    val documentPath: String, val sortField: LocationSortField,
    val lastValue: String?, val timestamp: Long
) {
    val documentId: String get() = documentPath.substringAfterLast("/")
}

class CursorDecodingException(message: String) : Exception(message)
class CursorMismatchException(message: String) : Exception(message)
class CursorDocumentNotFoundException(message: String) : Exception(message)

internal class FirebaseLocationsDataSource(
    private val firestore: FirebaseFirestore = Firebase.firestore,
    private val auth: FirebaseAuth = Firebase.auth
) {
// ========== LOCATIONS ==========

    suspend fun getAllLocations(): Result<List<Location>> {
        return try {
            Result.success(firestore.collection("locations").orderBy("name").limit(500).get().documents.mapNotNull { it.toLocationOrNull() })
        } catch (e: Exception) {
            logLocationQueryError("getAllLocations", e)
            Result.failure(e)
        }
    }

    suspend fun getLocationsByCity(city: String, state: String?): Result<List<Location>> {
        return try {
            var query = firestore.collection("locations").where { "city" equalTo city }
            if (!state.isNullOrBlank()) query = query.where { "state" equalTo state }
            Result.success(query.limit(LOCATION_SCOPED_QUERY_LIMIT).get().documents.mapNotNull { it.toLocationOrNull() })
        } catch (e: Exception) {
            logLocationQueryError("getLocationsByCity", e, mapOf("city" to city, "state" to (state ?: "")))
            Result.failure(e)
        }
    }

    suspend fun getLocationsByStates(states: List<String>): Result<List<Location>> {
        return try {
            val values = states.map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(10)
            if (values.isEmpty()) return Result.success(emptyList())
            val query = if (values.size == 1) {
                firestore.collection("locations").where { "state" equalTo values.first() }
            } else {
                firestore.collection("locations").where { "state" inArray values }
            }
            Result.success(query.limit(LOCATION_SCOPED_QUERY_LIMIT).get().documents.mapNotNull { it.toLocationOrNull() })
        } catch (e: Exception) {
            logLocationQueryError("getLocationsByStates", e, mapOf("states" to states.joinToString(",")))
            Result.failure(e)
        }
    }

    suspend fun getLocationsInLatitudeBand(minLatitude: Double, maxLatitude: Double): Result<List<Location>> {
        return try {
            val query = firestore.collection("locations")
                .where { "latitude" greaterThanOrEqualTo minLatitude }
                .where { "latitude" lessThanOrEqualTo maxLatitude }
            Result.success(query.limit(LOCATION_SCOPED_QUERY_LIMIT).get().documents.mapNotNull { it.toLocationOrNull() })
        } catch (e: Exception) {
            logLocationQueryError("getLocationsInLatitudeBand", e, mapOf("min" to minLatitude.toString(), "max" to maxLatitude.toString()))
            Result.failure(e)
        }
    }

    suspend fun getLocationsWithPagination(limit: Int, lastLocationName: String?): Result<List<Location>> {
        return try {
            var query = firestore.collection("locations").orderBy("name").limit(limit)
            if (lastLocationName != null) query = query.startAfter(lastLocationName)
            Result.success(query.get().documents.mapNotNull { it.toLocationOrNull() })
        } catch (e: Exception) {
            logLocationQueryError("getLocationsWithPagination", e, mapOf("limit" to limit.toString()))
            Result.failure(e)
        }
    }

    suspend fun getLocationsPaginated(pageSize: Int, cursor: String?, sortBy: LocationSortField): Result<PaginatedResult<Location>> {
        return try {
            val effectivePageSize = pageSize.coerceIn(1, 50)
            var query = firestore.collection("locations").orderBy(sortBy.firestoreField, Direction.ASCENDING).limit(effectivePageSize + 1)
            if (!cursor.isNullOrBlank()) {
                val cursorData = decodeCursor(cursor) ?: return Result.failure(CursorDecodingException("Cursor inválido ou expirado"))
                if (cursorData.sortField != sortBy) return Result.failure(CursorMismatchException("Campo de ordenação do cursor não corresponde ao solicitado"))
                val anchorDoc = firestore.collection("locations").document(cursorData.documentId).get()
                if (!anchorDoc.exists) return Result.failure(CursorDocumentNotFoundException("Documento do cursor não existe mais: ${cursorData.documentId}"))
                query = query.startAfter(anchorDoc)
            }
            val allDocs = query.get().documents
            val hasMore = allDocs.size > effectivePageSize
            val docsToReturn = if (hasMore) allDocs.take(effectivePageSize) else allDocs
            val locations = docsToReturn.mapNotNull { it.toLocationOrNull() }
            val nextCursor = if (hasMore && docsToReturn.isNotEmpty()) {
                val lastDoc = docsToReturn.last()
                val lastValue = when (sortBy) {
                    LocationSortField.NAME -> lastDoc.get<String?>("name")
                    LocationSortField.CITY -> lastDoc.get<String?>("city")
                    LocationSortField.RATING -> lastDoc.get<Double?>("rating")?.toString()
                    LocationSortField.CREATED_AT -> lastDoc.get<Long?>("createdAt")?.toString()
                }
                encodeCursor(lastDoc.reference.path, sortBy, lastValue)
            } else null
            Result.success(PaginatedResult(items = locations, cursor = nextCursor, hasMore = hasMore))
        } catch (e: CursorDecodingException) { Result.failure(e)
        } catch (e: CursorMismatchException) { Result.failure(e)
        } catch (e: CursorDocumentNotFoundException) { Result.failure(e)
        } catch (e: Exception) {
            logLocationQueryError("getLocationsPaginated", e, mapOf("pageSize" to pageSize.toString(), "sortBy" to sortBy.name))
            Result.failure(e)
        }
    }

    @OptIn(ExperimentalEncodingApi::class)
    private fun encodeCursor(documentPath: String, sortField: LocationSortField, lastValue: Any?): String {
        val cursorStr = "$documentPath|${sortField.name}|${lastValue?.toString() ?: ""}|${Clock.System.now().toEpochMilliseconds()}"
        // encodeToByteArray() / decodeToString() sao KMP (Kotlin stdlib) e usam UTF-8 por padrao
        // Charsets/String(ByteArray, Charset) sao JVM-only - quebram build iOS
        return Base64.encode(cursorStr.encodeToByteArray())
    }

    @OptIn(ExperimentalEncodingApi::class)
    private fun decodeCursor(cursor: String): CursorInfo? {
        return try {
            val decoded = Base64.decode(cursor).decodeToString()
            val parts = decoded.split("|")
            if (parts.size < 4) return null
            val timestamp = parts[3].toLongOrNull() ?: 0L
            if (timestamp > 0 && Clock.System.now().toEpochMilliseconds() - timestamp > 15 * 60 * 1000) {
                println("FirebaseDataSource: Cursor expirado")
                return null
            }
            CursorInfo(documentPath = parts[0], sortField = LocationSortField.fromString(parts[1]),
                lastValue = parts[2].takeIf { it.isNotEmpty() }, timestamp = timestamp)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao decodificar cursor: ${e.message}")
            null
        }
    }

    suspend fun deleteLocation(locationId: String): Result<Unit> {
        return try {
            firestore.collection("locations").document(locationId).delete()
            Result.success(Unit)
        } catch (e: Exception) { logLocationUpdateError(locationId, "delete", e); Result.failure(e) }
    }

    suspend fun deleteLocationWithFields(locationId: String): Result<Int> {
        return try {
            val locationDoc = firestore.collection("locations").document(locationId).get()
            if (!locationDoc.exists) return Result.failure(Exception("Local não encontrado: $locationId"))
            val fieldsSnapshot = firestore.collection("fields").where { "location_id" equalTo locationId }.get()
            val fieldIds = fieldsSnapshot.documents.map { it.id }
            val totalDocsToDelete = 1 + fieldIds.size
            if (fieldIds.size <= 499) {
                val batch = firestore.batch()
                batch.delete(firestore.collection("locations").document(locationId))
                fieldIds.forEach { batch.delete(firestore.collection("fields").document(it)) }
                batch.commit()
            } else {
                fieldIds.chunked(499).forEachIndexed { index, chunk ->
                    val batch = firestore.batch()
                    if (index == 0) batch.delete(firestore.collection("locations").document(locationId))
                    chunk.forEach { batch.delete(firestore.collection("fields").document(it)) }
                    batch.commit()
                }
            }
            Result.success(totalDocsToDelete)
        } catch (e: Exception) { logLocationUpdateError(locationId, "deleteWithFields", e); Result.failure(e) }
    }

    suspend fun getLocationsByOwner(ownerId: String): Result<List<Location>> {
        return try {
            Result.success(firestore.collection("locations").where { "owner_id" equalTo ownerId }.orderBy("name").get().documents.mapNotNull { it.toLocationOrNull() })
        } catch (e: Exception) { logLocationQueryError("getLocationsByOwner", e, mapOf("owner_id" to ownerId)); Result.failure(e) }
    }

    suspend fun getLocationById(locationId: String): Result<Location> {
        return try {
            val doc = firestore.collection("locations").document(locationId).get()
            Result.success(doc.toLocationOrNull() ?: return Result.failure(Exception("Local não encontrado")))
        } catch (e: Exception) { logLocationQueryError("getLocationById", e, mapOf("location_id" to locationId)); Result.failure(e) }
    }

    suspend fun getLocationWithFields(locationId: String): Result<LocationWithFields> {
        return try {
            coroutineScope {
                val locationDeferred = async { firestore.collection("locations").document(locationId).get().toLocationOrNull() }
                val fieldsDeferred = async {
                    firestore.collection("fields").where { "location_id" equalTo locationId }.where { "is_active" equalTo true }
                        .orderBy("type").orderBy("name").get().documents.mapNotNull { it.toFieldOrNull() }
                }
                val location = locationDeferred.await() ?: return@coroutineScope Result.failure<LocationWithFields>(Exception("Local não encontrado"))
                Result.success(LocationWithFields(location, fieldsDeferred.await()))
            }
        } catch (e: Exception) { logLocationQueryError("getLocationWithFields", e, mapOf("location_id" to locationId)); Result.failure(e) }
    }

    suspend fun createLocation(location: Location): Result<Location> {
        return try {
            val uid = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            val docRef = firestore.collection("locations").document
            val locationWithId = location.copy(id = docRef.id, ownerId = uid, createdAt = Clock.System.now().toEpochMilliseconds())
            docRef.set(locationWithId)
            Result.success(locationWithId)
        } catch (e: Exception) { logLocationUpdateError(location.name, "create", e); Result.failure(e) }
    }

    suspend fun updateLocation(location: Location): Result<Unit> {
        return try {
            val updates = buildMap<String, Any> {
                put("name", location.name)
                put("address", location.address)
                put("owner_id", location.ownerId)
                put("cep", location.cep)
                put("street", location.street)
                put("number", location.number)
                put("complement", location.complement)
                put("district", location.district)
                put("city", location.city)
                put("state", location.state)
                put("country", location.country)
                put("neighborhood", location.neighborhood)
                put("region", location.region)
                location.latitude?.let { put("latitude", it) }
                location.longitude?.let { put("longitude", it) }
                location.placeId?.let { put("place_id", it) }
                put("description", location.description)
                location.photoUrl?.let { put("photo_url", it) }
                put("amenities", location.amenities)
                location.phone?.let { put("phone", it) }
                location.website?.let { put("website", it) }
                location.instagram?.let { put("instagram", it) }
                put("opening_time", location.openingTime)
                put("closing_time", location.closingTime)
                put("operating_days", location.operatingDays)
                put("min_game_duration_minutes", location.minGameDurationMinutes)
                put("is_active", location.isActive)
                put("managers", location.managers)
                // Preserva/aplica fuso: nunca envia null; fallback legado se vazio.
                put("time_zone", location.effectiveTimeZone())
                put("updated_at", FieldValue.serverTimestamp)
            }
            firestore.collection("locations").document(location.id).update(updates)
            Result.success(Unit)
        } catch (e: Exception) { logLocationUpdateError(location.id, "update", e); Result.failure(e) }
    }

    suspend fun searchLocations(query: String): Result<List<Location>> {
        return try {
            if (query.length < 2) return Result.success(emptyList())
            val snapshot = firestore.collection("locations").orderBy("name")
                .startAt(query).endAt(query + "\uf8ff").limit(20).get()
            val locations = snapshot.documents.mapNotNull { it.toLocationOrNull() }
            val additional = if (locations.size < 20) {
                firestore.collection("locations").orderBy("address")
                    .startAt(query).endAt(query + "\uf8ff").limit(20).get()
                    .documents.mapNotNull { it.toLocationOrNull() }.filter { addr -> locations.none { it.id == addr.id } }
            } else emptyList()
            Result.success((locations + additional).take(20))
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar locais: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun getOrCreateLocationFromPlace(placeId: String, name: String, address: String, city: String, state: String, latitude: Double?, longitude: Double?): Result<Location> {
        return try {
            val existingSnapshot = firestore.collection("locations").where { "place_id" equalTo placeId }.limit(1).get()
            if (!existingSnapshot.documents.isEmpty()) {
                val existing = existingSnapshot.documents.first().toLocationOrNull() ?: return Result.failure(Exception("Erro ao converter local existente"))
                return Result.success(existing)
            }
            createLocation(Location(name = name, address = address, city = city, state = state, latitude = latitude, longitude = longitude, placeId = placeId))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun addLocationReview(review: LocationReview): Result<Unit> {
        return try {
            val reviewsRef = firestore.collection("locations").document(review.locationId).collection("reviews")
            reviewsRef.add(review)
            val snapshot = reviewsRef.get()
            val reviews = snapshot.documents.mapNotNull { it.toLocationReviewOrNull() }
            val count = reviews.size
            val avg = if (count > 0) reviews.map { it.rating }.average() else 0.0
            firestore.collection("locations").document(review.locationId).update(mapOf("rating" to avg, "ratingCount" to count))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getLocationReviews(locationId: String): Result<List<LocationReview>> {
        return try {
            val snapshot = try {
                firestore.collection("locations").document(locationId).collection("reviews").orderBy("created_at", Direction.DESCENDING).get()
            } catch (e: Exception) {
                firestore.collection("locations").document(locationId).collection("reviews").get()
            }
            Result.success(snapshot.documents.mapNotNull { it.toLocationReviewOrNull() })
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun seedGinasioApollo(): Result<Location> {
        return try {
            val existing = firestore.collection("locations").where { "name" equalTo "Ginásio de Esportes Apollo" }.limit(1).get()
            if (!existing.documents.isEmpty()) {
                return Result.success(existing.documents.first().toLocationOrNull() ?: return Result.failure(Exception("Erro ao converter local")))
            }
            val uid = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            val docRef = firestore.collection("locations").document
            val location = Location(id = docRef.id, name = "Ginásio de Esportes Apollo", address = "R. Canal Belém - Marginal Leste, 8027",
                city = "Curitiba", state = "PR", latitude = -25.4747, longitude = -49.2256, ownerId = uid, isVerified = true,
                phone = "(41) 99999-9999", website = "https://ginasioapollo.com.br", instagram = "@ginasioapollo",
                openingTime = "18:00", closingTime = "23:59", minGameDurationMinutes = 60,
                operatingDays = listOf(1, 2, 3, 4, 5, 6, 7), createdAt = Clock.System.now().toEpochMilliseconds())
            docRef.set(location)
            for (i in 1..4) {
                val fieldRef = firestore.collection("fields").document
                fieldRef.set(Field(id = fieldRef.id, locationId = location.id, name = "Quadra Futsal $i", type = "FUTSAL",
                    description = "Quadra de futsal profissional, piso taco", hourlyPrice = 120.0, isActive = true))
            }
            for (i in 1..2) {
                val fieldRef = firestore.collection("fields").document
                fieldRef.set(Field(id = fieldRef.id, locationId = location.id, name = "Campo Society $i", type = "SOCIETY",
                    description = "Campo de society grama sintética", hourlyPrice = 180.0, isActive = true))
            }
            Result.success(location)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun migrateLocations(migrationData: List<LocationMigrationData>): Result<Int> {
        return try {
            val validData = migrationData.filter { it.nameKey.isNotBlank() }
            if (validData.isEmpty()) return Result.success(0)
            val uid = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado para migração"))
            val allLocationsResult = getAllLocations()
            if (allLocationsResult.isFailure) return Result.failure(allLocationsResult.exceptionOrNull() ?: Exception("Erro ao buscar locais"))
            val allLocations = allLocationsResult.getOrNull() ?: emptyList()
            var processedCount = 0
            for (data in validData) {
                val existingLoc = allLocations.find { it.name.trim().equals(data.nameKey.trim(), ignoreCase = true) }
                val finalPhone = if (!data.whatsapp.isNullOrBlank()) data.whatsapp else data.phone
                val finalInsta = data.instagram?.substringAfter(".com/")?.replace("/", "")?.replace("@", "")
                val addr = "${data.street}, ${data.number}${if (data.complement.isNotBlank()) " - " + data.complement else ""} - ${data.neighborhood}, ${data.city} - ${data.state}"
                if (existingLoc != null) {
                    updateLocation(existingLoc.copy(cep = data.cep, street = data.street, number = data.number,
                        neighborhood = data.neighborhood, city = data.city, state = data.state, country = data.country,
                        complement = data.complement, region = if (data.region.isNotBlank()) data.region else existingLoc.region,
                        address = addr, phone = finalPhone ?: existingLoc.phone, instagram = finalInsta ?: existingLoc.instagram,
                        amenities = if (data.amenities.isNotEmpty()) data.amenities else existingLoc.amenities,
                        description = data.description ?: existingLoc.description, openingTime = data.openingTime ?: existingLoc.openingTime,
                        closingTime = data.closingTime ?: existingLoc.closingTime))
                } else {
                    val docRef = firestore.collection("locations").document
                    val newLoc = Location(id = docRef.id, ownerId = uid, name = data.nameKey, cep = data.cep, street = data.street,
                        number = data.number, neighborhood = data.neighborhood, city = data.city, state = data.state, country = data.country,
                        complement = data.complement, region = data.region, address = addr, phone = finalPhone, instagram = finalInsta,
                        amenities = data.amenities, description = data.description ?: "", openingTime = data.openingTime ?: "08:00",
                        closingTime = data.closingTime ?: "23:00", minGameDurationMinutes = 60, isActive = true, isVerified = true,
                        createdAt = Clock.System.now().toEpochMilliseconds())
                    docRef.set(newLoc)
                    val mainType = if (data.modalities.any { it.contains("Futsal", true) }) "FUTSAL" else "SOCIETY"
                    val count = if (data.numFieldsEstimation > 0) data.numFieldsEstimation else 1
                    for (i in 1..count) {
                        val fieldRef = firestore.collection("fields").document
                        fieldRef.set(Field(id = fieldRef.id, locationId = newLoc.id,
                            name = if (count > 1) "Quadra $i" else "Quadra Principal",
                            type = mainType, hourlyPrice = 100.0, isActive = true, isCovered = true))
                    }
                }
                processedCount++
            }
            Result.success(processedCount)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun deduplicateLocations(): Result<Int> {
        return try {
            val allLocationsResult = getAllLocations()
            if (allLocationsResult.isFailure) return Result.failure(allLocationsResult.exceptionOrNull() ?: Exception("Erro ao buscar locais"))
            val allLocations = allLocationsResult.getOrNull() ?: emptyList()
            fun String.normalizeStr(): String = this.lowercase().replace(Regex("[^a-z0-9]"), "")
            var deletedCount = 0
            val grouped = allLocations.groupBy { it.name.normalizeStr() }
            for ((_, duplicates) in grouped) {
                if (duplicates.size > 1) {
                    val best = duplicates.sortedWith(compareByDescending<Location> { !it.cep.isNullOrBlank() }
                        .thenByDescending { !it.phone.isNullOrBlank() }.thenByDescending { it.id }).first()
                    duplicates.filter { it.id != best.id }.forEach { loc ->
                        try {
                            firestore.collection("locations").document(loc.id).delete()
                            firestore.collection("fields").where { "location_id" equalTo loc.id }.get().documents.forEach { it.reference.delete() }
                            deletedCount++
                        } catch (e: Exception) { println("FirebaseDataSource: Erro ao deletar duplicata ${loc.name}: ${e.message}") }
                    }
                }
            }
            Result.success(deletedCount)
        } catch (e: Exception) { Result.failure(e) }
    }

    // ========== FIELDS ==========

    suspend fun getFieldsByLocation(locationId: String): Result<List<Field>> {
        return try {
            if (locationId.isBlank()) return Result.failure(Exception("ID do local inválido"))

            // Query 1: sub-coleção locations/{id}/fields (formato recomendado)
            val subFields = firestore.collection("locations").document(locationId).collection("fields")
                .orderBy("name").get().documents.mapNotNull { it.toFieldOrNull() }

            // Query 2: coleção root fields (legado)
            val rootFields = firestore.collection("fields").where { "location_id" equalTo locationId }
                .orderBy("type").orderBy("name").get().documents.mapNotNull { it.toFieldOrNull() }

            // Merge deduplicando por ID
            val merged = mutableMapOf<String, Field>()
            subFields.filter { it.isActive }.forEach { merged[it.id] = it }
            rootFields.filter { it.isActive }.forEach { f ->
                if (!merged.containsKey(f.id)) merged[f.id] = f
            }

            Result.success(merged.values.toList().sortedWith(compareBy({ it.type }, { it.name })))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getFieldById(fieldId: String): Result<Field> {
        return try {
            // Try root collection first
            val rootDoc = firestore.collection("fields").document(fieldId).get()
            if (rootDoc.exists) {
                return Result.success(rootDoc.toFieldOrNull() ?: return Result.failure(Exception("Quadra não encontrada")))
            }
            // Try sub-collections via collectionGroup query
            val groupSnap = firestore.collectionGroup("fields").where { FieldPath.documentId equalTo fieldId }.get()
            if (groupSnap.documents.isNotEmpty()) {
                return Result.success(groupSnap.documents.first().toFieldOrNull() ?: return Result.failure(Exception("Quadra não encontrada")))
            }
            Result.failure(Exception("Quadra não encontrada"))
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun createField(field: Field): Result<Field> {
        return try {
            // Create in sub-collection (recommended format)
            val docRef = firestore.collection("locations").document(field.locationId).collection("fields").document
            val fieldWithId = field.copy(id = docRef.id)
            docRef.set(fieldWithId)
            Result.success(fieldWithId)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun updateField(field: Field): Result<Unit> {
        return try {
            // Try sub-collection first (recommended format)
            val subRef = firestore.collection("locations").document(field.locationId).collection("fields").document(field.id)
            subRef.set(field)
            Result.success(Unit)
        } catch (e: Exception) {
            // Fallback to root collection
            try {
                firestore.collection("fields").document(field.id).set(field)
                Result.success(Unit)
            } catch (e2: Exception) { Result.failure(e2) }
        }
    }

    suspend fun deleteField(fieldId: String): Result<Unit> {
        return try {
            // Try root collection first (current format)
            firestore.collection("fields").document(fieldId).update(mapOf("is_active" to false))
            Result.success(Unit)
        } catch (e: Exception) {
            // Fallback: try to find in sub-collection via collectionGroup
            try {
                val groupSnap = firestore.collectionGroup("fields").where { FieldPath.documentId equalTo fieldId }.get()
                if (groupSnap.documents.isNotEmpty()) {
                    val doc = groupSnap.documents.first()
                    val locationId = doc.get<String?>("location_id") ?: ""
                    if (locationId.isNotBlank()) {
                        firestore.collection("locations").document(locationId).collection("fields").document(fieldId)
                            .update(mapOf("is_active" to false))
                        return Result.success(Unit)
                    }
                }
                Result.failure(e)
            } catch (e2: Exception) { Result.failure(e2) }
        }
    }

    suspend fun uploadFieldPhoto(filePath: String): Result<String> {
        return Result.failure(Exception("Upload de fotos requer Firebase Storage — não implementado ainda"))
    }

    // ========== LOCATION AUDIT LOGS ==========

    suspend fun logLocationAudit(log: LocationAuditLog): Result<Unit> {
        return try {
            val docRef = firestore.collection("locations").document(log.locationId).collection("audit_logs").document
            val logWithId = log.copy(id = docRef.id, timestamp = if (log.timestamp == 0L) Clock.System.now().toEpochMilliseconds() else log.timestamp)
            val data = mutableMapOf<String, Any?>(
                "id" to logWithId.id, "location_id" to logWithId.locationId, "user_id" to logWithId.userId,
                "user_name" to logWithId.userName, "action" to logWithId.action.name, "timestamp" to logWithId.timestamp
            )
            if (logWithId.changes != null) {
                data["changes"] = logWithId.changes.mapValues { (_, fc) -> mapOf("before" to fc.before, "after" to fc.after) }
            }
            docRef.set(data)
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao registrar log de auditoria: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun getLocationAuditLogs(locationId: String, limit: Int): Result<List<LocationAuditLog>> {
        return try {
            val snapshot = firestore.collection("locations").document(locationId).collection("audit_logs")
                .orderBy("timestamp", Direction.DESCENDING).limit(limit).get()
            Result.success(snapshot.documents.mapNotNull { it.toLocationAuditLogOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar logs de auditoria: ${e.message}")
            Result.failure(e)
        }
    }
}
