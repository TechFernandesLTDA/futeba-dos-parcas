package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GameTemplate
import com.futebadosparcas.domain.repository.GameTemplateRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

/**
 * Implementacao Android do GameTemplateRepository.
 * Usa Firebase Firestore para salvar/buscar/deletar templates de jogos.
 */
class GameTemplateRepositoryImpl constructor(
    private val firestore: FirebaseFirestore
) : GameTemplateRepository {

    companion object {
        private const val TAG = "GameTemplateRepo"
    }

    override suspend fun saveTemplate(template: GameTemplate): Result<String> = withContext(Dispatchers.Default) {
        try {
            val templateWithDate = template.copy(createdAt = System.currentTimeMillis())
            val collection = firestore.collection("users")
                .document(template.userId)
                .collection("game_templates")

            val docRef = if (template.id.isEmpty()) {
                collection.document()
            } else {
                collection.document(template.id)
            }

            val finalTemplate = templateWithDate.copy(id = docRef.id)
            docRef.set(finalTemplate).await()

            Result.success(docRef.id)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao salvar template", e)
            Result.failure(e)
        }
    }

    override suspend fun getUserTemplates(userId: String): Result<List<GameTemplate>> = withContext(Dispatchers.Default) {
        try {
            // P1 #12: Limit 50 - maximo realista de templates por usuario
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("game_templates")
                .limit(50)
                .get()
                .await()

            val templates = snapshot.documents.mapNotNull { doc ->
                try {
                    doc.toObject(GameTemplate::class.java)?.copy(id = doc.id)
                } catch (e: Exception) {
                    AppLogger.w(TAG) { "Erro ao parsear template ${doc.id}: ${e.message}" }
                    null
                }
            }
            Result.success(templates)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar templates", e)
            Result.failure(e)
        }
    }

    override suspend fun deleteTemplate(userId: String, templateId: String): Result<Unit> = withContext(Dispatchers.Default) {
        try {
            firestore.collection("users")
                .document(userId)
                .collection("game_templates")
                .document(templateId)
                .delete()
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao deletar template", e)
            Result.failure(e)
        }
    }
}
