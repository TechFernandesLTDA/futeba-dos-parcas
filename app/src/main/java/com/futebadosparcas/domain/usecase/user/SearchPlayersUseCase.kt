package com.futebadosparcas.domain.usecase.user

import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.PlayerRatingRole
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.repository.UserRepository
import com.futebadosparcas.util.AppLogger
import javax.inject.Inject

/**
 * Use Case para buscar jogadores.
 *
 * Responsabilidades:
 * - Buscar jogadores por nome/query
 * - Filtrar por tipo de campo preferido
 * - Ordenar por habilidade/rating
 * - Paginar resultados
 */
class SearchPlayersUseCase @Inject constructor(
    private val userRepository: UserRepository
) {
    companion object {
        private const val TAG = "SearchPlayersUseCase"
        private const val DEFAULT_PAGE_SIZE = 20
    }

    /**
     * Opções de ordenação para jogadores.
     */
    enum class SortOption {
        NAME_ASC,
        NAME_DESC,
        LEVEL_DESC,
        RATING_STRIKER_DESC,
        RATING_GOALKEEPER_DESC,
        GAMES_PLAYED_DESC
    }

    /**
     * Filtros de busca.
     */
    data class SearchFilters(
        val query: String = "",
        val fieldTypes: List<FieldType> = emptyList(),
        val minLevel: Int? = null,
        val maxLevel: Int? = null,
        val onlyPublicProfiles: Boolean = true,
        val sortOption: SortOption = SortOption.NAME_ASC
    )

    /**
     * Resultado paginado da busca.
     */
    data class SearchResult(
        val players: List<User>,
        val totalCount: Int,
        val hasMore: Boolean,
        val currentPage: Int
    )

    /**
     * Busca jogadores com filtros.
     *
     * @param filters Filtros de busca
     * @param page Página atual (0-indexed)
     * @param pageSize Tamanho da página
     * @return Result com resultado paginado
     */
    suspend fun search(
        filters: SearchFilters = SearchFilters(),
        page: Int = 0,
        pageSize: Int = DEFAULT_PAGE_SIZE
    ): Result<SearchResult> {
        AppLogger.d(TAG) { "Buscando jogadores: query='${filters.query}', page=$page" }

        return try {
            // 1. Buscar usuários com query
            val usersResult = userRepository.searchUsers(filters.query)
            if (usersResult.isFailure) {
                return Result.failure(usersResult.exceptionOrNull()!!)
            }

            var players = usersResult.getOrNull()!!

            // 2. Aplicar filtros
            players = applyFilters(players, filters)

            // 3. Ordenar
            players = sortPlayers(players, filters.sortOption)

            // 4. Paginar
            val totalCount = players.size
            val startIndex = page * pageSize
            val endIndex = minOf(startIndex + pageSize, totalCount)
            val hasMore = endIndex < totalCount

            val pagedPlayers = if (startIndex < totalCount) {
                players.subList(startIndex, endIndex)
            } else {
                emptyList()
            }

            val result = SearchResult(
                players = pagedPlayers,
                totalCount = totalCount,
                hasMore = hasMore,
                currentPage = page
            )

            AppLogger.d(TAG) { "Encontrados ${totalCount} jogadores, retornando ${pagedPlayers.size}" }

            Result.success(result)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogadores", e)
            Result.failure(e)
        }
    }

    /**
     * Busca jogadores por rating de uma posição.
     *
     * @param role Posição (STRIKER, GOALKEEPER, etc)
     * @param limit Número máximo de resultados
     * @return Result com top jogadores
     */
    suspend fun getTopByRating(
        role: PlayerRatingRole,
        limit: Int = 10
    ): Result<List<User>> {
        AppLogger.d(TAG) { "Buscando top jogadores por rating: $role" }

        return try {
            val usersResult = userRepository.searchUsers("")
            if (usersResult.isFailure) {
                return Result.failure(usersResult.exceptionOrNull()!!)
            }

            val topPlayers = usersResult.getOrNull()!!
                .filter { it.isProfilePublic }
                .sortedByDescending { it.getEffectiveRating(role) }
                .take(limit)

            Result.success(topPlayers)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar top jogadores", e)
            Result.failure(e)
        }
    }

    /**
     * Busca jogadores por tipo de campo preferido.
     *
     * @param fieldType Tipo de campo
     * @param limit Número máximo de resultados
     * @return Result com jogadores que preferem o tipo de campo
     */
    suspend fun getByFieldType(
        fieldType: FieldType,
        limit: Int = 20
    ): Result<List<User>> {
        AppLogger.d(TAG) { "Buscando jogadores por tipo de campo: $fieldType" }

        return try {
            val usersResult = userRepository.searchUsers("")
            if (usersResult.isFailure) {
                return Result.failure(usersResult.exceptionOrNull()!!)
            }

            val filteredPlayers = usersResult.getOrNull()!!
                .filter { it.isProfilePublic }
                .filter { it.preferredFieldTypes.contains(fieldType) }
                .sortedBy { it.name }
                .take(limit)

            Result.success(filteredPlayers)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar jogadores por campo", e)
            Result.failure(e)
        }
    }

    private fun applyFilters(players: List<User>, filters: SearchFilters): List<User> {
        var result = players

        // Filtrar apenas perfis públicos
        if (filters.onlyPublicProfiles) {
            result = result.filter { it.isProfilePublic }
        }

        // Filtrar por tipo de campo
        if (filters.fieldTypes.isNotEmpty()) {
            result = result.filter { user ->
                user.preferredFieldTypes.any { it in filters.fieldTypes }
            }
        }

        // Filtrar por nível mínimo
        filters.minLevel?.let { minLevel ->
            result = result.filter { it.level >= minLevel }
        }

        // Filtrar por nível máximo
        filters.maxLevel?.let { maxLevel ->
            result = result.filter { it.level <= maxLevel }
        }

        return result
    }

    private fun sortPlayers(players: List<User>, sortOption: SortOption): List<User> {
        return when (sortOption) {
            SortOption.NAME_ASC -> players.sortedBy { it.name }
            SortOption.NAME_DESC -> players.sortedByDescending { it.name }
            SortOption.LEVEL_DESC -> players.sortedByDescending { it.level }
            SortOption.RATING_STRIKER_DESC -> players.sortedByDescending {
                it.getEffectiveRating(PlayerRatingRole.STRIKER)
            }
            SortOption.RATING_GOALKEEPER_DESC -> players.sortedByDescending {
                it.getEffectiveRating(PlayerRatingRole.GOALKEEPER)
            }
            SortOption.GAMES_PLAYED_DESC -> players.sortedByDescending { it.experiencePoints }
        }
    }
}
