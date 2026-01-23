package com.futebadosparcas.data.migration

/**
 * Interface para execucao de migracoes.
 *
 * Define o contrato que cada migracao deve implementar.
 * A implementacao real usa Firebase Firestore no Android.
 */
interface MigrationExecutor {
    /**
     * Executa a migracao.
     *
     * @return Resultado da execucao da migracao
     */
    suspend fun execute(): MigrationResult
}

/**
 * Tipo de funcao que cria um executor de migracao.
 *
 * Recebe um contexto de migracao com acesso ao Firestore e retorna
 * um executor que pode ser invocado.
 */
typealias MigrationExecutorFactory = (MigrationContext) -> MigrationExecutor

/**
 * Contexto fornecido para execucao de migracoes.
 *
 * Abstrai o acesso ao Firestore e permite injecao de dependencias
 * para testes.
 */
expect class MigrationContext {
    /**
     * Busca todos os documentos de uma colecao.
     *
     * @param collectionPath Caminho da colecao (ex: "locations")
     * @return Lista de pares (documentId, dados)
     */
    suspend fun getAllDocuments(collectionPath: String): Result<List<Pair<String, Map<String, Any?>>>>

    /**
     * Busca documentos que correspondem a uma query.
     *
     * @param collectionPath Caminho da colecao
     * @param field Campo para filtrar
     * @param value Valor esperado
     * @return Lista de pares (documentId, dados)
     */
    suspend fun getDocumentsWhere(
        collectionPath: String,
        field: String,
        value: Any?
    ): Result<List<Pair<String, Map<String, Any?>>>>

    /**
     * Busca documentos onde um campo nao existe.
     *
     * @param collectionPath Caminho da colecao
     * @param field Campo que nao deve existir
     * @return Lista de pares (documentId, dados)
     */
    suspend fun getDocumentsWhereFieldMissing(
        collectionPath: String,
        field: String
    ): Result<List<Pair<String, Map<String, Any?>>>>

    /**
     * Atualiza um documento.
     *
     * @param collectionPath Caminho da colecao
     * @param documentId ID do documento
     * @param updates Campos para atualizar
     * @return Result indicando sucesso ou falha
     */
    suspend fun updateDocument(
        collectionPath: String,
        documentId: String,
        updates: Map<String, Any?>
    ): Result<Unit>

    /**
     * Atualiza multiplos documentos em batch.
     *
     * @param updates Lista de tuplas (collectionPath, documentId, updates)
     * @return Result indicando sucesso ou falha
     */
    suspend fun batchUpdate(
        updates: List<Triple<String, String, Map<String, Any?>>>
    ): Result<Unit>

    /**
     * Deleta um documento.
     *
     * @param collectionPath Caminho da colecao
     * @param documentId ID do documento
     * @return Result indicando sucesso ou falha
     */
    suspend fun deleteDocument(
        collectionPath: String,
        documentId: String
    ): Result<Unit>

    /**
     * Cria um documento.
     *
     * @param collectionPath Caminho da colecao
     * @param documentId ID do documento (ou null para auto-gerar)
     * @param data Dados do documento
     * @return Result com o ID do documento criado
     */
    suspend fun createDocument(
        collectionPath: String,
        documentId: String?,
        data: Map<String, Any?>
    ): Result<String>

    /**
     * Registra um log de migracao.
     *
     * @param log Dados do log
     * @return Result indicando sucesso ou falha
     */
    suspend fun logMigrationChange(log: MigrationLog): Result<Unit>

    /**
     * Retorna o timestamp atual do servidor.
     */
    fun serverTimestamp(): Any
}
