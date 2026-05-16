package com.futebadosparcas.domain.model.onboarding

/**
 * Estado persistido do onboarding do usuário.
 *
 * Armazenado em Firestore como campo `onboarding` no documento `users/{uid}`.
 * O campo é um mapa plano (não subcoleção) para economizar reads.
 *
 * Versão atual: [CURRENT_ONBOARDING_VERSION].
 * Quando `version < CURRENT_ONBOARDING_VERSION`, o carrossel é reapresentado.
 */
data class OnboardingState(
    /** Timestamp (epoch ms) de quando o carrossel foi concluído, ou null se ainda não completou. */
    val carouselCompletedAt: Long? = null,
    /** Indica se o usuário pulou o carrossel. */
    val carouselSkipped: Boolean = false,
    /** Chaves: [OnboardingStep.id], valores: true = concluído. */
    val checklistSteps: Map<String, Boolean> = emptyMap(),
    /** Timestamp (epoch ms) de quando o checklist foi totalmente concluído. */
    val checklistCompletedAt: Long? = null,
    /** Indica se o usuário dispensou o checklist antes de completar. */
    val checklistDismissed: Boolean = false,
    /** Mapa de dicas in-app por id (futuras fases). */
    val firstTimeTips: Map<String, Boolean> = emptyMap(),
    /**
     * Indica se a recompensa "Bem-vindo" foi concedida.
     * O badge real é criado por Cloud Function (TODO: Fase 2).
     * O cliente apenas sinaliza via este flag para exibir a CelebrationSheet.
     */
    val rewardGranted: Boolean = false,
    /**
     * Versão do onboarding. Quando menor que [CURRENT_ONBOARDING_VERSION],
     * o carrossel é reexibido (mecanismo de re-tour).
     */
    val version: Int = CURRENT_ONBOARDING_VERSION
) {
    companion object {
        const val CURRENT_ONBOARDING_VERSION = 1

        /**
         * Constrói um [OnboardingState] a partir de um mapa Firestore.
         * Aplica merge offline: campos null no servidor mantêm valor local (OR para booleanos).
         * Campos *CompletedAt: server wins (nunca sobrescrevemos timestamp do servidor com null).
         */
        @Suppress("UNCHECKED_CAST")
        fun fromMap(map: Map<String, Any?>): OnboardingState {
            val serverSteps = (map["checklist_steps"] as? Map<String, Any?>)
                ?.mapValues { (_, v) -> v as? Boolean ?: false }
                ?: emptyMap()

            return OnboardingState(
                carouselCompletedAt = (map["carousel_completed_at"] as? Number)?.toLong(),
                carouselSkipped = map["carousel_skipped"] as? Boolean ?: false,
                checklistSteps = serverSteps,
                checklistCompletedAt = (map["checklist_completed_at"] as? Number)?.toLong(),
                checklistDismissed = map["checklist_dismissed"] as? Boolean ?: false,
                firstTimeTips = (map["first_time_tips"] as? Map<String, Any?>)
                    ?.mapValues { (_, v) -> v as? Boolean ?: false }
                    ?: emptyMap(),
                rewardGranted = map["reward_granted"] as? Boolean ?: false,
                version = (map["version"] as? Number)?.toInt() ?: CURRENT_ONBOARDING_VERSION
            )
        }
    }

    /**
     * Converte o estado para mapa Firestore (snake_case, sem nulls explícitos).
     */
    fun toMap(): Map<String, Any?> = buildMap {
        carouselCompletedAt?.let { put("carousel_completed_at", it) }
        put("carousel_skipped", carouselSkipped)
        put("checklist_steps", checklistSteps)
        checklistCompletedAt?.let { put("checklist_completed_at", it) }
        put("checklist_dismissed", checklistDismissed)
        put("first_time_tips", firstTimeTips)
        put("reward_granted", rewardGranted)
        put("version", version)
    }

    /** Retorna true se o carrossel já foi visto (concluído ou pulado) nesta versão. */
    fun hasSeenCarousel(): Boolean =
        (carouselCompletedAt != null || carouselSkipped) && version >= CURRENT_ONBOARDING_VERSION

    /** Retorna true se todos os 4 passos do checklist foram derivados como completos. */
    fun isChecklistComplete(): Boolean =
        checklistCompletedAt != null
}

/**
 * Passos do checklist de primeiros passos.
 *
 * A conclusão de cada passo é derivada de eventos de domínio já existentes
 * (grupos, jogos confirmados, etc.) — NÃO de checkboxes manuais.
 */
enum class OnboardingStep(val id: String) {
    COMPLETE_PROFILE("complete_profile"),
    JOIN_OR_CREATE_GROUP("join_or_create_group"),
    CONFIRM_PRESENCE("confirm_presence"),
    PLAY_FIRST_GAME("play_first_game");

    companion object {
        fun fromId(id: String): OnboardingStep? = values().find { it.id == id }
    }
}
