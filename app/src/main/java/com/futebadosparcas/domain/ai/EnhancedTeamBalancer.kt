package com.futebadosparcas.domain.ai

import com.futebadosparcas.domain.model.DraftPlayer
import com.futebadosparcas.domain.model.PlayerPair
import com.futebadosparcas.domain.model.TeamStrength
import com.futebadosparcas.domain.model.PlayerPosition
import kotlin.math.abs

/**
 * Resultado do balanceamento avancado de times.
 * Inclui informacoes adicionais sobre forca e distribuicao de posicoes.
 */
data class EnhancedBalancedTeams(
    val teamA: List<PlayerForBalancing>,
    val teamB: List<PlayerForBalancing>,
    val teamAStrength: TeamStrength,
    val teamBStrength: TeamStrength,
    val isBalanced: Boolean,
    val positionDistribution: Map<String, Pair<Int, Int>>, // Position -> (teamA count, teamB count)
    val pairsRespected: Boolean,
    val rotationSuggestions: List<SwapSuggestion> = emptyList()
)

/**
 * Sugestao de troca de jogadores entre times.
 */
data class SwapSuggestion(
    val player1Id: String,
    val player1Name: String,
    val player2Id: String,
    val player2Name: String,
    val ratingImprovementPercent: Float,
    val reason: String
)

/**
 * Balanceador de times avancado com suporte a:
 * - Balanceamento por posicao (garantir goleiro em cada time)
 * - Manter pares juntos (amigos, casais, etc)
 * - Sugestoes de rotacao
 * - Calculo de forca do time
 */
class EnhancedTeamBalancer {

    companion object {
        private const val BALANCE_THRESHOLD = 5f // Diferenca maxima de 5% para considerar balanceado
        private const val MAX_ITERATIONS = 100
    }

    /**
     * Balanceia jogadores em dois times equilibrados.
     *
     * @param players Lista de jogadores a serem divididos
     * @param pairs Pares de jogadores que devem ficar juntos
     * @param goalkeepersPerTeam Numero minimo de goleiros por time
     * @param considerPositions Se deve distribuir posicoes uniformemente
     * @return Times balanceados com informacoes detalhadas
     */
    fun balance(
        players: List<PlayerForBalancing>,
        pairs: List<PlayerPair> = emptyList(),
        goalkeepersPerTeam: Int = 1,
        considerPositions: Boolean = true
    ): EnhancedBalancedTeams {
        if (players.isEmpty()) {
            return createEmptyResult()
        }

        // Separar goleiros e jogadores de linha
        val goalkeepers = players.filter { it.position == PlayerPosition.GOALKEEPER }
            .sortedByDescending { it.goalkeeperSkill }
        val linePlayers = players.filter { it.position == PlayerPosition.LINE }
            .sortedByDescending { it.overallRating }

        val teamA = mutableListOf<PlayerForBalancing>()
        val teamB = mutableListOf<PlayerForBalancing>()

        // 1. Distribuir goleiros garantindo quantidade minima
        distributeGoalkeepers(goalkeepers, teamA, teamB, goalkeepersPerTeam)

        // 2. Processar pares primeiro
        val pairedPlayers = mutableSetOf<String>()
        distributePairs(linePlayers, pairs, teamA, teamB, pairedPlayers)

        // 3. Distribuir jogadores de linha restantes
        val remainingPlayers = linePlayers.filter { it.id !in pairedPlayers }
        distributeLinePlayers(remainingPlayers, teamA, teamB, considerPositions)

        // 4. Otimizar balance se necessario
        optimizeBalance(teamA, teamB, pairs)

        // 5. Calcular forcas dos times
        val teamAStrength = calculateTeamStrength("A", "Time A", teamA)
        val teamBStrength = calculateTeamStrength("B", "Time B", teamB)

        // 6. Gerar sugestoes de rotacao
        val suggestions = generateSwapSuggestions(teamA, teamB, pairs)

        val positionDist = calculatePositionDistribution(teamA, teamB)
        val isBalanced = teamAStrength.getDifferencePercent(teamBStrength) < BALANCE_THRESHOLD
        val pairsRespected = checkPairsRespected(teamA, teamB, pairs)

        return EnhancedBalancedTeams(
            teamA = teamA.toList(),
            teamB = teamB.toList(),
            teamAStrength = teamAStrength,
            teamBStrength = teamBStrength,
            isBalanced = isBalanced,
            positionDistribution = positionDist,
            pairsRespected = pairsRespected,
            rotationSuggestions = suggestions
        )
    }

    /**
     * Distribui goleiros entre os times.
     */
    private fun distributeGoalkeepers(
        goalkeepers: List<PlayerForBalancing>,
        teamA: MutableList<PlayerForBalancing>,
        teamB: MutableList<PlayerForBalancing>,
        minPerTeam: Int
    ) {
        goalkeepers.forEachIndexed { index, gk ->
            if (index % 2 == 0 && teamA.count { it.position == PlayerPosition.GOALKEEPER } < minPerTeam) {
                teamA.add(gk)
            } else if (teamB.count { it.position == PlayerPosition.GOALKEEPER } < minPerTeam) {
                teamB.add(gk)
            } else {
                // Time com menos jogadores recebe o goleiro extra
                if (teamA.size <= teamB.size) teamA.add(gk) else teamB.add(gk)
            }
        }
    }

    /**
     * Distribui pares de jogadores mantendo-os juntos.
     */
    private fun distributePairs(
        players: List<PlayerForBalancing>,
        pairs: List<PlayerPair>,
        teamA: MutableList<PlayerForBalancing>,
        teamB: MutableList<PlayerForBalancing>,
        pairedPlayers: MutableSet<String>
    ) {
        for (pair in pairs) {
            val player1 = players.find { it.id == pair.player1Id }
            val player2 = players.find { it.id == pair.player2Id }

            if (player1 != null && player2 != null) {
                // Ambos jogadores do par estao disponiveis
                // Adicionar ao time com menos jogadores
                val pairRating = (player1.overallRating + player2.overallRating) / 2f

                val teamARating = if (teamA.isEmpty()) 0f else teamA.map { it.overallRating }.average().toFloat()
                val teamBRating = if (teamB.isEmpty()) 0f else teamB.map { it.overallRating }.average().toFloat()

                // Adicionar ao time mais fraco para balancear
                if (teamARating <= teamBRating && teamA.size <= teamB.size) {
                    teamA.add(player1)
                    teamA.add(player2)
                } else {
                    teamB.add(player1)
                    teamB.add(player2)
                }

                pairedPlayers.add(player1.id)
                pairedPlayers.add(player2.id)
            }
        }
    }

    /**
     * Distribui jogadores de linha usando snake draft para balanceamento.
     */
    private fun distributeLinePlayers(
        players: List<PlayerForBalancing>,
        teamA: MutableList<PlayerForBalancing>,
        teamB: MutableList<PlayerForBalancing>,
        considerPositions: Boolean
    ) {
        // Ordenar por rating para snake draft
        val sorted = players.sortedByDescending { it.overallRating }

        sorted.forEachIndexed { index, player ->
            // Snake draft: 0,1,1,0,0,1,1,0...
            val roundNumber = index / 2
            val pickInRound = index % 2
            val goesToTeamA = if (roundNumber % 2 == 0) pickInRound == 0 else pickInRound == 1

            // Verificar balanco de tamanho
            val sizeDiff = teamA.size - teamB.size
            val forceTeamA = sizeDiff < 0
            val forceTeamB = sizeDiff > 0

            when {
                forceTeamA -> teamA.add(player)
                forceTeamB -> teamB.add(player)
                goesToTeamA -> teamA.add(player)
                else -> teamB.add(player)
            }
        }
    }

    /**
     * Otimiza o balanceamento atraves de trocas.
     */
    private fun optimizeBalance(
        teamA: MutableList<PlayerForBalancing>,
        teamB: MutableList<PlayerForBalancing>,
        pairs: List<PlayerPair>
    ) {
        val pairedPlayerIds = pairs.flatMap { listOf(it.player1Id, it.player2Id) }.toSet()

        repeat(MAX_ITERATIONS) {
            val ratingA = calculateAverageRating(teamA)
            val ratingB = calculateAverageRating(teamB)
            val diff = abs(ratingA - ratingB)

            if (diff < 0.1f) return // Ja esta balanceado

            // Tentar trocar jogadores para melhorar balance
            val swappable = if (ratingA > ratingB) {
                findSwappablePair(teamA, teamB, pairedPlayerIds, ratingA - ratingB)
            } else {
                findSwappablePair(teamB, teamA, pairedPlayerIds, ratingB - ratingA)
            }

            if (swappable != null) {
                val (fromHigher, fromLower) = swappable
                val higherTeam = if (ratingA > ratingB) teamA else teamB
                val lowerTeam = if (ratingA > ratingB) teamB else teamA

                higherTeam.remove(fromHigher)
                lowerTeam.remove(fromLower)
                higherTeam.add(fromLower)
                lowerTeam.add(fromHigher)
            } else {
                return // Nao ha mais trocas possiveis
            }
        }
    }

    /**
     * Encontra um par de jogadores para trocar.
     */
    private fun findSwappablePair(
        higherTeam: List<PlayerForBalancing>,
        lowerTeam: List<PlayerForBalancing>,
        pairedPlayerIds: Set<String>,
        targetDiff: Float
    ): Pair<PlayerForBalancing, PlayerForBalancing>? {
        // Procurar jogadores que nao estao em pares
        val swappableFromHigher = higherTeam.filter { it.id !in pairedPlayerIds }
        val swappableFromLower = lowerTeam.filter { it.id !in pairedPlayerIds }

        // Encontrar troca que melhore o balance
        var bestSwap: Pair<PlayerForBalancing, PlayerForBalancing>? = null
        var bestImprovement = 0f

        for (higher in swappableFromHigher) {
            for (lower in swappableFromLower) {
                // Mesma posicao preferido
                if (higher.position != lower.position) continue

                val ratingDiff = higher.overallRating - lower.overallRating
                if (ratingDiff > 0 && ratingDiff < targetDiff) {
                    val improvement = targetDiff - abs(targetDiff - 2 * ratingDiff)
                    if (improvement > bestImprovement) {
                        bestImprovement = improvement
                        bestSwap = higher to lower
                    }
                }
            }
        }

        return bestSwap
    }

    /**
     * Calcula a forca de um time.
     */
    fun calculateTeamStrength(
        teamId: String,
        teamName: String,
        players: List<PlayerForBalancing>
    ): TeamStrength {
        if (players.isEmpty()) {
            return TeamStrength(
                teamId = teamId,
                teamName = teamName,
                overallRating = 0f,
                attackRating = 0f,
                defenseRating = 0f,
                midfieldRating = 0f,
                goalkeeperRating = 0f,
                playerCount = 0,
                hasGoalkeeper = false
            )
        }

        val linePlayers = players.filter { it.position == PlayerPosition.LINE }
        val goalkeepers = players.filter { it.position == PlayerPosition.GOALKEEPER }

        val attackAvg = if (linePlayers.isNotEmpty()) {
            linePlayers.map { it.attackSkill }.average().toFloat()
        } else 0f

        val defenseAvg = if (linePlayers.isNotEmpty()) {
            linePlayers.map { it.defenseSkill }.average().toFloat()
        } else 0f

        val midfieldAvg = if (linePlayers.isNotEmpty()) {
            linePlayers.map { it.midfieldSkill }.average().toFloat()
        } else 0f

        val gkAvg = if (goalkeepers.isNotEmpty()) {
            goalkeepers.map { it.goalkeeperSkill }.average().toFloat()
        } else 0f

        val overall = players.map { it.overallRating }.average().toFloat()

        return TeamStrength(
            teamId = teamId,
            teamName = teamName,
            overallRating = overall,
            attackRating = attackAvg,
            defenseRating = defenseAvg,
            midfieldRating = midfieldAvg,
            goalkeeperRating = gkAvg,
            playerCount = players.size,
            hasGoalkeeper = goalkeepers.isNotEmpty()
        )
    }

    /**
     * Gera sugestoes de trocas para melhorar rotacao.
     */
    private fun generateSwapSuggestions(
        teamA: List<PlayerForBalancing>,
        teamB: List<PlayerForBalancing>,
        pairs: List<PlayerPair>
    ): List<SwapSuggestion> {
        val pairedPlayerIds = pairs.flatMap { listOf(it.player1Id, it.player2Id) }.toSet()
        val suggestions = mutableListOf<SwapSuggestion>()

        // Encontrar jogadores com ratings similares para sugerir rotacao
        val swappableA = teamA.filter { it.id !in pairedPlayerIds && it.position == PlayerPosition.LINE }
        val swappableB = teamB.filter { it.id !in pairedPlayerIds && it.position == PlayerPosition.LINE }

        for (playerA in swappableA) {
            for (playerB in swappableB) {
                val ratingDiff = abs(playerA.overallRating - playerB.overallRating)
                if (ratingDiff < 0.5f) {
                    suggestions.add(
                        SwapSuggestion(
                            player1Id = playerA.id,
                            player1Name = playerA.name,
                            player2Id = playerB.id,
                            player2Name = playerB.name,
                            ratingImprovementPercent = 0f,
                            reason = "Jogadores com habilidades similares - trocar para variar times"
                        )
                    )
                }
            }
        }

        return suggestions.take(3) // Retornar no maximo 3 sugestoes
    }

    /**
     * Calcula a distribuicao de posicoes entre os times.
     */
    private fun calculatePositionDistribution(
        teamA: List<PlayerForBalancing>,
        teamB: List<PlayerForBalancing>
    ): Map<String, Pair<Int, Int>> {
        val distribution = mutableMapOf<String, Pair<Int, Int>>()

        PlayerPosition.entries.forEach { position ->
            val countA = teamA.count { it.position == position }
            val countB = teamB.count { it.position == position }
            distribution[position.name] = countA to countB
        }

        return distribution
    }

    /**
     * Verifica se todos os pares foram respeitados.
     */
    private fun checkPairsRespected(
        teamA: List<PlayerForBalancing>,
        teamB: List<PlayerForBalancing>,
        pairs: List<PlayerPair>
    ): Boolean {
        val teamAIds = teamA.map { it.id }.toSet()
        val teamBIds = teamB.map { it.id }.toSet()

        for (pair in pairs) {
            val player1InA = pair.player1Id in teamAIds
            val player2InA = pair.player2Id in teamAIds
            val player1InB = pair.player1Id in teamBIds
            val player2InB = pair.player2Id in teamBIds

            // Ambos devem estar no mesmo time
            val bothInA = player1InA && player2InA
            val bothInB = player1InB && player2InB

            if (!bothInA && !bothInB) {
                return false
            }
        }

        return true
    }

    private fun calculateAverageRating(players: List<PlayerForBalancing>): Float {
        if (players.isEmpty()) return 0f
        return players.map { it.overallRating }.average().toFloat()
    }

    private fun createEmptyResult(): EnhancedBalancedTeams {
        val emptyStrength = TeamStrength(
            teamId = "",
            teamName = "",
            overallRating = 0f,
            attackRating = 0f,
            defenseRating = 0f,
            midfieldRating = 0f,
            goalkeeperRating = 0f,
            playerCount = 0,
            hasGoalkeeper = false
        )

        return EnhancedBalancedTeams(
            teamA = emptyList(),
            teamB = emptyList(),
            teamAStrength = emptyStrength,
            teamBStrength = emptyStrength,
            isBalanced = true,
            positionDistribution = emptyMap(),
            pairsRespected = true,
            rotationSuggestions = emptyList()
        )
    }
}

/**
 * Extensao para converter DraftPlayer para PlayerForBalancing.
 */
fun DraftPlayer.toPlayerForBalancing(): PlayerForBalancing {
    // DraftPlayer (domain.model) ja usa o enum correto PlayerPosition (domain.model)
    // Nao precisa conversao - apenas mapear os campos
    return PlayerForBalancing(
        id = id,
        name = name,
        position = position, // Ja é domain.model.PlayerPosition
        attackSkill = strikerRating,
        midfieldSkill = midRating,
        defenseSkill = defenderRating,
        goalkeeperSkill = gkRating,
        overallRating = overallRating
    )
}
