package com.futebadosparcas.domain.usecase.ranking

import com.futebadosparcas.data.model.LeagueDivision
import com.futebadosparcas.data.model.SeasonParticipationV2
import com.futebadosparcas.domain.model.LeagueDivision as SharedLeagueDivision
import com.futebadosparcas.domain.model.Season
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.domain.ranking.LeagueService
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth

/**
 * Use Case para buscar classificacao da liga.
 *
 * Responsabilidades:
 * - Buscar classificacao por divisao
 * - Calcular posicao do jogador
 * - Verificar criterios de promocao/rebaixamento
 * - Fornecer estatisticas da temporada
 */
class GetLeagueStandingsUseCase constructor(
    private val gamificationRepository: GamificationRepository,
    private val leagueService: LeagueService,
    private val userRepository: UserRepository,
    private val auth: FirebaseAuth
) {
    companion object {
        private const val TAG = "GetLeagueStandingsUseCase"

        /**
         * Converte LeagueDivision do Android para Shared.
         */
        private fun toSharedDivision(division: LeagueDivision): SharedLeagueDivision {
            return when (division) {
                LeagueDivision.BRONZE -> SharedLeagueDivision.BRONZE
                LeagueDivision.PRATA -> SharedLeagueDivision.PRATA
                LeagueDivision.OURO -> SharedLeagueDivision.OURO
                LeagueDivision.DIAMANTE -> SharedLeagueDivision.DIAMANTE
            }
        }
    }

    /**
     * Participante com dados completos.
     */
    data class RankedPlayer(
        val position: Int,
        val user: User,
        val participation: SeasonParticipationV2,
        val division: LeagueDivision,
        val isCurrentUser: Boolean,
        val positionChange: Int,
        val isPromotionZone: Boolean,
        val isRelegationZone: Boolean
    )

    /**
     * Classificação completa de uma divisão.
     */
    data class DivisionStandings(
        val division: LeagueDivision,
        val season: Season,
        val players: List<RankedPlayer>,
        val promotionCutoff: Int,
        val relegationCutoff: Int,
        val currentUserPosition: Int?
    )

    /**
     * Visão geral da liga.
     */
    data class LeagueOverview(
        val season: Season,
        val divisions: List<DivisionStandings>,
        val currentUserDivision: LeagueDivision?,
        val currentUserPosition: Int?,
        val daysRemaining: Int
    )

    /**
     * Busca classificação de uma divisão específica.
     *
     * @param division Divisão da liga
     * @param limit Número máximo de jogadores
     * @return Result com classificação da divisão
     */
    suspend fun getDivisionStandings(
        division: LeagueDivision,
        limit: Int = 50
    ): Result<DivisionStandings> {
        AppLogger.d(TAG) { "Buscando classificação: division=$division" }

        return try {
            val currentUserId = auth.currentUser?.uid

            // 1. Buscar temporada ativa
            val season = gamificationRepository.getActiveSeason()
                .getOrElse { return Result.failure(it) }
                ?: return Result.failure(IllegalStateException("Nenhuma temporada ativa"))

            // 2. Buscar classificacao da divisao (converter para SharedLeagueDivision)
            val sharedDivision = toSharedDivision(division)
            val participations = leagueService.getPlayersByDivision(season.id, sharedDivision, limit)
                .getOrElse { return Result.failure(it) }

            // 3. Buscar dados dos usuários
            val userIds = participations.map { it.userId }
            val usersResult = userRepository.getUsersByIds(userIds)
            val usersMap = usersResult.getOrNull()?.associateBy { it.id } ?: emptyMap()

            // 4. Montar lista de jogadores rankeados
            val totalPlayers = participations.size
            val rankedPlayers = participations.mapIndexed { index, participation ->
                val userId = participation.userId
                val user = usersMap[userId] ?: createUnknownUser(userId)
                val position = index + 1

                RankedPlayer(
                    position = position,
                    user = user,
                    participation = participation,
                    division = division,
                    isCurrentUser = userId == currentUserId,
                    positionChange = 0,
                    isPromotionZone = position <= getPromotionCutoff(division),
                    isRelegationZone = position > totalPlayers - getRelegationCutoff(division)
                )
            }

            // 5. Encontrar posição do usuário atual
            val currentUserPosition = rankedPlayers.firstOrNull { it.isCurrentUser }?.position

            val standings = DivisionStandings(
                division = division,
                season = season,
                players = rankedPlayers,
                promotionCutoff = getPromotionCutoff(division),
                relegationCutoff = getRelegationCutoff(division),
                currentUserPosition = currentUserPosition
            )

            AppLogger.d(TAG) { "Classificação carregada: ${rankedPlayers.size} jogadores" }

            Result.success(standings)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar classificação", e)
            Result.failure(e)
        }
    }

    /**
     * Busca visão geral da liga completa.
     *
     * @return Result com visão geral
     */
    suspend fun getLeagueOverview(): Result<LeagueOverview> {
        AppLogger.d(TAG) { "Buscando visão geral da liga" }

        return try {
            // 1. Buscar temporada ativa
            val season = gamificationRepository.getActiveSeason()
                .getOrElse { return Result.failure(it) }
                ?: return Result.failure(IllegalStateException("Nenhuma temporada ativa"))

            // 2. Buscar classificação de cada divisão
            val divisions = mutableListOf<DivisionStandings>()
            var currentUserDivision: LeagueDivision? = null
            var currentUserPosition: Int? = null

            for (division in LeagueDivision.values()) {
                val standingsResult = getDivisionStandings(division, 20)
                if (standingsResult.isSuccess) {
                    val standings = standingsResult.getOrThrow()
                    divisions.add(standings)

                    // Verificar se usuário está nesta divisão
                    standings.currentUserPosition?.let { pos ->
                        currentUserDivision = division
                        currentUserPosition = pos
                    }
                }
            }

            // 3. Calcular dias restantes
            val daysRemaining = calculateDaysRemaining(season)

            val overview = LeagueOverview(
                season = season,
                divisions = divisions.sortedByDescending { it.division.ordinal },
                currentUserDivision = currentUserDivision,
                currentUserPosition = currentUserPosition,
                daysRemaining = daysRemaining
            )

            Result.success(overview)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar visão geral", e)
            Result.failure(e)
        }
    }

    /**
     * Busca participação do usuário atual.
     *
     * @return Result com dados de participação
     */
    suspend fun getCurrentUserParticipation(): Result<RankedPlayer?> {
        val currentUserId = auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Usuário não autenticado"))

        AppLogger.d(TAG) { "Buscando participação do usuário: $currentUserId" }

        return try {
            // 1. Buscar temporada ativa
            val season = gamificationRepository.getActiveSeason()
                .getOrElse { return Result.failure(it) }
                ?: return Result.failure(IllegalStateException("Nenhuma temporada ativa"))

            // 2. Buscar participação
            val domainParticipation = gamificationRepository.getUserParticipation(currentUserId, season.id)
                .getOrElse { return Result.success(null) } // Usuário não está participando
                ?: return Result.success(null) // Participação nula

            // 3. Buscar dados do usuário
            val userResult = userRepository.getCurrentUser()
            val user = userResult.getOrNull() ?: createUnknownUser(currentUserId)

            // 4. Converter para SeasonParticipationV2 (compatibilidade com LeagueService)
            val division = LeagueDivision.valueOf(domainParticipation.division)
            val participation = SeasonParticipationV2(
                id = domainParticipation.id,
                userId = domainParticipation.userId,
                seasonId = domainParticipation.seasonId,
                division = division,
                points = domainParticipation.points,
                gamesPlayed = domainParticipation.gamesPlayed,
                wins = domainParticipation.wins,
                draws = domainParticipation.draws,
                losses = domainParticipation.losses,
                goalsScored = domainParticipation.goals,
                goalsConceded = 0,
                assists = domainParticipation.assists,
                mvpCount = domainParticipation.mvpCount,
                leagueRating = domainParticipation.leagueRating.toDouble()
            )

            // 5. Buscar posição na divisão
            val standingsResult = getDivisionStandings(division, 100)
            val position = standingsResult.getOrNull()?.currentUserPosition ?: 0

            val rankedPlayer = RankedPlayer(
                position = position,
                user = user,
                participation = participation,
                division = division,
                isCurrentUser = true,
                positionChange = 0,
                isPromotionZone = position <= getPromotionCutoff(division),
                isRelegationZone = false
            )

            Result.success(rankedPlayer)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar participação", e)
            Result.failure(e)
        }
    }

    private fun getPromotionCutoff(division: LeagueDivision): Int {
        return when (division) {
            LeagueDivision.BRONZE -> 3
            LeagueDivision.PRATA -> 3
            LeagueDivision.OURO -> 3
            LeagueDivision.DIAMANTE -> 0
        }
    }

    private fun getRelegationCutoff(division: LeagueDivision): Int {
        return when (division) {
            LeagueDivision.BRONZE -> 0
            LeagueDivision.PRATA -> 3
            LeagueDivision.OURO -> 3
            LeagueDivision.DIAMANTE -> 3
        }
    }

    private fun calculateDaysRemaining(season: Season): Int {
        return try {
            val diff = season.endDate - System.currentTimeMillis()
            (diff / (1000 * 60 * 60 * 24)).toInt().coerceAtLeast(0)
        } catch (e: Exception) {
            0
        }
    }

    private fun createUnknownUser(userId: String) = User(
        id = userId,
        name = "Jogador",
        email = ""
    )
}
