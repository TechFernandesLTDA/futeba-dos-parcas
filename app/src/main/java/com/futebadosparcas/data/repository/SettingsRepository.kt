package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GamificationSettings
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

interface SettingsRepository {
    suspend fun getGamificationSettings(): Result<GamificationSettings>
    suspend fun updateGamificationSettings(settings: GamificationSettings): Result<Unit>
}

@Singleton
class SettingsRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore
) : SettingsRepository {

    private val settingsCollection = firestore.collection("app_settings")
    private val gamificationDoc = settingsCollection.document("gamification")

    override suspend fun getGamificationSettings(): Result<GamificationSettings> {
        return try {
            val snapshot = gamificationDoc.get().await()
            val settings = snapshot.toObject(GamificationSettings::class.java) ?: GamificationSettings()
            Result.success(settings)
        } catch (e: Exception) {
            // Retorna configuracoes default se falhar
            Result.success(GamificationSettings())
        }
    }

    override suspend fun updateGamificationSettings(settings: GamificationSettings): Result<Unit> {
        return try {
            gamificationDoc.set(settings).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
