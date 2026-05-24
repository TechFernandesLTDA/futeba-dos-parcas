package com.futebadosparcas.domain.ai

import com.futebadosparcas.domain.model.PlayerPosition
import kotlin.math.abs
import kotlin.math.sqrt

enum class DrawStrategy {
    SNAKE_DRAFT,
    GREEDY
}

data class BalancedDrawTeam(
    val index: Int,
    val name: String,
    val players: List<PlayerForBalancing>,
    val averageRating: Float,
    val totalRating: Float
)

data class BalancedDrawResult(
    val teams: List<BalancedDrawTeam>,
    val balanceScore: Float,
    val strategy: DrawStrategy
) {
    val isBalanced: Boolean
        get() = balanceScore < 5f
}

object BalancedDrawAlgorithm {

    private const val MAX_OPTIMIZE_ITERATIONS = 100

    fun balance(
        players: List<PlayerForBalancing>,
        numberOfTeams: Int = 2,
        goalkeepersPerTeam: Int = 1,
        strategy: DrawStrategy = DrawStrategy.SNAKE_DRAFT
    ): BalancedDrawResult {
        require(numberOfTeams >= 2) { "Numero minimo de times e 2" }

        if (players.isEmpty()) {
            val emptyTeams = (0 until numberOfTeams).map { i ->
                BalancedDrawTeam(i, "Time ${'A' + i}", emptyList(), 0f, 0f)
            }
            return BalancedDrawResult(emptyTeams, 0f, strategy)
        }

        val goalkeepers = players.filter { it.position == PlayerPosition.GOALKEEPER }
            .sortedByDescending { it.goalkeeperSkill }
        val linePlayers = players.filter { it.position == PlayerPosition.LINE }
            .sortedByDescending { it.overallRating }

        val teamSlots = Array(numberOfTeams) { mutableListOf<PlayerForBalancing>() }

        distributeGoalkeepers(goalkeepers, teamSlots, goalkeepersPerTeam)

        when (strategy) {
            DrawStrategy.SNAKE_DRAFT -> distributeSnakeDraft(linePlayers, teamSlots)
            DrawStrategy.GREEDY -> distributeGreedy(linePlayers, teamSlots)
        }

        optimizeBalance(teamSlots)

        val teams = teamSlots.mapIndexed { index, teamPlayers ->
            val total = teamPlayers.sumOf { it.overallRating.toDouble() }.toFloat()
            val avg = if (teamPlayers.isNotEmpty()) total / teamPlayers.size else 0f
            BalancedDrawTeam(
                index = index,
                name = "Time ${'A' + index}",
                players = teamPlayers.toList(),
                averageRating = avg,
                totalRating = total
            )
        }

        val balanceScore = calculateBalanceScore(teams)

        return BalancedDrawResult(teams, balanceScore, strategy)
    }

    private fun distributeGoalkeepers(
        goalkeepers: List<PlayerForBalancing>,
        teamSlots: Array<MutableList<PlayerForBalancing>>,
        minPerTeam: Int
    ) {
        val numTeams = teamSlots.size
        var teamIndex = 0

        for (gk in goalkeepers) {
            val gkCountInTeam = teamSlots[teamIndex].count { it.position == PlayerPosition.GOALKEEPER }

            if (gkCountInTeam < minPerTeam) {
                teamSlots[teamIndex].add(gk)
            } else {
                var placed = false
                for (i in 0 until numTeams) {
                    val candidateIdx = (teamIndex + 1 + i) % numTeams
                    val gkCount = teamSlots[candidateIdx].count { it.position == PlayerPosition.GOALKEEPER }
                    if (gkCount < minPerTeam) {
                        teamSlots[candidateIdx].add(gk)
                        teamIndex = candidateIdx
                        placed = true
                        break
                    }
                }
                if (!placed) {
                    val smallestTeam = teamSlots.indices.minByOrNull { teamSlots[it].size } ?: 0
                    teamSlots[smallestTeam].add(gk)
                }
            }
            teamIndex = (teamIndex + 1) % numTeams
        }
    }

    private fun distributeSnakeDraft(
        players: List<PlayerForBalancing>,
        teamSlots: Array<MutableList<PlayerForBalancing>>
    ) {
        val numTeams = teamSlots.size

        players.forEachIndexed { index, player ->
            val round = index / numTeams
            val pickInRound = index % numTeams

            val targetTeam = if (round % 2 == 0) {
                pickInRound
            } else {
                numTeams - 1 - pickInRound
            }

            teamSlots[targetTeam].add(player)
        }
    }

    private fun distributeGreedy(
        players: List<PlayerForBalancing>,
        teamSlots: Array<MutableList<PlayerForBalancing>>
    ) {
        for (player in players) {
            val targetTeam = teamSlots.indices.minByOrNull { i ->
                val team = teamSlots[i]
                if (team.isEmpty()) 0f else team.sumOf { it.overallRating.toDouble() }.toFloat()
            } ?: 0

            teamSlots[targetTeam].add(player)
        }
    }

    private fun optimizeBalance(teamSlots: Array<MutableList<PlayerForBalancing>>) {
        val numTeams = teamSlots.size
        if (numTeams < 2) return

        repeat(MAX_OPTIMIZE_ITERATIONS) {
            val ratings = teamSlots.map { slot ->
                if (slot.isEmpty()) 0f else slot.sumOf { p -> p.overallRating.toDouble() }.toFloat() / slot.size
            }

            val maxIdx = ratings.indices.maxByOrNull { ratings[it] } ?: return@repeat
            val minIdx = ratings.indices.minByOrNull { ratings[it] } ?: return@repeat

            if (maxIdx == minIdx) return@repeat

            val diff = ratings[maxIdx] - ratings[minIdx]
            if (diff < 0.1f) return@repeat

            val bestSwap = findBestSwap(teamSlots[maxIdx], teamSlots[minIdx], diff)

            if (bestSwap != null) {
                val (fromMax, fromMin) = bestSwap
                teamSlots[maxIdx].remove(fromMax)
                teamSlots[minIdx].remove(fromMin)
                teamSlots[maxIdx].add(fromMin)
                teamSlots[minIdx].add(fromMax)
            } else {
                return@repeat
            }
        }
    }

    private fun findBestSwap(
        higherTeam: MutableList<PlayerForBalancing>,
        lowerTeam: MutableList<PlayerForBalancing>,
        targetDiff: Float
    ): Pair<PlayerForBalancing, PlayerForBalancing>? {
        var bestSwap: Pair<PlayerForBalancing, PlayerForBalancing>? = null
        var bestImprovement = 0f

        for (higher in higherTeam) {
            if (higher.position == PlayerPosition.GOALKEEPER) continue
            for (lower in lowerTeam) {
                if (lower.position == PlayerPosition.GOALKEEPER) continue
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

    fun calculateBalanceScore(teams: List<BalancedDrawTeam>): Float {
        if (teams.size < 2) return 0f

        val ratings = teams.map { it.averageRating }
        val mean = ratings.average()

        if (mean == 0.0) return 0f

        val variance = ratings.sumOf { (it - mean) * (it - mean) } / ratings.size
        val stdDev = sqrt(variance)

        return (stdDev / mean * 100).toFloat()
    }
}
