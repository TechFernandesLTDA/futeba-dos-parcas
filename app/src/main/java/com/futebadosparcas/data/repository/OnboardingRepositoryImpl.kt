package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.onboarding.OnboardingState
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

/**
 * Implementação Android do [OnboardingRepository].
 *
 * Lê/escreve o campo `onboarding` (mapa aninhado) no documento `users/{uid}` do Firestore.
 * Usa FirebaseFirestore diretamente para obter o campo bruto (não mapeado pelo toObject<User>).
 *
 * Política de merge:
 * - Escrita via dot-notation ("onboarding.field") → merge parcial seguro
 * - Leitura: get() raw → extrai chave "onboarding" como Map<String, Any?>
 */
class OnboardingRepositoryImpl constructor(
    private val firestore: FirebaseFirestore
) : OnboardingRepository {

    companion object {
        private const val TAG = "OnboardingRepository"
        private const val COLLECTION_USERS = "users"
        private const val FIELD_ONBOARDING = "onboarding"
    }

    override suspend fun getOnboardingState(userId: String): Result<OnboardingState> {
        return try {
            AppLogger.d(TAG) { "Buscando estado de onboarding: userId=$userId" }

            val doc = firestore.collection(COLLECTION_USERS)
                .document(userId)
                .get()
                .await()

            if (!doc.exists()) {
                AppLogger.d(TAG) { "Documento de usuário não encontrado — retornando estado default" }
                return Result.success(OnboardingState())
            }

            @Suppress("UNCHECKED_CAST")
            val onboardingMap = doc.get(FIELD_ONBOARDING) as? Map<String, Any?> ?: emptyMap()
            val state = OnboardingState.fromMap(onboardingMap)

            AppLogger.d(TAG) { "Estado onboarding: version=${state.version}, carouselDone=${state.hasSeenCarousel()}" }
            Result.success(state)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar estado de onboarding", e)
            Result.failure(e)
        }
    }

    override suspend fun updateOnboardingState(
        userId: String,
        updates: Map<String, Any?>
    ): Result<Unit> {
        return try {
            AppLogger.d(TAG) { "Atualizando onboarding: userId=$userId campos=${updates.keys}" }

            // Dot-notation para merge parcial — não sobrescreve outros campos do documento
            val dotNotationUpdates: Map<String, Any?> = updates.mapKeys { (key, _) ->
                "$FIELD_ONBOARDING.$key"
            }

            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(dotNotationUpdates)
                .await()

            AppLogger.i(TAG) { "Onboarding atualizado com sucesso: userId=$userId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar onboarding", e)
            Result.failure(e)
        }
    }

    override suspend fun markCarouselCompleted(userId: String, completedAt: Long): Result<Unit> {
        return updateOnboardingState(
            userId = userId,
            updates = mapOf(
                "carousel_completed_at" to completedAt,
                "carousel_skipped" to false,
                "version" to OnboardingState.CURRENT_ONBOARDING_VERSION
            )
        )
    }

    override suspend fun markCarouselSkipped(userId: String, atSlideIndex: Int): Result<Unit> {
        return updateOnboardingState(
            userId = userId,
            updates = mapOf(
                "carousel_skipped" to true,
                "version" to OnboardingState.CURRENT_ONBOARDING_VERSION
            )
        )
    }

    override suspend fun markChecklistCompleted(userId: String, completedAt: Long): Result<Unit> {
        return updateOnboardingState(
            userId = userId,
            updates = mapOf(
                "checklist_completed_at" to completedAt,
                "reward_granted" to true
            )
        )
    }

    override suspend fun markChecklistDismissed(userId: String): Result<Unit> {
        return updateOnboardingState(
            userId = userId,
            updates = mapOf(
                "checklist_dismissed" to true
            )
        )
    }
}
