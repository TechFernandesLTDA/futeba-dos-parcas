package com.futebadosparcas.data.migration

import kotlinx.datetime.Clock

/**
 * Gerenciador de migracoes para a colecao Location.
 *
 * Responsavel por:
 * - Verificar quais migracoes ja foram aplicadas
 * - Executar migracoes pendentes em ordem
 * - Registrar historico de migracoes no Firestore
 * - Verificar checksums para garantir idempotencia
 *
 * Colecoes no Firestore:
 * - _migrations/locations: Documento com metadados
 * - _migrations/locations/records/{version}: Registros de migracoes aplicadas
 * - _migrations/locations/logs/{logId}: Logs detalhados de alteracoes
 *
 * @param context Contexto de migracao com acesso ao Firestore
 */
class LocationMigrationManager(
    private val context: MigrationContext
) {
    companion object {
        private const val MIGRATIONS_COLLECTION = "_migrations"
        private const val LOCATIONS_DOC = "locations"
        private const val RECORDS_SUBCOLLECTION = "records"
        private const val LOGS_SUBCOLLECTION = "logs"

        private const val COLLECTION_PATH_RECORDS = "$MIGRATIONS_COLLECTION/$LOCATIONS_DOC/$RECORDS_SUBCOLLECTION"
        private const val COLLECTION_PATH_LOGS = "$MIGRATIONS_COLLECTION/$LOCATIONS_DOC/$LOGS_SUBCOLLECTION"
    }

    /**
     * Executa todas as migracoes pendentes.
     *
     * @return Lista de resultados de cada migracao executada
     */
    suspend fun runPendingMigrations(): List<MigrationResult> {
        val results = mutableListOf<MigrationResult>()

        // Obtem migracoes ja aplicadas
        val appliedVersions = getAppliedMigrations()
        val lastAppliedVersion = appliedVersions.maxOrNull()

        // Obtem migracoes pendentes
        val pendingMigrations = LocationMigrationRegistry.getPendingMigrations(lastAppliedVersion)

        if (pendingMigrations.isEmpty()) {
            return emptyList()
        }

        // Executa cada migracao em ordem
        for (registeredMigration in pendingMigrations) {
            val result = runMigration(registeredMigration)
            results.add(result)

            // Para a execucao se uma migracao falhar
            if (!result.success) {
                break
            }
        }

        return results
    }

    /**
     * Executa uma migracao especifica.
     *
     * @param registeredMigration Migracao a ser executada
     * @return Resultado da execucao
     */
    suspend fun runMigration(registeredMigration: RegisteredMigration): MigrationResult {
        val migration = registeredMigration.migration
        val startTime = Clock.System.now().toEpochMilliseconds()

        // Verifica se ja foi aplicada
        val existingRecord = getMigrationRecord(migration.version)
        if (existingRecord != null) {
            // Verifica checksum
            if (!migration.verifyChecksum(existingRecord)) {
                return MigrationResult.failure(
                    "Checksum da migracao ${migration.version} nao corresponde. " +
                    "A migracao pode ter sido alterada apos ser aplicada.",
                    Clock.System.now().toEpochMilliseconds() - startTime
                )
            }

            // Ja aplicada com sucesso, retorna sem executar novamente
            if (existingRecord.status == MigrationStatus.COMPLETED) {
                return MigrationResult.success(
                    existingRecord.documentsAffected,
                    0
                )
            }
        }

        // Marca migracao como em execucao
        markMigrationRunning(migration, registeredMigration.checksum)

        // Cria o executor e executa
        val executor = registeredMigration.executorFactory(context)
        val result = try {
            executor.execute()
        } catch (e: Exception) {
            MigrationResult.failure(
                "Excecao durante execucao: ${e.message}",
                Clock.System.now().toEpochMilliseconds() - startTime
            )
        }

        // Registra resultado
        if (result.success) {
            markMigrationComplete(migration, registeredMigration.checksum, result)
        } else {
            markMigrationFailed(migration, registeredMigration.checksum, result)
        }

        // Log da execucao
        logMigration(migration, result)

        return result
    }

    /**
     * Retorna lista de versoes de migracoes ja aplicadas com sucesso.
     */
    suspend fun getAppliedMigrations(): List<Int> {
        val result = context.getAllDocuments(COLLECTION_PATH_RECORDS)

        if (result.isFailure) {
            return emptyList()
        }

        return result.getOrThrow()
            .mapNotNull { (_, data) ->
                val status = data["status"] as? String
                val version = (data["version"] as? Number)?.toInt()

                if (status == MigrationStatus.COMPLETED.name.lowercase() && version != null) {
                    version
                } else {
                    null
                }
            }
            .sorted()
    }

    /**
     * Retorna o registro de uma migracao especifica.
     */
    suspend fun getMigrationRecord(version: Int): MigrationRecord? {
        val result = context.getDocumentsWhere(
            COLLECTION_PATH_RECORDS,
            "version",
            version
        )

        if (result.isFailure) {
            return null
        }

        val docs = result.getOrThrow()
        if (docs.isEmpty()) {
            return null
        }

        val (_, data) = docs.first()
        return MigrationRecord(
            version = (data["version"] as? Number)?.toInt() ?: version,
            name = data["name"] as? String ?: "",
            checksum = data["checksum"] as? String ?: "",
            appliedAt = (data["applied_at"] as? Number)?.toLong() ?: 0L,
            documentsAffected = (data["documents_affected"] as? Number)?.toInt() ?: 0,
            executionTimeMs = (data["execution_time_ms"] as? Number)?.toLong() ?: 0L,
            appliedBy = data["applied_by"] as? String ?: "system",
            status = MigrationStatus.entries.find {
                it.name.equals(data["status"] as? String, ignoreCase = true)
            } ?: MigrationStatus.PENDING,
            errors = (data["errors"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
        )
    }

    /**
     * Retorna resumo do estado das migracoes.
     */
    suspend fun getMigrationSummary(): MigrationSummary {
        val appliedVersions = getAppliedMigrations()
        val allMigrations = LocationMigrationRegistry.migrations

        val failedRecords = allMigrations.count { registered ->
            val record = getMigrationRecord(registered.migration.version)
            record?.status == MigrationStatus.FAILED
        }

        return MigrationSummary(
            totalMigrations = allMigrations.size,
            appliedMigrations = appliedVersions.size,
            pendingMigrations = allMigrations.size - appliedVersions.size - failedRecords,
            failedMigrations = failedRecords,
            lastAppliedVersion = appliedVersions.maxOrNull(),
            lastAppliedAt = appliedVersions.maxOrNull()?.let { version ->
                getMigrationRecord(version)?.appliedAt
            }
        )
    }

    /**
     * Verifica se ha migracoes pendentes.
     */
    suspend fun hasPendingMigrations(): Boolean {
        val appliedVersions = getAppliedMigrations()
        val lastApplied = appliedVersions.maxOrNull()
        return LocationMigrationRegistry.hasPendingMigrations(lastApplied)
    }

    /**
     * Verifica integridade dos checksums de todas as migracoes aplicadas.
     *
     * @return Lista de versoes com checksum invalido
     */
    suspend fun verifyChecksums(): List<Int> {
        val invalidVersions = mutableListOf<Int>()

        for (registered in LocationMigrationRegistry.migrations) {
            val record = getMigrationRecord(registered.migration.version)
            if (record != null && record.status == MigrationStatus.COMPLETED) {
                if (!registered.migration.verifyChecksum(record)) {
                    invalidVersions.add(registered.migration.version)
                }
            }
        }

        return invalidVersions
    }

    // ========== METODOS PRIVADOS ==========

    /**
     * Marca uma migracao como em execucao.
     */
    private suspend fun markMigrationRunning(migration: Migration, checksum: String) {
        val data = mapOf<String, Any?>(
            "version" to migration.version,
            "name" to migration.name,
            "checksum" to checksum,
            "status" to MigrationStatus.RUNNING.name.lowercase(),
            "started_at" to Clock.System.now().toEpochMilliseconds(),
            "applied_by" to "system"
        )

        context.createDocument(
            COLLECTION_PATH_RECORDS,
            migration.version.toString(),
            data
        )
    }

    /**
     * Marca uma migracao como concluida.
     */
    private suspend fun markMigrationComplete(
        migration: Migration,
        checksum: String,
        result: MigrationResult
    ) {
        val data = mapOf<String, Any?>(
            "version" to migration.version,
            "name" to migration.name,
            "checksum" to checksum,
            "status" to MigrationStatus.COMPLETED.name.lowercase(),
            "applied_at" to Clock.System.now().toEpochMilliseconds(),
            "documents_affected" to result.documentsAffected,
            "execution_time_ms" to result.executionTimeMs,
            "applied_by" to "system",
            "errors" to result.errors
        )

        context.updateDocument(
            COLLECTION_PATH_RECORDS,
            migration.version.toString(),
            data
        )
    }

    /**
     * Marca uma migracao como falha.
     */
    private suspend fun markMigrationFailed(
        migration: Migration,
        checksum: String,
        result: MigrationResult
    ) {
        val data = mapOf<String, Any?>(
            "version" to migration.version,
            "name" to migration.name,
            "checksum" to checksum,
            "status" to MigrationStatus.FAILED.name.lowercase(),
            "failed_at" to Clock.System.now().toEpochMilliseconds(),
            "documents_affected" to result.documentsAffected,
            "execution_time_ms" to result.executionTimeMs,
            "applied_by" to "system",
            "errors" to result.errors
        )

        context.updateDocument(
            COLLECTION_PATH_RECORDS,
            migration.version.toString(),
            data
        )
    }

    /**
     * Registra log de execucao de migracao.
     */
    private suspend fun logMigration(migration: Migration, result: MigrationResult) {
        val logId = "${migration.version}_${Clock.System.now().toEpochMilliseconds()}"

        val log = MigrationLog(
            id = logId,
            migrationVersion = migration.version,
            migrationName = migration.name,
            action = if (result.success) MigrationAction.DOCUMENT_UPDATED else MigrationAction.FIELD_UPDATED,
            collectionPath = COLLECTION_PATH_LOGS,
            changes = mapOf(
                "result" to FieldChange(
                    oldValue = null,
                    newValue = if (result.success) "success" else "failed: ${result.errors.joinToString()}"
                ),
                "documents_affected" to FieldChange(
                    oldValue = null,
                    newValue = result.documentsAffected.toString()
                )
            ),
            timestamp = Clock.System.now().toEpochMilliseconds()
        )

        context.logMigrationChange(log)
    }
}
