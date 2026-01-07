package com.futebadosparcas.domain.usecase

import com.futebadosparcas.domain.ai.BalancedTeams
import com.futebadosparcas.domain.ai.PlayerForBalancing
import com.futebadosparcas.domain.ai.GreedyTeamBalancer
import com.futebadosparcas.domain.model.PlayerPosition
import com.futebadosparcas.domain.model.User

/**
 * Use Case para balancear times de forma justa.
 * Usa o algoritmo de balanceamento compartilhado.
 */
class BalanceTeamsUseCase {

    private val teamBalancer = GreedyTeamBalancer

    /**
     * Balanceia times com base em uma lista de usuarios confirmados.
     *
     * @param users Lista de usuarios que confirmaram presenca
     * @param goalkeepersPerTeam Numero de goleiros por time (padrao: 1)
     * @return Times balanceados ou erro se nao houver jogadores suficientes
     */
    operator fun invoke(
        users: List<User>,
        goalkeepersPerTeam: Int = 1
    ): Result<BalancedTeams> {
        return try {
            // Validacoes
            if (users.isEmpty()) {
                return Result.failure(IllegalArgumentException("Lista de jogadores vazia"))
            }

            if (users.size < 2) {
                return Result.failure(IllegalArgumentException("Sao necessarios pelo menos 2 jogadores"))
            }

            // Converter User para PlayerForBalancing
            val players = users.map { user ->
                val rating = user.getOverallRating().toFloat()
                PlayerForBalancing(
                    id = user.id,
                    name = user.getDisplayName(),
                    position = PlayerPosition.LINE, // Default to LINE, pode ser ajustado conforme necessario
                    attackSkill = rating,
                    midfieldSkill = rating,
                    defenseSkill = rating,
                    goalkeeperSkill = rating * 0.8f // GK skill um pouco menor por padrao
                )
            }

            // Balancear times
            val balanced = teamBalancer.balance(players, goalkeepersPerTeam)

            Result.success(balanced)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Balanceia times e retorna IDs dos jogadores organizados por time.
     *
     * @param users Lista de usuarios que confirmaram presenca
     * @param goalkeepersPerTeam Numero de goleiros por time
     * @return Par de listas (Time A IDs, Time B IDs)
     */
    fun balanceAndGetIds(
        users: List<User>,
        goalkeepersPerTeam: Int = 1
    ): Result<Pair<List<String>, List<String>>> {
        return invoke(users, goalkeepersPerTeam).map { balanced ->
            val teamAIds = balanced.teamA.map { it.id }
            val teamBIds = balanced.teamB.map { it.id }
            Pair(teamAIds, teamBIds)
        }
    }

    /**
     * Verifica se o balanceamento e possivel e retorna mensagem descritiva.
     *
     * @param playerCount Numero total de jogadores
     * @param teamSize Tamanho desejado de cada time
     * @return Resultado da validacao
     */
    fun validateTeamBalance(playerCount: Int, teamSize: Int): TeamBalanceValidation {
        if (playerCount < 2) {
            return TeamBalanceValidation.Invalid("Sao necessarios pelo menos 2 jogadores")
        }

        if (teamSize < 1) {
            return TeamBalanceValidation.Invalid("Tamanho do time deve ser maior que 0")
        }

        val minimumPlayers = teamSize * 2
        if (playerCount < minimumPlayers) {
            return TeamBalanceValidation.Invalid(
                "Sao necessarios pelo menos $minimumPlayers jogadores para times de $teamSize"
            )
        }

        val remainingPlayers = playerCount % (teamSize * 2)
        return if (remainingPlayers == 0) {
            TeamBalanceValidation.Perfect
        } else {
            TeamBalanceValidation.WithBench(remainingPlayers)
        }
    }
}

/**
 * Resultado da validacao de balanceamento de times.
 */
sealed class TeamBalanceValidation {
    object Perfect : TeamBalanceValidation()
    data class WithBench(val benchPlayers: Int) : TeamBalanceValidation()
    data class Invalid(val reason: String) : TeamBalanceValidation()

    fun isValid(): Boolean = this is Perfect || this is WithBench
    fun getMessage(): String = when (this) {
        is Perfect -> "Times balanceados perfeitamente"
        is WithBench -> "$benchPlayers jogador(es) ficara(ao) no banco"
        is Invalid -> reason
    }
}
