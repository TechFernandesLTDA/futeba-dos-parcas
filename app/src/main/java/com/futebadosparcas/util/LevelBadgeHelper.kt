package com.futebadosparcas.util

import androidx.annotation.DrawableRes
import com.futebadosparcas.R

/**
 * Helper object para gerenciar os brasões de nível do jogador
 *
 * Brasões disponíveis:
 * - Níveis 0-10: Brasões únicos para cada nível
 * - Níveis 11-20: Usam o mesmo brasão do nível 10 (Imortal)
 *
 * Jogadores lendas (11-20):
 * - 11: Garrincha
 * - 12: Zico
 * - 13: Cruyff
 * - 14: Beckham
 * - 15: Ronaldinho
 * - 16: Ronaldo Fenômeno
 * - 17: Messi
 * - 18: Cristiano Ronaldo
 * - 19: Diego Maradona
 * - 20: Pelé (O Deus dos Deuses)
 */
object LevelBadgeHelper {

    private const val MAX_LEVEL_WITH_UNIQUE_BADGE = 10
    private const val MAX_LEVEL = 20

    /**
     * Retorna o drawable resource ID do brasão para o nível especificado
     *
     * Níveis 11-20 usam o mesmo brasão do nível 10 (Imortal),
     * pois representam a elite do futebol mundial.
     *
     * @param level O nível do jogador (0-20)
     * @return Resource ID do drawable do brasão
     */
    @DrawableRes
    fun getBadgeForLevel(level: Int): Int {
        return when (level.coerceIn(0, MAX_LEVEL)) {
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
            10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 -> R.drawable.ic_level_badge_10
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
        return level in 0..MAX_LEVEL
    }

    /**
     * Verifica se o nível usa o brasão do Imortal (nível 10+)
     *
     * @param level O nível a ser verificado
     * @return true se o nível usa o brasão do Imortal
     */
    fun isImmortalBadge(level: Int): Boolean {
        return level >= MAX_LEVEL_WITH_UNIQUE_BADGE
    }

    /**
     * Retorna todos os brasões disponíveis em ordem
     * Útil para preview ou seleção de brasões
     *
     * @return Lista de resource IDs dos brasões
     */
    fun getAllBadges(): List<Int> {
        return (0..MAX_LEVEL_WITH_UNIQUE_BADGE).map { getBadgeForLevel(it) }
    }

    /**
     * Retorna o resource ID do brasão do Imortal
     * Usado para níveis 10-20
     */
    @DrawableRes
    fun getImmortalBadge(): Int {
        return R.drawable.ic_level_badge_10
    }
}
