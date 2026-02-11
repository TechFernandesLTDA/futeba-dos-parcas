package com.futebadosparcas.data.util

import com.google.firebase.firestore.CollectionReference
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.tasks.await

/**
 * Utilitário para operações Firestore em batch com execução paralela.
 *
 * Resolve o problema de queries sequenciais em loops (N+1) e
 * respeita o limite de 10 itens do Firestore whereIn.
 *
 * Uso:
 * ```kotlin
 * val users = BatchOperationHelper.parallelWhereIn(
 *     collection = firestore.collection("users"),
 *     ids = userIds,
 *     mapper = { doc -> doc.toObject(User::class.java) }
 * )
 * ```
 */
object BatchOperationHelper {

    private const val TAG = "BatchOperationHelper"

    /** Limite máximo de itens por query whereIn do Firestore */
    private const val WHERE_IN_CHUNK_SIZE = 10

    /** Limite máximo de operações por batch write do Firestore */
    private const val BATCH_WRITE_LIMIT = 400

    /**
     * Executa queries whereIn em paralelo, respeitando o limite de 10 itens.
     *
     * Em vez de processar chunks sequencialmente com forEach { await() },
     * lança todas as queries em paralelo com async/awaitAll.
     *
     * @param collection Referência à coleção do Firestore
     * @param ids Lista de IDs para buscar
     * @param fieldPath Campo para filtrar (padrão: documentId)
     * @param chunkSize Tamanho do chunk (padrão: 10, limite do Firestore)
     * @param mapper Função para converter DocumentSnapshot em objeto
     * @return Lista de objetos mapeados (nulls são filtrados)
     */
    suspend fun <T> parallelWhereIn(
        collection: CollectionReference,
        ids: List<String>,
        fieldPath: FieldPath = FieldPath.documentId(),
        chunkSize: Int = WHERE_IN_CHUNK_SIZE,
        mapper: (DocumentSnapshot) -> T?
    ): List<T> {
        if (ids.isEmpty()) return emptyList()

        return coroutineScope {
            ids.distinct()
                .chunked(chunkSize)
                .map { chunk ->
                    async {
                        try {
                            collection
                                .whereIn(fieldPath, chunk)
                                .get()
                                .await()
                                .documents
                                .mapNotNull(mapper)
                        } catch (e: Exception) {
                            AppLogger.w(TAG) { "Erro ao buscar chunk de ${chunk.size} itens: ${e.message}" }
                            emptyList()
                        }
                    }
                }
                .awaitAll()
                .flatten()
        }
    }

    /**
     * Variante que aceita Query customizada em vez de CollectionReference.
     * Útil quando há filtros adicionais além do whereIn.
     *
     * @param queryBuilder Função que recebe o chunk de IDs e retorna a Query pronta
     * @param ids Lista de IDs para buscar
     * @param chunkSize Tamanho do chunk (padrão: 10)
     * @param mapper Função para converter DocumentSnapshot em objeto
     */
    suspend fun <T> parallelQueryChunked(
        ids: List<String>,
        chunkSize: Int = WHERE_IN_CHUNK_SIZE,
        queryBuilder: (List<String>) -> Query,
        mapper: (DocumentSnapshot) -> T?
    ): List<T> {
        if (ids.isEmpty()) return emptyList()

        return coroutineScope {
            ids.distinct()
                .chunked(chunkSize)
                .map { chunk ->
                    async {
                        try {
                            queryBuilder(chunk)
                                .get()
                                .await()
                                .documents
                                .mapNotNull(mapper)
                        } catch (e: Exception) {
                            AppLogger.w(TAG) { "Erro ao executar query para chunk de ${chunk.size}: ${e.message}" }
                            emptyList()
                        }
                    }
                }
                .awaitAll()
                .flatten()
        }
    }

    /**
     * Executa batch writes em paralelo, respeitando o limite de 500 ops por batch.
     *
     * @param firestore Instância do FirebaseFirestore
     * @param operations Lista de operações a executar
     * @param batchSize Tamanho máximo de cada batch (padrão: 400, margem de segurança)
     */
    suspend fun parallelBatchWrite(
        firestore: FirebaseFirestore,
        operations: List<BatchWriteOperation>,
        batchSize: Int = BATCH_WRITE_LIMIT
    ) {
        if (operations.isEmpty()) return

        coroutineScope {
            operations.chunked(batchSize).map { chunk ->
                async {
                    try {
                        val batch = firestore.batch()
                        chunk.forEach { op -> op.applyTo(batch) }
                        batch.commit().await()
                    } catch (e: Exception) {
                        AppLogger.e(TAG, "Erro ao commitar batch de ${chunk.size} operações", e)
                        throw e
                    }
                }
            }.awaitAll()
        }
    }
}

/**
 * Representa uma operação de escrita em batch.
 */
fun interface BatchWriteOperation {
    fun applyTo(batch: com.google.firebase.firestore.WriteBatch)
}
