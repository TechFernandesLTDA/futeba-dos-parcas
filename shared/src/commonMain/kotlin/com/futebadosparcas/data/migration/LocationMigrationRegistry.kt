package com.futebadosparcas.data.migration

import kotlinx.datetime.Clock

/**
 * Registro central de todas as migracoes de Location.
 *
 * Cada migracao e registrada com:
 * - Numero de versao unico e sequencial
 * - Nome descritivo
 * - Descricao do que a migracao faz
 * - Factory para criar o executor
 *
 * IMPORTANTE: Nunca altere migracoes ja aplicadas!
 * Sempre adicione novas migracoes com versao maior.
 */
object LocationMigrationRegistry {

    /**
     * Lista de todas as migracoes registradas, ordenadas por versao.
     */
    val migrations: List<RegisteredMigration> = listOf(
        // Migracao 1: Adiciona campo managers a locations que nao tem
        RegisteredMigration(
            migration = Migration(
                version = 1,
                name = "add_managers_field",
                description = "Adiciona campo 'managers' (lista vazia) em locations que nao possuem"
            ),
            executorFactory = { context -> AddManagersFieldMigration(context) }
        ),

        // Migracao 2: Normaliza timestamps para Long (milissegundos)
        RegisteredMigration(
            migration = Migration(
                version = 2,
                name = "normalize_timestamps",
                description = "Converte timestamps de Date/Timestamp para Long (ms desde epoch)"
            ),
            executorFactory = { context -> NormalizeTimestampsMigration(context) }
        ),

        // Migracao 3: Remove locations duplicados baseado em placeId
        RegisteredMigration(
            migration = Migration(
                version = 3,
                name = "deduplicate_locations",
                description = "Remove locations duplicados mantendo o mais recente por placeId"
            ),
            executorFactory = { context -> DeduplicateLocationsMigration(context) }
        )
    )

    /**
     * Retorna a migracao por versao.
     */
    fun getMigration(version: Int): RegisteredMigration? {
        return migrations.find { it.migration.version == version }
    }

    /**
     * Retorna migracoes pendentes (versao maior que a ultima aplicada).
     */
    fun getPendingMigrations(lastAppliedVersion: Int?): List<RegisteredMigration> {
        val currentVersion = lastAppliedVersion ?: 0
        return migrations.filter { it.migration.version > currentVersion }
            .sortedBy { it.migration.version }
    }

    /**
     * Retorna a versao mais recente disponivel.
     */
    fun getLatestVersion(): Int {
        return migrations.maxOfOrNull { it.migration.version } ?: 0
    }

    /**
     * Verifica se ha migracoes pendentes.
     */
    fun hasPendingMigrations(lastAppliedVersion: Int?): Boolean {
        return getPendingMigrations(lastAppliedVersion).isNotEmpty()
    }
}

/**
 * Wrapper que associa uma migracao com seu executor.
 */
data class RegisteredMigration(
    val migration: Migration,
    val executorFactory: MigrationExecutorFactory
) {
    /**
     * Gera o checksum da migracao.
     */
    val checksum: String by lazy {
        migration.generateChecksum()
    }
}

// ============================================================================
// IMPLEMENTACOES DAS MIGRACOES
// ============================================================================

/**
 * Migracao 1: Adiciona campo 'managers' em locations que nao possuem.
 *
 * Locations antigos nao tinham o campo managers. Esta migracao
 * adiciona uma lista vazia para garantir consistencia.
 */
class AddManagersFieldMigration(
    private val context: MigrationContext
) : MigrationExecutor {

    override suspend fun execute(): MigrationResult {
        val startTime = Clock.System.now().toEpochMilliseconds()
        val errors = mutableListOf<String>()
        var documentsAffected = 0

        try {
            // Busca locations sem o campo 'managers'
            val docsResult = context.getDocumentsWhereFieldMissing("locations", "managers")

            if (docsResult.isFailure) {
                return MigrationResult.failure(
                    "Falha ao buscar locations: ${docsResult.exceptionOrNull()?.message}",
                    Clock.System.now().toEpochMilliseconds() - startTime
                )
            }

            val docs = docsResult.getOrThrow()

            if (docs.isEmpty()) {
                return MigrationResult.success(
                    0,
                    Clock.System.now().toEpochMilliseconds() - startTime
                )
            }

            // Prepara batch de atualizacoes
            val updates = docs.map { (docId, _) ->
                Triple("locations", docId, mapOf<String, Any?>("managers" to emptyList<String>()))
            }

            // Executa batch update
            val batchResult = context.batchUpdate(updates)

            if (batchResult.isFailure) {
                return MigrationResult.failure(
                    "Falha no batch update: ${batchResult.exceptionOrNull()?.message}",
                    Clock.System.now().toEpochMilliseconds() - startTime
                )
            }

            documentsAffected = docs.size

            // Log de cada alteracao
            docs.forEach { (docId, _) ->
                context.logMigrationChange(
                    MigrationLog(
                        migrationVersion = 1,
                        migrationName = "add_managers_field",
                        action = MigrationAction.FIELD_ADDED,
                        documentId = docId,
                        collectionPath = "locations",
                        changes = mapOf("managers" to FieldChange(oldValue = null, newValue = "[]")),
                        timestamp = Clock.System.now().toEpochMilliseconds()
                    )
                )
            }

        } catch (e: Exception) {
            errors.add("Erro inesperado: ${e.message}")
        }

        val executionTime = Clock.System.now().toEpochMilliseconds() - startTime

        return if (errors.isEmpty()) {
            MigrationResult.success(documentsAffected, executionTime)
        } else {
            MigrationResult(
                success = false,
                documentsAffected = documentsAffected,
                errors = errors,
                executionTimeMs = executionTime
            )
        }
    }
}

/**
 * Migracao 2: Normaliza timestamps para Long (milissegundos desde epoch).
 *
 * Converte campos createdAt e updatedAt de Timestamp/Date para Long.
 */
class NormalizeTimestampsMigration(
    private val context: MigrationContext
) : MigrationExecutor {

    override suspend fun execute(): MigrationResult {
        val startTime = Clock.System.now().toEpochMilliseconds()
        val errors = mutableListOf<String>()
        var documentsAffected = 0

        try {
            // Busca todos os locations
            val docsResult = context.getAllDocuments("locations")

            if (docsResult.isFailure) {
                return MigrationResult.failure(
                    "Falha ao buscar locations: ${docsResult.exceptionOrNull()?.message}",
                    Clock.System.now().toEpochMilliseconds() - startTime
                )
            }

            val docs = docsResult.getOrThrow()
            val updatesToMake = mutableListOf<Triple<String, String, Map<String, Any?>>>()

            for ((docId, data) in docs) {
                val updates = mutableMapOf<String, Any?>()
                var hasChanges = false

                // Verifica created_at
                val createdAt = data["created_at"]
                if (createdAt != null && createdAt !is Long) {
                    val normalizedValue = normalizeTimestamp(createdAt)
                    if (normalizedValue != null) {
                        updates["created_at"] = normalizedValue
                        hasChanges = true
                    }
                }

                // Verifica updated_at
                val updatedAt = data["updated_at"]
                if (updatedAt != null && updatedAt !is Long) {
                    val normalizedValue = normalizeTimestamp(updatedAt)
                    if (normalizedValue != null) {
                        updates["updated_at"] = normalizedValue
                        hasChanges = true
                    }
                }

                // Atualiza migrationVersion
                val currentVersion = (data["migration_version"] as? Number)?.toInt() ?: 0
                if (currentVersion < 2) {
                    updates["migration_version"] = 2
                    hasChanges = true
                }

                if (hasChanges) {
                    updatesToMake.add(Triple("locations", docId, updates))
                }
            }

            if (updatesToMake.isEmpty()) {
                return MigrationResult.success(
                    0,
                    Clock.System.now().toEpochMilliseconds() - startTime
                )
            }

            // Executa batch update
            val batchResult = context.batchUpdate(updatesToMake)

            if (batchResult.isFailure) {
                return MigrationResult.failure(
                    "Falha no batch update: ${batchResult.exceptionOrNull()?.message}",
                    Clock.System.now().toEpochMilliseconds() - startTime
                )
            }

            documentsAffected = updatesToMake.size

            // Log de cada alteracao
            updatesToMake.forEach { (_, docId, updates) ->
                val changes = updates.mapValues { (key, value) ->
                    FieldChange(oldValue = "original", newValue = value?.toString())
                }

                context.logMigrationChange(
                    MigrationLog(
                        migrationVersion = 2,
                        migrationName = "normalize_timestamps",
                        action = MigrationAction.FIELD_UPDATED,
                        documentId = docId,
                        collectionPath = "locations",
                        changes = changes,
                        timestamp = Clock.System.now().toEpochMilliseconds()
                    )
                )
            }

        } catch (e: Exception) {
            errors.add("Erro inesperado: ${e.message}")
        }

        val executionTime = Clock.System.now().toEpochMilliseconds() - startTime

        return if (errors.isEmpty()) {
            MigrationResult.success(documentsAffected, executionTime)
        } else {
            MigrationResult(
                success = false,
                documentsAffected = documentsAffected,
                errors = errors,
                executionTimeMs = executionTime
            )
        }
    }

    /**
     * Converte um valor de timestamp para Long (milissegundos).
     */
    private fun normalizeTimestamp(value: Any?): Long? {
        return when (value) {
            is Long -> value
            is Int -> value.toLong()
            is Double -> value.toLong()
            is Number -> value.toLong()
            is String -> value.toLongOrNull()
            else -> {
                // Kotlin Reflection não está disponível em wasmJs.
                // Firebase Timestamp é apenas Android/iOS - retorna null no web.
                null
            }
        }
    }
}

/**
 * Migracao 3: Remove locations duplicados por placeId.
 *
 * Quando multiplos locations tem o mesmo placeId, mantemos apenas
 * o mais recente (baseado em updatedAt ou createdAt).
 */
class DeduplicateLocationsMigration(
    private val context: MigrationContext
) : MigrationExecutor {

    override suspend fun execute(): MigrationResult {
        val startTime = Clock.System.now().toEpochMilliseconds()
        val errors = mutableListOf<String>()
        var documentsAffected = 0

        try {
            // Busca todos os locations
            val docsResult = context.getAllDocuments("locations")

            if (docsResult.isFailure) {
                return MigrationResult.failure(
                    "Falha ao buscar locations: ${docsResult.exceptionOrNull()?.message}",
                    Clock.System.now().toEpochMilliseconds() - startTime
                )
            }

            val docs = docsResult.getOrThrow()

            // Agrupa por placeId (ignora locations sem placeId)
            val locationsByPlaceId = docs
                .filter { (_, data) ->
                    (data["place_id"] as? String)?.isNotBlank() == true
                }
                .groupBy { (_, data) -> data["place_id"] as String }

            // Identifica duplicados
            val toDelete = mutableListOf<String>()

            for ((placeId, locations) in locationsByPlaceId) {
                if (locations.size > 1) {
                    // Ordena por timestamp (mais recente primeiro)
                    val sorted = locations.sortedByDescending { (_, data) ->
                        val updatedAt = (data["updated_at"] as? Number)?.toLong() ?: 0L
                        val createdAt = (data["created_at"] as? Number)?.toLong() ?: 0L
                        maxOf(updatedAt, createdAt)
                    }

                    // Mantem o primeiro (mais recente), marca os outros para deletar
                    toDelete.addAll(sorted.drop(1).map { it.first })
                }
            }

            if (toDelete.isEmpty()) {
                return MigrationResult.success(
                    0,
                    Clock.System.now().toEpochMilliseconds() - startTime
                )
            }

            // Deleta os duplicados
            for (docId in toDelete) {
                val deleteResult = context.deleteDocument("locations", docId)

                if (deleteResult.isFailure) {
                    errors.add("Falha ao deletar $docId: ${deleteResult.exceptionOrNull()?.message}")
                    continue
                }

                documentsAffected++

                // Log da delecao
                context.logMigrationChange(
                    MigrationLog(
                        migrationVersion = 3,
                        migrationName = "deduplicate_locations",
                        action = MigrationAction.DOCUMENT_DELETED,
                        documentId = docId,
                        collectionPath = "locations",
                        timestamp = Clock.System.now().toEpochMilliseconds()
                    )
                )
            }

        } catch (e: Exception) {
            errors.add("Erro inesperado: ${e.message}")
        }

        val executionTime = Clock.System.now().toEpochMilliseconds() - startTime

        return if (errors.isEmpty()) {
            MigrationResult.success(documentsAffected, executionTime)
        } else {
            MigrationResult(
                success = documentsAffected > 0,
                documentsAffected = documentsAffected,
                errors = errors,
                executionTimeMs = executionTime
            )
        }
    }
}
