package com.futebadosparcas.domain.ai

import com.futebadosparcas.domain.model.PlayerPosition

/**
 * Dados de um jogador para balanceamento de times.
 */
data class PlayerForBalancing(
    val id: String,
    val name: String,
    val position: PlayerPosition,
    val attackSkill: Float,
    val midfieldSkill: Float,
    val defenseSkill: Float,
    val goalkeeperSkill: Float,
    val overallRating: Float = (attackSkill + midfieldSkill + defenseSkill) / 3f
)

/**
 * Resultado do balanceamento de times.
 */
data class BalancedTeams(
    val teamA: List<PlayerForBalancing>,
    val teamB: List<PlayerForBalancing>,
    val teamARating: Float,
    val teamBRating: Float,
    val ratingDifference: Float
)

/**
 * Interface para algoritmos de balanceamento de times.
 * Permite diferentes implementacoes (greedy, genetic, etc).
 */
interface TeamBalancer {

    /**
     * Balanceia jogadores em dois times equilibrados.
     * @param players Lista de jogadores a serem divididos
     * @param goalkeepersPerTeam Numero de goleiros por time (default: 1)
     * @return Times balanceados com ratings
     */
    fun balance(
        players: List<PlayerForBalancing>,
        goalkeepersPerTeam: Int = 1
    ): BalancedTeams

    /**
     * Calcula o rating medio de um time.
     */
    fun calculateTeamRating(players: List<PlayerForBalancing>): Float {
        if (players.isEmpty()) return 0f
        return players.map { it.overallRating }.average().toFloat()
    }
}

/**
 * Implementacao padrao usando algoritmo greedy.
 * Alterna jogadores entre times ordenados por rating.
 */
object GreedyTeamBalancer : TeamBalancer {

    override fun balance(
        players: List<PlayerForBalancing>,
        goalkeepersPerTeam: Int
    ): BalancedTeams {
        if (players.isEmpty()) {
            return BalancedTeams(
                teamA = emptyList(),
                teamB = emptyList(),
                teamARating = 0f,
                teamBRating = 0f,
                ratingDifference = 0f
            )
        }

        // Separar goleiros e jogadores de linha
        val goalkeepers = players.filter { it.position == PlayerPosition.GOALKEEPER }
            .sortedByDescending { it.goalkeeperSkill }
        val linePlayers = players.filter { it.position == PlayerPosition.LINE }
            .sortedByDescending { it.overallRating }

        val teamA = mutableListOf<PlayerForBalancing>()
        val teamB = mutableListOf<PlayerForBalancing>()

        // Distribuir goleiros alternadamente
        goalkeepers.forEachIndexed { index, player ->
            if (index % 2 == 0 && teamA.count { it.position == PlayerPosition.GOALKEEPER } < goalkeepersPerTeam) {
                teamA.add(player)
            } else if (teamB.count { it.position == PlayerPosition.GOALKEEPER } < goalkeepersPerTeam) {
                teamB.add(player)
            } else {
                teamA.add(player)
            }
        }

        // Distribuir jogadores de linha usando algoritmo snake draft
        linePlayers.forEachIndexed { index, player ->
            val roundNumber = index / 2
            val pickInRound = index % 2

            // Snake draft: 0,1,1,0,0,1,1,0...
            val goesToTeamA = if (roundNumber % 2 == 0) pickInRound == 0 else pickInRound == 1

            if (goesToTeamA) {
                teamA.add(player)
            } else {
                teamB.add(player)
            }
        }

        val teamARating = calculateTeamRating(teamA)
        val teamBRating = calculateTeamRating(teamB)

        return BalancedTeams(
            teamA = teamA,
            teamB = teamB,
            teamARating = teamARating,
            teamBRating = teamBRating,
            ratingDifference = kotlin.math.abs(teamARating - teamBRating)
        )
    }
}
