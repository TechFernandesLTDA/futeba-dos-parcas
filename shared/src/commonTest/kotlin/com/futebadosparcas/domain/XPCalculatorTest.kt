package com.futebadosparcas.domain

import com.futebadosparcas.domain.model.PlayerPosition
import com.futebadosparcas.domain.ranking.PlayerGameData
import com.futebadosparcas.domain.ranking.XPCalculator
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Testes compartilhados para XPCalculator.
 * Executam em Android (JVM) e iOS (Native), validando logica
 * de gamificacao identica em ambas as plataformas.
 */
class XPCalculatorTest {

    private fun createDefaultPlayerData(
        goals: Int = 0,
        assists: Int = 0,
        saves: Int = 0,
        teamWon: Boolean = false,
        teamDrew: Boolean = false,
        isMvp: Boolean = false,
        isWorstPlayer: Boolean = false,
        currentStreak: Int = 0,
        position: PlayerPosition = PlayerPosition.LINE
    ) = PlayerGameData(
        playerId = "test-player",
        position = position,
        goals = goals,
        assists = assists,
        saves = saves,
        yellowCards = 0,
        redCards = 0,
        isMvp = isMvp,
        isWorstPlayer = isWorstPlayer,
        hasBestGoal = false,
        teamId = "team-1",
        teamWon = teamWon,
        teamDrew = teamDrew,
        currentStreak = currentStreak
    )

    @Test
    fun participacaoBase_retorna10Xp() {
        val data = createDefaultPlayerData()
        val result = XPCalculator.calculate(data)
        // Participacao base = 10 XP
        assertEquals(10L, result.breakdown.participation)
    }

    @Test
    fun golsContribuemXp() {
        val data = createDefaultPlayerData(goals = 2)
        val result = XPCalculator.calculate(data)
        // 2 gols * 10 XP = 20 XP
        assertEquals(20L, result.breakdown.goals)
    }

    @Test
    fun assistenciasContribuemXp() {
        val data = createDefaultPlayerData(assists = 3)
        val result = XPCalculator.calculate(data)
        // 3 assistencias * 7 XP = 21 XP
        assertEquals(21L, result.breakdown.assists)
    }

    @Test
    fun defesasContribuemXp() {
        val data = createDefaultPlayerData(saves = 5, position = PlayerPosition.GOALKEEPER)
        val result = XPCalculator.calculate(data)
        // 5 defesas * 8 XP = 40 XP
        assertEquals(40L, result.breakdown.saves)
    }

    @Test
    fun vitoriaGera20Xp() {
        val data = createDefaultPlayerData(teamWon = true)
        val result = XPCalculator.calculate(data)
        assertEquals(20L, result.breakdown.result)
    }

    @Test
    fun empateGera10Xp() {
        val data = createDefaultPlayerData(teamDrew = true)
        val result = XPCalculator.calculate(data)
        assertEquals(10L, result.breakdown.result)
    }

    @Test
    fun derrotaGera0Xp() {
        val data = createDefaultPlayerData()
        val result = XPCalculator.calculate(data)
        assertEquals(0L, result.breakdown.result)
    }

    @Test
    fun mvpGera30XpBonus() {
        val data = createDefaultPlayerData(isMvp = true)
        val result = XPCalculator.calculate(data)
        assertEquals(30L, result.breakdown.mvp)
    }

    @Test
    fun bolaMurchaRetiraMenos10Xp() {
        val data = createDefaultPlayerData(isWorstPlayer = true)
        val result = XPCalculator.calculate(data)
        assertEquals(-10L, result.breakdown.penalty)
    }

    @Test
    fun streakDe3_gera20XpBonus() {
        val data = createDefaultPlayerData(currentStreak = 3)
        val result = XPCalculator.calculate(data)
        assertEquals(20L, result.breakdown.streak)
    }

    @Test
    fun streakDe5_gera35XpBonus() {
        val data = createDefaultPlayerData(currentStreak = 5)
        val result = XPCalculator.calculate(data)
        assertEquals(35L, result.breakdown.streak)
    }

    @Test
    fun streakDe7_gera50XpBonus() {
        val data = createDefaultPlayerData(currentStreak = 7)
        val result = XPCalculator.calculate(data)
        assertEquals(50L, result.breakdown.streak)
    }

    @Test
    fun streakDe10_gera100XpBonus() {
        val data = createDefaultPlayerData(currentStreak = 10)
        val result = XPCalculator.calculate(data)
        assertEquals(100L, result.breakdown.streak)
    }

    @Test
    fun totalXpNuncaFicaNegativo() {
        val data = createDefaultPlayerData(isWorstPlayer = true)
        val result = XPCalculator.calculate(data)
        // Participacao(10) + Penalty(-10) = 0, nao negativo
        assertTrue(result.totalXp >= 0)
    }

    @Test
    fun golsAcimaDoTeto_saoLimitados() {
        // Teto = 15 gols por jogo
        val data = createDefaultPlayerData(goals = 20)
        val result = XPCalculator.calculate(data)
        // 15 gols * 10 XP = 150 (nao 20 * 10 = 200)
        assertEquals(150L, result.breakdown.goals)
    }

    @Test
    fun assistenciasAcimaDoTeto_saoLimitadas() {
        // Teto = 10 assistencias por jogo
        val data = createDefaultPlayerData(assists = 15)
        val result = XPCalculator.calculate(data)
        // 10 assistencias * 7 XP = 70 (nao 15 * 7 = 105)
        assertEquals(70L, result.breakdown.assists)
    }

    @Test
    fun defesasAcimaDoTeto_saoLimitadas() {
        // Teto = 30 defesas por jogo
        val data = createDefaultPlayerData(saves = 35)
        val result = XPCalculator.calculate(data)
        // 30 defesas * 8 XP = 240 (nao 35 * 8 = 280)
        assertEquals(240L, result.breakdown.saves)
    }

    @Test
    fun totalXpNuncaPassaDe500() {
        // Cenario extremo: MVP + vitoria + muitos gols + streak 10
        val data = createDefaultPlayerData(
            goals = 15,
            assists = 10,
            saves = 30,
            teamWon = true,
            isMvp = true,
            currentStreak = 10
        )
        val result = XPCalculator.calculate(data)
        assertTrue(result.totalXp <= 500)
    }

    @Test
    fun calculateSimple_funcionaCorretamente() {
        val result = XPCalculator.calculateSimple(
            goals = 1,
            assists = 1,
            saves = 0,
            won = true,
            drew = false,
            isMvp = false,
            currentStreak = 0
        )
        // Participacao(10) + Gol(10) + Assistencia(7) + Vitoria(20) = 47
        assertEquals(47L, result.totalXp)
    }
}
