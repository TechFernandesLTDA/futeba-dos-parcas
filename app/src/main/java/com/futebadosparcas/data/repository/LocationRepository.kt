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
                        .get()
                        .await()
                }

                val locationDoc = locationDeferred.await()
                val fieldsSnapshot = fieldsDeferred.await()

                val location = locationDoc.toObject(Location::class.java)
                    ?: return@coroutineScope Result.failure(Exception("Local nao encontrado"))

                val fields = fieldsSnapshot.toObjects(Field::class.java)
                    .filter { it.isActive }
                    .sortedWith(compareBy({ it.type }, { it.name }))

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
     * Nota: Removido filtro is_active e ordenações complexas para evitar erro de índice
     */
    suspend fun getFieldsByLocation(locationId: String): Result<List<Field>> {
        return try {
            if (locationId.isBlank()) {
                return Result.failure(Exception("ID do local inválido"))
            }
            
            val snapshot = fieldsCollection
                .whereEqualTo("location_id", locationId)
                .get()
                .await()

            // Ordenar localmente para evitar necessidade de índice composto
            val fields = snapshot.toObjects(Field::class.java)
                .sortedWith(compareBy({ it.type }, { it.name }))
            
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
    suspend fun seedCuritibaLocations(currentUserId: String? = null): Result<Int> {
        return try {
            val uid = currentUserId ?: auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))

            val locationsToSeed = listOf(
                // 1) Arena Amigos da Bola
                Location(
                    name = "Arena Amigos da Bola",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Boa Vista",
                    region = "Norte",
                    address = "Rua Estados Unidos, 2851",
                    latitude = -25.392827,
                    longitude = -49.2572238,
                    phone = "(41) 3206-6241",
                    instagram = "@arenaamigosdabola",
                    amenities = listOf("sport bar", "churrasqueira", "vestiario", "wi-fi", "estacionamento"),
                    ownerId = uid,
                    isVerified = true,
                    description = "2 quadras society (cobertas), piso sintético"
                ),
                // 2) Camisa 9 – Futebol e Diversão
                Location(
                    name = "Camisa 9 – Futebol e Diversão",
                    city = "Pinhais",
                    state = "PR",
                    neighborhood = "Centro",
                    region = "Grande Curitiba",
                    address = "Avenida Ayrton Senna da Silva, 2700",
                    latitude = -25.444941,
                    longitude = -49.1931287,
                    phone = "(41) 88288-499",
                    amenities = listOf("estacionamento", "bar", "churrasqueira", "salao de festas", "vestiario"),
                    ownerId = uid,
                    isVerified = true,
                    description = "3 quadras society (cobertas) + 1 campo (grama)"
                ),
                // 3) Cancha do Corinthians
                Location(
                    name = "Cancha do Corinthians",
                    city = "Pinhais",
                    state = "PR",
                    neighborhood = "Vargem Grande",
                    region = "Grande Curitiba",
                    address = "R. Henrique Coelho Neto, 534",
                    latitude = -25.448291,
                    longitude = -49.1774825,
                    phone = "(41) 99944-2404",
                    ownerId = uid,
                    isVerified = true,
                    description = "Campo de Futebol Suíço e Society"
                ),
                // 4) ARP – Futebol Society e Academia
                Location(
                    name = "ARP – Futebol Society e Academia",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Rebouças",
                    region = "Centro/Sul",
                    address = "Rua 24 de Maio, 988",
                    latitude = -25.443195,
                    longitude = -49.266225,
                    ownerId = uid,
                    isVerified = true
                ),
                // 5) Futebol Society Barcelona
                Location(
                    name = "Futebol Society Barcelona",
                    city = "Pinhais",
                    state = "PR",
                    neighborhood = "Emiliano Perneta",
                    region = "Grande Curitiba",
                    address = "R. Marialva, 506",
                    latitude = -25.42397,
                    longitude = -49.18378,
                    ownerId = uid,
                    isVerified = true
                ),
                // 6) JB Esportes & Eventos
                Location(
                    name = "JB Esportes & Eventos",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Portão",
                    region = "Sul",
                    address = "Rua João Bettega, 3173",
                    latitude = -25.4881045,
                    longitude = -49.3198734,
                    ownerId = uid,
                    isVerified = true,
                    description = "Society e Futsal"
                ),
                // 7) Brasil Soccer (Portão)
                Location(
                    name = "Brasil Soccer",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Portão",
                    region = "Sul",
                    address = "Rua João Bettega, 1250",
                    latitude = -25.47696,
                    longitude = -49.30799,
                    ownerId = uid,
                    isVerified = true
                ),
                // 8) Top Sports Centro Esportivo
                Location(
                    name = "Top Sports Centro Esportivo",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Portão",
                    region = "Sul",
                    address = "Rua João Bettega, 2709",
                    latitude = -25.503923,
                    longitude = -49.330805,
                    ownerId = uid,
                    isVerified = true
                ),
                // 9) Eco Soccer (Pilarzinho)
                Location(
                    name = "Eco Soccer",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Pilarzinho",
                    region = "Norte",
                    address = "Rua Nilo Peçanha, 2575",
                    latitude = -25.3898,
                    longitude = -49.2721,
                    ownerId = uid,
                    isVerified = true
                ),
                // 10) Copacabana Sports
                Location(
                    name = "Copacabana Sports",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Capão da Imbuia",
                    region = "Leste",
                    address = "Rua Antônio Simm, 809",
                    // Coords approx
                    latitude = -25.4385,
                    longitude = -49.2215,
                    ownerId = uid,
                    isVerified = true
                ),
                // 11) Duga Sports (Uberaba)
                Location(
                    name = "Duga Sports",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Uberaba",
                    region = "Leste",
                    address = "Rua Dr. Joaquim Ignácio Silveira da Motta, 1211",
                    latitude = -25.474668,
                    longitude = -49.231902,
                    ownerId = uid,
                    isVerified = true
                ),
                // 12) Goleadores Futebol Society (Uberaba)
                Location(
                    name = "Goleadores Futebol Society",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Uberaba",
                    region = "Leste",
                    address = "Av. Senador Salgado Filho, 1690",
                    latitude = -25.4791162,
                    longitude = -49.2254817,
                    ownerId = uid,
                    isVerified = true
                ),
                // 13) Meia Alta Society (CIC)
                Location(
                    name = "Meia Alta Society",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "CIC",
                    region = "Oeste",
                    address = "Rua Nossa Senhora da Cabeça, 1845",
                    latitude = -25.4957427,
                    longitude = -49.3155662,
                    ownerId = uid,
                    isVerified = true
                ),
                // 14) Premium Esportes e Eventos (Campo Comprido)
                Location(
                    name = "Premium Esportes e Eventos",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Campo Comprido",
                    region = "Oeste",
                    address = "Rua Renato Polatti, 2535",
                    latitude = -25.4607422,
                    longitude = -49.331917,
                    ownerId = uid,
                    isVerified = true
                ),
                // 15) BR Sports (Xaxim)
                Location(
                    name = "BR Sports",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Xaxim",
                    region = "Sul",
                    address = "BR-116, 15499",
                    latitude = -25.49805,
                    longitude = -49.2770138,
                    ownerId = uid,
                    isVerified = true
                ),
                // 16) Arena Boqueirão
                Location(
                    name = "Arena Boqueirão",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Boqueirão",
                    region = "Sul",
                    ownerId = uid,
                    description = "Google Maps Query: Arena Boqueirão Curitiba PR"
                ),
                // 17) Arena Xaxim
                Location(
                    name = "Arena Xaxim",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Xaxim",
                    region = "Sul",
                    ownerId = uid,
                    description = "Google Maps Query: Arena Xaxim Curitiba PR"
                ),
                // 18) Baldan Sports Futsal
                Location(
                    name = "Baldan Sports Futsal",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Sítio Cercado",
                    region = "Sul",
                    ownerId = uid,
                    description = "Google Maps Query: Baldan Sports Futsal Sítio Cercado Curitiba PR"
                ),
                // 19) Arena Santa Cândida
                Location(
                    name = "Arena Santa Cândida",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Santa Cândida",
                    region = "Norte",
                    ownerId = uid,
                    description = "Google Maps Query: Arena Santa Cândida Curitiba PR"
                ),
                // 20) Arena Tarumã
                Location(
                    name = "Arena Tarumã",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Tarumã",
                    region = "Leste",
                    ownerId = uid,
                    description = "Google Maps Query: Arena Tarumã Curitiba PR"
                ),
                 // 21) Arena Alto da XV
                Location(
                    name = "Arena Alto da XV",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Alto da XV",
                    region = "Central",
                    ownerId = uid,
                    description = "Google Maps Query: Arena Alto da XV Curitiba PR"
                ),
                // 22) Arena Santa Quitéria
                Location(
                    name = "Arena Santa Quitéria",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Santa Quitéria",
                    region = "Sul/Oeste",
                    ownerId = uid,
                    description = "Google Maps Query: Arena Santa Quitéria Curitiba PR"
                ),
                // 23) Arena Orleans
                Location(
                    name = "Arena Orleans",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Orleans",
                    region = "Oeste",
                    ownerId = uid,
                    description = "Google Maps Query: Arena Orleans Curitiba PR"
                ),
                // 24) Arena Bairro Alto
                Location(
                    name = "Arena Bairro Alto",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Bairro Alto",
                    region = "Norte",
                    ownerId = uid,
                    description = "Google Maps Query: Arena Bairro Alto Curitiba PR"
                ),
                // 25) Arena Hauer (Fut & Chopp)
                Location(
                    name = "Arena Hauer (Fut & Chopp)",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Hauer",
                    region = "Sul",
                    ownerId = uid,
                    description = "Google Maps Query: Fut & Chopp Arena Hauer Curitiba PR"
                ),
                // 26) Arena Tatuquara
                Location(
                    name = "Arena Tatuquara",
                    city = "Curitiba",
                    state = "PR",
                    neighborhood = "Tatuquara",
                    region = "Sul",
                    ownerId = uid,
                    description = "Google Maps Query: Arena Tatuquara Curitiba PR"
                ),
                // 27) DD Arena Sports (Pinhais)
                Location(
                    name = "DD Arena Sports",
                    city = "Pinhais",
                    state = "PR",
                    region = "Grande Curitiba",
                    ownerId = uid,
                    description = "Google Maps Query: DD Arena Sports Pinhais PR"
                ),
                // 28) Arena Ceschin Fut7 (Pinhais)
                Location(
                    name = "Arena Ceschin Fut7",
                    city = "Pinhais",
                    state = "PR",
                    region = "Grande Curitiba",
                    ownerId = uid,
                    description = "Google Maps Query: Arena Ceschin Fut7 Pinhais PR"
                ),
                // 29) Centro Esportivo Mendes (Pinhais)
                Location(
                    name = "Centro Esportivo Mendes",
                    city = "Pinhais",
                    state = "PR",
                    region = "Grande Curitiba",
                    ownerId = uid,
                    description = "Google Maps Query: Centro Esportivo Mendes Pinhais PR"
                ),
                // 30) Centro da Juventude de Pinhais
                Location(
                    name = "Centro da Juventude de Pinhais",
                    city = "Pinhais",
                    state = "PR",
                    region = "Grande Curitiba",
                    ownerId = uid,
                    description = "Google Maps Query: Centro da Juventude de Pinhais Pinhais PR"
                ),
                // 31) Ginásio Tancredo Neves – Poli (Pinhais)
                Location(
                    name = "Ginásio Tancredo Neves – Poli",
                    city = "Pinhais",
                    state = "PR",
                    region = "Grande Curitiba",
                    address = "Rua 11 de Junho, 637",
                    latitude = -25.43806,
                    longitude = -49.19269,
                    phone = "(41) 99280-1073",
                    ownerId = uid,
                    isVerified = true
                ),
                
                // --- Genéricos para cobertura geográfica ---
                
                // 32) Arena Society São José dos Pinhais
                Location(name = "Arena Society São José dos Pinhais", city = "São José dos Pinhais", state = "PR", region = "Grande Curitiba", ownerId = uid),
                // 33) Arena Society Colombo
                Location(name = "Arena Society Colombo", city = "Colombo", state = "PR", region = "Grande Curitiba", ownerId = uid),
                // 34) Arena Society Araucária
                Location(name = "Arena Society Araucária", city = "Araucária", state = "PR", region = "Grande Curitiba", ownerId = uid),
                // 35) Arena Society Campo Largo
                Location(name = "Arena Society Campo Largo", city = "Campo Largo", state = "PR", region = "Grande Curitiba", ownerId = uid),
                // 36) Arena Society Fazenda Rio Grande
                Location(name = "Arena Society Fazenda Rio Grande", city = "Fazenda Rio Grande", state = "PR", region = "Grande Curitiba", ownerId = uid),
                // 37) Arena Society Almirante Tamandaré
                Location(name = "Arena Society Almirante Tamandaré", city = "Almirante Tamandaré", state = "PR", region = "Grande Curitiba", ownerId = uid),
                // 38) Arena Society Piraquara
                Location(name = "Arena Society Piraquara", city = "Piraquara", state = "PR", region = "Grande Curitiba", ownerId = uid),
                // 39) Arena Society Quatro Barras
                Location(name = "Arena Society Quatro Barras", city = "Quatro Barras", state = "PR", region = "Grande Curitiba", ownerId = uid),
                // 40) Arena Society Rio Branco do Sul
                Location(name = "Arena Society Rio Branco do Sul", city = "Rio Branco do Sul", state = "PR", region = "Grande Curitiba", ownerId = uid),
                
                // --- Genéricos Bairros Curitiba ---
                
                // 41) Quadra de Futsal Portão
                Location(name = "Quadra de Futsal Portão", city = "Curitiba", state = "PR", neighborhood = "Portão", region = "Sul", ownerId = uid, description = "Futsal"),
                // 42) Quadra de Futsal Água Verde
                Location(name = "Quadra de Futsal Água Verde", city = "Curitiba", state = "PR", neighborhood = "Água Verde", region = "Sul", ownerId = uid, description = "Futsal"),
                // 43) Quadra de Futsal Boqueirão
                Location(name = "Quadra de Futsal Boqueirão", city = "Curitiba", state = "PR", neighborhood = "Boqueirão", region = "Sul", ownerId = uid, description = "Futsal"),
                // 44) Quadra de Futsal Santa Felicidade
                Location(name = "Quadra de Futsal Santa Felicidade", city = "Curitiba", state = "PR", neighborhood = "Santa Felicidade", region = "Oeste", ownerId = uid, description = "Futsal"),
                // 45) Quadra Society Santa Cândida
                Location(name = "Quadra Society Santa Cândida", city = "Curitiba", state = "PR", neighborhood = "Santa Cândida", region = "Norte", ownerId = uid, description = "Society"),
                // 46) Quadra Society Pinheirinho
                Location(name = "Quadra Society Pinheirinho", city = "Curitiba", state = "PR", neighborhood = "Pinheirinho", region = "Sul", ownerId = uid, description = "Society"),
                // 47) Quadra Society Cajuru
                Location(name = "Quadra Society Cajuru", city = "Curitiba", state = "PR", neighborhood = "Cajuru", region = "Leste", ownerId = uid, description = "Society"),
                // 48) Quadra Society Barreirinha
                Location(name = "Quadra Society Barreirinha", city = "Curitiba", state = "PR", neighborhood = "Barreirinha", region = "Norte", ownerId = uid, description = "Society"),
                // 49) Quadra Society Sítio Cercado
                Location(name = "Quadra Society Sítio Cercado", city = "Curitiba", state = "PR", neighborhood = "Sítio Cercado", region = "Sul", ownerId = uid, description = "Society"),
                // 50) Quadra Society Uberaba
                Location(name = "Quadra Society Uberaba", city = "Curitiba", state = "PR", neighborhood = "Uberaba", region = "Leste", ownerId = uid, description = "Society")
            )

            var addedCount = 0
            for (loc in locationsToSeed) {
                // Verificar existência pelo nome e cidade (simples desduplicação)
                val existing = locationsCollection
                    .whereEqualTo("name", loc.name)
                    .whereEqualTo("city", loc.city)
                    .limit(1)
                    .get()
                    .await()

                if (existing.isEmpty) {
                    val docRef = locationsCollection.document()
                    val newLoc = loc.copy(id = docRef.id)
                    docRef.set(newLoc).await()
                    
                    // Adicionar uma quadra padrão para cada local, para evitar locais vazios
                    val fieldType = if (loc.name.contains("Futsal", ignoreCase = true) || loc.description.contains("Futsal", ignoreCase = true)) "FUTSAL" else "SOCIETY"
                    
                    val fieldRef = fieldsCollection.document()
                    val defaultField = Field(
                        id = fieldRef.id,
                        locationId = newLoc.id,
                        name = "Quadra Principal",
                        type = fieldType,
                        hourlyPrice = 100.0,
                        isActive = true,
                        isCovered = true
                    )
                    fieldRef.set(defaultField).await()
                    
                    addedCount++
                }
            }
            
            Result.success(addedCount)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao popular locais de Curitiba", e)
            Result.failure(e)
        }
    }
}
