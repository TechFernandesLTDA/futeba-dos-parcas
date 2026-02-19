package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GamificationSettings
import com.futebadosparcas.domain.repository.SettingsRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

/**
 * Implementacao Android do SettingsRepository.
 * Usa Firebase Firestore para buscar/atualizar configuracoes.
 */
class SettingsRepositoryImpl constructor(
    private val firestore: FirebaseFirestore
) : SettingsRepository {

    companion object {
        private const val TAG = "SettingsRepository"
    }

    private val settingsCollection = firestore.collection("app_settings")
    private val gamificationDoc = settingsCollection.document("gamification")

    override suspend fun getGamificationSettings(): Result<GamificationSettings> = withContext(Dispatchers.IO) {
        try {
            // PERF_001 P2: Firestore I/O deve usar Dispatchers.IO, não Default
            val snapshot = gamificationDoc.get().await()
            val settings = snapshot.toObject(GamificationSettings::class.java) ?: GamificationSettings()
            Result.success(settings)
        } catch (e: Exception) {
            // Retorna configurações default se falhar (graceful degradation)
            AppLogger.w(TAG) { "Erro ao carregar configurações de gamificação, usando defaults: ${e.message}" }
            Result.success(GamificationSettings())
        }
    }

    override suspend fun updateGamificationSettings(settings: GamificationSettings): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            // PERF_001 P2: Firestore I/O deve usar Dispatchers.IO, não Default
            gamificationDoc.set(settings).await()
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar configurações de gamificação", e)
            Result.failure(e)
        }
    }
}
