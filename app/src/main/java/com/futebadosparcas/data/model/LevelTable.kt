package com.futebadosparcas.data.model

import com.futebadosparcas.util.AppLogger

/**
 * Definicao de um nivel.
 */
data class LevelDefinition(
    val level: Int,
    val xpRequired: Long,
    val name: String
)

/**
 * Tabela de niveis e XP necessario.
 *
 * Suporta configuracao dinamica via Firebase Remote Config ou Firestore.
 * Se nenhuma configuracao for fornecida, usa valores padrao.
 */
object LevelTable {
    private const val TAG = "LevelTable"

    /**
     * Niveis padrao (fallback se nao houver configuracao).
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
     * Niveis configurados (podem ser atualizados em runtime).
     */
    @Volatile
    private var configuredLevels: List<LevelDefinition>? = null

    /**
     * Retorna a lista de niveis atualmente em uso.
     */
    val levels: List<LevelDefinition>
        get() = configuredLevels ?: defaultLevels

    /**
     * Configura os niveis a partir de uma fonte externa.
     *
     * @param newLevels Lista de definicoes de nivel. Deve estar ordenada por level.
     * @return true se a configuracao foi aplicada com sucesso
     */
    fun configure(newLevels: List<LevelDefinition>): Boolean {
        if (newLevels.isEmpty()) {
            AppLogger.w(TAG) { "Tentativa de configurar LevelTable com lista vazia. Ignorando." }
            return false
        }

        // Validar que os niveis estao ordenados corretamente
        val sorted = newLevels.sortedBy { it.level }
        if (sorted.first().level != 0) {
            AppLogger.w(TAG) { "LevelTable deve comecar no nivel 0. Ignorando configuracao." }
            return false
        }

        // Validar que XP e crescente
        for (i in 1 until sorted.size) {
            if (sorted[i].xpRequired <= sorted[i - 1].xpRequired) {
                AppLogger.w(TAG) { "XP deve ser crescente entre niveis. Ignorando configuracao." }
                return false
            }
        }

        configuredLevels = sorted
        AppLogger.d(TAG) { "LevelTable configurada com ${sorted.size} niveis. Max: ${sorted.last().name}" }
        return true
    }

    /**
     * Configura os niveis a partir de um mapa (formato Firestore).
     *
     * Formato esperado:
     * ```
     * {
     *   "levels": [
     *     {"level": 0, "xp_required": 0, "name": "Novato"},
     *     {"level": 1, "xp_required": 100, "name": "Iniciante"},
     *     ...
     *   ]
     * }
     * ```
     */
    fun configureFromMap(data: Map<String, Any>): Boolean {
        try {
            @Suppress("UNCHECKED_CAST")
            val levelsList = data["levels"] as? List<Map<String, Any>> ?: return false

            val parsed = levelsList.mapNotNull { levelMap ->
                val level = (levelMap["level"] as? Number)?.toInt() ?: return@mapNotNull null
                val xpRequired = (levelMap["xp_required"] as? Number)?.toLong() ?: return@mapNotNull null
                val name = levelMap["name"] as? String ?: return@mapNotNull null
                LevelDefinition(level, xpRequired, name)
            }

            return configure(parsed)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao parsear configuracao de niveis", e)
            return false
        }
    }

    /**
     * Reseta para os valores padrao.
     */
    fun reset() {
        configuredLevels = null
        AppLogger.d(TAG) { "LevelTable resetada para valores padrao" }
    }

    /**
     * Retorna o nivel para uma quantidade de XP.
     */
    fun getLevelForXp(xp: Long): Int {
        return levels.lastOrNull { xp >= it.xpRequired }?.level ?: 0
    }

    /**
     * Retorna o XP necessario para um nivel.
     */
    fun getXpForLevel(level: Int): Long {
        return levels.find { it.level == level }?.xpRequired ?: 0L
    }

    /**
     * Retorna o XP necessario para o proximo nivel.
     */
    fun getXpForNextLevel(currentLevel: Int): Long {
        val nextLevel = levels.find { it.level == currentLevel + 1 }
        return nextLevel?.xpRequired ?: levels.last().xpRequired
    }

    /**
     * Retorna o progresso de XP dentro do nivel atual.
     *
     * @return Pair(XP progresso atual, XP total necessario para o proximo nivel)
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
     * Retorna a porcentagem de progresso para o proximo nivel (0-100).
     */
    fun getProgressPercent(xp: Long): Int {
        val (progress, needed) = getXpProgress(xp)
        return if (needed > 0) {
            ((progress.toFloat() / needed) * 100).toInt().coerceIn(0, 100)
        } else {
            100 // Nivel maximo
        }
    }

    /**
     * Retorna o nome do nivel.
     */
    fun getLevelName(level: Int): String {
        return levels.find { it.level == level }?.name ?: "Desconhecido"
    }

    /**
     * Retorna o nivel maximo disponivel.
     */
    val maxLevel: Int
        get() = levels.maxOfOrNull { it.level } ?: 0

    /**
     * Verifica se o jogador atingiu o nivel maximo.
     */
    fun isMaxLevel(level: Int): Boolean {
        return level >= maxLevel
    }

    /**
     * Retorna quantos niveis o jogador subiu entre dois valores de XP.
     */
    fun getLevelsGained(xpBefore: Long, xpAfter: Long): Int {
        val levelBefore = getLevelForXp(xpBefore)
        val levelAfter = getLevelForXp(xpAfter)
        return (levelAfter - levelBefore).coerceAtLeast(0)
    }
}
