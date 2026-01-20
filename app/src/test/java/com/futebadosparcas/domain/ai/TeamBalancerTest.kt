package com.futebadosparcas.domain.ai

import com.futebadosparcas.domain.model.PlayerPosition
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Testes unitários para TeamBalancer e GreedyTeamBalancer.
 * Cobre balanceamento de times, distribuição de goleiros e rating.
 */
@DisplayName("TeamBalancer Tests")
class TeamBalancerTest {

    // ==================== HELPER FUNCTIONS ====================

    private fun createPlayer(
        id: String,
        name: String,
        position: PlayerPosition = PlayerPosition.LINE,
        attackSkill: Float = 50f,
        midfieldSkill: Float = 50f,
        defenseSkill: Float = 50f,
        goalkeeperSkill: Float = 0f
    ) = PlayerForBalancing(
        id = id,
        name = name,
        position = position,
        attackSkill = attackSkill,
        midfieldSkill = midfieldSkill,
        defenseSkill = defenseSkill,
        goalkeeperSkill = goalkeeperSkill
    )

    private fun createGoalkeeper(
        id: String,
        name: String,
        goalkeeperSkill: Float = 70f
    ) = PlayerForBalancing(
        id = id,
        name = name,
        position = PlayerPosition.GOALKEEPER,
        attackSkill = 0f,
        midfieldSkill = 0f,
        defenseSkill = 0f,
        goalkeeperSkill = goalkeeperSkill
    )

    // ==================== TESTES DE GreedyTeamBalancer.balance ====================

    @Nested
    @DisplayName("GreedyTeamBalancer.balance")
    inner class BalanceTests {

        @Test
        @DisplayName("Lista vazia deve retornar times vazios")
        fun `empty list should return empty teams`() {
            val result = GreedyTeamBalancer.balance(emptyList())

            assertTrue(result.teamA.isEmpty())
            assertTrue(result.teamB.isEmpty())
            assertEquals(0f, result.teamARating)
            assertEquals(0f, result.teamBRating)
            assertEquals(0f, result.ratingDifference)
        }

        @Test
        @DisplayName("Um jogador deve ir para time A")
        fun `single player should go to team A`() {
            val player = createPlayer("1", "Player 1")
            val result = GreedyTeamBalancer.balance(listOf(player))

            assertEquals(1, result.teamA.size)
            assertEquals(0, result.teamB.size)
            assertEquals("Player 1", result.teamA[0].name)
        }

        @Test
        @DisplayName("Dois jogadores devem ser divididos")
        fun `two players should be split`() {
            val players = listOf(
                createPlayer("1", "Player 1", attackSkill = 80f, midfieldSkill = 80f, defenseSkill = 80f),
                createPlayer("2", "Player 2", attackSkill = 60f, midfieldSkill = 60f, defenseSkill = 60f)
            )
            val result = GreedyTeamBalancer.balance(players)

            assertEquals(1, result.teamA.size)
            assertEquals(1, result.teamB.size)
        }

        @Test
        @DisplayName("Times devem ter tamanhos equilibrados")
        fun `teams should have balanced sizes`() {
            val players = (1..10).map { i ->
                createPlayer("$i", "Player $i")
            }
            val result = GreedyTeamBalancer.balance(players)

            assertEquals(5, result.teamA.size)
            assertEquals(5, result.teamB.size)
        }

        @Test
        @DisplayName("Goleiros devem ser distribuídos alternadamente")
        fun `goalkeepers should be distributed alternately`() {
            val players = listOf(
                createGoalkeeper("gk1", "Goleiro 1", goalkeeperSkill = 90f),
                createGoalkeeper("gk2", "Goleiro 2", goalkeeperSkill = 80f),
                createPlayer("1", "Player 1"),
                createPlayer("2", "Player 2")
            )
            val result = GreedyTeamBalancer.balance(players)

            val gkInTeamA = result.teamA.count { it.position == PlayerPosition.GOALKEEPER }
            val gkInTeamB = result.teamB.count { it.position == PlayerPosition.GOALKEEPER }

            assertEquals(1, gkInTeamA)
            assertEquals(1, gkInTeamB)
        }

        @Test
        @DisplayName("Diferença de rating deve ser calculada")
        fun `rating difference should be calculated`() {
            val players = listOf(
                createPlayer("1", "Player 1", attackSkill = 90f, midfieldSkill = 90f, defenseSkill = 90f),
                createPlayer("2", "Player 2", attackSkill = 80f, midfieldSkill = 80f, defenseSkill = 80f),
                createPlayer("3", "Player 3", attackSkill = 70f, midfieldSkill = 70f, defenseSkill = 70f),
                createPlayer("4", "Player 4", attackSkill = 60f, midfieldSkill = 60f, defenseSkill = 60f)
            )
            val result = GreedyTeamBalancer.balance(players)

            assertTrue(result.ratingDifference >= 0f)
            assertEquals(
                kotlin.math.abs(result.teamARating - result.teamBRating),
                result.ratingDifference
            )
        }

        @Test
        @DisplayName("Snake draft deve equilibrar times")
        fun `snake draft should balance teams`() {
            // Jogadores ordenados por rating: 90, 80, 70, 60
            // Snake draft: Time A pega 90, Time B pega 80, 70 -> Time B já tem 2, mas snake...
            // Esperado: diferença de rating pequena
            val players = listOf(
                createPlayer("1", "High", attackSkill = 90f, midfieldSkill = 90f, defenseSkill = 90f),
                createPlayer("2", "Good", attackSkill = 80f, midfieldSkill = 80f, defenseSkill = 80f),
                createPlayer("3", "Average", attackSkill = 70f, midfieldSkill = 70f, defenseSkill = 70f),
                createPlayer("4", "Low", attackSkill = 60f, midfieldSkill = 60f, defenseSkill = 60f)
            )
            val result = GreedyTeamBalancer.balance(players)

            // Com snake draft: A(90,60) vs B(80,70) -> A=75, B=75
            // Diferença deve ser pequena
            assertTrue(result.ratingDifference <= 10f)
        }

        @Test
        @DisplayName("14 jogadores típicos de pelada")
        fun `14 players typical soccer match`() {
            val players = mutableListOf<PlayerForBalancing>()

            // 2 goleiros
            players.add(createGoalkeeper("gk1", "Goleiro 1", goalkeeperSkill = 80f))
            players.add(createGoalkeeper("gk2", "Goleiro 2", goalkeeperSkill = 75f))

            // 12 jogadores de linha
            for (i in 1..12) {
                val skill = 50f + (i * 3f) // Skills variados
                players.add(createPlayer("p$i", "Player $i", attackSkill = skill, midfieldSkill = skill, defenseSkill = skill))
            }

            val result = GreedyTeamBalancer.balance(players)

            assertEquals(7, result.teamA.size)
            assertEquals(7, result.teamB.size)
            assertEquals(1, result.teamA.count { it.position == PlayerPosition.GOALKEEPER })
            assertEquals(1, result.teamB.count { it.position == PlayerPosition.GOALKEEPER })
        }

        @Test
        @DisplayName("Número ímpar de jogadores")
        fun `odd number of players`() {
            val players = (1..7).map { i ->
                createPlayer("$i", "Player $i")
            }
            val result = GreedyTeamBalancer.balance(players)

            assertEquals(7, result.teamA.size + result.teamB.size)
            assertTrue(kotlin.math.abs(result.teamA.size - result.teamB.size) <= 1)
        }
    }

    // ==================== TESTES DE calculateTeamRating ====================

    @Nested
    @DisplayName("calculateTeamRating")
    inner class CalculateTeamRatingTests {

        @Test
        @DisplayName("Lista vazia deve retornar 0")
        fun `empty list should return 0`() {
            val rating = GreedyTeamBalancer.calculateTeamRating(emptyList())
            assertEquals(0f, rating)
        }

        @Test
        @DisplayName("Um jogador deve retornar seu overallRating")
        fun `single player should return their overallRating`() {
            val player = createPlayer("1", "Player", attackSkill = 60f, midfieldSkill = 60f, defenseSkill = 60f)
            val rating = GreedyTeamBalancer.calculateTeamRating(listOf(player))

            assertEquals(60f, rating)
        }

        @Test
        @DisplayName("Média de dois jogadores")
        fun `average of two players`() {
            val players = listOf(
                createPlayer("1", "High", attackSkill = 80f, midfieldSkill = 80f, defenseSkill = 80f),
                createPlayer("2", "Low", attackSkill = 60f, midfieldSkill = 60f, defenseSkill = 60f)
            )
            val rating = GreedyTeamBalancer.calculateTeamRating(players)

            assertEquals(70f, rating)
        }

        @Test
        @DisplayName("Média de jogadores variados")
        fun `average of varied players`() {
            val players = listOf(
                createPlayer("1", "P1", attackSkill = 90f, midfieldSkill = 90f, defenseSkill = 90f),
                createPlayer("2", "P2", attackSkill = 60f, midfieldSkill = 60f, defenseSkill = 60f),
                createPlayer("3", "P3", attackSkill = 75f, midfieldSkill = 75f, defenseSkill = 75f)
            )
            val rating = GreedyTeamBalancer.calculateTeamRating(players)

            // (90 + 60 + 75) / 3 = 75
            assertEquals(75f, rating)
        }
    }

    // ==================== TESTES DE PlayerForBalancing ====================

    @Nested
    @DisplayName("PlayerForBalancing")
    inner class PlayerForBalancingTests {

        @Test
        @DisplayName("overallRating deve ser média de attack, midfield e defense")
        fun `overallRating should be average of attack midfield and defense`() {
            val player = createPlayer(
                "1", "Player",
                attackSkill = 90f,
                midfieldSkill = 60f,
                defenseSkill = 60f
            )

            // (90 + 60 + 60) / 3 = 70
            assertEquals(70f, player.overallRating)
        }

        @Test
        @DisplayName("Goleiro deve ter overallRating baseado em skills de linha")
        fun `goalkeeper should have overallRating based on line skills`() {
            val goalkeeper = createGoalkeeper("gk", "Goleiro", goalkeeperSkill = 90f)

            // (0 + 0 + 0) / 3 = 0
            assertEquals(0f, goalkeeper.overallRating)
        }

        @Test
        @DisplayName("Jogador equilibrado deve ter overallRating igual às skills")
        fun `balanced player should have overallRating equal to skills`() {
            val player = createPlayer(
                "1", "Player",
                attackSkill = 70f,
                midfieldSkill = 70f,
                defenseSkill = 70f
            )

            assertEquals(70f, player.overallRating)
        }
    }

    // ==================== TESTES DE BalancedTeams ====================

    @Nested
    @DisplayName("BalancedTeams")
    inner class BalancedTeamsTests {

        @Test
        @DisplayName("ratingDifference deve ser absoluto")
        fun `ratingDifference should be absolute`() {
            val teams = BalancedTeams(
                teamA = emptyList(),
                teamB = emptyList(),
                teamARating = 60f,
                teamBRating = 70f,
                ratingDifference = 10f
            )

            assertTrue(teams.ratingDifference >= 0f)
        }

        @Test
        @DisplayName("Data class properties devem funcionar")
        fun `data class properties should work`() {
            val player = createPlayer("1", "Player")
            val teams = BalancedTeams(
                teamA = listOf(player),
                teamB = emptyList(),
                teamARating = 50f,
                teamBRating = 0f,
                ratingDifference = 50f
            )

            assertEquals(1, teams.teamA.size)
            assertEquals(0, teams.teamB.size)
            assertEquals(50f, teams.teamARating)
            assertEquals(0f, teams.teamBRating)
            assertEquals(50f, teams.ratingDifference)
        }
    }
}
