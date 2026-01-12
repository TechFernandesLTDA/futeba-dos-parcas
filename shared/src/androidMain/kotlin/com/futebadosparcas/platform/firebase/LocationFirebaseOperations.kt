package com.futebadosparcas.platform.firebase

import android.net.Uri
import com.futebadosparcas.domain.model.*
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.async
import kotlinx.coroutines.tasks.await
import java.io.File

/**
 * Implementações Android para operações de Location e Field no Firebase.
 *
 * Este arquivo contém todas as funções actual para Location/Field
 * declaradas no FirebaseDataSource expect class.
 *
 * Para adicionar estas funções ao FirebaseDataSource, copie cada bloco
 * de função para dentro da classe FirebaseDataSource em FirebaseDataSource.kt
 */

// ========== MAPPING HELPERS ==========

/**
 * Helper para converter DocumentSnapshot para Location
 * Adicione este método como uma função privada na classe FirebaseDataSource
 */
private fun com.google.firebase.firestore.DocumentSnapshot.toLocationOrNull(): Location? {
    if (!exists()) return null

    return Location(
        id = id,
        name = getString("name") ?: "",
        address = getString("address") ?: "",

        // Endereço Estruturado
        cep = getString("cep") ?: "",
        street = getString("street") ?: "",
        number = getString("number") ?: "",
        complement = getString("complement") ?: "",
        district = getString("district") ?: "",
        city = getString("city") ?: "",
        state = getString("state") ?: "",
        country = getString("country") ?: "Brasil",

        // Localização detalhada
        neighborhood = getString("neighborhood") ?: "",
        region = getString("region") ?: "",
        latitude = getDouble("latitude"),
        longitude = getDouble("longitude"),
        placeId = getString("place_id") ?: getString("placeId"),

        // Proprietário
        ownerId = getString("owner_id") ?: getString("ownerId") ?: "",
        isVerified = getBoolean("is_verified") ?: getBoolean("isVerified") ?: false,
        isActive = getBoolean("is_active") ?: getBoolean("isActive") ?: true,

        // Avaliação
        rating = getDouble("rating") ?: 0.0,
        ratingCount = getLong("rating_count")?.toInt() ?: getLong("ratingCount")?.toInt() ?: 0,

        // Descrição e mídia
        description = getString("description") ?: "",
        photoUrl = getString("photo_url") ?: getString("photoUrl"),

        // Infraestrutura
        amenities = (get("amenities") as? List<*>)?.filterIsInstance<String>() ?: emptyList(),

        // Contato
        phone = getString("phone"),
        website = getString("website"),
        instagram = getString("instagram"),

        // Horário de funcionamento
        openingTime = getString("opening_time") ?: getString("openingTime") ?: "08:00",
        closingTime = getString("closing_time") ?: getString("closingTime") ?: "23:00",
        operatingDays = (get("operating_days") ?: get("operatingDays")) as? List<Int> ?: listOf(1, 2, 3, 4, 5, 6, 7),
        minGameDurationMinutes = getLong("min_game_duration_minutes")?.toInt()
            ?: getLong("minGameDurationMinutes")?.toInt() ?: 60,

        createdAt = safeLongLocation("created_at") ?: safeLongLocation("createdAt")
    )
}

/**
 * Helper para converter DocumentSnapshot para Field
 */
private fun com.google.firebase.firestore.DocumentSnapshot.toFieldOrNull(): Field? {
    if (!exists()) return null

    return Field(
        id = id,
        locationId = getString("location_id") ?: getString("locationId") ?: "",
        name = getString("name") ?: "",
        type = getString("type") ?: "SOCIETY",
        description = getString("description"),
        photoUrl = getString("photo_url") ?: getString("photoUrl"),
        isActive = getBoolean("is_active") ?: getBoolean("isActive") ?: true,
        hourlyPrice = getDouble("hourly_price") ?: getDouble("hourlyPrice") ?: 0.0,
        photos = (get("photos") as? List<*>)?.filterIsInstance<String>() ?: emptyList(),

        // Permissões
        managers = (get("managers") as? List<*>)?.filterIsInstance<String>() ?: emptyList(),

        // Detalhes da quadra
        surface = getString("surface"),
        isCovered = getBoolean("is_covered") ?: getBoolean("isCovered") ?: false,
        dimensions = getString("dimensions")
    )
}

/**
 * Helper para converter DocumentSnapshot para LocationReview
 */
private fun com.google.firebase.firestore.DocumentSnapshot.toLocationReviewOrNull(): LocationReview? {
    if (!exists()) return null

    return LocationReview(
        id = id,
        locationId = getString("locationId") ?: "",
        userId = getString("userId") ?: "",
        userName = getString("userName") ?: "",
        userPhotoUrl = getString("userPhotoUrl"),
        rating = getDouble("rating")?.toFloat() ?: 0f,
        comment = getString("comment") ?: "",
        createdAt = safeLongLocation("createdAt")
    )
}

/**
 * Helper para pegar Long de forma segura (específico para Location para evitar conflitos)
 */
private fun com.google.firebase.firestore.DocumentSnapshot.safeLongLocation(field: String): Long? {
    val value = get(field)
    return when (value) {
        is Number -> value.toLong()
        is com.google.firebase.Timestamp -> value.toDate().time
        is String -> value.toLongOrNull()
        else -> null
    }
}

/**
 * ============================================================
 * INSTRUÇÕES: Copie todas as funções abaixo para dentro da classe
 * FirebaseDataSource em FirebaseDataSource.kt, após o método logout()
 * ============================================================
 */

/*
// ========== LOCATIONS ==========

actual suspend fun getAllLocations(): Result<List<Location>> {
    return try {
        val snapshot = firestore.collection("locations")
            .orderBy("name")
            .get()
            .await()

        val locations = snapshot.documents.mapNotNull { it.toLocationOrNull() }
        Result.success(locations)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun getLocationsWithPagination(
    limit: Int,
    lastLocationName: String?
): Result<List<Location>> {
    return try {
        var query = firestore.collection("locations")
            .orderBy("name")
            .limit(limit.toLong())

        if (lastLocationName != null) {
            query = query.startAfter(lastLocationName)
        }

        val snapshot = query.get().await()
        val locations = snapshot.documents.mapNotNull { it.toLocationOrNull() }
        Result.success(locations)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun deleteLocation(locationId: String): Result<Unit> {
    return try {
        firestore.collection("locations")
            .document(locationId)
            .delete()
            .await()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun getLocationsByOwner(ownerId: String): Result<List<Location>> {
    return try {
        val snapshot = firestore.collection("locations")
            .whereEqualTo("owner_id", ownerId)
            .orderBy("name")
            .get()
            .await()

        val locations = snapshot.documents.mapNotNull { it.toLocationOrNull() }
        Result.success(locations)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun getLocationById(locationId: String): Result<Location> {
    return try {
        val doc = firestore.collection("locations")
            .document(locationId)
            .get()
            .await()

        val location = doc.toLocationOrNull()
            ?: return Result.failure(Exception("Local não encontrado"))
        Result.success(location)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun getLocationWithFields(locationId: String): Result<LocationWithFields> {
    return try {
        async {
            val locationDeferred = async {
                firestore.collection("locations")
                    .document(locationId)
                    .get()
                    .await()
            }
            val fieldsDeferred = async {
                firestore.collection("fields")
                    .whereEqualTo("location_id", locationId)
                    .whereEqualTo("is_active", true)
                    .orderBy("type")
                    .orderBy("name")
                    .get()
                    .await()
            }

            val locationDoc = locationDeferred.await()
            val fieldsSnapshot = fieldsDeferred.await()

            val location = locationDoc.toLocationOrNull()
                ?: return@async Result.failure<LocationWithFields>(Exception("Local não encontrado"))

            val fields = fieldsSnapshot.documents.mapNotNull { it.toFieldOrNull() }

            Result.success(LocationWithFields(location, fields))
        }.await()
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun createLocation(location: Location): Result<Location> {
    return try {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(Exception("Usuário não autenticado"))

        val docRef = firestore.collection("locations").document()
        val locationWithId = location.copy(
            id = docRef.id,
            ownerId = uid,
            createdAt = System.currentTimeMillis()
        )

        docRef.set(locationWithId).await()
        Result.success(locationWithId)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun updateLocation(location: Location): Result<Unit> {
    return try {
        firestore.collection("locations")
            .document(location.id)
            .set(location)
            .await()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun searchLocations(query: String): Result<List<Location>> {
    return try {
        if (query.length < 2) {
            return Result.success(emptyList())
        }

        val snapshot = firestore.collection("locations")
            .get()
            .await()

        val locations = snapshot.documents.mapNotNull { it.toLocationOrNull() }
            .filter {
                it.name.contains(query, ignoreCase = true) ||
                        it.address.contains(query, ignoreCase = true)
            }
            .take(10)

        Result.success(locations)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun getOrCreateLocationFromPlace(
    placeId: String,
    name: String,
    address: String,
    city: String,
    state: String,
    latitude: Double?,
    longitude: Double?
): Result<Location> {
    return try {
        val existingSnapshot = firestore.collection("locations")
            .whereEqualTo("place_id", placeId)
            .limit(1)
            .get()
            .await()

        if (!existingSnapshot.isEmpty) {
            val existing = existingSnapshot.documents.first()
                .toLocationOrNull()!!
            return Result.success(existing)
        }

        val newLocation = Location(
            name = name,
            address = address,
            city = city,
            state = state,
            latitude = latitude,
            longitude = longitude,
            placeId = placeId
        )

        createLocation(newLocation)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun addLocationReview(review: LocationReview): Result<Unit> {
    return try {
        val reviewsRef = firestore.collection("locations")
            .document(review.locationId)
            .collection("reviews")
        reviewsRef.add(review).await()

        val snapshot = reviewsRef.get().await()
        val reviews = snapshot.documents.mapNotNull { it.toLocationReviewOrNull() }
        val count = reviews.size
        val avg = if (count > 0) reviews.map { it.rating }.average() else 0.0

        firestore.collection("locations")
            .document(review.locationId)
            .update(
                mapOf(
                    "rating" to avg,
                    "rating_count" to count
                )
            )
            .await()

        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun getLocationReviews(locationId: String): Result<List<LocationReview>> {
    return try {
        val snapshot = firestore.collection("locations")
            .document(locationId)
            .collection("reviews")
            .orderBy("createdAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .get()
            .await()

        val reviews = snapshot.documents.mapNotNull { it.toLocationReviewOrNull() }
        Result.success(reviews)
    } catch (e: Exception) {
        try {
            val snapshot = firestore.collection("locations")
                .document(locationId)
                .collection("reviews")
                .get()
                .await()
            val reviews = snapshot.documents.mapNotNull { it.toLocationReviewOrNull() }
            Result.success(reviews)
        } catch (e2: Exception) {
            Result.failure(e2)
        }
    }
}

actual suspend fun seedGinasioApollo(): Result<Location> {
    return try {
        val existing = firestore.collection("locations")
            .whereEqualTo("name", "Ginásio de Esportes Apollo")
            .limit(1)
            .get()
            .await()

        if (!existing.isEmpty) {
            val location = existing.documents.first()
                .toLocationOrNull()!!
            return Result.success(location)
        }

        val uid = auth.currentUser?.uid
            ?: return Result.failure(Exception("Usuário não autenticado"))

        val docRef = firestore.collection("locations").document()
        val location = Location(
            id = docRef.id,
            name = "Ginásio de Esportes Apollo",
            address = "R. Canal Belém - Marginal Leste, 8027",
            city = "Curitiba",
            state = "PR",
            latitude = -25.4747,
            longitude = -49.2256,
            ownerId = uid,
            isVerified = true,
            phone = "(41) 99999-9999",
            website = "https://ginasioapollo.com.br",
            instagram = "@ginasioapollo",
            openingTime = "18:00",
            closingTime = "23:59",
            minGameDurationMinutes = 60,
            operatingDays = listOf(1, 2, 3, 4, 5, 6, 7),
            createdAt = System.currentTimeMillis()
        )

        docRef.set(location).await()

        // Criar quadras de futsal
        for (i in 1..4) {
            val fieldRef = firestore.collection("fields").document()
            val field = Field(
                id = fieldRef.id,
                locationId = location.id,
                name = "Quadra Futsal $i",
                type = "FUTSAL",
                description = "Quadra de futsal profissional, piso taco",
                hourlyPrice = 120.0,
                isActive = true
            )
            fieldRef.set(field).await()
        }

        // Criar campos de society
        for (i in 1..2) {
            val fieldRef = firestore.collection("fields").document()
            val field = Field(
                id = fieldRef.id,
                locationId = location.id,
                name = "Campo Society $i",
                type = "SOCIETY",
                description = "Campo de society grama sintética",
                hourlyPrice = 180.0,
                isActive = true
            )
            fieldRef.set(field).await()
        }

        Result.success(location)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun migrateLocations(migrationData: List<LocationMigrationData>): Result<Int> {
    return try {
        val validData = migrationData.filter { it.nameKey.isNotBlank() }
        if (validData.isEmpty()) return Result.success(0)

        val uid = auth.currentUser?.uid
            ?: return Result.failure(Exception("Usuário não autenticado para migração"))

        val allLocationsResult = getAllLocations()
        if (allLocationsResult.isFailure) return Result.failure(
            allLocationsResult.exceptionOrNull()!!
        )

        val allLocations = allLocationsResult.getOrNull() ?: emptyList()
        var processedCount = 0

        for (data in validData) {
            val existingLoc = allLocations.find {
                it.name.trim()
                    .equals(data.nameKey.trim(), ignoreCase = true)
            }

            val finalPhone = if (!data.whatsapp.isNullOrBlank()) data.whatsapp else data.phone
            val finalInsta = data.instagram?.substringAfter(".com/")
                ?.replace("/", "")
                ?.replace("@", "")

            if (existingLoc != null) {
                val updated = existingLoc.copy(
                    cep = data.cep,
                    street = data.street,
                    number = data.number,
                    neighborhood = data.neighborhood,
                    city = data.city,
                    state = data.state,
                    country = data.country,
                    complement = data.complement,
                    region = if (data.region.isNotBlank()) data.region else existingLoc.region,
                    address = "${data.street}, ${data.number}${
                        if (data.complement.isNotBlank()) " - " + data.complement else ""
                    } - ${data.neighborhood}, ${data.city} - ${data.state}",
                    phone = finalPhone ?: existingLoc.phone,
                    instagram = finalInsta ?: existingLoc.instagram,
                    amenities = if (data.amenities.isNotEmpty()) data.amenities else existingLoc.amenities,
                    description = data.description ?: existingLoc.description,
                    openingTime = data.openingTime ?: existingLoc.openingTime,
                    closingTime = data.closingTime ?: existingLoc.closingTime
                )
                updateLocation(updated)
            } else {
                val docRef = firestore.collection("locations").document()
                val newLoc = Location(
                    id = docRef.id,
                    ownerId = uid,
                    name = data.nameKey,
                    cep = data.cep,
                    street = data.street,
                    number = data.number,
                    neighborhood = data.neighborhood,
                    city = data.city,
                    state = data.state,
                    country = data.country,
                    complement = data.complement,
                    region = data.region,
                    address = "${data.street}, ${data.number}${
                        if (data.complement.isNotBlank()) " - " + data.complement else ""
                    } - ${data.neighborhood}, ${data.city} - ${data.state}",
                    phone = finalPhone,
                    instagram = finalInsta,
                    amenities = data.amenities,
                    description = data.description ?: "",
                    openingTime = data.openingTime ?: "08:00",
                    closingTime = data.closingTime ?: "23:00",
                    minGameDurationMinutes = 60,
                    isActive = true,
                    isVerified = true,
                    createdAt = System.currentTimeMillis()
                )
                docRef.set(newLoc).await()

                val mainType = if (data.modalities.any {
                        it.contains("Futsal", true)
                    }) "FUTSAL" else "SOCIETY"
                val count = if (data.numFieldsEstimation > 0) data.numFieldsEstimation else 1

                for (i in 1..count) {
                    val fieldRef = firestore.collection("fields").document()
                    val field = Field(
                        id = fieldRef.id,
                        locationId = newLoc.id,
                        name = if (count > 1) "Quadra $i" else "Quadra Principal",
                        type = mainType,
                        hourlyPrice = 100.0,
                        isActive = true,
                        isCovered = true
                    )
                    fieldRef.set(field).await()
                }
            }
            processedCount++
        }
        Result.success(processedCount)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun deduplicateLocations(): Result<Int> {
    return try {
        val allLocationsResult = getAllLocations()
        if (allLocationsResult.isFailure) return Result.failure(
            allLocationsResult.exceptionOrNull()!!
        )
        val allLocations = allLocationsResult.getOrNull() ?: emptyList()

        fun String.normalize(): String {
            return java.text.Normalizer.normalize(
                this,
                java.text.Normalizer.Form.NFD
            )
                .replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
                .lowercase()
                .replace(Regex("[^a-z0-9]"), "")
        }

        var deletedCount = 0
        val grouped = allLocations.groupBy { it.name.normalize() }

        for ((_, duplicates) in grouped) {
            if (duplicates.size > 1) {
                val best = duplicates.sortedWith(
                    compareByDescending<Location> { !it.cep.isNullOrBlank() }
                        .thenByDescending { !it.phone.isNullOrBlank() }
                        .thenByDescending { it.id }
                ).first()

                val toDelete = duplicates.filter { it.id != best.id }

                for (loc in toDelete) {
                    try {
                        firestore.collection("locations")
                            .document(loc.id)
                            .delete()
                            .await()

                        val fieldsSnapshot = firestore.collection("fields")
                            .whereEqualTo("location_id", loc.id)
                            .get()
                            .await()
                        for (fieldDoc in fieldsSnapshot.documents) {
                            fieldDoc.reference.delete().await()
                        }

                        deletedCount++
                    } catch (e: Exception) {
                        android.util.Log.e(
                            "FirebaseDataSource",
                            "Error deleting duplicate ${loc.name}",
                            e
                        )
                    }
                }
            }
        }
        Result.success(deletedCount)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

// ========== FIELDS ==========

actual suspend fun getFieldsByLocation(locationId: String): Result<List<Field>> {
    return try {
        if (locationId.isBlank()) {
            return Result.failure(Exception("ID do local inválido"))
        }

        val snapshot = firestore.collection("fields")
            .whereEqualTo("location_id", locationId)
            .orderBy("type")
            .orderBy("name")
            .get()
            .await()

        val fields = snapshot.documents.mapNotNull { it.toFieldOrNull() }
        Result.success(fields)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun getFieldById(fieldId: String): Result<Field> {
    return try {
        val doc = firestore.collection("fields")
            .document(fieldId)
            .get()
            .await()

        val field = doc.toFieldOrNull()
            ?: return Result.failure(Exception("Quadra não encontrada"))
        Result.success(field)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun createField(field: Field): Result<Field> {
    return try {
        val docRef = firestore.collection("fields").document()
        val fieldWithId = field.copy(id = docRef.id)

        docRef.set(fieldWithId).await()
        Result.success(fieldWithId)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun updateField(field: Field): Result<Unit> {
    return try {
        firestore.collection("fields")
            .document(field.id)
            .set(field)
            .await()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun deleteField(fieldId: String): Result<Unit> {
    return try {
        firestore.collection("fields")
            .document(fieldId)
            .update("is_active", false)
            .await()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

actual suspend fun uploadFieldPhoto(filePath: String): Result<String> {
    return try {
        val storage = FirebaseStorage.getInstance()
        val filename = "${System.currentTimeMillis()}.jpg"
        val ref = storage.reference.child("fields_photos/$filename")

        val file = File(filePath)
        val uri = Uri.fromFile(file)

        ref.putFile(uri).await()
        val downloadUrl = ref.downloadUrl.await()

        Result.success(downloadUrl.toString())
    } catch (e: Exception) {
        Result.failure(e)
    }
}

*/
