package com.futebadosparcas.data

import com.futebadosparcas.data.cache.LocationCache
import com.futebadosparcas.domain.model.*
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.logging.PlatformLogger

/**
 * Implementacao iOS do LocationRepository.
 *
 * Usa FirebaseDataSource para operacoes de Firebase e LocationCache
 * para cache LRU com TTL de 5 minutos e max 50 entradas.
 *
 * NOTA: Esta implementacao usa o mesmo cache multiplataforma do Android.
 *
 * @see FirebaseDataSource (iOS implementation needed)
 */
class LocationRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : LocationRepository {

    companion object {
        private const val TAG = "LocationRepository"
    }

    // Cache LRU com TTL para locais (max 50 entradas, TTL 5 minutos)
    private val cache = LocationCache()

    // ========== LOCATIONS ==========

    override suspend fun getAllLocations(): Result<List<Location>> {
        return try {
            PlatformLogger.d(TAG,"Buscando todos os locais (iOS)")
            firebaseDataSource.getAllLocations()
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao buscar locais", e)
            Result.failure(e)
        }
    }

    override suspend fun getLocationsWithPagination(
        limit: Int,
        lastLocationName: String?
    ): Result<List<Location>> {
        return try {
            PlatformLogger.d(TAG,"Buscando locais com paginacao (iOS): limit=$limit, last=$lastLocationName")
            firebaseDataSource.getLocationsWithPagination(limit, lastLocationName)
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao buscar locais com paginacao", e)
            Result.failure(e)
        }
    }

    override suspend fun deleteLocation(locationId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG,"Deletando local (iOS): $locationId")
            firebaseDataSource.deleteLocation(locationId).also { result ->
                if (result.isSuccess) {
                    // Invalidar cache apos deletar
                    cache.invalidate(locationId)
                    PlatformLogger.d(TAG,"Cache invalidado para local: $locationId")
                }
            }
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao deletar local", e)
            Result.failure(e)
        }
    }

    override suspend fun getLocationsByOwner(ownerId: String): Result<List<Location>> {
        return try {
            // Tentar buscar do cache primeiro
            val cached = cache.getByOwner(ownerId)
            if (cached != null) {
                PlatformLogger.d(TAG,"Cache HIT: locais do proprietario $ownerId (${cached.size} locais)")
                return Result.success(cached)
            }

            PlatformLogger.d(TAG,"Cache MISS: buscando locais do proprietario (iOS): $ownerId")
            firebaseDataSource.getLocationsByOwner(ownerId).also { result ->
                result.getOrNull()?.let { locations ->
                    cache.putByOwner(ownerId, locations)
                    PlatformLogger.d(TAG,"Cache atualizado para owner $ownerId com ${locations.size} locais")
                }
            }
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao buscar locais do proprietario", e)
            Result.failure(e)
        }
    }

    override suspend fun getLocationById(locationId: String): Result<Location> {
        return try {
            // Tentar buscar do cache primeiro
            val cached = cache.getById(locationId)
            if (cached != null) {
                PlatformLogger.d(TAG,"Cache HIT: local $locationId")
                return Result.success(cached)
            }

            PlatformLogger.d(TAG,"Cache MISS: buscando local (iOS): $locationId")
            firebaseDataSource.getLocationById(locationId).also { result ->
                result.getOrNull()?.let { location ->
                    cache.putById(location)
                    PlatformLogger.d(TAG,"Cache atualizado para local ${location.id}")
                }
            }
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao buscar local", e)
            Result.failure(e)
        }
    }

    override suspend fun getLocationWithFields(locationId: String): Result<LocationWithFields> {
        return try {
            PlatformLogger.d(TAG,"Buscando local com quadras (iOS): $locationId")
            firebaseDataSource.getLocationWithFields(locationId).also { result ->
                // Cachear o local (sem as quadras)
                result.getOrNull()?.let { locationWithFields ->
                    cache.putById(locationWithFields.location)
                }
            }
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao buscar local com quadras", e)
            Result.failure(e)
        }
    }

    override suspend fun createLocation(location: Location): Result<Location> {
        return try {
            PlatformLogger.d(TAG,"Criando local (iOS): ${location.name}")
            firebaseDataSource.createLocation(location).also { result ->
                result.getOrNull()?.let { createdLocation ->
                    // Cachear o local criado
                    cache.putById(createdLocation)
                    // Invalidar cache do owner para forcar refresh da lista
                    if (createdLocation.ownerId.isNotEmpty()) {
                        cache.invalidateByOwner(createdLocation.ownerId)
                    }
                    PlatformLogger.d(TAG,"Local criado e cacheado: ${createdLocation.id}")
                }
            }
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao criar local", e)
            Result.failure(e)
        }
    }

    override suspend fun updateLocation(location: Location): Result<Unit> {
        return try {
            PlatformLogger.d(TAG,"Atualizando local (iOS): ${location.id}")
            firebaseDataSource.updateLocation(location).also { result ->
                if (result.isSuccess) {
                    // Invalidar cache do local e do owner
                    cache.invalidate(location.id)
                    if (location.ownerId.isNotEmpty()) {
                        cache.invalidateByOwner(location.ownerId)
                    }
                    PlatformLogger.d(TAG,"Cache invalidado apos atualizar local: ${location.id}")
                }
            }
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao atualizar local", e)
            Result.failure(e)
        }
    }

    override suspend fun getServerLocationVersion(locationId: String): Result<Location> {
        return try {
            PlatformLogger.d(TAG,"Buscando versao do servidor (bypass cache) para local (iOS): $locationId")
            // Busca diretamente do Firebase, sem usar cache
            firebaseDataSource.getLocationById(locationId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao buscar versao do servidor", e)
            Result.failure(e)
        }
    }

    override suspend fun searchLocations(query: String): Result<List<Location>> {
        return try {
            // Tentar buscar do cache primeiro (para queries com pelo menos 2 caracteres)
            if (query.trim().length >= 2) {
                val cached = cache.getBySearchQuery(query)
                if (cached != null) {
                    PlatformLogger.d(TAG,"Cache HIT: busca '$query' (${cached.size} resultados)")
                    return Result.success(cached)
                }
            }

            PlatformLogger.d(TAG,"Cache MISS: buscando locais (iOS): $query")
            firebaseDataSource.searchLocations(query).also { result ->
                result.getOrNull()?.let { locations ->
                    if (query.trim().length >= 2) {
                        cache.putBySearchQuery(query, locations)
                        PlatformLogger.d(TAG,"Cache atualizado para busca '$query' com ${locations.size} resultados")
                    }
                }
            }
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao buscar locais", e)
            Result.failure(e)
        }
    }

    override suspend fun getOrCreateLocationFromPlace(
        placeId: String,
        name: String,
        address: String,
        city: String,
        state: String,
        latitude: Double?,
        longitude: Double?
    ): Result<Location> {
        return try {
            PlatformLogger.d(TAG,"Buscando/criando local do lugar (iOS): $name")
            firebaseDataSource.getOrCreateLocationFromPlace(
                placeId, name, address, city, state, latitude, longitude
            ).also { result ->
                result.getOrNull()?.let { location ->
                    cache.putById(location)
                    PlatformLogger.d(TAG,"Local do place cacheado: ${location.id}")
                }
            }
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao buscar/criar local", e)
            Result.failure(e)
        }
    }

    override suspend fun addLocationReview(review: LocationReview): Result<Unit> {
        return try {
            PlatformLogger.d(TAG,"Adicionando review ao local (iOS): ${review.locationId}")
            firebaseDataSource.addLocationReview(review).also { result ->
                if (result.isSuccess) {
                    // Invalidar cache do local (rating pode ter mudado)
                    cache.invalidate(review.locationId)
                }
            }
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao adicionar review", e)
            Result.failure(e)
        }
    }

    override suspend fun getLocationReviews(locationId: String): Result<List<LocationReview>> {
        return try {
            PlatformLogger.d(TAG,"Buscando reviews do local (iOS): $locationId")
            firebaseDataSource.getLocationReviews(locationId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao buscar reviews", e)
            Result.failure(e)
        }
    }

    override suspend fun seedGinasioApollo(): Result<Location> {
        return try {
            PlatformLogger.d(TAG,"Fazendo seed do Ginasio Apollo (iOS)")
            firebaseDataSource.seedGinasioApollo().also { result ->
                result.getOrNull()?.let { location ->
                    cache.putById(location)
                }
            }
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao fazer seed", e)
            Result.failure(e)
        }
    }

    override suspend fun migrateLocations(migrationData: List<LocationMigrationData>): Result<Int> {
        return try {
            PlatformLogger.d(TAG,"Migrando ${migrationData.size} locais (iOS)")
            firebaseDataSource.migrateLocations(migrationData).also { result ->
                if (result.isSuccess) {
                    // Limpar cache apos migracao em massa
                    cache.clear()
                    PlatformLogger.d(TAG,"Cache limpo apos migracao")
                }
            }
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao migrar locais", e)
            Result.failure(e)
        }
    }

    override suspend fun deduplicateLocations(): Result<Int> {
        return try {
            PlatformLogger.d(TAG,"Deduplicando locais (iOS)")
            firebaseDataSource.deduplicateLocations().also { result ->
                if (result.isSuccess) {
                    // Limpar cache apos deduplicacao
                    cache.clear()
                    PlatformLogger.d(TAG,"Cache limpo apos deduplicacao")
                }
            }
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao deduplicar locais", e)
            Result.failure(e)
        }
    }

    // ========== FIELDS ==========

    override suspend fun getFieldsByLocation(locationId: String): Result<List<Field>> {
        return try {
            PlatformLogger.d(TAG,"Buscando quadras do local (iOS): $locationId")
            firebaseDataSource.getFieldsByLocation(locationId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao buscar quadras", e)
            Result.failure(e)
        }
    }

    override suspend fun getFieldById(fieldId: String): Result<Field> {
        return try {
            PlatformLogger.d(TAG,"Buscando quadra (iOS): $fieldId")
            firebaseDataSource.getFieldById(fieldId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao buscar quadra", e)
            Result.failure(e)
        }
    }

    override suspend fun createField(field: Field): Result<Field> {
        return try {
            PlatformLogger.d(TAG,"Criando quadra (iOS): ${field.name}")
            firebaseDataSource.createField(field).also { result ->
                if (result.isSuccess) {
                    // Invalidar cache do local pai (numero de quadras pode ter mudado)
                    cache.invalidate(field.locationId)
                }
            }
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao criar quadra", e)
            Result.failure(e)
        }
    }

    override suspend fun updateField(field: Field): Result<Unit> {
        return try {
            PlatformLogger.d(TAG,"Atualizando quadra (iOS): ${field.id}")
            firebaseDataSource.updateField(field)
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao atualizar quadra", e)
            Result.failure(e)
        }
    }

    override suspend fun deleteField(fieldId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG,"Deletando quadra (iOS): $fieldId")
            firebaseDataSource.deleteField(fieldId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao deletar quadra", e)
            Result.failure(e)
        }
    }

    override suspend fun uploadFieldPhoto(filePath: String): Result<String> {
        return try {
            PlatformLogger.d(TAG,"Fazendo upload de foto (iOS): $filePath")
            firebaseDataSource.uploadFieldPhoto(filePath)
        } catch (e: Exception) {
            PlatformLogger.e(TAG,"Erro ao fazer upload de foto", e)
            Result.failure(e)
        }
    }

    // ========== CACHE MANAGEMENT ==========

    /**
     * Limpa todo o cache de locais.
     * Util para refresh forcado ou logout.
     */
    suspend fun clearCache() {
        cache.clear()
        PlatformLogger.d(TAG,"Cache de locais limpo")
    }

    /**
     * Retorna estatisticas do cache.
     */
    suspend fun getCacheStats(): String {
        return cache.stats().toString()
    }
}
