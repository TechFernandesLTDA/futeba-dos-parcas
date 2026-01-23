package com.futebadosparcas.data.migration

import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await

/**
 * Implementacao Android do contexto de migracao usando Firebase Firestore.
 */
actual class MigrationContext(
    private val firestore: FirebaseFirestore
) {
    companion object {
        private const val LOGS_COLLECTION = "_migrations/locations/logs"
        private const val BATCH_SIZE = 500 // Limite do Firestore para batch writes
    }

    /**
     * Busca todos os documentos de uma colecao.
     */
    actual suspend fun getAllDocuments(
        collectionPath: String
    ): Result<List<Pair<String, Map<String, Any?>>>> {
        return try {
            val snapshot = firestore.collection(collectionPath).get().await()
            val docs = snapshot.documents.map { doc ->
                doc.id to (doc.data ?: emptyMap())
            }
            Result.success(docs)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca documentos que correspondem a uma query.
     */
    actual suspend fun getDocumentsWhere(
        collectionPath: String,
        field: String,
        value: Any?
    ): Result<List<Pair<String, Map<String, Any?>>>> {
        return try {
            val snapshot = firestore.collection(collectionPath)
                .whereEqualTo(field, value)
                .get()
                .await()

            val docs = snapshot.documents.map { doc ->
                doc.id to (doc.data ?: emptyMap())
            }
            Result.success(docs)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca documentos onde um campo nao existe.
     *
     * Nota: Firestore nao suporta query direta para campos ausentes.
     * Usamos uma abordagem alternativa: buscamos todos e filtramos localmente.
     */
    actual suspend fun getDocumentsWhereFieldMissing(
        collectionPath: String,
        field: String
    ): Result<List<Pair<String, Map<String, Any?>>>> {
        return try {
            val snapshot = firestore.collection(collectionPath).get().await()

            val docs = snapshot.documents
                .filter { doc ->
                    val data = doc.data
                    data == null || !data.containsKey(field)
                }
                .map { doc ->
                    doc.id to (doc.data ?: emptyMap())
                }

            Result.success(docs)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Atualiza um documento.
     */
    actual suspend fun updateDocument(
        collectionPath: String,
        documentId: String,
        updates: Map<String, Any?>
    ): Result<Unit> {
        return try {
            // Filtra valores nulos para usar FieldValue.delete()
            val processedUpdates = updates.mapValues { (_, value) ->
                value ?: FieldValue.delete()
            }

            firestore.collection(collectionPath)
                .document(documentId)
                .update(processedUpdates)
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Atualiza multiplos documentos em batch.
     */
    actual suspend fun batchUpdate(
        updates: List<Triple<String, String, Map<String, Any?>>>
    ): Result<Unit> {
        return try {
            // Divide em chunks para respeitar limite do Firestore
            val chunks = updates.chunked(BATCH_SIZE)

            for (chunk in chunks) {
                val batch = firestore.batch()

                for ((collectionPath, documentId, updateData) in chunk) {
                    val docRef = firestore.collection(collectionPath).document(documentId)

                    // Processa valores nulos
                    val processedUpdates = updateData.mapValues { (_, value) ->
                        value ?: FieldValue.delete()
                    }

                    batch.update(docRef, processedUpdates)
                }

                batch.commit().await()
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Deleta um documento.
     */
    actual suspend fun deleteDocument(
        collectionPath: String,
        documentId: String
    ): Result<Unit> {
        return try {
            firestore.collection(collectionPath)
                .document(documentId)
                .delete()
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Cria um documento.
     */
    actual suspend fun createDocument(
        collectionPath: String,
        documentId: String?,
        data: Map<String, Any?>
    ): Result<String> {
        return try {
            val collectionRef = firestore.collection(collectionPath)

            val docRef = if (documentId != null) {
                collectionRef.document(documentId)
            } else {
                collectionRef.document()
            }

            // Filtra valores nulos
            val processedData = data.filterValues { it != null }

            docRef.set(processedData, SetOptions.merge()).await()

            Result.success(docRef.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Registra um log de migracao.
     */
    actual suspend fun logMigrationChange(log: MigrationLog): Result<Unit> {
        return try {
            val logData = mapOf(
                "migration_version" to log.migrationVersion,
                "migration_name" to log.migrationName,
                "action" to log.action.name.lowercase(),
                "document_id" to log.documentId,
                "collection_path" to log.collectionPath,
                "changes" to log.changes.mapValues { (_, change) ->
                    mapOf(
                        "old_value" to change.oldValue,
                        "new_value" to change.newValue
                    )
                },
                "timestamp" to log.timestamp,
                "executed_by" to log.executedBy
            )

            val logId = log.id.ifEmpty {
                "${log.migrationVersion}_${log.timestamp}"
            }

            firestore.collection(LOGS_COLLECTION)
                .document(logId)
                .set(logData)
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            // Falha no log nao deve impedir a migracao
            Result.success(Unit)
        }
    }

    /**
     * Retorna o timestamp atual do servidor.
     */
    actual fun serverTimestamp(): Any {
        return FieldValue.serverTimestamp()
    }
}

/**
 * Factory para criar MigrationContext com Firestore.
 */
object MigrationContextFactory {
    /**
     * Cria um MigrationContext com a instancia padrao do Firestore.
     */
    fun create(): MigrationContext {
        return MigrationContext(FirebaseFirestore.getInstance())
    }

    /**
     * Cria um MigrationContext com uma instancia especifica do Firestore.
     */
    fun create(firestore: FirebaseFirestore): MigrationContext {
        return MigrationContext(firestore)
    }
}
