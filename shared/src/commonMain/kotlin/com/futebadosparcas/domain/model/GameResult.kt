package com.futebadosparcas.domain.model

/**
 * Resultado de uma partida para um jogador/time.
 *
 * Inclui valores de XP e pontos de temporada associados a cada resultado.
 *
 * @property displayName Nome para exibicao
 * @property xpReward XP base concedido pelo resultado
 * @property seasonPoints Pontos de temporada (formato classico: 3/1/0)
 */
enum class GameResult(
    val displayName: String,
    val xpReward: Int,
    val seasonPoints: Int
) {
    WIN("Vitoria", 20, 3),
    DRAW("Empate", 10, 1),
    LOSS("Derrota", 0, 0);

    /**
     * Verifica se o resultado e positivo (vitoria ou empate).
     */
    fun isPositive(): Boolean = this != LOSS

    companion object {
        /**
         * Converte String para GameResult. Retorna null se invalido.
         */
        fun fromString(value: String?): GameResult? {
            return entries.find { it.name == value }
        }

        /**
         * Determina o resultado baseado nos placares dos times.
         *
         * @param myTeamScore Placar do time do jogador
         * @param opponentScore Placar do adversario
         * @return Resultado correspondente
         */
        fun fromScore(myTeamScore: Int, opponentScore: Int): GameResult = when {
            myTeamScore > opponentScore -> WIN
            myTeamScore < opponentScore -> LOSS
            else -> DRAW
        }
    }
}
