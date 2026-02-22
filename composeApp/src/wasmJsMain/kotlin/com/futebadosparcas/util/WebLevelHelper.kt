package com.futebadosparcas.util

import com.futebadosparcas.domain.model.LevelTable

object WebLevelHelper {
    fun getLevelFromXP(totalXP: Long): Int = LevelTable.getLevelForXp(totalXP)

    fun getXPForLevel(level: Int): Long = LevelTable.getXpForLevel(level)

    fun getLevelTitle(level: Int): String = LevelTable.getLevelName(level)

    fun getLevelPhrase(level: Int): String = LevelTable.getLevelPhrase(level)

    fun getProgressInCurrentLevel(totalXP: Long): Pair<Long, Long> = LevelTable.getXpProgress(totalXP)

    fun getProgressPercentage(totalXP: Long): Int = LevelTable.getProgressPercent(totalXP)

    fun isMaxLevel(level: Int): Boolean = LevelTable.isMaxLevel(level)

    fun getMaxLevel(): Int = LevelTable.maxLevel

    fun getLevelEmoji(level: Int): String = when {
        level >= 50 -> "👑"
        level >= 40 -> "🏆"
        level >= 30 -> "⭐"
        level >= 20 -> "💫"
        level >= 10 -> "🌟"
        level >= 5 -> "✨"
        else -> "🌱"
    }

    fun getLevelColorHex(level: Int): String = when {
        level >= 50 -> "#FFD700"
        level >= 30 -> "#9C27B0"
        level >= 20 -> "#2196F3"
        level >= 10 -> "#4CAF50"
        else -> "#1976D2"
    }
}
