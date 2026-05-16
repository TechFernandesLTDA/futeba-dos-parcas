package com.futebadosparcas.data.migration

import kotlinx.datetime.Clock

/**
 * Implementação iOS do contexto de migração de dados Firestore.
 *
 * N/A — MIGRAÇÕES NÃO RODAM NO CLIENT iOS.
 *
 * MigrationContext é utilizado exclusivamente em scripts server-side
 * (Cloud Functions / Node.js) para operações batch em lote de dados do Firestore
 * (ex: coleção `_migrations/locations/logs`, batch de 500 documentos).
 * Clientes iOS nunca devem executar migrações de dados — essa responsabilidade
 * pertence ao backend (Cloud Functions ou scripts de manutenção).
 *
 * Cada método retorna imediatamente com UnsupportedOperationException documentada.
 * Isso resolve os NotImplementedError bloqueantes sem puxar Firebase iOS SDK
 * desnecessariamente para este contexto.
 *
 * Refs: specs/feat-2026-05-16-ios-parity-cmp-phase3.md §3.2 (CA2)
 */
actual class MigrationContext {

    /**
     * N/A no iOS — migrações rodam server-side (Cloud Functions).
     */
    actual suspend fun getAllDocuments(
        collectionPath: String
    ): Result<List<Pair<String, Map<String, Any?>>>> =
        Result.failure(
            UnsupportedOperationException(
                "MigrationContext não roda no cliente iOS. " +
                    "Execute migrações via Cloud Functions ou scripts Node.js server-side."
            )
        )

    /**
     * N/A no iOS — migrações rodam server-side (Cloud Functions).
     */
    actual suspend fun getDocumentsWhere(
        collectionPath: String,
        field: String,
        value: Any?
    ): Result<List<Pair<String, Map<String, Any?>>>> =
        Result.failure(
            UnsupportedOperationException(
                "MigrationContext não roda no cliente iOS. " +
                    "Execute migrações via Cloud Functions ou scripts Node.js server-side."
            )
        )

    /**
     * N/A no iOS — migrações rodam server-side (Cloud Functions).
     */
    actual suspend fun getDocumentsWhereFieldMissing(
        collectionPath: String,
        field: String
    ): Result<List<Pair<String, Map<String, Any?>>>> =
        Result.failure(
            UnsupportedOperationException(
                "MigrationContext não roda no cliente iOS. " +
                    "Execute migrações via Cloud Functions ou scripts Node.js server-side."
            )
        )

    /**
     * N/A no iOS — migrações rodam server-side (Cloud Functions).
     */
    actual suspend fun updateDocument(
        collectionPath: String,
        documentId: String,
        updates: Map<String, Any?>
    ): Result<Unit> =
        Result.failure(
            UnsupportedOperationException(
                "MigrationContext não roda no cliente iOS. " +
                    "Execute migrações via Cloud Functions ou scripts Node.js server-side."
            )
        )

    /**
     * N/A no iOS — migrações rodam server-side (Cloud Functions).
     */
    actual suspend fun batchUpdate(
        updates: List<Triple<String, String, Map<String, Any?>>>
    ): Result<Unit> =
        Result.failure(
            UnsupportedOperationException(
                "MigrationContext não roda no cliente iOS. " +
                    "Execute migrações via Cloud Functions ou scripts Node.js server-side."
            )
        )

    /**
     * N/A no iOS — migrações rodam server-side (Cloud Functions).
     */
    actual suspend fun deleteDocument(
        collectionPath: String,
        documentId: String
    ): Result<Unit> =
        Result.failure(
            UnsupportedOperationException(
                "MigrationContext não roda no cliente iOS. " +
                    "Execute migrações via Cloud Functions ou scripts Node.js server-side."
            )
        )

    /**
     * N/A no iOS — migrações rodam server-side (Cloud Functions).
     */
    actual suspend fun createDocument(
        collectionPath: String,
        documentId: String?,
        data: Map<String, Any?>
    ): Result<String> =
        Result.failure(
            UnsupportedOperationException(
                "MigrationContext não roda no cliente iOS. " +
                    "Execute migrações via Cloud Functions ou scripts Node.js server-side."
            )
        )

    /**
     * Log de migração — no-op no iOS (logs são server-side).
     * Retorna sucesso para não bloquear eventual chamada acidental.
     */
    actual suspend fun logMigrationChange(log: MigrationLog): Result<Unit> =
        Result.success(Unit)

    /**
     * Timestamp local como fallback (migrações server-side usam FieldValue.serverTimestamp()).
     */
    actual fun serverTimestamp(): Any {
        return Clock.System.now().toEpochMilliseconds()
    }
}
