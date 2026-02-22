package com.futebadosparcas.domain.ranking

import com.futebadosparcas.data.model.MilestoneType
import com.futebadosparcas.domain.model.Statistics

/**
 * Resultado da verificacao de milestones.
 */
data class MilestoneCheckResult(
    val newMilestones: List<MilestoneType>,
    val totalXpFromMilestones: Long
) {
    /**
     * Retorna os nomes dos milestones para persistencia.
     */
    val milestoneNames: List<String>
        get() = newMilestones.map { it.name }
}

/**
 * Verifica e concede milestones baseado nas estatisticas do jogador.
 *
 * IMPORTANTE: Esta classe apenas VERIFICA milestones. A persistencia
 * deve ser feita pelo chamador usando transacoes atomicas para evitar
 * duplicatas em cenarios de concorrencia.
 */
object MilestoneChecker {

    /**
     * Verifica quais milestones foram alcancados mas ainda nao concedidos.
     *
     * NOTA: O chamador deve garantir que `achievedMilestones` esta atualizado
     * e que a persistencia dos novos milestones sera feita atomicamente.
     *
     * @param stats Estatisticas atuais do jogador (JA atualizadas com o jogo atual)
     * @param achievedMilestones Lista de milestones ja conquistados anteriormente
     * @return Lista de novos milestones alcancados e XP total ganho
     */
    fun check(
        stats: Statistics,
        achievedMilestones: List<String>
    ): MilestoneCheckResult {
        val newMilestones = mutableListOf<MilestoneType>()

        // Usar Set para busca O(1) em vez de List O(n)
        val achievedSet = achievedMilestones.toSet()

        MilestoneType.entries.forEach { milestone ->
            // Pular se ja conquistou
            if (achievedSet.contains(milestone.name)) {
                return@forEach
            }

            // Verificar se alcancou o threshold
            val currentValue = getStatValue(stats, milestone.field)
            if (currentValue >= milestone.threshold) {
                newMilestones.add(milestone)
            }
        }

        // Calcular XP total dos novos milestones
        val totalXp = newMilestones.fold(0L) { acc, milestone -> acc + milestone.xpReward }

        return MilestoneCheckResult(
            newMilestones = newMilestones,
            totalXpFromMilestones = totalXp
        )
    }

    /**
     * Verifica milestones de forma segura, garantindo que duplicatas
     * sejam removidas mesmo se a lista de achievedMilestones estiver desatualizada.
     *
     * Use esta versao quando nao puder garantir atomicidade da leitura.
     */
    fun checkSafe(
        stats: Statistics,
        achievedMilestones: List<String>,
        pendingMilestones: List<String> = emptyList()
    ): MilestoneCheckResult {
        // Combinar achieved + pending para evitar duplicatas
        val allAchieved = (achievedMilestones + pendingMilestones).toSet()

        return check(stats, allAchieved.toList())
    }

    /**
     * Obtem o valor de um campo especifico das estatisticas.
     */
    private fun getStatValue(stats: Statistics, field: String): Int {
        return when (field) {
            "totalGames" -> stats.totalGames
            "totalGoals" -> stats.totalGoals
            "totalAssists" -> stats.totalAssists
            "totalSaves" -> stats.totalSaves
            "bestPlayerCount" -> stats.bestPlayerCount
            "gamesWon" -> stats.gamesWon
            "worstPlayerCount" -> stats.worstPlayerCount
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
    fun getProgress(stats: Statistics, milestone: MilestoneType): Pair<Int, Int> {
        val current = getStatValue(stats, milestone.field)
        return Pair(current, milestone.threshold)
    }

    /**
     * Retorna a porcentagem de progresso (0-100) para um milestone.
     */
    fun getProgressPercent(stats: Statistics, milestone: MilestoneType): Int {
        val (current, threshold) = getProgress(stats, milestone)
        return if (threshold > 0) {
            ((current.toFloat() / threshold) * 100).toInt().coerceIn(0, 100)
        } else {
            0
        }
    }

    /**
     * Retorna o proximo milestone a ser alcancado para cada categoria.
     */
    fun getNextMilestones(
        stats: Statistics,
        achievedMilestones: List<String>
    ): List<MilestoneType> {
        val achievedSet = achievedMilestones.toSet()
        val nextByCategory = mutableMapOf<String, MilestoneType?>()

        MilestoneType.entries.forEach { milestone ->
            if (achievedSet.contains(milestone.name)) {
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

    /**
     * Verifica se um milestone especifico foi alcancado.
     */
    fun isAchieved(
        stats: Statistics,
        milestone: MilestoneType
    ): Boolean {
        val currentValue = getStatValue(stats, milestone.field)
        return currentValue >= milestone.threshold
    }

    /**
     * Calcula quantos pontos faltam para o proximo milestone de uma categoria.
     */
    fun getPointsToNext(
        stats: Statistics,
        achievedMilestones: List<String>,
        category: String
    ): Int? {
        val achievedSet = achievedMilestones.toSet()

        val nextMilestone = MilestoneType.entries
            .filter { it.field == category && !achievedSet.contains(it.name) }
            .minByOrNull { it.threshold }
            ?: return null

        val current = getStatValue(stats, category)
        return (nextMilestone.threshold - current).coerceAtLeast(0)
    }
}
