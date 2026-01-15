package com.futebadosparcas.domain.ranking

import com.futebadosparcas.domain.model.LeagueDivision

/**
 * Configuracoes do sistema de progressao de liga.
 * Permite customizacao das regras para diferentes grupos/ligas.
 */
data class LeagueProgressionConfig(
    /** Numero de jogos consecutivos necessarios para promocao */
    val promotionGamesRequired: Int = DEFAULT_PROMOTION_GAMES,
    /** Numero de jogos consecutivos necessarios para rebaixamento */
    val relegationGamesRequired: Int = DEFAULT_RELEGATION_GAMES,
    /** Numero de jogos de protecao apos mudanca de divisao */
    val protectionGames: Int = DEFAULT_PROTECTION_GAMES,
    /** Numero maximo de jogos recentes a considerar */
    val maxRecentGames: Int = DEFAULT_MAX_RECENT_GAMES
) {
    companion object {
        const val DEFAULT_PROMOTION_GAMES = 3
        const val DEFAULT_RELEGATION_GAMES = 3
        const val DEFAULT_PROTECTION_GAMES = 5
        const val DEFAULT_MAX_RECENT_GAMES = 10

        /** Configuracao padrao do sistema */
        val DEFAULT = LeagueProgressionConfig()
    }
}

/**
 * Estado atual de progressao de um jogador na liga.
 */
data class LeagueProgressionState(
    /** Divisao atual do jogador */
    val division: LeagueDivision,
    /** League Rating atual (0-100) */
    val leagueRating: Double = 0.0,
    /** Progresso para promocao (0 ate config.promotionGamesRequired) */
    val promotionProgress: Int = 0,
    /** Progresso para rebaixamento (0 ate config.relegationGamesRequired) */
    val relegationProgress: Int = 0,
    /** Jogos restantes de protecao (imunidade a rebaixamento) */
    val protectionGames: Int = 0
)

/**
 * Resultado de uma atualizacao de progressao de liga.
 */
data class LeagueProgressionResult(
    /** Novo estado apos a atualizacao */
    val newState: LeagueProgressionState,
    /** Divisao anterior (para comparacao) */
    val previousDivision: LeagueDivision,
    /** Se houve promocao */
    val promoted: Boolean,
    /** Se houve rebaixamento */
    val relegated: Boolean
) {
    /** Verifica se houve mudanca de divisao */
    val divisionChanged: Boolean get() = promoted || relegated
}

/**
 * Estatisticas de uma temporada de um jogador.
 * Logica pura para calculos de temporada.
 */
data class SeasonStats(
    val gamesPlayed: Int = 0,
    val wins: Int = 0,
    val draws: Int = 0,
    val losses: Int = 0,
    val goalsScored: Int = 0,
    val goalsConceded: Int = 0,
    val mvpCount: Int = 0,
    val points: Int = 0
) {
    /** Saldo de gols */
    val goalDifference: Int get() = goalsScored - goalsConceded

    /** Taxa de vitorias (0.0 a 1.0) */
    val winRate: Double get() = if (gamesPlayed > 0) wins.toDouble() / gamesPlayed else 0.0

    /** Taxa de MVP (0.0 a 1.0) */
    val mvpRate: Double get() = if (gamesPlayed > 0) mvpCount.toDouble() / gamesPlayed else 0.0
}

/**
 * Gerenciador de progressao de liga.
 *
 * Responsavel por calcular promocoes, rebaixamentos e
 * atualizacoes de estado de liga de forma pura (sem dependencias de plataforma).
 *
 * Regras de Progressao:
 * - Promocao: LR >= limite superior por N jogos consecutivos
 * - Rebaixamento: LR < limite inferior por N jogos consecutivos
 * - Protecao: N jogos de imunidade apos mudanca de divisao
 *
 * @param config Configuracoes customizaveis do sistema
 */
class LeagueProgressionManager(
    private val config: LeagueProgressionConfig = LeagueProgressionConfig.DEFAULT
) {

    /**
     * Calcula a nova progressao de liga apos um jogo.
     *
     * @param currentState Estado atual do jogador
     * @param newLeagueRating Novo League Rating calculado
     * @return Resultado da progressao com novo estado
     */
    fun updateProgression(
        currentState: LeagueProgressionState,
        newLeagueRating: Double
    ): LeagueProgressionResult {
        val oldDivision = currentState.division

        // Thresholds para a divisao atual
        val nextTierThreshold = LeagueRatingCalculator.getNextDivisionThreshold(oldDivision)
        val prevTierThreshold = LeagueRatingCalculator.getPreviousDivisionThreshold(oldDivision)

        var currentProtection = currentState.protectionGames
        var currentPromotionProgress = currentState.promotionProgress
        var currentRelegationProgress = currentState.relegationProgress

        var promoted = false
        var relegated = false
        var newDivision = oldDivision

        // Se estiver protegido, decrementa e nao altera progressos
        if (currentProtection > 0) {
            currentProtection--
            currentPromotionProgress = 0
            currentRelegationProgress = 0
        } else {
            // Checa Promocao
            if (newLeagueRating >= nextTierThreshold && oldDivision != LeagueDivision.DIAMANTE) {
                currentPromotionProgress++
                currentRelegationProgress = 0 // Reseta o oposto

                if (currentPromotionProgress >= config.promotionGamesRequired) {
                    promoted = true
                    currentPromotionProgress = 0
                    currentProtection = config.protectionGames
                    newDivision = LeagueDivision.getNextDivision(oldDivision)
                }
            }
            // Checa Rebaixamento
            else if (newLeagueRating < prevTierThreshold && oldDivision != LeagueDivision.BRONZE) {
                currentRelegationProgress++
                currentPromotionProgress = 0 // Reseta o oposto

                if (currentRelegationProgress >= config.relegationGamesRequired) {
                    relegated = true
                    currentRelegationProgress = 0
                    currentProtection = config.protectionGames
                    newDivision = LeagueDivision.getPreviousDivision(oldDivision)
                }
            } else {
                // Se saiu da zona de promocao/rebaixamento, reseta progressos
                if (newLeagueRating < nextTierThreshold) currentPromotionProgress = 0
                if (newLeagueRating >= prevTierThreshold) currentRelegationProgress = 0
            }
        }

        val newState = LeagueProgressionState(
            division = newDivision,
            leagueRating = newLeagueRating,
            promotionProgress = currentPromotionProgress,
            relegationProgress = currentRelegationProgress,
            protectionGames = currentProtection
        )

        return LeagueProgressionResult(
            newState = newState,
            previousDivision = oldDivision,
            promoted = promoted,
            relegated = relegated
        )
    }

    /**
     * Atualiza estatisticas de temporada com resultado de um jogo.
     *
     * @param currentStats Estatisticas atuais
     * @param won Se o jogador venceu
     * @param drew Se o jogador empatou
     * @param goalDiff Saldo de gols do jogo (positivo se fez mais)
     * @param wasMvp Se foi MVP do jogo
     * @return Novas estatisticas atualizadas
     */
    fun updateSeasonStats(
        currentStats: SeasonStats,
        won: Boolean,
        drew: Boolean,
        goalDiff: Int,
        wasMvp: Boolean
    ): SeasonStats {
        val lost = !won && !drew

        return currentStats.copy(
            gamesPlayed = currentStats.gamesPlayed + 1,
            wins = currentStats.wins + if (won) 1 else 0,
            draws = currentStats.draws + if (drew) 1 else 0,
            losses = currentStats.losses + if (lost) 1 else 0,
            goalsScored = currentStats.goalsScored + maxOf(0, goalDiff),
            goalsConceded = currentStats.goalsConceded + maxOf(0, -goalDiff),
            mvpCount = currentStats.mvpCount + if (wasMvp) 1 else 0,
            points = currentStats.points + calculateMatchPoints(won, drew)
        )
    }

    /**
     * Calcula pontos de uma partida.
     *
     * @param won Se venceu
     * @param drew Se empatou
     * @return Pontos (3 vitoria, 1 empate, 0 derrota)
     */
    fun calculateMatchPoints(won: Boolean, drew: Boolean): Int {
        return when {
            won -> 3
            drew -> 1
            else -> 0
        }
    }

    /**
     * Determina a divisao inicial de um jogador baseado em historico anterior.
     *
     * @param previousLeagueRating Rating da temporada anterior (ou null se novo)
     * @return Divisao inicial sugerida
     */
    fun determineInitialDivision(previousLeagueRating: Double?): LeagueDivision {
        return if (previousLeagueRating != null) {
            LeagueRatingCalculator.getDivisionForRating(previousLeagueRating)
        } else {
            LeagueDivision.BRONZE
        }
    }

    /**
     * Limita uma lista de jogos recentes ao maximo configurado.
     *
     * @param recentGames Lista completa de jogos recentes
     * @return Lista limitada ao maxRecentGames configurado
     */
    fun trimRecentGames(recentGames: List<RecentGameData>): List<RecentGameData> {
        return recentGames.take(config.maxRecentGames)
    }

    /**
     * Verifica se um jogador esta em zona de promocao.
     *
     * @param state Estado atual
     * @return true se o rating atual o qualifica para promocao
     */
    fun isInPromotionZone(state: LeagueProgressionState): Boolean {
        if (state.division == LeagueDivision.DIAMANTE) return false
        val threshold = LeagueRatingCalculator.getNextDivisionThreshold(state.division)
        return state.leagueRating >= threshold
    }

    /**
     * Verifica se um jogador esta em zona de rebaixamento.
     *
     * @param state Estado atual
     * @return true se o rating atual o qualifica para rebaixamento
     */
    fun isInRelegationZone(state: LeagueProgressionState): Boolean {
        if (state.division == LeagueDivision.BRONZE) return false
        val threshold = LeagueRatingCalculator.getPreviousDivisionThreshold(state.division)
        return state.leagueRating < threshold
    }

    /**
     * Verifica se um jogador esta protegido de mudancas de divisao.
     *
     * @param state Estado atual
     * @return true se ainda tem jogos de protecao
     */
    fun isProtected(state: LeagueProgressionState): Boolean {
        return state.protectionGames > 0
    }

    /**
     * Calcula jogos restantes para promocao.
     *
     * @param state Estado atual
     * @return Numero de jogos necessarios (0 se nao esta em zona de promocao)
     */
    fun gamesUntilPromotion(state: LeagueProgressionState): Int {
        return if (isInPromotionZone(state)) {
            config.promotionGamesRequired - state.promotionProgress
        } else {
            0
        }
    }

    /**
     * Calcula jogos restantes para rebaixamento.
     *
     * @param state Estado atual
     * @return Numero de jogos necessarios (0 se nao esta em zona de rebaixamento)
     */
    fun gamesUntilRelegation(state: LeagueProgressionState): Int {
        return if (isInRelegationZone(state) && !isProtected(state)) {
            config.relegationGamesRequired - state.relegationProgress
        } else {
            0
        }
    }

    companion object {
        /** Instancia padrao com configuracao default */
        val DEFAULT = LeagueProgressionManager()
    }
}
