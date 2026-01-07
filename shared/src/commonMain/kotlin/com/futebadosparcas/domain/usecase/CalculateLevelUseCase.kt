package com.futebadosparcas.domain.usecase

import com.futebadosparcas.domain.ranking.LevelCalculator

/**
 * Use Case para calcular nivel e progresso de XP do jogador.
 * Usa o sistema de niveis compartilhado.
 */
class CalculateLevelUseCase {

    /**
     * Calcula o nivel atual do jogador baseado no XP.
     *
     * @param currentXp XP atual do jogador
     * @return Nivel calculado (1-10)
     */
    fun calculateLevel(currentXp: Long): Int {
        return LevelCalculator.getLevelFromXp(currentXp)
    }

    /**
     * Calcula o XP necessario para atingir um nivel especifico.
     *
     * @param targetLevel Nivel alvo
     * @return XP necessario para atingir o nivel
     */
    fun getXpForLevel(targetLevel: Int): Long {
        return LevelCalculator.getLevelInfo(targetLevel).xpRequired
    }

    /**
     * Calcula o XP necessario para o proximo nivel.
     *
     * @param currentXp XP atual do jogador
     * @return XP necessario para o proximo nivel
     */
    fun getXpForNextLevel(currentXp: Long): Long {
        return LevelCalculator.getXpForNextLevel(currentXp)
    }

    /**
     * Calcula o progresso percentual no nivel atual.
     *
     * @param currentXp XP atual do jogador
     * @return Percentual de progresso (0.0 - 1.0)
     */
    fun calculateLevelProgress(currentXp: Long): Double {
        return LevelCalculator.getProgressToNextLevel(currentXp).toDouble()
    }

    /**
     * Retorna informacoes completas sobre o nivel e progresso do jogador.
     *
     * @param currentXp XP atual do jogador
     * @return Informacoes detalhadas do nivel
     */
    fun getLevelInfo(currentXp: Long): LevelInfo {
        val currentLevel = calculateLevel(currentXp)
        val levelInfo = LevelCalculator.getLevelInfo(currentLevel)
        val xpForCurrentLevel = levelInfo.xpRequired
        val xpNeededForNextLevel = getXpForNextLevel(currentXp)
        val xpInCurrentLevel = currentXp - xpForCurrentLevel
        val progress = calculateLevelProgress(currentXp)

        return LevelInfo(
            currentLevel = currentLevel,
            currentXp = currentXp,
            xpForCurrentLevel = xpForCurrentLevel,
            xpForNextLevel = xpForCurrentLevel + levelInfo.xpForNextLevel,
            xpInCurrentLevel = xpInCurrentLevel,
            xpNeededForNextLevel = xpNeededForNextLevel,
            progressPercentage = progress,
            levelTitle = levelInfo.title
        )
    }

    /**
     * Verifica se o jogador subiu de nivel apos ganhar XP.
     *
     * @param oldXp XP antes de ganhar
     * @param newXp XP depois de ganhar
     * @return True se o jogador subiu de nivel
     */
    fun didLevelUp(oldXp: Long, newXp: Long): Boolean {
        return LevelCalculator.didLevelUp(oldXp, newXp)
    }

    /**
     * Calcula quantos niveis o jogador subiu.
     *
     * @param oldXp XP antes
     * @param newXp XP depois
     * @return Numero de niveis ganhos (0 se nao subiu)
     */
    fun getLevelGain(oldXp: Long, newXp: Long): Int {
        val oldLevel = calculateLevel(oldXp)
        val newLevel = calculateLevel(newXp)
        return maxOf(0, newLevel - oldLevel)
    }

    /**
     * Retorna o titulo do nivel.
     */
    fun getLevelTitle(level: Int): String {
        return LevelCalculator.getLevelTitle(level)
    }

    /**
     * Retorna todos os niveis disponiveis.
     */
    fun getAllLevels(): List<LevelCalculator.LevelInfo> {
        return LevelCalculator.getAllLevels()
    }
}

/**
 * Informacoes detalhadas sobre o nivel do jogador.
 */
data class LevelInfo(
    val currentLevel: Int,
    val currentXp: Long,
    val xpForCurrentLevel: Long,
    val xpForNextLevel: Long,
    val xpInCurrentLevel: Long,
    val xpNeededForNextLevel: Long,
    val progressPercentage: Double,
    val levelTitle: String
) {
    /**
     * Progresso como inteiro (0-100).
     */
    fun getProgressInt(): Int = (progressPercentage * 100).toInt()

    /**
     * Verifica se esta no nivel maximo.
     */
    fun isMaxLevel(): Boolean = currentLevel >= 10
}
