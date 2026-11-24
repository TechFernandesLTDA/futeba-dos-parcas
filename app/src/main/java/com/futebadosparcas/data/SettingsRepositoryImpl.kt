package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GamificationSettings
import com.futebadosparcas.domain.repository.SettingsRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import com.futebadosparcas.data.firestore.AndroidEscritoresFirestore

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
            // #4645: lê os nomes em snake_case, os mesmos que as functions usam.
            val settings = snapshot.data?.let { AndroidEscritoresFirestore.lerConfiguracoesGamificacao(it) }
                ?: GamificationSettings()
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
            // #4645: em camelCase, as functions não viam a edição do admin.
            gamificationDoc.set(AndroidEscritoresFirestore.configuracoesGamificacao(settings)).await()
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar configurações de gamificação", e)
            Result.failure(e)
        }
    }
}
