package com.futebadosparcas.util

import androidx.annotation.DrawableRes
import com.futebadosparcas.R

/**
 * Helper object para gerenciar os brasões de nível do jogador
 *
 * Brasões disponíveis (0-20):
 * - Níveis 0-10: Brasões únicos built-in (Progressão Base)
 * - Níveis 11-20: Brasões cartoon das Lendas do Futebol (resolvidos dinamicamente,
 *   com fallback automático para o badge 10 enquanto os drawables não existirem)
 *
 * Jogadores lendas (11-20):
 * - 11: Garrincha          - "Alegria do Povo! Dribla até o vento!"
 * - 12: Zico               - "O Galinho de Quintino! Craque nato!"
 * - 13: Cruyff             - "Futebol Total! Visão de jogo única!"
 * - 14: Beckham            - "Precisão cirúrgica nos passes!"
 * - 15: Ronaldinho         - "Joga bonito! O sorriso do futebol!"
 * - 16: Ronaldo Fenômeno   - "Fenômeno! Velocidade e gols!"
 * - 17: Messi              - "La Pulga! Gênio da bola!"
 * - 18: Cristiano Ronaldo  - "CR7! Determinação e excelência!"
 * - 19: Diego Maradona     - "La Mano de Dios! Pura magia!"
 * - 20: Pelé               - "O Rei do Futebol! Nível máximo!"
 */
object LevelBadgeHelper {

    private const val MAX_LEVEL = 20

    /**
     * Retorna o drawable resource ID do brasão para o nível especificado.
     *
     * Níveis 0-10: retorna o drawable built-in diretamente.
     * Níveis 11-20: tenta resolver `ic_level_badge_{N}` via reflection;
     *               se o recurso não existir, faz fallback para badge 10.
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
            10 -> R.drawable.ic_level_badge_10
            else -> resolveBadgeOrFallback(level)
        }
    }

    /**
     * Tenta resolver o drawable `ic_level_badge_{level}` via reflection.
     * Se o campo não existir no R.drawable, retorna o badge 10 como fallback.
     *
     * Isso permite que o código compile sem os drawables cartoon (11-20) e
     * funcione automaticamente quando eles forem adicionados ao projeto.
     */
    @DrawableRes
    private fun resolveBadgeOrFallback(level: Int): Int {
        return try {
            val field = R.drawable::class.java.getField("ic_level_badge_$level")
            field.getInt(null)
        } catch (_: NoSuchFieldException) {
            R.drawable.ic_level_badge_10
        } catch (_: Exception) {
            R.drawable.ic_level_badge_10
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
     * Verifica se o nível está na faixa Lendas do Futebol (11+)
     *
     * @param level O nível a ser verificado
     * @return true se o nível é uma lenda (11 ou superior)
     */
    fun isLegendBadge(level: Int): Boolean {
        return level >= 11
    }

    /**
     * Retorna todos os badges built-in (0-10) em ordem.
     * Útil para preview ou seleção de brasões da progressão base.
     *
     * @return Lista de resource IDs dos brasões 0-10
     */
    fun getAllBuiltInBadges(): List<Int> {
        return (0..10).map { getBadgeForLevel(it) }
    }

    /**
     * Retorna o resource ID do brasão do Imortal (nível 10).
     * Usado como fallback para níveis 11-20 quando os drawables
     * cartoon ainda não foram adicionados.
     */
    @DrawableRes
    fun getFallbackBadge(): Int {
        return R.drawable.ic_level_badge_10
    }
}
