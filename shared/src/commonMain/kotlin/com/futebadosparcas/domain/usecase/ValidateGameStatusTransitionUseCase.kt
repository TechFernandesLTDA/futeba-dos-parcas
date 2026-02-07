package com.futebadosparcas.domain.usecase

import com.futebadosparcas.domain.model.GameStatus

/**
 * Use Case para validar transicoes de status de jogo.
 * Logica pura, compartilhavel entre plataformas.
 *
 * Garante que as transicoes de estado sigam o fluxo correto:
 * SCHEDULED -> CONFIRMED -> LIVE -> FINISHED
 *                                 -> CANCELLED (de qualquer estado)
 */
object ValidateGameStatusTransitionUseCase {

    /**
     * Mapa de transicoes validas.
     * Chave: status atual, Valor: lista de status destino permitidos.
     */
    private val validTransitions = mapOf(
        GameStatus.SCHEDULED to setOf(
            GameStatus.CONFIRMED,
            GameStatus.CANCELLED
        ),
        GameStatus.CONFIRMED to setOf(
            GameStatus.LIVE,
            GameStatus.SCHEDULED, // Reabrir lista
            GameStatus.CANCELLED
        ),
        GameStatus.LIVE to setOf(
            GameStatus.FINISHED,
            GameStatus.CANCELLED
        ),
        GameStatus.FINISHED to emptySet<GameStatus>(), // Estado final
        GameStatus.CANCELLED to setOf(
            GameStatus.SCHEDULED // Reativar jogo cancelado
        )
    )

    /**
     * Verifica se uma transicao de status e valida.
     *
     * @param currentStatus Status atual do jogo
     * @param targetStatus Status desejado
     * @return true se a transicao e permitida
     */
    operator fun invoke(currentStatus: GameStatus, targetStatus: GameStatus): Boolean {
        if (currentStatus == targetStatus) return false // Nao pode transicionar para o mesmo status
        val allowed = validTransitions[currentStatus] ?: return false
        return targetStatus in allowed
    }

    /**
     * Retorna a lista de status para os quais o jogo pode transicionar.
     *
     * @param currentStatus Status atual do jogo
     * @return Lista de status destino validos
     */
    fun getAvailableTransitions(currentStatus: GameStatus): Set<GameStatus> {
        return validTransitions[currentStatus] ?: emptySet()
    }

    /**
     * Verifica se o jogo pode ser cancelado no status atual.
     */
    fun canCancel(currentStatus: GameStatus): Boolean {
        return invoke(currentStatus, GameStatus.CANCELLED)
    }

    /**
     * Verifica se o jogo pode ser iniciado (ir para LIVE).
     */
    fun canStart(currentStatus: GameStatus): Boolean {
        return invoke(currentStatus, GameStatus.LIVE)
    }

    /**
     * Verifica se o jogo pode ser finalizado.
     */
    fun canFinish(currentStatus: GameStatus): Boolean {
        return invoke(currentStatus, GameStatus.FINISHED)
    }

    /**
     * Verifica se o jogo esta em estado que permite modificacao de lista de jogadores.
     * Apenas jogos SCHEDULED ou CONFIRMED permitem alteracoes na lista.
     */
    fun canModifyPlayerList(currentStatus: GameStatus): Boolean {
        return currentStatus == GameStatus.SCHEDULED || currentStatus == GameStatus.CONFIRMED
    }

    /**
     * Verifica se o jogo esta em estado ativo (nao finalizado/cancelado).
     */
    fun isActive(status: GameStatus): Boolean {
        return status != GameStatus.FINISHED && status != GameStatus.CANCELLED
    }
}
