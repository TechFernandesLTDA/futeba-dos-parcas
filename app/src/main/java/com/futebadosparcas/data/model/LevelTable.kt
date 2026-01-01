package com.futebadosparcas.data.model

/**
 * Definicao dos niveis e XP necessario.
 */
object LevelTable {
    data class LevelDefinition(
        val level: Int,
        val xpRequired: Long,
        val name: String
    )

    val levels = listOf(
        LevelDefinition(0, 0L, "Novato"),
        LevelDefinition(1, 100L, "Iniciante"),
        LevelDefinition(2, 350L, "Amador"),
        LevelDefinition(3, 850L, "Regular"),
        LevelDefinition(4, 1850L, "Experiente"),
        LevelDefinition(5, 3850L, "Habilidoso"),
        LevelDefinition(6, 7350L, "Profissional"),
        LevelDefinition(7, 12850L, "Expert"),
        LevelDefinition(8, 20850L, "Mestre"),
        LevelDefinition(9, 32850L, "Lenda"),
        LevelDefinition(10, 52850L, "Imortal")
    )

    fun getLevelForXp(xp: Long): Int {
        return levels.lastOrNull { xp >= it.xpRequired }?.level ?: 0
    }

    fun getXpForLevel(level: Int): Long {
        return levels.getOrNull(level)?.xpRequired ?: 0L
    }

    fun getXpForNextLevel(currentLevel: Int): Long {
        val nextLevel = levels.getOrNull(currentLevel + 1)
        return nextLevel?.xpRequired ?: levels.last().xpRequired
    }

    fun getXpProgress(xp: Long): Pair<Long, Long> {
        val currentLevel = getLevelForXp(xp)
        val currentLevelXp = levels.getOrNull(currentLevel)?.xpRequired ?: 0L
        val nextLevelXp = getXpForNextLevel(currentLevel)
        val progressXp = xp - currentLevelXp
        val neededXp = nextLevelXp - currentLevelXp
        return Pair(progressXp, if (neededXp > 0) neededXp else 1L)
    }

    fun getLevelName(level: Int): String {
        return levels.getOrNull(level)?.name ?: "Desconhecido"
    }
}
