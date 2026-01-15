package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.*
import kotlinx.coroutines.flow.Flow

/**
 * Repositório de gamificação: streaks, badges, desafios, temporadas.
 *
 * Gerencia elementos de gamificação do sistema:
 * - Streaks de jogos consecutivos
 * - Badges e conquistas
 * - Temporadas e rankings de liga
 * - Desafios semanais
 *
 * Implementações específicas de plataforma em androidMain/iosMain.
 */
interface GamificationRepository {

    // ========== STREAKS ==========

    /**
     * Atualiza o streak do usuário após confirmar presença em um jogo.
     *
     * @param userId ID do usuário
     * @param gameDate Data do jogo no formato "yyyy-MM-dd"
     * @return Result<UserStreak> Streak atualizado
     */
    suspend fun updateStreak(userId: String, gameDate: String): Result<UserStreak>

    /**
     * Busca o streak atual do usuário.
     *
     * @param userId ID do usuário
     * @return Result<UserStreak?> Streak do usuário ou null se não existir
     */
    suspend fun getUserStreak(userId: String): Result<UserStreak?>

    // ========== BADGES ==========

    /**
     * Premia um badge ao usuário.
     *
     * Se o usuário já possui o badge, incrementa o contador.
     *
     * @param userId ID do usuário
     * @param badgeId ID do badge a ser premiado
     * @return Result<UserBadge> Badge premiado
     */
    suspend fun awardBadge(userId: String, badgeId: String): Result<UserBadge>

    /**
     * Busca todos os badges do usuário.
     *
     * @param userId ID do usuário
     * @return Result<List<UserBadge>> Lista de badges do usuário
     */
    suspend fun getUserBadges(userId: String): Result<List<UserBadge>>

    /**
     * Busca todos os badges disponíveis no sistema.
     *
     * @return Result<List<BadgeDefinition>> Lista de badges disponíveis
     */
    suspend fun getAvailableBadges(): Result<List<BadgeDefinition>>

    /**
     * Busca os badges mais recentes do usuário.
     *
     * @param userId ID do usuário
     * @param limit Número máximo de badges a retornar (padrão: 5)
     * @return Result<List<UserBadge>> Lista de badges recentes
     */
    suspend fun getRecentBadges(userId: String, limit: Int = 5): Result<List<UserBadge>>

    // ========== SEASONS & LEAGUE ==========

    /**
     * Busca a temporada ativa.
     *
     * @return Result<Season?> Temporada ativa ou null se não existir
     */
    suspend fun getActiveSeason(): Result<Season?>

    /**
     * Busca todas as temporadas (ativas e inativas).
     *
     * @return Result<List<Season>> Lista de temporadas ordenadas por data
     */
    suspend fun getAllSeasons(): Result<List<Season>>

    /**
     * Busca o ranking da temporada.
     *
     * @param seasonId ID da temporada
     * @param limit Número máximo de jogadores a retornar (padrão: 50)
     * @return Result<List<SeasonParticipation>> Lista de participações ordenadas por pontos
     */
    suspend fun getSeasonRanking(seasonId: String, limit: Int = 50): Result<List<SeasonParticipation>>

    /**
     * Observa o ranking da temporada em tempo real.
     *
     * @param seasonId ID da temporada
     * @param limit Número máximo de jogadores a retornar (padrão: 50)
     * @return Flow<List<SeasonParticipation>> Flow que emite o ranking em tempo real
     */
    fun observeSeasonRanking(seasonId: String, limit: Int = 50): Flow<List<SeasonParticipation>>

    /**
     * Busca a participação de um usuário em uma temporada.
     *
     * @param userId ID do usuário
     * @param seasonId ID da temporada
     * @return Result<SeasonParticipation?> Participação do usuário ou null se não existir
     */
    suspend fun getUserParticipation(userId: String, seasonId: String): Result<SeasonParticipation?>

    /**
     * Atualiza a participação do usuário na temporada após um jogo.
     *
     * @param userId ID do usuário
     * @param seasonId ID da temporada
     * @param won Se o usuário venceu o jogo
     * @param draw Se o jogo terminou em empate
     * @param goalsScored Número de gols marcados (padrão: 0)
     * @param goalsConceded Número de gols sofridos (padrão: 0)
     * @param assists Número de assistências (padrão: 0)
     * @param isMVP Se o usuário foi o MVP do jogo (padrão: false)
     * @return Result<SeasonParticipation> Participação atualizada
     */
    suspend fun updateSeasonParticipation(
        userId: String,
        seasonId: String,
        won: Boolean,
        draw: Boolean,
        goalsScored: Int = 0,
        goalsConceded: Int = 0,
        assists: Int = 0,
        isMVP: Boolean = false
    ): Result<SeasonParticipation>

    // ========== CHALLENGES ==========

    /**
     * Busca os desafios ativos no momento.
     *
     * @return Result<List<WeeklyChallenge>> Lista de desafios ativos
     */
    suspend fun getActiveChallenges(): Result<List<WeeklyChallenge>>

    /**
     * Busca o progresso do usuário em múltiplos desafios.
     *
     * @param userId ID do usuário
     * @param challengeIds Lista de IDs dos desafios
     * @return Result<List<UserChallengeProgress>> Lista de progressos
     */
    suspend fun getChallengesProgress(
        userId: String,
        challengeIds: List<String>
    ): Result<List<UserChallengeProgress>>
}
