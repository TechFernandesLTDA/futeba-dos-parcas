package com.futebadosparcas.domain.usecase

import com.futebadosparcas.domain.model.LevelTable

/**
 * Use Case para calcular nivel e progresso de XP do jogador.
 *
 * Usa LevelTable como unica fonte de verdade (20 niveis).
 * LevelCalculator (10 niveis) foi descontinuado — fix #1531.
 */
class CalculateLevelUseCase {

    /**
     * Calcula o nivel atual do jogador baseado no XP.
     *
     * @param currentXp XP atual do jogador
     * @return Nivel calculado (0-20)
     */
    fun calculateLevel(currentXp: Long): Int {
        return LevelTable.getLevelForXp(currentXp)
    }

    /**
     * Calcula o XP necessario para atingir um nivel especifico.
     *
     * @param targetLevel Nivel alvo
     * @return XP necessario para atingir o nivel
     */
    fun getXpForLevel(targetLevel: Int): Long {
        return LevelTable.getXpForLevel(targetLevel)
    }

    /**
     * Calcula o XP necessario para o proximo nivel.
     *
     * @param currentXp XP atual do jogador
     * @return XP necessario para o proximo nivel
     */
    fun getXpForNextLevel(currentXp: Long): Long {
        val currentLevel = calculateLevel(currentXp)
        val currentLevelXp = LevelTable.getXpForLevel(currentLevel)
        val nextLevelXp = LevelTable.getXpForNextLevel(currentLevel)
        val xpInCurrentLevel = currentXp - currentLevelXp
        val xpNeeded = nextLevelXp - currentLevelXp
        return (xpNeeded - xpInCurrentLevel).coerceAtLeast(0L)
    }

    /**
     * Calcula o progresso percentual no nivel atual.
     *
     * @param currentXp XP atual do jogador
     * @return Percentual de progresso (0.0 - 1.0)
     */
    fun calculateLevelProgress(currentXp: Long): Double {
        return LevelTable.getProgressPercent(currentXp) / 100.0
    }

    /**
     * Retorna informacoes completas sobre o nivel e progresso do jogador.
     *
     * @param currentXp XP atual do jogador
     * @return Informacoes detalhadas do nivel
     */
    fun getLevelInfo(currentXp: Long): LevelInfo {
        val currentLevel = calculateLevel(currentXp)
        val xpForCurrentLevel = LevelTable.getXpForLevel(currentLevel)
        val xpNeededForNextLevel = getXpForNextLevel(currentXp)
        val xpInCurrentLevel = currentXp - xpForCurrentLevel
        val progress = calculateLevelProgress(currentXp)
        val levelTitle = LevelTable.getLevelName(currentLevel)
        val nextLevelXp = LevelTable.getXpForNextLevel(currentLevel)

        return LevelInfo(
            currentLevel = currentLevel,
            currentXp = currentXp,
            xpForCurrentLevel = xpForCurrentLevel,
            xpForNextLevel = nextLevelXp,
            xpInCurrentLevel = xpInCurrentLevel,
            xpNeededForNextLevel = xpNeededForNextLevel,
            progressPercentage = progress,
            levelTitle = levelTitle
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
        return LevelTable.getLevelsGained(oldXp, newXp) > 0
    }

    /**
     * Calcula quantos niveis o jogador subiu.
     *
     * @param oldXp XP antes
     * @param newXp XP depois
     * @return Numero de niveis ganhos (0 se nao subiu)
     */
    fun getLevelGain(oldXp: Long, newXp: Long): Int {
        return LevelTable.getLevelsGained(oldXp, newXp)
    }

    /**
     * Retorna o titulo do nivel.
     */
    fun getLevelTitle(level: Int): String {
        return LevelTable.getLevelName(level)
    }

    /**
     * Retorna todos os niveis disponiveis.
     */
    fun getAllLevels(): List<LevelInfo> {
        return LevelTable.levels.map { def ->
            val nextXp = LevelTable.getXpForNextLevel(def.level)
            LevelInfo(
                currentLevel = def.level,
                currentXp = def.xpRequired,
                xpForCurrentLevel = def.xpRequired,
                xpForNextLevel = nextXp,
                xpInCurrentLevel = 0L,
                xpNeededForNextLevel = nextXp - def.xpRequired,
                progressPercentage = 0.0,
                levelTitle = def.name
            )
        }
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
    fun isMaxLevel(): Boolean = currentLevel >= LevelTable.maxLevel
}
