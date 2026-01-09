package com.futebadosparcas.data.repository

import android.net.Uri
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.data.model.LocationWithFields
import com.futebadosparcas.data.model.LocationReview
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

data class LocationMigrationData(
    val nameKey: String,
    val cep: String,
    val street: String,
    val number: String,
    val complement: String = "",
    val neighborhood: String,
    val city: String,
    val state: String,
    val region: String = "",
    val country: String = "Brasil",
    
    // Additional Info
    val phone: String? = null,
    val whatsapp: String? = null, // To prioritize
    val instagram: String? = null,
    val description: String? = null,
    val amenities: List<String> = emptyList(),
    val openingTime: String? = null, // "HH:mm"
    val closingTime: String? = null, // "HH:mm"
    val modalities: List<String> = emptyList(), // For default fields creation
    val numFieldsEstimation: Int = 1
)


@Singleton
class LocationRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val storage: FirebaseStorage
) {
    private val locationsCollection = firestore.collection("locations")
    private val fieldsCollection = firestore.collection("fields")

    companion object {
        private const val TAG = "LocationRepository"
    }

    /**
     * Busca todos os locais cadastrados
     */
    suspend fun getAllLocations(): Result<List<Location>> {
        return try {
            val snapshot = locationsCollection
                .orderBy("name")
                .get()
                .await()

            val locations = snapshot.toObjects(Location::class.java)
            Result.success(locations)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar locais", e)
            Result.failure(e)
        }
    }

    /**
     * Busca locais com paginação (PERF FIX: Previne loading 1000+ items)
     * @param limit Número máximo de locais por página (padrão 50)
     * @param lastLocationName Nome do último local da página anterior para cursor-based pagination
     */
    suspend fun getLocationsWithPagination(limit: Int = 50, lastLocationName: String? = null): Result<List<Location>> {
        return try {
            var query = locationsCollection.orderBy("name").limit(limit.toLong())

            // Cursor-based pagination: começar após o último item da página anterior
            if (lastLocationName != null) {
                query = query.startAfter(lastLocationName)
            }

            val snapshot = query.get().await()
            val locations = snapshot.toObjects(Location::class.java)
            Result.success(locations)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar locais com paginação", e)
            Result.failure(e)
        }
    }

    suspend fun deleteLocation(locationId: String): Result<Unit> {
        return try {
            locationsCollection.document(locationId).delete().await()
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao deletar local", e)
            Result.failure(e)
        }
    }

    /**
     * Busca locais de um proprietário específico
     */
    suspend fun getLocationsByOwner(ownerId: String): Result<List<Location>> {
        return try {
            val snapshot = locationsCollection
                .whereEqualTo("owner_id", ownerId)
                .orderBy("name")
                .get()
                .await()

            val locations = snapshot.toObjects(Location::class.java)
            Result.success(locations)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar locais do proprietário", e)
            Result.failure(e)
        }
    }

    /**
     * Busca um local pelo ID
     */
    suspend fun getLocationById(locationId: String): Result<Location> {
        return try {
            val doc = locationsCollection.document(locationId).get().await()
            val location = doc.toObject(Location::class.java)
                ?: return Result.failure(Exception("Local nao encontrado"))
            Result.success(location)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar local", e)
            Result.failure(e)
        }
    }

    /**
     * Busca um local com todas as suas quadras
     */
    suspend fun getLocationWithFields(locationId: String): Result<LocationWithFields> {
        return try {
            coroutineScope {
                val locationDeferred = async { locationsCollection.document(locationId).get().await() }
                val fieldsDeferred = async {
                    fieldsCollection
                        .whereEqualTo("location_id", locationId)
                        .whereEqualTo("is_active", true)
                        .orderBy("type")
                        .orderBy("name")
                        .get()
                        .await()
                }

                val locationDoc = locationDeferred.await()
                val fieldsSnapshot = fieldsDeferred.await()

                val location = locationDoc.toObject(Location::class.java)
                    ?: return@coroutineScope Result.failure(Exception("Local nao encontrado"))

                val fields = fieldsSnapshot.toObjects(Field::class.java)

                Result.success(LocationWithFields(location, fields))
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar local com quadras", e)
            Result.failure(e)
        }
    }

    /**
     * Cria um novo local
     */
    suspend fun createLocation(location: Location): Result<Location> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            val docRef = locationsCollection.document()
            val locationWithId = location.copy(id = docRef.id, ownerId = uid)

            docRef.set(locationWithId).await()
            Result.success(locationWithId)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao criar local", e)
            Result.failure(e)
        }
    }

    /**
     * Atualiza um local existente
     */
    suspend fun updateLocation(location: Location): Result<Unit> {
        return try {
            locationsCollection.document(location.id).set(location).await()
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar local", e)
            Result.failure(e)
        }
    }

    /**
     * Busca todas as quadras de um local
     */
    suspend fun getFieldsByLocation(locationId: String): Result<List<Field>> {
        return try {
            if (locationId.isBlank()) {
                return Result.failure(Exception("ID do local inválido"))
            }
            
            val snapshot = fieldsCollection
                .whereEqualTo("location_id", locationId)
                .orderBy("type")
                .orderBy("name")
                .get()
                .await()

            val fields = snapshot.toObjects(Field::class.java)
            
            Result.success(fields)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar quadras do local $locationId", e)
            Result.failure(e)
        }
    }

    /**
     * Busca uma quadra pelo ID
     */
    suspend fun getFieldById(fieldId: String): Result<Field> {
        return try {
            val doc = fieldsCollection.document(fieldId).get().await()
            val field = doc.toObject(Field::class.java)
                ?: return Result.failure(Exception("Quadra nao encontrada"))
            Result.success(field)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar quadra", e)
            Result.failure(e)
        }
    }

    /**
     * Cria uma nova quadra
     */
    suspend fun createField(field: Field): Result<Field> {
        return try {
            val docRef = fieldsCollection.document()
            val fieldWithId = field.copy(id = docRef.id)

            docRef.set(fieldWithId).await()
            Result.success(fieldWithId)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao criar quadra", e)
            Result.failure(e)
        }
    }

    /**
     * Atualiza uma quadra existente
     */
    suspend fun updateField(field: Field): Result<Unit> {
        return try {
            fieldsCollection.document(field.id).set(field).await()
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar quadra", e)
            Result.failure(e)
        }
    }

    /**
     * Desativa uma quadra (soft delete)
     */
    suspend fun deleteField(fieldId: String): Result<Unit> {
        return try {
            fieldsCollection.document(fieldId).update("is_active", false).await()
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao desativar quadra", e)
            Result.failure(e)
        }
    }

    /**
     * Faz upload de foto da quadra
     */
    suspend fun uploadFieldPhoto(imageUri: Uri): Result<String> {
        return try {
            val filename = "${System.currentTimeMillis()}.jpg"
            val ref = storage.reference.child("fields_photos/$filename")
            
            ref.putFile(imageUri).await()
            val downloadUrl = ref.downloadUrl.await()
            
            Result.success(downloadUrl.toString())
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao fazer upload da foto", e)
            Result.failure(e)
        }
    }

    /**
     * Busca locais pelo nome (para autocomplete)
     */
    suspend fun searchLocations(query: String): Result<List<Location>> {
        return try {
            if (query.length < 2) {
                return Result.success(emptyList())
            }

            // Busca todos e filtra localmente (Firestore nao suporta LIKE)
            val snapshot = locationsCollection.get().await()
            val locations = snapshot.toObjects(Location::class.java)
                .filter { it.name.contains(query, ignoreCase = true) ||
                         it.address.contains(query, ignoreCase = true) }
                .take(10)

            Result.success(locations)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar locais", e)
            Result.failure(e)
        }
    }

    /**
     * Busca ou cria um local baseado nos dados do Google Places
     */
    suspend fun getOrCreateLocationFromPlace(
        placeId: String,
        name: String,
        address: String,
        city: String,
        state: String,
        latitude: Double?,
        longitude: Double?
    ): Result<Location> {
        return try {
            // Primeiro, verifica se já existe um local com esse placeId
            val existingSnapshot = locationsCollection
                .whereEqualTo("place_id", placeId)
                .limit(1)
                .get()
                .await()

            if (!existingSnapshot.isEmpty) {
                val existing = existingSnapshot.documents.first().toObject(Location::class.java)!!
                return Result.success(existing)
            }

            // Se não existe, cria um novo
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
            AppLogger.e(TAG, "Erro ao buscar/criar local", e)
            Result.failure(e)
        }
    }

    suspend fun addLocationReview(review: LocationReview): Result<Unit> {
        return try {
             val reviewsRef = locationsCollection.document(review.locationId).collection("reviews")
             reviewsRef.add(review).await()
             
             // Update average
             val snapshot = reviewsRef.get().await()
             val reviews = snapshot.toObjects(LocationReview::class.java)
             val count = reviews.size
             val avg = if (count > 0) reviews.map { it.rating }.average() else 0.0
             
             locationsCollection.document(review.locationId).update(
                 mapOf(
                     "rating" to avg,
                     "ratingCount" to count
                 )
             ).await()
             
             Result.success(Unit)
        } catch (e: Exception) {
             Result.failure(e)
        }
    }

    suspend fun getLocationReviews(locationId: String): Result<List<LocationReview>> {
        return try {
            val snapshot = locationsCollection.document(locationId)
                .collection("reviews")
                .orderBy("createdAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .get()
                .await()
            
            val reviews = snapshot.toObjects(LocationReview::class.java)
            Result.success(reviews)
        } catch (e: Exception) {
            // Fallback: try without ordering if index missing
             try {
                val snapshot = locationsCollection.document(locationId)
                    .collection("reviews")
                    .get()
                    .await()
                val reviews = snapshot.toObjects(LocationReview::class.java)
                Result.success(reviews)
             } catch (e2: Exception) {
                 Result.failure(e2)
             }
        }
    }

    /**
     * Seeds the database with Ginásio de Esportes Apollo data
     * 4 quadras de futsal + 2 campos de society
     * Horário: 19:00 - 00:00, todos os dias
     * Mínimo: 1 hora
     */
    suspend fun seedGinasioApollo(): Result<Location> {
        return try {
            // Verificar se já existe
            val existing = locationsCollection
                .whereEqualTo("name", "Ginásio de Esportes Apollo")
                .limit(1)
                .get()
                .await()

            if (!existing.isEmpty) {
                val location = existing.documents.first().toObject(Location::class.java)!!
                AppLogger.d(TAG) { "Ginásio Apollo já existe: ${location.id}" }
                return Result.success(location)
            }

            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Criar o local
            val docRef = locationsCollection.document()
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
                operatingDays = listOf(1, 2, 3, 4, 5, 6, 7)
            )

            docRef.set(location).await()
            AppLogger.d(TAG) { "Ginásio Apollo criado: ${location.id}" }

            // Criar 4 quadras de futsal
            for (i in 1..4) {
                val fieldRef = fieldsCollection.document()
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
                AppLogger.d(TAG) { "Quadra Futsal $i criada" }
            }

            // Criar 2 campos de society
            for (i in 1..2) {
                val fieldRef = fieldsCollection.document()
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
                AppLogger.d(TAG) { "Campo Society $i criada" }
            }

            Result.success(location)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao criar seed do Ginásio Apollo", e)
            Result.failure(e)
        }
    }
    /**
     * Seeds the database with 50 locations in Curitiba region
     */
    /**
     * Seeds the database with 50 locations in Curitiba region
     * DEPRECATED: Use migrateLocations instead.
     */
    suspend fun seedCuritibaLocations(currentUserId: String? = null): Result<Int> {
        return Result.success(0)
    }

    /**
     * Migration/Seeding Utility: Updates or Creates locations based on provided data.
     * Matches by NAME (case insensitive).
     */
    suspend fun migrateLocations(migrationData: List<LocationMigrationData>): Result<Int> {
        return try {
            val validData = migrationData.filter { it.nameKey.isNotBlank() }
            if (validData.isEmpty()) return Result.success(0)

            val uid = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado para migração"))

            // Efficient approach: Get all locations once instead of N queries
            val allLocationsResult = getAllLocations()
            if (allLocationsResult.isFailure) return Result.failure(allLocationsResult.exceptionOrNull()!!)
            
            val allLocations = allLocationsResult.getOrNull() ?: emptyList()
            var processedCount = 0

            for (data in validData) {
                // Find location by name (case insensitive)
                val existingLoc = allLocations.find { it.name.trim().equals(data.nameKey.trim(), ignoreCase = true) }
                
                // Determine contact info precedence
                val finalPhone = if (!data.whatsapp.isNullOrBlank()) data.whatsapp else data.phone
                
                // Parse Instagram (remove URL if present)
                val finalInsta = data.instagram?.substringAfter(".com/")?.replace("/", "")?.replace("@", "")
                
                if (existingLoc != null) {
                    // UPDATE
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
                        address = "${data.street}, ${data.number}${if (data.complement.isNotBlank()) " - " + data.complement else ""} - ${data.neighborhood}, ${data.city} - ${data.state}",
                        
                        // Update optional fields if provided in data
                        phone = finalPhone ?: existingLoc.phone,
                        instagram = finalInsta ?: existingLoc.instagram,
                        amenities = if (data.amenities.isNotEmpty()) data.amenities else existingLoc.amenities,
                        description = data.description ?: existingLoc.description,
                        openingTime = data.openingTime ?: existingLoc.openingTime,
                        closingTime = data.closingTime ?: existingLoc.closingTime
                    )
                    updateLocation(updated)
                } else {
                    // CREATE (Seed)
                   val docRef = locationsCollection.document()
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
                       address = "${data.street}, ${data.number}${if (data.complement.isNotBlank()) " - " + data.complement else ""} - ${data.neighborhood}, ${data.city} - ${data.state}",
                       phone = finalPhone,
                       instagram = finalInsta,
                       amenities = data.amenities,
                       description = data.description ?: "",
                       openingTime = data.openingTime ?: "08:00",
                       closingTime = data.closingTime ?: "23:00",
                       minGameDurationMinutes = 60,
                       isActive = true,
                       isVerified = true
                   )
                   docRef.set(newLoc).await()
                   
                   // Create default fields based on modalities
                   // Basic logic: 1 field per modality or just 1 default
                   val mainType = if (data.modalities.any { it.contains("Futsal", true) }) "FUTSAL" else "SOCIETY"
                   val count = if (data.numFieldsEstimation > 0) data.numFieldsEstimation else 1
                   
                   for (i in 1..count) {
                       val fieldRef = fieldsCollection.document()
                       val field = Field(
                           id = fieldRef.id,
                           locationId = newLoc.id,
                           name = if (count > 1) "Quadra $i" else "Quadra Principal",
                           type = mainType,
                           hourlyPrice = 100.0,
                           isActive = true,
                           isCovered = true // Assumption
                       )
                       fieldRef.set(field).await()
                   }
                }
                processedCount++
            }
            Result.success(processedCount)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro na migração/seeding de locais", e)
            Result.failure(e)
        }
    }
    /**
     * Deduplicates locations based on normalized names.
     * Keeps the record with the most complete structured address data.
     */
    suspend fun deduplicateLocations(): Result<Int> {
        return try {
            val allLocationsResult = getAllLocations()
            if (allLocationsResult.isFailure) return Result.failure(allLocationsResult.exceptionOrNull()!!)
            val allLocations = allLocationsResult.getOrNull() ?: emptyList()

            // Helper to normalize strings (remove accents, lowercase, remove special chars)
            fun String.normalize(): String {
                return java.text.Normalizer.normalize(this, java.text.Normalizer.Form.NFD)
                    .replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
                    .lowercase()
                    .replace(Regex("[^a-z0-9]"), "")
            }

            var deletedCount = 0
            
            // Group by normalized name
            val grouped = allLocations.groupBy { it.name.normalize() }
            
            for ((_, duplicates) in grouped) {
                if (duplicates.size > 1) {
                    // Sort to find the "best" record to keep
                    // Priority: Has CEP (migrated) > Has Phone > ID string comparison (arbitrary tiebreaker)
                    val best = duplicates.sortedWith(compareByDescending<Location> { !it.cep.isNullOrBlank() }
                        .thenByDescending { !it.phone.isNullOrBlank() }
                        .thenByDescending { it.id } 
                    ).first()
                    
                    val toDelete = duplicates.filter { it.id != best.id }
                    
                    for (loc in toDelete) {
                        try {
                            // 1. Delete the location document
                            locationsCollection.document(loc.id).delete().await()
                            
                            // 2. Delete associated fields
                            val fieldsSnapshot = fieldsCollection.whereEqualTo("location_id", loc.id).get().await()
                            for (fieldDoc in fieldsSnapshot.documents) {
                                fieldDoc.reference.delete().await()
                            }
                            
                            deletedCount++
                            AppLogger.d(TAG) { "Deleted duplicate location: ${loc.name} (${loc.id})" }
                        } catch (e: Exception) {
                            AppLogger.e(TAG, "Error deleting duplicate ${loc.name}", e)
                        }
                    }
                }
            }
            Result.success(deletedCount)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Error executing deduplication", e)
            Result.failure(e)
        }
    }
}

