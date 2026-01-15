package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GamificationSettings
import com.futebadosparcas.domain.repository.SettingsRepository
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Implementacao Android do SettingsRepository.
 * Usa Firebase Firestore para buscar/atualizar configuracoes.
 */
@Singleton
class SettingsRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore
) : SettingsRepository {

    private val settingsCollection = firestore.collection("app_settings")
    private val gamificationDoc = settingsCollection.document("gamification")

    override suspend fun getGamificationSettings(): Result<GamificationSettings> = withContext(Dispatchers.Default) {
        try {
            val snapshot = gamificationDoc.get().await()
            val settings = snapshot.toObject(GamificationSettings::class.java) ?: GamificationSettings()
            Result.success(settings)
        } catch (e: Exception) {
            // Retorna configuracoes default se falhar
            Result.success(GamificationSettings())
        }
    }

    override suspend fun updateGamificationSettings(settings: GamificationSettings): Result<Unit> = withContext(Dispatchers.Default) {
        try {
            gamificationDoc.set(settings).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
