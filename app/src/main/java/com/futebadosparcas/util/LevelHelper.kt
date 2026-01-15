package com.futebadosparcas.util

import com.futebadosparcas.domain.model.LevelTable

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
     * Retorna o nome do nível
     */
    fun getLevelTitle(level: Int): String {
        return LevelTable.getLevelName(level)
    }

    /**
     * Retorna a frase inspiradora do nível
     */
    fun getLevelPhrase(level: Int): String {
        return LevelTable.getLevelPhrase(level)
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
     * Verifica se o jogador atingiu o nível máximo
     */
    fun isMaxLevel(level: Int): Boolean {
        return LevelTable.isMaxLevel(level)
    }

    /**
     * Retorna o nível máximo disponível
     */
    fun getMaxLevel(): Int {
        return LevelTable.maxLevel
    }

    /**
     * Retorna uma mensagem motivacional baseada no progresso
     */
    fun getMotivationalMessage(totalXP: Long): String {
        val (currentXP, neededXP) = getProgressInCurrentLevel(totalXP)
        val remaining = neededXP - currentXP
        val percentage = getProgressPercentage(totalXP)
        val level = getLevelFromXP(totalXP)
        val maxLevel = getMaxLevel()

        return when {
            level >= maxLevel -> "Você atingiu o nível máximo! ${getLevelTitle(level)}!"
            percentage >= 90 -> "Quase lá! Só mais $remaining XP para o ${getLevelTitle(level + 1)}!"
            percentage >= 75 -> "Faltam apenas $remaining XP para o próximo nível!"
            percentage >= 50 -> "Você já está na metade! Continue jogando!"
            percentage >= 25 -> "Bom progresso! Faltam $remaining XP para subir!"
            else -> "Jogue mais partidas para ganhar XP!"
        }
    }
}
