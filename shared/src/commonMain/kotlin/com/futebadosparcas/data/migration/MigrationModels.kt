package com.futebadosparcas.data.migration

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Representa uma migracao de dados a ser executada.
 *
 * Cada migracao tem:
 * - version: Numero sequencial unico
 * - name: Nome descritivo da migracao
 * - description: Descricao detalhada do que a migracao faz
 * - checksum: Hash MD5 do codigo da migracao para verificacao de integridade
 */
@Serializable
data class Migration(
    val version: Int,
    val name: String,
    val description: String = "",
    val checksum: String = ""
)

/**
 * Resultado da execucao de uma migracao.
 *
 * @property success Indica se a migracao foi executada com sucesso
 * @property documentsAffected Numero de documentos afetados pela migracao
 * @property errors Lista de erros encontrados durante a execucao
 * @property executionTimeMs Tempo de execucao em milissegundos
 */
@Serializable
data class MigrationResult(
    val success: Boolean,
    val documentsAffected: Int,
    val errors: List<String> = emptyList(),
    val executionTimeMs: Long = 0
) {
    companion object {
        /**
         * Cria um resultado de sucesso.
         */
        fun success(documentsAffected: Int, executionTimeMs: Long = 0) = MigrationResult(
            success = true,
            documentsAffected = documentsAffected,
            executionTimeMs = executionTimeMs
        )

        /**
         * Cria um resultado de falha.
         */
        fun failure(errors: List<String>, executionTimeMs: Long = 0) = MigrationResult(
            success = false,
            documentsAffected = 0,
            errors = errors,
            executionTimeMs = executionTimeMs
        )

        /**
         * Cria um resultado de falha com uma unica mensagem de erro.
         */
        fun failure(error: String, executionTimeMs: Long = 0) = failure(listOf(error), executionTimeMs)
    }
}

/**
 * Registro de uma migracao aplicada no Firestore.
 *
 * Armazenado em: _migrations/locations/records/{version}
 */
@Serializable
data class MigrationRecord(
    val version: Int,
    val name: String,
    val checksum: String,
    @SerialName("applied_at") val appliedAt: Long,
    @SerialName("documents_affected") val documentsAffected: Int,
    @SerialName("execution_time_ms") val executionTimeMs: Long,
    @SerialName("applied_by") val appliedBy: String = "system",
    val status: MigrationStatus = MigrationStatus.COMPLETED,
    val errors: List<String> = emptyList()
)

/**
 * Status de uma migracao.
 */
@Serializable
enum class MigrationStatus {
    @SerialName("pending")
    PENDING,

    @SerialName("running")
    RUNNING,

    @SerialName("completed")
    COMPLETED,

    @SerialName("failed")
    FAILED,

    @SerialName("rolled_back")
    ROLLED_BACK
}

/**
 * Log de uma operacao de migracao individual.
 *
 * Armazenado em: _migrations/locations/logs/{logId}
 */
@Serializable
data class MigrationLog(
    val id: String = "",
    @SerialName("migration_version") val migrationVersion: Int,
    @SerialName("migration_name") val migrationName: String,
    val action: MigrationAction,
    @SerialName("document_id") val documentId: String? = null,
    @SerialName("collection_path") val collectionPath: String,
    @SerialName("changes") val changes: Map<String, FieldChange> = emptyMap(),
    val timestamp: Long,
    @SerialName("executed_by") val executedBy: String = "system"
)

/**
 * Tipo de acao realizada em uma migracao.
 */
@Serializable
enum class MigrationAction {
    @SerialName("field_added")
    FIELD_ADDED,

    @SerialName("field_updated")
    FIELD_UPDATED,

    @SerialName("field_removed")
    FIELD_REMOVED,

    @SerialName("document_created")
    DOCUMENT_CREATED,

    @SerialName("document_updated")
    DOCUMENT_UPDATED,

    @SerialName("document_deleted")
    DOCUMENT_DELETED,

    @SerialName("document_merged")
    DOCUMENT_MERGED
}

/**
 * Representa uma mudanca em um campo de documento.
 */
@Serializable
data class FieldChange(
    @SerialName("old_value") val oldValue: String? = null,
    @SerialName("new_value") val newValue: String? = null
)

/**
 * Resumo do estado das migracoes.
 */
@Serializable
data class MigrationSummary(
    @SerialName("total_migrations") val totalMigrations: Int,
    @SerialName("applied_migrations") val appliedMigrations: Int,
    @SerialName("pending_migrations") val pendingMigrations: Int,
    @SerialName("failed_migrations") val failedMigrations: Int,
    @SerialName("last_applied_version") val lastAppliedVersion: Int?,
    @SerialName("last_applied_at") val lastAppliedAt: Long?
)
