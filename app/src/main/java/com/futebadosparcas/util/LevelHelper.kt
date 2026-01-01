package com.futebadosparcas.util

import com.futebadosparcas.data.model.LevelTable

/**
 * Helper para cálculos de nível e XP (Experience Points)
 * Usa a LevelTable oficial do sistema de ranking
 */
object LevelHelper {

    /**
     * Calcula o XP necessário para alcançar um determinado nível
     */
    fun getXPForLevel(level: Int): Long {
        return LevelTable.getXpForLevel(level)
    }

    /**
     * Calcula o XP necessário para subir do nível atual para o próximo
     */
    fun getXPForNextLevel(currentLevel: Int): Long {
        return LevelTable.getXpForNextLevel(currentLevel)
    }

    /**
     * Calcula o nível baseado no XP total acumulado
     */
    fun getLevelFromXP(totalXP: Long): Int {
        return LevelTable.getLevelForXp(totalXP)
    }

    /**
     * Calcula o progresso percentual para o próximo nível
     * @return Par com (XP no nível atual, XP necessário para próximo nível)
     */
    fun getProgressInCurrentLevel(totalXP: Long): Pair<Long, Long> {
        return LevelTable.getXpProgress(totalXP)
    }

    /**
     * Calcula a porcentagem de progresso no nível atual (0 a 100)
     */
    fun getProgressPercentage(totalXP: Long): Int {
        val (currentXP, neededXP) = getProgressInCurrentLevel(totalXP)
        if (neededXP == 0L) return 100
        return ((currentXP.toFloat() / neededXP) * 100).toInt().coerceIn(0, 100)
    }

    /**
     * Retorna uma mensagem motivacional baseada no progresso
     */
    fun getMotivationalMessage(totalXP: Long): String {
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

    fun getLevelTitle(level: Int): String {
        return LevelTable.getLevelName(level)
    }
}
