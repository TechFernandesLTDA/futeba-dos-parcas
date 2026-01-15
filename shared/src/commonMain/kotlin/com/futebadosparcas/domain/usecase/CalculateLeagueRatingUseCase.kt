package com.futebadosparcas.domain.usecase

import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.domain.ranking.LeagueRatingCalculator
import com.futebadosparcas.domain.ranking.RecentGameData

/**
 * Use Case para calcular rating de liga (sistema 0-100 em producao).
 * Usa o LeagueRatingCalculator compartilhado.
 *
 * SISTEMA DE RATING: Escala 0-100 (media ponderada)
 * -------------------------------------------------
 * O sistema usa uma formula ponderada baseada nos ultimos 10 jogos:
 * LR = (PPJ * 40%) + (WR * 30%) + (GD * 20%) + (MVP_Rate * 10%)
 *
 * DECISAO DE ARQUITETURA:
 * Este sistema 0-100 foi mantido em detrimento do sistema Elo (100-3000)
 * porque ja esta em producao e todos os thresholds estao definidos baseados nele.
 */
class CalculateLeagueRatingUseCase {

    /**
     * Calcula o League Rating baseado nos ultimos jogos.
     *
     * @param recentGames Lista de jogos recentes (max 10 recomendado)
     * @return Rating entre 0.0 e 100.0
     */
    fun calculateRating(recentGames: List<RecentGameData>): Double {
        return LeagueRatingCalculator.calculate(recentGames)
    }

    /**
     * Retorna a divisao correspondente ao rating fornecido.
     *
     * @param rating Rating entre 0.0 e 100.0
     * @return Divisao correspondente
     */
    fun getDivisionForRating(rating: Double): LeagueDivision {
        return LeagueRatingCalculator.getDivisionForRating(rating)
    }

    /**
     * Retorna o threshold de rating para a proxima divisao.
     *
     * @param division Divisao atual
     * @return Rating minimo para subir de divisao
     */
    fun getNextDivisionThreshold(division: LeagueDivision): Double {
        return LeagueRatingCalculator.getNextDivisionThreshold(division)
    }

    /**
     * Retorna o threshold de rating para a divisao anterior.
     *
     * @param division Divisao atual
     * @return Rating minimo para cair de divisao
     */
    fun getPreviousDivisionThreshold(division: LeagueDivision): Double {
        return LeagueRatingCalculator.getPreviousDivisionThreshold(division)
    }

    /**
     * Calcula pontos da temporada baseado em vitorias/empates/derrotas.
     *
     * @param wins Numero de vitorias
     * @param draws Numero de empates
     * @param losses Numero de derrotas
     * @return Total de pontos
     */
    fun calculateSeasonPoints(wins: Int, draws: Int, losses: Int): Int {
        return LeagueRatingCalculator.calculateSeasonPoints(wins, draws, losses)
    }
}
