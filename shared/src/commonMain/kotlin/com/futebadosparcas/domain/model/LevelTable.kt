package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.concurrent.Volatile

/**
 * Definio de um nvel.
 */
@Serializable
data class LevelDefinition(
    val level: Int,
    @SerialName("xp_required") val xpRequired: Long,
    val name: String
)

/**
 * Tabela de nveis e XP necessrio.
 *
 * Suporta configurao dinmica via Firebase Remote Config ou Firestore.
 * Se nenhuma configurao for fornecida, usa valores padro.
 */
object LevelTable {
    /**
     * Nveis padro (fallback se no houver configurao).
     */
    private val defaultLevels = listOf(
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

    /**
     * Nveis configurados (podem ser atualizados em runtime).
     */
    @Volatile
    private var configuredLevels: List<LevelDefinition>? = null

    /**
     * Retorna a lista de nveis atualmente em uso.
     */
    val levels: List<LevelDefinition>
        get() = configuredLevels ?: defaultLevels

    /**
     * Configura os nveis a partir de uma fonte externa.
     *
     * @param newLevels Lista de definies de nvel. Deve estar ordenada por level.
     * @return true se a configurao foi aplicada com sucesso
     */
    fun configure(newLevels: List<LevelDefinition>): Boolean {
        if (newLevels.isEmpty()) return false

        // Validar que os nveis esto ordenados corretamente
        val sorted = newLevels.sortedBy { it.level }
        if (sorted.first().level != 0) return false

        // Validar que XP  crescente
        for (i in 1 until sorted.size) {
            if (sorted[i].xpRequired <= sorted[i - 1].xpRequired) {
                return false
            }
        }

        configuredLevels = sorted
        return true
    }

    /**
     * Configura os nveis a partir de uma lista de pares chave-valor.
     *
     * Formato esperado:
     * ```
     * [
     *   {"level": 0, "xp_required": 0, "name": "Novato"},
     *   {"level": 1, "xp_required": 100, "name": "Iniciante"},
     *   ...
     * ]
     * ```
     */
    fun configureFromList(data: List<Map<String, Any>>): Boolean {
        val parsed = data.mapNotNull { levelMap ->
            val level = (levelMap["level"] as? Number)?.toInt() ?: return@mapNotNull null
            val xpRequired = (levelMap["xp_required"] as? Number)?.toLong() ?: return@mapNotNull null
            val name = levelMap["name"] as? String ?: return@mapNotNull null
            LevelDefinition(level, xpRequired, name)
        }

        return configure(parsed)
    }

    /**
     * Reseta para os valores padro.
     */
    fun reset() {
        configuredLevels = null
    }

    /**
     * Retorna o nvel para uma quantidade de XP.
     */
    fun getLevelForXp(xp: Long): Int {
        return levels.lastOrNull { xp >= it.xpRequired }?.level ?: 0
    }

    /**
     * Retorna o XP necessrio para um nvel.
     */
    fun getXpForLevel(level: Int): Long {
        return levels.find { it.level == level }?.xpRequired ?: 0L
    }

    /**
     * Retorna o XP necessrio para o prximo nvel.
     */
    fun getXpForNextLevel(currentLevel: Int): Long {
        val nextLevel = levels.find { it.level == currentLevel + 1 }
        return nextLevel?.xpRequired ?: levels.last().xpRequired
    }

    /**
     * Retorna o progresso de XP dentro do nvel atual.
     *
     * @return Pair(XP progresso atual, XP total necessrio para o prximo nvel)
     */
    fun getXpProgress(xp: Long): Pair<Long, Long> {
        val currentLevel = getLevelForXp(xp)
        val currentLevelXp = getXpForLevel(currentLevel)
        val nextLevelXp = getXpForNextLevel(currentLevel)
        val progressXp = xp - currentLevelXp
        val neededXp = nextLevelXp - currentLevelXp
        return Pair(progressXp, if (neededXp > 0) neededXp else 1L)
    }

    /**
     * Retorna a porcentagem de progresso para o prximo nvel (0-100).
     */
    fun getProgressPercent(xp: Long): Int {
        val (progress, needed) = getXpProgress(xp)
        return if (needed > 0) {
            ((progress.toFloat() / needed) * 100).toInt().coerceIn(0, 100)
        } else {
            100 // Nvel mximo
        }
    }

    /**
     * Retorna o nome do nvel.
     */
    fun getLevelName(level: Int): String {
        return levels.find { it.level == level }?.name ?: "Desconhecido"
    }

    /**
     * Retorna o nvel mximo disponvel.
     */
    val maxLevel: Int
        get() = levels.maxOfOrNull { it.level } ?: 0

    /**
     * Verifica se o jogador atingiu o nvel mximo.
     */
    fun isMaxLevel(level: Int): Boolean {
        return level >= maxLevel
    }

    /**
     * Retorna quantos nveis o jogador subiu entre dois valores de XP.
     */
    fun getLevelsGained(xpBefore: Long, xpAfter: Long): Int {
        val levelBefore = getLevelForXp(xpBefore)
        val levelAfter = getLevelForXp(xpAfter)
        return (levelAfter - levelBefore).coerceAtLeast(0)
    }
}
