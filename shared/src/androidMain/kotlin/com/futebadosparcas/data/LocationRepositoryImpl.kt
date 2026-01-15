package com.futebadosparcas.data

import com.futebadosparcas.domain.model.*
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.logging.PlatformLogger

/**
 * Implementação Android do LocationRepository.
 *
 * Usa FirebaseDataSource para operações de Firebase.
 */
class LocationRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : LocationRepository {

    companion object {
        private const val TAG = "LocationRepository"
    }

    // ========== LOCATIONS ==========

    override suspend fun getAllLocations(): Result<List<Location>> {
        return try {
            PlatformLogger.d(TAG, "Buscando todos os locais")
            firebaseDataSource.getAllLocations()
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar locais", e)
            Result.failure(e)
        }
    }

    override suspend fun getLocationsWithPagination(
        limit: Int,
        lastLocationName: String?
    ): Result<List<Location>> {
        return try {
            PlatformLogger.d(TAG, "Buscando locais com paginação: limit=$limit, last=$lastLocationName")
            firebaseDataSource.getLocationsWithPagination(limit, lastLocationName)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar locais com paginação", e)
            Result.failure(e)
        }
    }

    override suspend fun deleteLocation(locationId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Deletando local: $locationId")
            firebaseDataSource.deleteLocation(locationId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao deletar local", e)
            Result.failure(e)
        }
    }

    override suspend fun getLocationsByOwner(ownerId: String): Result<List<Location>> {
        return try {
            PlatformLogger.d(TAG, "Buscando locais do proprietário: $ownerId")
            firebaseDataSource.getLocationsByOwner(ownerId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar locais do proprietário", e)
            Result.failure(e)
        }
    }

    override suspend fun getLocationById(locationId: String): Result<Location> {
        return try {
            PlatformLogger.d(TAG, "Buscando local: $locationId")
            firebaseDataSource.getLocationById(locationId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar local", e)
            Result.failure(e)
        }
    }

    override suspend fun getLocationWithFields(locationId: String): Result<LocationWithFields> {
        return try {
            PlatformLogger.d(TAG, "Buscando local com quadras: $locationId")
            firebaseDataSource.getLocationWithFields(locationId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar local com quadras", e)
            Result.failure(e)
        }
    }

    override suspend fun createLocation(location: Location): Result<Location> {
        return try {
            PlatformLogger.d(TAG, "Criando local: ${location.name}")
            firebaseDataSource.createLocation(location)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao criar local", e)
            Result.failure(e)
        }
    }

    override suspend fun updateLocation(location: Location): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Atualizando local: ${location.id}")
            firebaseDataSource.updateLocation(location)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao atualizar local", e)
            Result.failure(e)
        }
    }

    override suspend fun searchLocations(query: String): Result<List<Location>> {
        return try {
            PlatformLogger.d(TAG, "Buscando locais: $query")
            firebaseDataSource.searchLocations(query)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar locais", e)
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
            PlatformLogger.d(TAG, "Buscando/criando local do lugar: $name")
            firebaseDataSource.getOrCreateLocationFromPlace(
                placeId, name, address, city, state, latitude, longitude
            )
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar/criar local", e)
            Result.failure(e)
        }
    }

    override suspend fun addLocationReview(review: LocationReview): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Adicionando review ao local: ${review.locationId}")
            firebaseDataSource.addLocationReview(review)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao adicionar review", e)
            Result.failure(e)
        }
    }

    override suspend fun getLocationReviews(locationId: String): Result<List<LocationReview>> {
        return try {
            PlatformLogger.d(TAG, "Buscando reviews do local: $locationId")
            firebaseDataSource.getLocationReviews(locationId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar reviews", e)
            Result.failure(e)
        }
    }

    override suspend fun seedGinasioApollo(): Result<Location> {
        return try {
            PlatformLogger.d(TAG, "Fazendo seed do Ginásio Apollo")
            firebaseDataSource.seedGinasioApollo()
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao fazer seed", e)
            Result.failure(e)
        }
    }

    override suspend fun migrateLocations(migrationData: List<LocationMigrationData>): Result<Int> {
        return try {
            PlatformLogger.d(TAG, "Migrando ${migrationData.size} locais")
            firebaseDataSource.migrateLocations(migrationData)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao migrar locais", e)
            Result.failure(e)
        }
    }

    override suspend fun deduplicateLocations(): Result<Int> {
        return try {
            PlatformLogger.d(TAG, "Deduplicando locais")
            firebaseDataSource.deduplicateLocations()
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao deduplicar locais", e)
            Result.failure(e)
        }
    }

    // ========== FIELDS ==========

    override suspend fun getFieldsByLocation(locationId: String): Result<List<Field>> {
        return try {
            PlatformLogger.d(TAG, "Buscando quadras do local: $locationId")
            firebaseDataSource.getFieldsByLocation(locationId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar quadras", e)
            Result.failure(e)
        }
    }

    override suspend fun getFieldById(fieldId: String): Result<Field> {
        return try {
            PlatformLogger.d(TAG, "Buscando quadra: $fieldId")
            firebaseDataSource.getFieldById(fieldId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar quadra", e)
            Result.failure(e)
        }
    }

    override suspend fun createField(field: Field): Result<Field> {
        return try {
            PlatformLogger.d(TAG, "Criando quadra: ${field.name}")
            firebaseDataSource.createField(field)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao criar quadra", e)
            Result.failure(e)
        }
    }

    override suspend fun updateField(field: Field): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Atualizando quadra: ${field.id}")
            firebaseDataSource.updateField(field)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao atualizar quadra", e)
            Result.failure(e)
        }
    }

    override suspend fun deleteField(fieldId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Deletando quadra: $fieldId")
            firebaseDataSource.deleteField(fieldId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao deletar quadra", e)
            Result.failure(e)
        }
    }

    override suspend fun uploadFieldPhoto(filePath: String): Result<String> {
        return try {
            PlatformLogger.d(TAG, "Fazendo upload de foto: $filePath")
            firebaseDataSource.uploadFieldPhoto(filePath)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao fazer upload de foto", e)
            Result.failure(e)
        }
    }
}
