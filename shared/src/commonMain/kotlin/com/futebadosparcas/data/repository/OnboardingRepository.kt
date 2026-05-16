package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.onboarding.OnboardingState

/**
 * Repositório para persistência do estado de onboarding.
 *
 * O estado é armazenado como campo `onboarding` (mapa aninhado) no documento
 * `users/{uid}` do Firestore — sem nova coleção.
 *
 * Política de merge offline:
 * - Campos *CompletedAt: server wins (nunca sobrescreve timestamp com null)
 * - Booleanos: OR entre local e servidor (uma vez true, permanece true)
 * - `version`: sempre usa o valor do servidor
 */
interface OnboardingRepository {

    /**
     * Busca o estado de onboarding do usuário logado.
     * Retorna [OnboardingState] com valores default se o campo ainda não existir no Firestore.
     */
    suspend fun getOnboardingState(userId: String): Result<OnboardingState>

    /**
     * Persiste campos específicos do estado de onboarding.
     * Usa merge parcial (dot-notation) para não sobrescrever campos não enviados.
     *
     * @param userId UID do usuário autenticado
     * @param updates mapa com apenas os campos alterados (snake_case)
     */
    suspend fun updateOnboardingState(
        userId: String,
        updates: Map<String, Any?>
    ): Result<Unit>

    /**
     * Conveniência: marca carrossel como concluído.
     */
    suspend fun markCarouselCompleted(userId: String, completedAt: Long): Result<Unit>

    /**
     * Conveniência: marca carrossel como pulado.
     */
    suspend fun markCarouselSkipped(userId: String, atSlideIndex: Int): Result<Unit>

    /**
     * Conveniência: marca checklist como completamente concluído e sinaliza recompensa.
     * O badge real é escrito por Cloud Function (TODO: Fase 2).
     */
    suspend fun markChecklistCompleted(userId: String, completedAt: Long): Result<Unit>

    /**
     * Conveniência: marca checklist como dispensado pelo usuário.
     */
    suspend fun markChecklistDismissed(userId: String): Result<Unit>
}
