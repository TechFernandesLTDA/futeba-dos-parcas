package com.futebadosparcas.data.migration

import kotlinx.datetime.Clock

// TODO: Fase 3 - implementar via API remota para web
actual class MigrationContext {
    actual suspend fun getAllDocuments(
        collectionPath: String
    ): Result<List<Pair<String, Map<String, Any?>>>> =
        Result.failure(UnsupportedOperationException("MigrationContext nao disponivel na plataforma Web (Phase 0 stub)"))

    actual suspend fun getDocumentsWhere(
        collectionPath: String,
        field: String,
        value: Any?
    ): Result<List<Pair<String, Map<String, Any?>>>> =
        Result.failure(UnsupportedOperationException("MigrationContext nao disponivel na plataforma Web (Phase 0 stub)"))

    actual suspend fun getDocumentsWhereFieldMissing(
        collectionPath: String,
        field: String
    ): Result<List<Pair<String, Map<String, Any?>>>> =
        Result.failure(UnsupportedOperationException("MigrationContext nao disponivel na plataforma Web (Phase 0 stub)"))

    actual suspend fun updateDocument(
        collectionPath: String,
        documentId: String,
        updates: Map<String, Any?>
    ): Result<Unit> =
        Result.failure(UnsupportedOperationException("MigrationContext nao disponivel na plataforma Web (Phase 0 stub)"))

    actual suspend fun batchUpdate(
        updates: List<Triple<String, String, Map<String, Any?>>>
    ): Result<Unit> =
        Result.failure(UnsupportedOperationException("MigrationContext nao disponivel na plataforma Web (Phase 0 stub)"))

    actual suspend fun deleteDocument(
        collectionPath: String,
        documentId: String
    ): Result<Unit> =
        Result.failure(UnsupportedOperationException("MigrationContext nao disponivel na plataforma Web (Phase 0 stub)"))

    actual suspend fun createDocument(
        collectionPath: String,
        documentId: String?,
        data: Map<String, Any?>
    ): Result<String> =
        Result.failure(UnsupportedOperationException("MigrationContext nao disponivel na plataforma Web (Phase 0 stub)"))

    actual suspend fun logMigrationChange(log: MigrationLog): Result<Unit> =
        Result.failure(UnsupportedOperationException("MigrationContext nao disponivel na plataforma Web (Phase 0 stub)"))

    actual fun serverTimestamp(): Any = Clock.System.now().toEpochMilliseconds()
}
