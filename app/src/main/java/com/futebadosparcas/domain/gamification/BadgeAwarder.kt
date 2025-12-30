package com.futebadosparcas.domain.gamification

import com.futebadosparcas.data.model.BadgeType
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.LivePlayerStats
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.data.repository.GamificationRepository
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * UseCase responsável por verificar e premiar badges automaticamente após um jogo.
 */
@Singleton
class BadgeAwarder @Inject constructor(
    private val gamificationRepository: GamificationRepository
) {

    companion object {
        private const val TAG = "BadgeAwarder"
    }

    private val _newBadges = kotlinx.coroutines.flow.MutableSharedFlow<com.futebadosparcas.data.model.UserBadge>()
    val newBadges = _newBadges.asSharedFlow()

    /**
     * Verifica e premia badges para todos os jogadores de um jogo finalizado baseando-se nas estatísticas.
     */
    suspend fun checkAndAwardBadges(game: Game, stats: List<LivePlayerStats>) {
        AppLogger.d(TAG) { "Iniciando verificação de badges para o jogo ${game.id}" }
        
        stats.forEach { playerStats ->
            checkIndividualBadges(playerStats, stats, game)
        }
    }

    private suspend fun checkIndividualBadges(playerStats: LivePlayerStats, allStats: List<LivePlayerStats>, game: Game) {
        val userId = playerStats.playerId
        
        // 1. Verificar STREAKS
        game.date?.let { gameDate ->
            gamificationRepository.updateStreak(userId, gameDate)
                .onSuccess { streak ->
                    if (streak.currentStreak >= 30) {
                        award(userId, BadgeType.STREAK_30)
                    } else if (streak.currentStreak >= 7) {
                        award(userId, BadgeType.STREAK_7)
                    }
                }
        }

        // 2. HAT_TRICK: 3 gols no mesmo jogo
        if (playerStats.goals >= 3) {
            award(userId, BadgeType.HAT_TRICK)
        }

        // 3. PAREDAO: Goleiro sem levar gols
        if (playerStats.getPositionEnum() == PlayerPosition.GOALKEEPER) {
            val opponentGoals = allStats
                .filter { it.teamId != playerStats.teamId }
                .sumOf { it.goals }
            
            if (opponentGoals == 0) {
                award(userId, BadgeType.PAREDAO)
            }
        }
    }

    private suspend fun award(userId: String, badgeType: BadgeType) {
        gamificationRepository.awardBadge(userId, badgeType.name)
            .onSuccess { userBadge ->
                AppLogger.d(TAG) { "Badge ${badgeType.name} concedido para $userId" }
                _newBadges.emit(userBadge)
            }
            .onFailure { e ->
                AppLogger.e(TAG, "Erro ao conceder badge ${badgeType.name} para $userId", e)
            }
    }
}
