package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.MVPVote
import com.futebadosparcas.domain.model.VoteCategory

/**
 * Repository para gerenciar a experiencia de jogo (votacao MVP, etc).
 * Interface KMP para ser usada em Android e iOS.
 */
interface GameExperienceRepository {
    /**
     * Submete um voto para uma categoria (MVP, Melhor Goleiro, Bola Murcha).
     * Verifica se o jogo foi finalizado dentro da janela de 24 horas.
     */
    suspend fun submitVote(vote: MVPVote): Result<Unit>

    /**
     * Verifica se a votacao ainda esta aberta para um jogo (dentro de 24h).
     */
    suspend fun isVotingOpen(gameId: String): Result<Boolean>

    /**
     * Verifica se o usuario ja votou em um jogo.
     */
    suspend fun hasUserVoted(gameId: String, userId: String): Result<Boolean>

    /**
     * Retorna apenas as categorias votadas pelo próprio usuário, usando os
     * IDs determinísticos autorizados pelas rules. Nunca lista votos brutos.
     */
    suspend fun getUserVoteCategories(
        gameId: String,
        userId: String
    ): Result<Set<VoteCategory>>

    /**
     * Conclui a votacao calculando os resultados.
     * Atualiza as confirmacoes com os resultados da votacao.
     */
    suspend fun concludeVoting(gameId: String): Result<Unit>

    /**
     * Verifica se todos os jogadores confirmados ja votaram.
     */
    suspend fun checkAllVoted(gameId: String): Result<Boolean>
}
