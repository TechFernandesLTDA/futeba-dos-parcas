package com.futebadosparcas.util

import com.futebadosparcas.data.model.LevelTable

/**
 * Helper para cálculos de nível e XP (Experience Points)
 * Usa a LevelTable oficial do sistema de ranking
 */
object LevelHelper {

    /**
     * Calcula o XP necessário para alcançar um determinado nível
     * Usa a tabela oficial de niveis (0-10)
     */
    fun getXPForLevel(level: Int): Int {
        return LevelTable.getXpForLevel(level)
    }

    /**
     * Calcula o XP necessário para subir do nível atual para o próximo
     */
    fun getXPForNextLevel(currentLevel: Int): Int {
        return LevelTable.getXpForNextLevel(currentLevel)
    }

    /**
     * Calcula o nível baseado no XP total acumulado
     *
     * @param totalXP XP total do jogador
     * @return Nível calculado (0-10)
     */
    fun getLevelFromXP(totalXP: Int): Int {
        return LevelTable.getLevelForXp(totalXP)
    }

    /**
     * Calcula o progresso percentual para o próximo nível
     *
     * @param totalXP XP total do jogador
     * @return Par com (XP no nível atual, XP necessário para próximo nível)
     */
    fun getProgressInCurrentLevel(totalXP: Int): Pair<Int, Int> {
        return LevelTable.getXpProgress(totalXP)
    }

    /**
     * Calcula a porcentagem de progresso no nível atual
     *
     * @param totalXP XP total do jogador
     * @return Porcentagem de 0 a 100
     */
    fun getProgressPercentage(totalXP: Int): Int {
        val (currentXP, neededXP) = getProgressInCurrentLevel(totalXP)
        if (neededXP == 0) return 100
        return ((currentXP.toFloat() / neededXP) * 100).toInt().coerceIn(0, 100)
    }

    /**
     * Retorna uma mensagem motivacional baseada no progresso
     */
    fun getMotivationalMessage(totalXP: Int): String {
        val (currentXP, neededXP) = getProgressInCurrentLevel(totalXP)
        val remaining = neededXP - currentXP
        val percentage = getProgressPercentage(totalXP)
        val level = getLevelFromXP(totalXP)

        return when {
            level >= 10 -> "Voce atingiu o nivel maximo! Lendario!"
            percentage >= 90 -> "Quase la! So mais $remaining XP para o nivel ${level + 1}!"
            percentage >= 75 -> "Faltam apenas $remaining XP para o proximo nivel!"
            percentage >= 50 -> "Voce ja esta na metade! Continue jogando!"
            percentage >= 25 -> "Bom progresso! Faltam $remaining XP para subir!"
            else -> "Jogue mais partidas para ganhar XP!"
        }
    }

    /**
     * Retorna o título baseado no nível
     * Usa os nomes oficiais da LevelTable
     */
    fun getLevelTitle(level: Int): String {
        return LevelTable.getLevelName(level)
    }
}
