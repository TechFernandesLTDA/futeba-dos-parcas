package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.AttributeRating
import com.futebadosparcas.domain.model.MVPStreak
import com.futebadosparcas.domain.model.MVPVote
import com.futebadosparcas.domain.model.MVPVoteResult
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.domain.model.VoteResultWithPodium
import com.futebadosparcas.domain.model.VotingSettings
import kotlinx.coroutines.flow.Flow

/**
 * Repository para gerenciar a experiencia de jogo (votacao MVP, etc).
 * Interface KMP para ser usada em Android e iOS.
 *
 * Melhorias implementadas (Issues #51-60):
 * - #51: Votação anônima
 * - #52: Categorias customizáveis
 * - #53: Avaliação de atributos
 * - #54: Timeout de votação
 * - #55: Reveal animado (UI)
 * - #56: Opção de pular voto
 * - #57: Top 3 (podium)
 * - #58: Compartilhar resultado (UI)
 * - #59: Badge MVP Streak
 * - #60: Votação separada goleiros/jogadores
 */
interface GameExperienceRepository {

    // ==================== VOTAÇÃO MVP ====================

    /**
     * Submete um voto para uma categoria (MVP, Melhor Goleiro, Bola Murcha).
     * Verifica se o jogo foi finalizado dentro da janela de votação.
     *
     * @param vote Objeto MVPVote com os dados do voto
     * @param skipped Se true, registra que o usuário pulou esta categoria
     */
    suspend fun submitVote(vote: MVPVote, skipped: Boolean = false): Result<Unit>

    /**
     * Verifica se a votacao ainda esta aberta para um jogo.
     * Considera o votingDeadline se definido.
     */
    suspend fun isVotingOpen(gameId: String): Result<Boolean>

    /**
     * Retorna o tempo restante para votação em milissegundos.
     */
    suspend fun getVotingTimeRemaining(gameId: String): Result<Long>

    /**
     * Verifica se o usuario ja votou em um jogo.
     */
    suspend fun hasUserVoted(gameId: String, userId: String): Result<Boolean>

    /**
     * Verifica se o usuário já votou em uma categoria específica.
     */
    suspend fun hasUserVotedCategory(gameId: String, userId: String, category: VoteCategory): Result<Boolean>

    /**
     * Busca todos os votos de um jogo.
     */
    suspend fun getGameVotes(gameId: String): Result<List<MVPVote>>

    /**
     * Flow de votos de um jogo em tempo real.
     */
    fun getGameVotesFlow(gameId: String): Flow<List<MVPVote>>

    /**
     * Busca os resultados da votação com podium (top 3).
     *
     * @param gameId ID do jogo
     * @param isAnonymous Se true, não retorna os IDs dos votantes
     * @return Lista de VoteResultWithPodium para cada categoria
     */
    suspend fun getVoteResults(gameId: String, isAnonymous: Boolean = false): Result<List<VoteResultWithPodium>>

    /**
     * Conclui a votacao calculando os resultados.
     * Atualiza as confirmacoes com os resultados da votacao.
     * Atualiza MVP streaks dos jogadores.
     */
    suspend fun concludeVoting(gameId: String): Result<Unit>

    /**
     * Verifica se todos os jogadores confirmados ja votaram.
     */
    suspend fun checkAllVoted(gameId: String): Result<Boolean>

    /**
     * Conta quantos jogadores pularam uma categoria.
     */
    suspend fun getSkippedCount(gameId: String, category: VoteCategory): Result<Int>

    // ==================== AVALIAÇÃO DE ATRIBUTOS (#53) ====================

    /**
     * Submete avaliação de atributos de um jogador.
     */
    suspend fun submitAttributeRating(rating: AttributeRating): Result<Unit>

    /**
     * Busca avaliações de atributos de um jogador em um jogo.
     */
    suspend fun getPlayerAttributeRatings(gameId: String, playerId: String): Result<List<AttributeRating>>

    /**
     * Calcula a média de atributos de um jogador em um jogo.
     */
    suspend fun getPlayerAverageRating(gameId: String, playerId: String): Result<AttributeRating?>

    // ==================== MVP STREAK (#59) ====================

    /**
     * Busca o streak de MVP de um jogador.
     */
    suspend fun getMVPStreak(userId: String): Result<MVPStreak?>

    /**
     * Atualiza o streak de MVP após uma votação.
     *
     * @param userId ID do jogador
     * @param gameId ID do jogo onde foi MVP
     * @param wasMVP Se true, incrementa streak; se false, reseta
     */
    suspend fun updateMVPStreak(userId: String, gameId: String, wasMVP: Boolean): Result<MVPStreak>

    /**
     * Verifica se o jogador atingiu streak de 3 MVPs consecutivos (para badge).
     */
    suspend fun checkMVPStreakBadge(userId: String): Result<Boolean>

    // ==================== CONFIGURAÇÕES DE VOTAÇÃO ====================

    /**
     * Busca as configurações de votação de um grupo.
     */
    suspend fun getVotingSettings(groupId: String): Result<VotingSettings?>

    /**
     * Atualiza as configurações de votação de um grupo.
     * Apenas owner/admin pode atualizar.
     */
    suspend fun updateVotingSettings(groupId: String, settings: VotingSettings): Result<Unit>
}
