package com.futebadosparcas.util

import androidx.annotation.DrawableRes
import com.futebadosparcas.R

/**
 * Helper object para gerenciar os brasões de nível do jogador
 *
 * Brasões disponíveis:
 * - Nível 0: Iniciante
 * - Nível 1: Novato
 * - Nível 2: Aprendiz
 * - Nível 3: Jogador
 * - Nível 4: Habilidoso
 * - Nível 5: Talentoso
 * - Nível 6: Expert
 * - Nível 7: Craque
 * - Nível 8: Estrela
 * - Nível 9: Lenda
 * - Nível 10: Mestre
 */
object LevelBadgeHelper {

    /**
     * Retorna o drawable resource ID do brasão para o nível especificado
     *
     * @param level O nível do jogador (0-10)
     * @return Resource ID do drawable do brasão
     */
    @DrawableRes
    fun getBadgeForLevel(level: Int): Int {
        return when (level.coerceIn(0, 10)) {
            0 -> R.drawable.ic_level_badge_0
            1 -> R.drawable.ic_level_badge_1
            2 -> R.drawable.ic_level_badge_2
            3 -> R.drawable.ic_level_badge_3
            4 -> R.drawable.ic_level_badge_4
            5 -> R.drawable.ic_level_badge_5
            6 -> R.drawable.ic_level_badge_6
            7 -> R.drawable.ic_level_badge_7
            8 -> R.drawable.ic_level_badge_8
            9 -> R.drawable.ic_level_badge_9
            10 -> R.drawable.ic_level_badge_10
            else -> R.drawable.ic_level_badge_0
        }
    }

    /**
     * Retorna uma descrição do brasão para acessibilidade
     *
     * @param level O nível do jogador
     * @return String de descrição para content description
     */
    fun getBadgeDescription(level: Int, levelName: String): String {
        return "Brasão de nível $level - $levelName"
    }

    /**
     * Verifica se um nível tem brasão disponível
     *
     * @param level O nível a ser verificado
     * @return true se existe brasão para o nível
     */
    fun hasBadge(level: Int): Boolean {
        return level in 0..10
    }

    /**
     * Retorna todos os brasões disponíveis em ordem
     * Útil para preview ou seleção de brasões
     *
     * @return Lista de resource IDs dos brasões
     */
    fun getAllBadges(): List<Int> {
        return (0..10).map { getBadgeForLevel(it) }
    }
}
