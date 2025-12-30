package com.futebadosparcas.domain.ranking

import com.futebadosparcas.data.model.MilestoneType
import com.futebadosparcas.data.model.UserStatistics

/**
 * Resultado da verificacao de milestones.
 */
data class MilestoneCheckResult(
    val newMilestones: List<MilestoneType>,
    val totalXpFromMilestones: Int
)

/**
 * Verifica e concede milestones baseado nas estatisticas do jogador.
 */
object MilestoneChecker {

    /**
     * Verifica quais milestones foram alcancados mas ainda nao concedidos.
     *
     * @param stats Estatisticas atuais do jogador (JA atualizadas com o jogo atual)
     * @param achievedMilestones Lista de milestones ja conquistados anteriormente
     * @return Lista de novos milestones alcancados e XP total ganho
     */
    fun check(
        stats: UserStatistics,
        achievedMilestones: List<String>
    ): MilestoneCheckResult {
        val newMilestones = mutableListOf<MilestoneType>()

        MilestoneType.entries.forEach { milestone ->
            // Pular se ja conquistou
            if (achievedMilestones.contains(milestone.name)) {
                return@forEach
            }

            // Verificar se alcancou o threshold
            val currentValue = getStatValue(stats, milestone.field)
            if (currentValue >= milestone.threshold) {
                newMilestones.add(milestone)
            }
        }

        val totalXp = newMilestones.sumOf { it.xpReward }

        return MilestoneCheckResult(
            newMilestones = newMilestones,
            totalXpFromMilestones = totalXp
        )
    }

    /**
     * Obtem o valor de um campo especifico das estatisticas.
     */
    private fun getStatValue(stats: UserStatistics, field: String): Int {
        return when (field) {
            "totalGames" -> stats.totalGames
            "totalGoals" -> stats.totalGoals
            "totalAssists" -> stats.totalAssists
            "totalSaves" -> stats.totalSaves
            "bestPlayerCount" -> stats.bestPlayerCount
            "gamesWon" -> stats.gamesWon
            else -> 0
        }
    }

    /**
     * Retorna todos os milestones disponiveis agrupados por categoria.
     */
    fun getAllMilestonesByCategory(): Map<String, List<MilestoneType>> {
        return MilestoneType.entries.groupBy { milestone ->
            when {
                milestone.name.startsWith("GAMES_") -> "Jogos"
                milestone.name.startsWith("GOALS_") -> "Gols"
                milestone.name.startsWith("ASSISTS_") -> "Assistencias"
                milestone.name.startsWith("SAVES_") -> "Defesas"
                milestone.name.startsWith("MVP_") -> "MVP"
                milestone.name.startsWith("WINS_") -> "Vitorias"
                else -> "Outros"
            }
        }
    }

    /**
     * Retorna o progresso do jogador em um milestone especifico.
     */
    fun getProgress(stats: UserStatistics, milestone: MilestoneType): Pair<Int, Int> {
        val current = getStatValue(stats, milestone.field)
        return Pair(current, milestone.threshold)
    }

    /**
     * Retorna o proximo milestone a ser alcancado para cada categoria.
     */
    fun getNextMilestones(
        stats: UserStatistics,
        achievedMilestones: List<String>
    ): List<MilestoneType> {
        val nextByCategory = mutableMapOf<String, MilestoneType?>()

        MilestoneType.entries.forEach { milestone ->
            if (achievedMilestones.contains(milestone.name)) {
                return@forEach
            }

            val category = milestone.field
            val currentValue = getStatValue(stats, category)

            // So considerar se ainda nao alcancou
            if (currentValue < milestone.threshold) {
                val existing = nextByCategory[category]
                // Pegar o milestone mais proximo (menor threshold)
                if (existing == null || milestone.threshold < existing.threshold) {
                    nextByCategory[category] = milestone
                }
            }
        }

        return nextByCategory.values.filterNotNull()
    }
}
