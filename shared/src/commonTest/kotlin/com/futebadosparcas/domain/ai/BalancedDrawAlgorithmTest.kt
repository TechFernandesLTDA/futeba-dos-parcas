package com.futebadosparcas.domain.ai

import com.futebadosparcas.domain.model.PlayerPosition
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class BalancedDrawAlgorithmTest {

    private fun createLinePlayer(
        id: String,
        name: String,
        attack: Float = 50f,
        midfield: Float = 50f,
        defense: Float = 50f
    ) = PlayerForBalancing(
        id = id,
        name = name,
        position = PlayerPosition.LINE,
        attackSkill = attack,
        midfieldSkill = midfield,
        defenseSkill = defense,
        goalkeeperSkill = 0f
    )

    private fun createGoalkeeper(
        id: String,
        name: String,
        gkSkill: Float = 70f
    ) = PlayerForBalancing(
        id = id,
        name = name,
        position = PlayerPosition.GOALKEEPER,
        attackSkill = 0f,
        midfieldSkill = 0f,
        defenseSkill = 0f,
        goalkeeperSkill = gkSkill
    )

    @Test
    fun listaVaziaRetornaTimesVazios() {
        val result = BalancedDrawAlgorithm.balance(emptyList(), 2)

        assertEquals(2, result.teams.size)
        assertTrue(result.teams.all { it.players.isEmpty() })
        assertEquals(0f, result.balanceScore)
    }

    @Test
    fun doisTimesComSnakeDraft() {
        val players = listOf(
            createLinePlayer("1", "A", 90f, 90f, 90f),
            createLinePlayer("2", "B", 80f, 80f, 80f),
            createLinePlayer("3", "C", 70f, 70f, 70f),
            createLinePlayer("4", "D", 60f, 60f, 60f)
        )

        val result = BalancedDrawAlgorithm.balance(players, 2, strategy = DrawStrategy.SNAKE_DRAFT)

        assertEquals(2, result.teams.size)
        assertEquals(4, result.teams.sumOf { it.players.size })
        assertTrue(result.balanceScore <= 10f)
    }

    @Test
    fun snakeDraftDistribuiOrdemCorreta() {
        val players = listOf(
            createLinePlayer("1", "P1", 90f, 90f, 90f),
            createLinePlayer("2", "P2", 80f, 80f, 80f),
            createLinePlayer("3", "P3", 70f, 70f, 70f),
            createLinePlayer("4", "P4", 60f, 60f, 60f)
        )

        val result = BalancedDrawAlgorithm.balance(players, 2, strategy = DrawStrategy.SNAKE_DRAFT)

        val teamA = result.teams[0]
        val teamB = result.teams[1]
        assertEquals(2, teamA.players.size)
        assertEquals(2, teamB.players.size)
        assertTrue(result.balanceScore <= 10f)
    }

    @Test
    fun greedyDistribuiParaTimeMaisFraco() {
        val players = listOf(
            createLinePlayer("1", "P1", 90f, 90f, 90f),
            createLinePlayer("2", "P2", 80f, 80f, 80f),
            createLinePlayer("3", "P3", 70f, 70f, 70f),
            createLinePlayer("4", "P4", 60f, 60f, 60f)
        )

        val result = BalancedDrawAlgorithm.balance(players, 2, strategy = DrawStrategy.GREEDY)

        assertEquals(2, result.teams.size)
        assertEquals(4, result.teams.sumOf { it.players.size })
        assertTrue(result.balanceScore <= 15f)
    }

    @Test
    fun goleirosSaoDistribuidos() {
        val players = listOf(
            createGoalkeeper("gk1", "GK1", 90f),
            createGoalkeeper("gk2", "GK2", 80f),
            createLinePlayer("1", "P1"),
            createLinePlayer("2", "P2"),
            createLinePlayer("3", "P3"),
            createLinePlayer("4", "P4")
        )

        val result = BalancedDrawAlgorithm.balance(players, 2, goalkeepersPerTeam = 1)

        val gkInTeam0 = result.teams[0].players.count { it.position == PlayerPosition.GOALKEEPER }
        val gkInTeam1 = result.teams[1].players.count { it.position == PlayerPosition.GOALKEEPER }
        assertEquals(1, gkInTeam0)
        assertEquals(1, gkInTeam1)
    }

    @Test
    fun tresTimesDistribuemJogadores() {
        val players = (1..9).map { i ->
            createLinePlayer("$i", "P$i", (50 + i * 3).toFloat(), (50 + i * 3).toFloat(), (50 + i * 3).toFloat())
        }

        val result = BalancedDrawAlgorithm.balance(players, 3)

        assertEquals(3, result.teams.size)
        assertEquals(9, result.teams.sumOf { it.players.size })
        result.teams.forEach { team ->
            assertEquals(3, team.players.size)
        }
    }

    @Test
    fun quatroTimesCom14Jogadores() {
        val players = mutableListOf<PlayerForBalancing>()
        players.add(createGoalkeeper("gk1", "GK1", 80f))
        players.add(createGoalkeeper("gk2", "GK2", 75f))
        players.add(createGoalkeeper("gk3", "GK3", 70f))
        players.add(createGoalkeeper("gk4", "GK4", 65f))
        for (i in 1..10) {
            val skill = 50f + i * 3f
            players.add(createLinePlayer("p$i", "P$i", skill, skill, skill))
        }

        val result = BalancedDrawAlgorithm.balance(players, 4, goalkeepersPerTeam = 1)

        assertEquals(4, result.teams.size)
        assertEquals(14, result.teams.sumOf { it.players.size })
        result.teams.forEach { team ->
            val gkCount = team.players.count { it.position == PlayerPosition.GOALKEEPER }
            assertTrue(gkCount >= 1)
        }
    }

    @Test
    fun balanceScoreEhCalculado() {
        val players = listOf(
            createLinePlayer("1", "P1", 90f, 90f, 90f),
            createLinePlayer("2", "P2", 80f, 80f, 80f),
            createLinePlayer("3", "P3", 70f, 70f, 70f),
            createLinePlayer("4", "P4", 60f, 60f, 60f)
        )

        val result = BalancedDrawAlgorithm.balance(players, 2)

        assertTrue(result.balanceScore >= 0f)
    }

    @Test
    fun todosJogadoresSaoDistribuidos() {
        val players = (1..11).map { i ->
            createLinePlayer("$i", "P$i", (50 + i * 2).toFloat(), (50 + i * 2).toFloat(), (50 + i * 2).toFloat())
        }

        val result = BalancedDrawAlgorithm.balance(players, 2)

        assertEquals(11, result.teams.sumOf { it.players.size })
    }

    @Test
    fun numeroImparDeJogadores() {
        val players = (1..7).map { i ->
            createLinePlayer("$i", "P$i")
        }

        val result = BalancedDrawAlgorithm.balance(players, 2)

        assertEquals(7, result.teams.sumOf { it.players.size })
        val sizes = result.teams.map { it.players.size }
        assertTrue(kotlin.math.abs(sizes[0] - sizes[1]) <= 1)
    }

    @Test
    fun resultadoContemStrategy() {
        val players = listOf(createLinePlayer("1", "P1"))

        val snake = BalancedDrawAlgorithm.balance(players, 2, strategy = DrawStrategy.SNAKE_DRAFT)
        val greedy = BalancedDrawAlgorithm.balance(players, 2, strategy = DrawStrategy.GREEDY)

        assertEquals(DrawStrategy.SNAKE_DRAFT, snake.strategy)
        assertEquals(DrawStrategy.GREEDY, greedy.strategy)
    }

    @Test
    fun averageRatingECalculadoCorretamente() {
        val players = listOf(
            createLinePlayer("1", "P1", 80f, 80f, 80f),
            createLinePlayer("2", "P2", 60f, 60f, 60f)
        )

        val result = BalancedDrawAlgorithm.balance(players, 2)

        result.teams.forEach { team ->
            if (team.players.isNotEmpty()) {
                val expectedAvg = team.players.map { it.overallRating }.average().toFloat()
                assertEquals(expectedAvg, team.averageRating, 0.01f)
            }
        }
    }

    @Test
    fun isBalancedRetornaTrueParaTimesEquilibrados() {
        val players = listOf(
            createLinePlayer("1", "P1", 70f, 70f, 70f),
            createLinePlayer("2", "P2", 70f, 70f, 70f),
            createLinePlayer("3", "P3", 70f, 70f, 70f),
            createLinePlayer("4", "P4", 70f, 70f, 70f)
        )

        val result = BalancedDrawAlgorithm.balance(players, 2)

        assertTrue(result.isBalanced)
    }

    @Test
    fun paridadeDeterministicaDe14JogadoresComDesempatePorId() {
        val players = listOf(
            createGoalkeeper("gk1", "GK1", 80f),
            createGoalkeeper("gk2", "GK2", 75f),
            createLinePlayer("p01", "P01", 90f, 90f, 90f),
            createLinePlayer("p02", "P02", 85f, 85f, 85f),
            createLinePlayer("p03", "P03", 80f, 80f, 80f),
            createLinePlayer("p04", "P04", 80f, 80f, 80f),
            createLinePlayer("p05", "P05", 75f, 75f, 75f),
            createLinePlayer("p06", "P06", 70f, 70f, 70f),
            createLinePlayer("p07", "P07", 70f, 70f, 70f),
            createLinePlayer("p08", "P08", 65f, 65f, 65f),
            createLinePlayer("p09", "P09", 60f, 60f, 60f),
            createLinePlayer("p10", "P10", 55f, 55f, 55f),
            createLinePlayer("p11", "P11", 50f, 50f, 50f),
            createLinePlayer("p12", "P12", 45f, 45f, 45f)
        )

        val result = BalancedDrawAlgorithm.balance(players, 2, goalkeepersPerTeam = 1, strategy = DrawStrategy.SNAKE_DRAFT)

        assertEquals(2, result.teams.size)
        assertTrue(result.isBalanced)

        val teamAPlayerIds = result.teams[0].players.map { it.id }
        val teamBPlayerIds = result.teams[1].players.map { it.id }

        assertEquals(listOf("gk1", "p01", "p04", "p05", "p08", "p09", "p12"), teamAPlayerIds)
        assertEquals(listOf("gk2", "p02", "p03", "p06", "p07", "p10", "p11"), teamBPlayerIds)
    }
}
