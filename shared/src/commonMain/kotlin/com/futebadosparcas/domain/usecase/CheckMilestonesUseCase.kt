package com.futebadosparcas.domain.usecase

import com.futebadosparcas.domain.gamification.MilestoneChecker
import com.futebadosparcas.domain.model.Statistics

/**
 * Use Case para verificar conquista de milestones.
 * Usa o MilestoneChecker compartilhado.
 */
class CheckMilestonesUseCase {

    /**
     * Verifica quais milestones foram conquistados pelo jogador.
     *
     * @param statistics Estatisticas atuais do jogador
     * @param previouslyUnlocked Lista de milestones ja desbloqueados
     * @return Lista de novos milestones conquistados
     */
    operator fun invoke(
        statistics: Statistics,
        previouslyUnlocked: List<String>
    ): List<com.futebadosparcas.domain.gamification.MilestoneDefinition> {
        return MilestoneChecker.checkAll(statistics, previouslyUnlocked)
            .filter { it.isNewUnlock }
            .map { it.milestone }
    }

    /**
     * Verifica se um milestone especifico foi conquistado.
     *
     * @param milestoneId ID do milestone a verificar
     * @param statistics Estatisticas atuais do jogador
     * @return True se o milestone foi conquistado
     */
    fun isMilestoneUnlocked(
        milestoneId: String,
        statistics: Statistics
    ): Boolean {
        val unlocked = invoke(statistics, emptyList())
        return unlocked.any { it.id == milestoneId }
    }

    /**
     * Retorna todos os milestones disponiveis no sistema.
     *
     * @return Lista de definicoes de milestones
     */
    fun getAllMilestones(): List<com.futebadosparcas.domain.gamification.MilestoneDefinition> {
        return MilestoneChecker.allMilestones
    }

    /**
     * Calcula o progresso em direcao a um milestone especifico.
     * Retorna valor entre 0.0 e 1.0.
     *
     * @param milestoneId ID do milestone
     * @param statistics Estatisticas atuais do jogador
     * @return Progresso (0.0 = 0%, 1.0 = 100%)
     */
    fun getMilestoneProgress(
        milestoneId: String,
        statistics: Statistics
    ): Double {
        // Implementar logica de progresso baseada no tipo de milestone
        // Por enquanto, retorna 1.0 se desbloqueado, 0.0 caso contrario
        return if (isMilestoneUnlocked(milestoneId, statistics)) 1.0 else 0.0
    }

    /**
     * Retorna informacoes detalhadas sobre um milestone.
     *
     * @param milestoneId ID do milestone
     * @return Informacoes do milestone ou null se nao encontrado
     */
    fun getMilestoneInfo(milestoneId: String): MilestoneInfo? {
        return KNOWN_MILESTONES[milestoneId]
    }

    companion object {
        // IDs de milestones conhecidos (evita strings magicas)
        const val MILESTONE_FIRST_GOAL = "first_goal"
        const val MILESTONE_HAT_TRICK = "hat_trick"
        const val MILESTONE_CLEAN_SHEET = "clean_sheet"
        const val MILESTONE_PLAYMAKER = "playmaker"
        const val MILESTONE_CENTURION = "centurion"
        const val MILESTONE_GOLDEN_BOOT = "golden_boot"
        const val MILESTONE_VETERAN = "veteran"

        /**
         * Mapa centralizado de definicoes de milestones conhecidos.
         * Evita duplicacao da logica de criacao no getMilestoneInfo.
         */
        val KNOWN_MILESTONES: Map<String, MilestoneInfo> = mapOf(
            MILESTONE_FIRST_GOAL to MilestoneInfo(
                id = MILESTONE_FIRST_GOAL,
                name = "Primeiro Gol",
                description = "Marque seu primeiro gol",
                xpReward = 50
            ),
            MILESTONE_HAT_TRICK to MilestoneInfo(
                id = MILESTONE_HAT_TRICK,
                name = "Hat-trick",
                description = "Marque 3 gols em uma partida",
                xpReward = 100
            ),
            MILESTONE_CLEAN_SHEET to MilestoneInfo(
                id = MILESTONE_CLEAN_SHEET,
                name = "Muralha",
                description = "Nao sofra gols em uma partida como goleiro",
                xpReward = 75
            ),
            MILESTONE_PLAYMAKER to MilestoneInfo(
                id = MILESTONE_PLAYMAKER,
                name = "Armador",
                description = "De 3 ou mais assistencias em uma partida",
                xpReward = 80
            ),
            MILESTONE_CENTURION to MilestoneInfo(
                id = MILESTONE_CENTURION,
                name = "Centurion",
                description = "Participe de 100 jogos",
                xpReward = 500
            ),
            MILESTONE_GOLDEN_BOOT to MilestoneInfo(
                id = MILESTONE_GOLDEN_BOOT,
                name = "Artilheiro",
                description = "Marque 50 gols",
                xpReward = 300
            ),
            MILESTONE_VETERAN to MilestoneInfo(
                id = MILESTONE_VETERAN,
                name = "Veterano",
                description = "Participe de 500 jogos",
                xpReward = 1000
            )
        )
    }
}

/**
 * Informacoes sobre um milestone.
 *
 * @property id Identificador unico do milestone
 * @property name Nome para exibicao
 * @property description Descricao do criterio para desbloquear
 * @property xpReward Bonus de XP ao desbloquear o milestone
 */
data class MilestoneInfo(
    val id: String,
    val name: String,
    val description: String,
    val xpReward: Int
) {
    /**
     * Retorna texto formatado do premio de XP (ex: "+500 XP").
     */
    fun getFormattedReward(): String = "+$xpReward XP"
}
