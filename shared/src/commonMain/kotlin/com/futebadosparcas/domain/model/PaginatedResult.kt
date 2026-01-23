package com.futebadosparcas.domain.model

import kotlinx.serialization.Serializable

/**
 * Resultado paginado genérico para queries do Firestore.
 *
 * Utiliza cursor-based pagination para navegação eficiente entre páginas.
 * O cursor é uma string codificada que representa a posição do último item retornado.
 *
 * @param T Tipo dos itens na lista
 * @property items Lista de itens da página atual
 * @property cursor Cursor codificado para a próxima página (null se não houver mais páginas)
 * @property hasMore Indica se há mais itens após esta página
 * @property totalCount Contagem total opcional de itens (pode ser omitido por performance)
 */
@Serializable
data class PaginatedResult<T>(
    val items: List<T>,
    val cursor: String?,
    val hasMore: Boolean,
    val totalCount: Int? = null
) {
    companion object {
        /**
         * Cria um resultado vazio (sem itens e sem próxima página)
         */
        fun <T> empty(): PaginatedResult<T> = PaginatedResult(
            items = emptyList(),
            cursor = null,
            hasMore = false,
            totalCount = 0
        )

        /**
         * Cria um resultado de página única (todos os itens, sem próxima página)
         */
        fun <T> singlePage(items: List<T>): PaginatedResult<T> = PaginatedResult(
            items = items,
            cursor = null,
            hasMore = false,
            totalCount = items.size
        )
    }
}

/**
 * Campos de ordenação disponíveis para Locations
 */
enum class LocationSortField(val firestoreField: String) {
    NAME("name"),
    CITY("city"),
    RATING("rating"),
    CREATED_AT("createdAt");

    companion object {
        fun fromString(value: String): LocationSortField {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: NAME
        }
    }
}
