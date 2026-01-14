package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.concurrent.Volatile

/**
 * Definio de um nvel.
 *
 * Inclui uma frase inspiradora para cada nvel.
 */
@Serializable
data class LevelDefinition(
    val level: Int,
    @SerialName("xp_required") val xpRequired: Long,
    val name: String,
    val phrase: String = ""
)

/**
 * Frases inspiradoras para cada nvel (0-20).
 */
private val levelPhrases = mapOf(
    0 to "Toda jornada comea com o primeiro passo. Vamos l!",
    1 to "O comeo da sua lendria caminhada no futebol.",
    2 to "A prtica leva perfeio. Continue assim!",
    3 to "Cada jogo uma nova oportunidade de brilhar.",
    4 to "Sua evoluo est impressionante. Continue firme!",
    5 to "Voc est se tornando um jogador temido.",
    6 to "A profissionalizao do seu jogo est completa.",
    7 to "Seu talento j no pode mais ser ignorado.",
    8 to "Mestre das peladas, respeitado por todos.",
    9 to "Seu nome j escrito na histria do grupo.",
    10 to "A imortalidade no futebol comea aqui.",
    11 to "Nenhuma barreira pode deter sua evoluo.",
    12 to "Tcnica apurada, viso de jogo incomparvel.",
    13 to "O campo o seu palco, e voc brilha.",
    14 to "Genialidade pura em cada toque na bola.",
    15 to "Um mago com a bola nos ps.",
    16 to "Lenda viva do futebol amador.",
    17 to "Rei do drible, mestre da finalizao.",
    18 to "O melhor do mundo em sua poca.",
    19 to "Incomparvel, extraordinrio, o puro gnio.",
    20 to "O Rei do Futebol. O Deus dos Deuses."
)

/**
 * Tabela de nveis e XP necessrio.
 *
 * Progresso:
 * - Nveis 0-10: ~1,5 anos para jogador que joga 1x/sem (~78 jogos)
 * - Nveis 11-20: ~1,5 anos adicionais (mais ~78 jogos)
 * - Nvel 20: Pelé, a maior honra do futebol
 *
 * Suporta configurao dinmica via Firebase Remote Config ou Firestore.
 * Se nenhuma configurao for fornecida, usa valores padro.
 */
object LevelTable {
    /**
     * Nveis padro (fallback se no houver configurao).
     * Total de 20 nveis, sendo o nvel 20 dedicado a Pelé.
     */
    private val defaultLevels = listOf(
        // FASE 1: Iniciante (0-10) - ~1,5 anos jogando 1x/sem
        LevelDefinition(0, 0L, "Novato", levelPhrases[0]!!),
        LevelDefinition(1, 100L, "Iniciante", levelPhrases[1]!!),
        LevelDefinition(2, 350L, "Amador", levelPhrases[2]!!),
        LevelDefinition(3, 850L, "Regular", levelPhrases[3]!!),
        LevelDefinition(4, 1850L, "Experiente", levelPhrases[4]!!),
        LevelDefinition(5, 3850L, "Habilidoso", levelPhrases[5]!!),
        LevelDefinition(6, 7350L, "Profissional", levelPhrases[6]!!),
        LevelDefinition(7, 12850L, "Expert", levelPhrases[7]!!),
        LevelDefinition(8, 20850L, "Mestre", levelPhrases[8]!!),
        LevelDefinition(9, 32850L, "Lenda", levelPhrases[9]!!),
        LevelDefinition(10, 52850L, "Imortal", levelPhrases[10]!!),

        // FASE 2: lendas do Futebol (11-20) - ~1,5 anos adicionais
        // Nveis 11-20 usam o mesmo badge do Imortal (nvel 10)
        // Nomes em ordem crescente de fama, culminando com Pelé
        LevelDefinition(11, 75000L, "Garrincha", levelPhrases[11]!!),
        LevelDefinition(12, 100000L, "Zico", levelPhrases[12]!!),
        LevelDefinition(13, 128000L, "Cruyff", levelPhrases[13]!!),
        LevelDefinition(14, 160000L, "Beckham", levelPhrases[14]!!),
        LevelDefinition(15, 198000L, "Ronaldinho", levelPhrases[15]!!),
        LevelDefinition(16, 242000L, "Ronaldo Fenmeno", levelPhrases[16]!!),
        LevelDefinition(17, 295000L, "Messi", levelPhrases[17]!!),
        LevelDefinition(18, 360000L, "Cristiano Ronaldo", levelPhrases[18]!!),
        LevelDefinition(19, 440000L, "Diego Maradona", levelPhrases[19]!!),
        LevelDefinition(20, 528500L, "Pelé", levelPhrases[20]!!)
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
     * Retorna a frase inspiradora do nvel.
     */
    fun getLevelPhrase(level: Int): String {
        return levels.find { it.level == level }?.phrase ?: ""
    }

    /**
     * Retorna a definio completa do nvel.
     */
    fun getLevelDefinition(level: Int): LevelDefinition? {
        return levels.find { it.level == level }
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
