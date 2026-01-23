package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.*

/**
 * Interface de repositorio de locais e quadras.
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 */
interface LocationRepository {

    // ========== LOCATIONS ==========

    /**
     * Busca todos os locais cadastrados
     */
    suspend fun getAllLocations(): Result<List<Location>>

    /**
     * Busca locais com paginação (PERF FIX: Previne loading 1000+ items)
     * @param limit Número máximo de locais por página (padrão 50)
     * @param lastLocationName Nome do último local da página anterior para cursor-based pagination
     * @deprecated Use getLocationsPaginated() para cursor-based pagination com DocumentSnapshot
     */
    suspend fun getLocationsWithPagination(limit: Int = 50, lastLocationName: String? = null): Result<List<Location>>

    /**
     * Busca locais com paginação baseada em cursor de DocumentSnapshot.
     *
     * Usa cursor-based pagination para garantir consistência mesmo quando documentos
     * são adicionados/removidos entre páginas. O cursor é uma string codificada que
     * representa a posição exata do último documento retornado.
     *
     * @param pageSize Número máximo de locais por página (padrão 20, máximo 50)
     * @param cursor Cursor codificado da página anterior (null para primeira página)
     * @param sortBy Campo de ordenação (padrão: NAME)
     * @return PaginatedResult contendo os locais, cursor para próxima página e flag hasMore
     * @throws CursorExpiredException Se o cursor expirou (>15 minutos)
     * @throws CursorDocumentNotFoundException Se o documento do cursor não existe mais
     */
    suspend fun getLocationsPaginated(
        pageSize: Int = 20,
        cursor: String? = null,
        sortBy: LocationSortField = LocationSortField.NAME
    ): Result<PaginatedResult<Location>>

    /**
     * Deleta um local
     */
    suspend fun deleteLocation(locationId: String): Result<Unit>

    /**
     * Busca locais de um proprietário específico
     */
    suspend fun getLocationsByOwner(ownerId: String): Result<List<Location>>

    /**
     * Busca um local pelo ID
     */
    suspend fun getLocationById(locationId: String): Result<Location>

    /**
     * Busca um local com todas as suas quadras
     */
    suspend fun getLocationWithFields(locationId: String): Result<LocationWithFields>

    /**
     * Cria um novo local
     */
    suspend fun createLocation(location: Location): Result<Location>

    /**
     * Atualiza um local existente
     */
    suspend fun updateLocation(location: Location): Result<Unit>

    /**
     * Busca a versao mais recente de um local diretamente do servidor (sem cache).
     * Usado para verificar conflitos antes de atualizar.
     */
    suspend fun getServerLocationVersion(locationId: String): Result<Location>

    /**
     * Busca locais pelo nome (para autocomplete)
     */
    suspend fun searchLocations(query: String): Result<List<Location>>

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
    ): Result<Location>

    /**
     * Adiciona avaliação de um local
     */
    suspend fun addLocationReview(review: LocationReview): Result<Unit>

    /**
     * Busca avaliações de um local
     */
    suspend fun getLocationReviews(locationId: String): Result<List<LocationReview>>

    /**
     * Seeds the database with Ginásio de Esportes Apollo data
     * 4 quadras de futsal + 2 campos de society
     * Horário: 19:00 - 00:00, todos os dias
     * Mínimo: 1 hora
     */
    suspend fun seedGinasioApollo(): Result<Location>

    /**
     * Migration/Seeding Utility: Updates or Creates locations based on provided data.
     * Matches by NAME (case insensitive).
     */
    suspend fun migrateLocations(migrationData: List<LocationMigrationData>): Result<Int>

    /**
     * Deduplicates locations based on normalized names.
     * Keeps the record with the most complete structured address data.
     */
    suspend fun deduplicateLocations(): Result<Int>

    // ========== FIELDS ==========

    /**
     * Busca todas as quadras de um local
     */
    suspend fun getFieldsByLocation(locationId: String): Result<List<Field>>

    /**
     * Busca uma quadra pelo ID
     */
    suspend fun getFieldById(fieldId: String): Result<Field>

    /**
     * Cria uma nova quadra
     */
    suspend fun createField(field: Field): Result<Field>

    /**
     * Atualiza uma quadra existente
     */
    suspend fun updateField(field: Field): Result<Unit>

    /**
     * Desativa uma quadra (soft delete)
     */
    suspend fun deleteField(fieldId: String): Result<Unit>

    /**
     * Faz upload de foto da quadra
     * @param filePath Caminho do arquivo no dispositivo
     * @return URL da foto enviada
     */
    suspend fun uploadFieldPhoto(filePath: String): Result<String>
}
