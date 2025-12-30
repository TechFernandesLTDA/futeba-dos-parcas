package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GameTemplate
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import java.util.Date
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GameTemplateRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore
) : GameTemplateRepository {

    companion object {
        private const val TAG = "GameTemplateRepo"
    }

    override suspend fun saveTemplate(template: GameTemplate): Result<String> {
        return try {
            val templateWithDate = template.copy(createdAt = Date())
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

    override suspend fun getUserTemplates(userId: String): Result<List<GameTemplate>> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("game_templates")
                .get()
                .await()

            val templates = snapshot.toObjects(GameTemplate::class.java)
            Result.success(templates)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar templates", e)
            Result.failure(e)
        }
    }

    override suspend fun deleteTemplate(userId: String, templateId: String): Result<Unit> {
        return try {
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
