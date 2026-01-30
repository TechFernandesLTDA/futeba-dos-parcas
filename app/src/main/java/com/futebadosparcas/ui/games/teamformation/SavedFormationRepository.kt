package com.futebadosparcas.ui.games.teamformation

import com.futebadosparcas.data.model.SavedTeamFormation
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await
import java.util.Date
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repositorio para gerenciar formacoes de times salvas.
 */
@Singleton
class SavedFormationRepository @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    companion object {
        private const val TAG = "SavedFormationRepo"
        private const val COLLECTION = "saved_formations"
        private const val MAX_FORMATIONS_PER_USER = 20
    }

    /**
     * Busca todas as formacoes salvas de um usuario.
     */
    suspend fun getSavedFormations(userId: String): Result<List<SavedTeamFormation>> {
        return try {
            val snapshot = firestore.collection(COLLECTION)
                .whereEqualTo("owner_id", userId)
                .orderBy("last_used_at", Query.Direction.DESCENDING)
                .limit(MAX_FORMATIONS_PER_USER.toLong())
                .get()
                .await()

            val formations = snapshot.documents.mapNotNull { doc ->
                doc.toObject(SavedTeamFormation::class.java)?.copy(id = doc.id)
            }

            Result.success(formations)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar formacoes salvas", e)
            Result.failure(e)
        }
    }

    /**
     * Busca formacoes salvas de um grupo.
     */
    suspend fun getGroupFormations(groupId: String): Result<List<SavedTeamFormation>> {
        return try {
            val snapshot = firestore.collection(COLLECTION)
                .whereEqualTo("group_id", groupId)
                .orderBy("times_used", Query.Direction.DESCENDING)
                .limit(MAX_FORMATIONS_PER_USER.toLong())
                .get()
                .await()

            val formations = snapshot.documents.mapNotNull { doc ->
                doc.toObject(SavedTeamFormation::class.java)?.copy(id = doc.id)
            }

            Result.success(formations)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar formacoes do grupo", e)
            Result.failure(e)
        }
    }

    /**
     * Salva uma nova formacao.
     */
    suspend fun saveFormation(formation: SavedTeamFormation): Result<String> {
        return try {
            // Verificar limite de formacoes
            val existingCount = firestore.collection(COLLECTION)
                .whereEqualTo("owner_id", formation.ownerId)
                .get()
                .await()
                .size()

            if (existingCount >= MAX_FORMATIONS_PER_USER) {
                return Result.failure(Exception("Limite de $MAX_FORMATIONS_PER_USER formacoes atingido"))
            }

            val docRef = firestore.collection(COLLECTION).document()
            val formationWithId = formation.copy(
                id = docRef.id,
                createdAt = Date(),
                lastUsedAt = Date()
            )

            docRef.set(formationWithId).await()

            AppLogger.d(TAG) { "Formacao salva: ${docRef.id}" }
            Result.success(docRef.id)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao salvar formacao", e)
            Result.failure(e)
        }
    }

    /**
     * Atualiza uma formacao existente.
     */
    suspend fun updateFormation(formation: SavedTeamFormation): Result<Unit> {
        return try {
            if (formation.id.isEmpty()) {
                return Result.failure(Exception("ID da formacao invalido"))
            }

            val updatedFormation = formation.copy(lastUsedAt = Date())

            firestore.collection(COLLECTION)
                .document(formation.id)
                .set(updatedFormation)
                .await()

            AppLogger.d(TAG) { "Formacao atualizada: ${formation.id}" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar formacao", e)
            Result.failure(e)
        }
    }

    /**
     * Incrementa o contador de uso de uma formacao.
     */
    suspend fun incrementFormationUsage(formationId: String): Result<Unit> {
        return try {
            val docRef = firestore.collection(COLLECTION).document(formationId)

            firestore.runTransaction { transaction ->
                val snapshot = transaction.get(docRef)
                val currentUsage = snapshot.getLong("times_used")?.toInt() ?: 0

                transaction.update(docRef, mapOf(
                    "times_used" to currentUsage + 1,
                    "last_used_at" to Date()
                ))
            }.await()

            AppLogger.d(TAG) { "Uso da formacao incrementado: $formationId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao incrementar uso da formacao", e)
            Result.failure(e)
        }
    }

    /**
     * Exclui uma formacao.
     */
    suspend fun deleteFormation(formationId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION)
                .document(formationId)
                .delete()
                .await()

            AppLogger.d(TAG) { "Formacao excluida: $formationId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao excluir formacao", e)
            Result.failure(e)
        }
    }

    /**
     * Busca formacoes que contenham determinados jogadores.
     * Util para sugerir formacoes baseadas nos jogadores confirmados.
     */
    suspend fun findFormationsWithPlayers(
        userId: String,
        playerIds: List<String>,
        minMatchPercent: Float = 0.5f
    ): Result<List<SavedTeamFormation>> {
        return try {
            // Buscar todas as formacoes do usuario
            val formationsResult = getSavedFormations(userId)
            val formations = formationsResult.getOrNull() ?: return formationsResult

            // Filtrar formacoes que tenham pelo menos minMatchPercent dos jogadores
            val matching = formations.filter { formation ->
                val allPlayers = formation.getAllPlayerIds()
                val matchCount = playerIds.count { it in allPlayers }
                val matchPercent = if (allPlayers.isNotEmpty()) {
                    matchCount.toFloat() / allPlayers.size
                } else 0f

                matchPercent >= minMatchPercent
            }

            Result.success(matching)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar formacoes com jogadores", e)
            Result.failure(e)
        }
    }
}
