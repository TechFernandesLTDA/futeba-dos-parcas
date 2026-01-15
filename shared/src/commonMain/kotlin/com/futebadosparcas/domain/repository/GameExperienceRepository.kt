package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.MVPVote
import com.futebadosparcas.domain.model.VoteCategory
import kotlinx.coroutines.flow.Flow

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
     * Busca todos os votos de um jogo.
     */
    suspend fun getGameVotes(gameId: String): Result<List<MVPVote>>

    /**
     * Flow de votos de um jogo em tempo real.
     */
    fun getGameVotesFlow(gameId: String): Flow<List<MVPVote>>

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
