package com.futebadosparcas.domain.service

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.repository.GameRepository

/**
 * Dados de sugestao de horario com taxa de adesao.
 */
data class TimeSuggestion(
    val time: String,
    val attendanceRate: Double, // 0.0 a 1.0
    val gamesAnalyzed: Int
)

/**
 * Servico para analise de historico de jogos e sugestao de horarios.
 * Analisa jogos anteriores do usuario para determinar os horarios
 * com maior taxa de adesao (confirmacoes / max_players).
 */
class TimeSuggestionService constructor(
    private val gameRepository: GameRepository
) {
    companion object {
        // Horarios padrao para sugestao quando nao ha historico
        val DEFAULT_TIMES = listOf("19:00", "20:00", "21:00")
        const val MIN_GAMES_FOR_SUGGESTION = 3
    }

    /**
     * Analisa o historico de jogos e retorna sugestoes de horario.
     *
     * @param locationId Opcional - filtrar por local especifico
     * @param limit Numero maximo de sugestoes a retornar
     * @return Lista de sugestoes ordenadas por taxa de adesao (maior primeiro)
     */
    suspend fun getTimeSuggestions(
        locationId: String? = null,
        limit: Int = 3
    ): List<TimeSuggestion> {
        val gamesResult = gameRepository.getAllGames()

        if (gamesResult.isFailure) {
            return emptyList()
        }

        val games = gamesResult.getOrNull() ?: emptyList()

        // Filtrar jogos finalizados do usuario
        val finishedGames = games.filter { game ->
            game.status == "FINISHED" &&
                    (locationId == null || game.locationId == locationId)
        }

        if (finishedGames.size < MIN_GAMES_FOR_SUGGESTION) {
            return emptyList()
        }

        // Agrupar por horario e calcular taxa de adesao media
        val timeStats = finishedGames
            .groupBy { it.time.take(5) } // Pegar apenas HH:mm
            .mapNotNull { (time, gamesAtTime) ->
                if (gamesAtTime.isEmpty()) return@mapNotNull null

                val avgAttendance = gamesAtTime.map { game ->
                    if (game.maxPlayers > 0) {
                        game.playersCount.toDouble() / game.maxPlayers
                    } else {
                        0.0
                    }
                }.average()

                TimeSuggestion(
                    time = time,
                    attendanceRate = avgAttendance.coerceIn(0.0, 1.0),
                    gamesAnalyzed = gamesAtTime.size
                )
            }
            .filter { it.gamesAnalyzed >= 2 } // Minimo de 2 jogos no horario
            .sortedByDescending { it.attendanceRate }
            .take(limit)

        return timeStats
    }

    /**
     * Retorna a melhor sugestao de horario, se houver dados suficientes.
     */
    suspend fun getBestTimeSuggestion(locationId: String? = null): TimeSuggestion? {
        return getTimeSuggestions(locationId, limit = 1).firstOrNull()
    }

    /**
     * Formata a sugestao para exibicao.
     * Ex: "20:00 (85% de adesao)"
     */
    fun formatSuggestion(suggestion: TimeSuggestion): String {
        val percentage = (suggestion.attendanceRate * 100).toInt()
        return "${suggestion.time} (${percentage}% de adesao)"
    }
}
