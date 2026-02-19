package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.*
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.util.LocationQueries
import com.futebadosparcas.util.LocationQueryMetrics

/**
 * Decorator para LocationRepository que adiciona métricas de performance.
 *
 * Todas as operações são medidas e registradas no LocationQueryMetrics,
 * permitindo:
 * - Monitoramento de latência em tempo real
 * - Detecção de queries lentas
 * - Alertas de performance degradada
 * - Relatórios para Firebase Crashlytics
 *
 * Uso:
 * Substitui o LocationRepository padrão no RepositoryModule para
 * habilitar tracking automático de métricas.
 *
 * @param delegate Implementação base do LocationRepository (KMP)
 */
class MeteredLocationRepository constructor(
    private val delegate: LocationRepository
) : LocationRepository {

    // ========== LOCATIONS ==========

    override suspend fun getAllLocations(): Result<List<Location>> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.GET_ALL) {
            delegate.getAllLocations()
        }
    }

    override suspend fun getLocationsWithPagination(
        limit: Int,
        lastLocationName: String?
    ): Result<List<Location>> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.GET_WITH_PAGINATION) {
            delegate.getLocationsWithPagination(limit, lastLocationName)
        }
    }

    override suspend fun getLocationsPaginated(
        pageSize: Int,
        cursor: String?,
        sortBy: LocationSortField
    ): Result<PaginatedResult<Location>> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.GET_PAGINATED) {
            delegate.getLocationsPaginated(pageSize, cursor, sortBy)
        }
    }

    override suspend fun deleteLocation(locationId: String): Result<Unit> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.DELETE) {
            delegate.deleteLocation(locationId)
        }
    }

    override suspend fun getLocationsByOwner(ownerId: String): Result<List<Location>> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.GET_BY_OWNER) {
            delegate.getLocationsByOwner(ownerId)
        }
    }

    override suspend fun getLocationById(locationId: String): Result<Location> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.GET_BY_ID) {
            delegate.getLocationById(locationId)
        }
    }

    override suspend fun getLocationWithFields(locationId: String): Result<LocationWithFields> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.GET_WITH_FIELDS) {
            delegate.getLocationWithFields(locationId)
        }
    }

    override suspend fun createLocation(location: Location): Result<Location> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.CREATE) {
            delegate.createLocation(location)
        }
    }

    override suspend fun updateLocation(location: Location): Result<Unit> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.UPDATE) {
            delegate.updateLocation(location)
        }
    }

    override suspend fun getServerLocationVersion(locationId: String): Result<Location> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.GET_SERVER_VERSION) {
            delegate.getServerLocationVersion(locationId)
        }
    }

    override suspend fun searchLocations(query: String): Result<List<Location>> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.SEARCH) {
            delegate.searchLocations(query)
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
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.GET_OR_CREATE_FROM_PLACE) {
            delegate.getOrCreateLocationFromPlace(
                placeId, name, address, city, state, latitude, longitude
            )
        }
    }

    override suspend fun addLocationReview(review: LocationReview): Result<Unit> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.ADD_REVIEW) {
            delegate.addLocationReview(review)
        }
    }

    override suspend fun getLocationReviews(locationId: String): Result<List<LocationReview>> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.GET_REVIEWS) {
            delegate.getLocationReviews(locationId)
        }
    }

    override suspend fun seedGinasioApollo(): Result<Location> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.SEED_APOLLO) {
            delegate.seedGinasioApollo()
        }
    }

    override suspend fun migrateLocations(migrationData: List<LocationMigrationData>): Result<Int> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.MIGRATE) {
            delegate.migrateLocations(migrationData)
        }
    }

    override suspend fun deduplicateLocations(): Result<Int> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.DEDUPLICATE) {
            delegate.deduplicateLocations()
        }
    }

    // ========== FIELDS ==========

    override suspend fun getFieldsByLocation(locationId: String): Result<List<Field>> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.FIELD_GET_BY_LOCATION) {
            delegate.getFieldsByLocation(locationId)
        }
    }

    override suspend fun getFieldById(fieldId: String): Result<Field> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.FIELD_GET_BY_ID) {
            delegate.getFieldById(fieldId)
        }
    }

    override suspend fun createField(field: Field): Result<Field> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.FIELD_CREATE) {
            delegate.createField(field)
        }
    }

    override suspend fun updateField(field: Field): Result<Unit> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.FIELD_UPDATE) {
            delegate.updateField(field)
        }
    }

    override suspend fun deleteField(fieldId: String): Result<Unit> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.FIELD_DELETE) {
            delegate.deleteField(fieldId)
        }
    }

    override suspend fun uploadFieldPhoto(filePath: String): Result<String> {
        return LocationQueryMetrics.measureQuerySuspend(LocationQueries.FIELD_UPLOAD_PHOTO) {
            delegate.uploadFieldPhoto(filePath)
        }
    }
}
