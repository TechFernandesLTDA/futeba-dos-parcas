package com.futebadosparcas.domain.ranking

import com.futebadosparcas.domain.model.LevelTable

/**
 * Compat facade for level calculations.
 *
 * LevelTable is the canonical 0-20 level source of truth used by web,
 * functions and KMP use cases. Keep this facade for older callers/tests
 * without carrying a second XP curve.
 */
object LevelCalculator {

    data class LevelInfo(
        val level: Int,
        val title: String,
        val xpRequired: Long,
        val xpForNextLevel: Long
    )

    fun getLevelFromXp(xp: Long): Int {
        return LevelTable.getLevelForXp(xp.coerceAtLeast(0L))
    }

    fun getLevelInfo(level: Int): LevelInfo {
        val definition = LevelTable.getLevelDefinition(level)
            ?: LevelTable.levels.first()
        val nextXp = LevelTable.getXpForNextLevel(definition.level)
        val xpForNextLevel = if (LevelTable.isMaxLevel(definition.level)) {
            0L
        } else {
            nextXp - definition.xpRequired
        }

        return LevelInfo(
            level = definition.level,
            title = definition.name,
            xpRequired = definition.xpRequired,
            xpForNextLevel = xpForNextLevel
        )
    }

    fun getLevelInfoFromXp(xp: Long): LevelInfo {
        return getLevelInfo(getLevelFromXp(xp))
    }

    fun getProgressToNextLevel(xp: Long): Float {
        val normalizedXp = xp.coerceAtLeast(0L)
        val currentLevel = getLevelFromXp(normalizedXp)
        if (LevelTable.isMaxLevel(currentLevel)) return 1f

        val (progressXp, neededXp) = LevelTable.getXpProgress(normalizedXp)
        return (progressXp.toFloat() / neededXp.toFloat()).coerceIn(0f, 1f)
    }

    fun getXpForNextLevel(xp: Long): Long {
        val normalizedXp = xp.coerceAtLeast(0L)
        val currentLevel = getLevelFromXp(normalizedXp)
        if (LevelTable.isMaxLevel(currentLevel)) return 0L

        val (progressXp, neededXp) = LevelTable.getXpProgress(normalizedXp)
        return (neededXp - progressXp).coerceAtLeast(0L)
    }

    fun didLevelUp(xpBefore: Long, xpAfter: Long): Boolean {
        return getLevelFromXp(xpAfter) > getLevelFromXp(xpBefore)
    }

    fun getLevelTitle(level: Int): String {
        return getLevelInfo(level).title
    }

    fun getAllLevels(): List<LevelInfo> {
        return LevelTable.levels.map { definition ->
            getLevelInfo(definition.level)
        }
    }
}
