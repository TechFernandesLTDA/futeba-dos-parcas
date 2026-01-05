package com.futebadosparcas.domain.ranking

/**
 * Tabela de niveis do sistema de gamificacao.
 * Baseado em progressao geometrica para balanceamento.
 */
object LevelCalculator {

    /**
     * Representa um nivel no sistema.
     */
    data class LevelInfo(
        val level: Int,
        val title: String,
        val xpRequired: Long,
        val xpForNextLevel: Long
    )

    /**
     * Tabela de niveis com XP necessario.
     * Progressao balanceada para engajamento a longo prazo.
     */
    private val levelTable = listOf(
        LevelInfo(1, "Iniciante", 0, 100),
        LevelInfo(2, "Amador", 100, 250),
        LevelInfo(3, "Promissor", 350, 400),
        LevelInfo(4, "Habilidoso", 750, 600),
        LevelInfo(5, "Experiente", 1350, 850),
        LevelInfo(6, "Veterano", 2200, 1100),
        LevelInfo(7, "Elite", 3300, 1400),
        LevelInfo(8, "Craque", 4700, 1800),
        LevelInfo(9, "Lenda", 6500, 2300),
        LevelInfo(10, "Imortal", 8800, 0)
    )

    /**
     * Retorna o nivel atual baseado no XP total.
     */
    fun getLevelFromXp(xp: Long): Int {
        for (i in levelTable.indices.reversed()) {
            if (xp >= levelTable[i].xpRequired) {
                return levelTable[i].level
            }
        }
        return 1
    }

    /**
     * Retorna informacoes completas do nivel.
     */
    fun getLevelInfo(level: Int): LevelInfo {
        return levelTable.find { it.level == level } ?: levelTable.first()
    }

    /**
     * Retorna informacoes do nivel baseado no XP.
     */
    fun getLevelInfoFromXp(xp: Long): LevelInfo {
        val level = getLevelFromXp(xp)
        return getLevelInfo(level)
    }

    /**
     * Calcula o progresso percentual para o proximo nivel.
     */
    fun getProgressToNextLevel(xp: Long): Float {
        val currentLevel = getLevelFromXp(xp)
        val currentLevelInfo = getLevelInfo(currentLevel)

        if (currentLevel >= 10) return 1f // Nivel maximo

        val xpInCurrentLevel = xp - currentLevelInfo.xpRequired
        val xpNeededForNext = currentLevelInfo.xpForNextLevel

        return (xpInCurrentLevel.toFloat() / xpNeededForNext.toFloat()).coerceIn(0f, 1f)
    }

    /**
     * Retorna o XP necessario para o proximo nivel.
     */
    fun getXpForNextLevel(xp: Long): Long {
        val currentLevel = getLevelFromXp(xp)
        val currentLevelInfo = getLevelInfo(currentLevel)

        if (currentLevel >= 10) return 0

        val xpInCurrentLevel = xp - currentLevelInfo.xpRequired
        return currentLevelInfo.xpForNextLevel - xpInCurrentLevel
    }

    /**
     * Verifica se houve mudanca de nivel.
     */
    fun didLevelUp(xpBefore: Long, xpAfter: Long): Boolean {
        return getLevelFromXp(xpAfter) > getLevelFromXp(xpBefore)
    }

    /**
     * Retorna o titulo do nivel.
     */
    fun getLevelTitle(level: Int): String {
        return getLevelInfo(level).title
    }

    /**
     * Retorna todos os niveis disponiveis.
     */
    fun getAllLevels(): List<LevelInfo> = levelTable
}
