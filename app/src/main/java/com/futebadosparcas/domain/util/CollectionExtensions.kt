package com.futebadosparcas.domain.util

/**
 * Extensões para manipulação de coleções com deduplicação centralizada.
 *
 * Usado para garantir consistência na remoção de duplicatas em todo o codebase,
 * especialmente em listas vindas de múltiplas fontes (Firebase, Room, etc).
 */

/**
 * Remove duplicatas de uma lista baseado no ID do elemento.
 * Mantém a primeira ocorrência de cada ID.
 *
 * @param idSelector Função que extrai o ID de cada elemento
 * @return Lista sem duplicatas
 *
 * Exemplo de uso:
 * ```kotlin
 * val games = (publicGames + privateGames).deduplicateById { it.id }
 * val users = allUsers.deduplicateById { it.id }
 * ```
 */
inline fun <T, K> List<T>.deduplicateById(crossinline idSelector: (T) -> K): List<T> {
    return distinctBy(idSelector)
}

/**
 * Remove duplicatas e ordena por um campo específico.
 * Útil para listas que precisam de ordenação após merge de múltiplas fontes.
 *
 * @param idSelector Função que extrai o ID para deduplicação
 * @param sortSelector Função que extrai o valor para ordenação
 * @return Lista sem duplicatas e ordenada
 *
 * Exemplo de uso:
 * ```kotlin
 * val sortedGames = allGames.deduplicateAndSortBy(
 *     idSelector = { it.id },
 *     sortSelector = { it.dateTime }
 * )
 * ```
 */
inline fun <T, K, R : Comparable<R>> List<T>.deduplicateAndSortBy(
    crossinline idSelector: (T) -> K,
    crossinline sortSelector: (T) -> R?
): List<T> {
    return distinctBy(idSelector).sortedBy(sortSelector)
}

/**
 * Remove duplicatas e ordena em ordem decrescente.
 *
 * @param idSelector Função que extrai o ID para deduplicação
 * @param sortSelector Função que extrai o valor para ordenação
 * @return Lista sem duplicatas e ordenada decrescente
 */
inline fun <T, K, R : Comparable<R>> List<T>.deduplicateAndSortByDescending(
    crossinline idSelector: (T) -> K,
    crossinline sortSelector: (T) -> R?
): List<T> {
    return distinctBy(idSelector).sortedByDescending(sortSelector)
}

/**
 * Remove duplicatas, ordena e limita o tamanho da lista.
 * Útil para queries paginadas ou feeds com limite.
 *
 * @param idSelector Função que extrai o ID para deduplicação
 * @param sortSelector Função que extrai o valor para ordenação
 * @param limit Número máximo de elementos a retornar
 * @return Lista processada
 *
 * Exemplo de uso:
 * ```kotlin
 * val recentGames = allGames.deduplicateSortAndLimit(
 *     idSelector = { it.id },
 *     sortSelector = { it.dateTime },
 *     limit = 20
 * )
 * ```
 */
inline fun <T, K, R : Comparable<R>> List<T>.deduplicateSortAndLimit(
    crossinline idSelector: (T) -> K,
    crossinline sortSelector: (T) -> R?,
    limit: Int
): List<T> {
    return distinctBy(idSelector)
        .sortedBy(sortSelector)
        .take(limit)
}

/**
 * Versão descendente de deduplicateSortAndLimit.
 */
inline fun <T, K, R : Comparable<R>> List<T>.deduplicateSortDescendingAndLimit(
    crossinline idSelector: (T) -> K,
    crossinline sortSelector: (T) -> R?,
    limit: Int
): List<T> {
    return distinctBy(idSelector)
        .sortedByDescending(sortSelector)
        .take(limit)
}

/**
 * Merge de duas listas com deduplicação.
 * Útil para combinar resultados de múltiplas queries.
 *
 * @param other Segunda lista para merge
 * @param idSelector Função que extrai o ID para deduplicação
 * @return Lista merged sem duplicatas
 *
 * Exemplo de uso:
 * ```kotlin
 * val allGames = publicGames.mergeAndDeduplicate(privateGames) { it.id }
 * ```
 */
inline fun <T, K> List<T>.mergeAndDeduplicate(
    other: List<T>,
    crossinline idSelector: (T) -> K
): List<T> {
    return (this + other).distinctBy(idSelector)
}

/**
 * Merge de múltiplas listas com deduplicação.
 *
 * @param others Listas para merge
 * @param idSelector Função que extrai o ID para deduplicação
 * @return Lista merged sem duplicatas
 *
 * Exemplo de uso:
 * ```kotlin
 * val allGames = listOf(list1, list2, list3).mergeAllAndDeduplicate { it.id }
 * ```
 */
inline fun <T, K> List<List<T>>.mergeAllAndDeduplicate(
    crossinline idSelector: (T) -> K
): List<T> {
    return flatten().distinctBy(idSelector)
}
