package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.Payment

/**
 * Interface do repositório de pagamentos (KMP).
 *
 * Define contrato para operações de pagamento, permitindo implementações
 * específicas de plataforma enquanto mantém a lógica compartilhada.
 */
interface PaymentRepository {

    /**
     * Cria um novo pagamento no sistema.
     *
     * @param payment Dados do pagamento (sem ID e createdAt)
     * @return Result contendo o Payment com ID gerado e createdAt
     */
    suspend fun createPayment(payment: Payment): Result<Payment>

    /**
     * Gera um código PIX mock para o pagamento.
     *
     * NOTA: Em produção, isso deve integrar com API real de PIX (Banco Central, Gateway, etc).
     *
     * @param payment Dados do pagamento
     * @return String contendo o código PIX formatado (payload padrão EMV)
     */
    fun generatePixCode(payment: Payment): String

    /**
     * Confirma um pagamento como PAGO, atualizando status e registrando data.
     *
     * Usa transação para garantir atomicidade entre:
     * - Atualizar status do payment
     * - Atualizar status na confirmação do jogo (se relacionado)
     *
     * @param paymentId ID do pagamento a confirmar
     * @return Result<Unit> indicando sucesso ou falha
     */
    suspend fun confirmPayment(paymentId: String): Result<Unit>

    /**
     * Busca todos os pagamentos de um usuário, ordenados por data (mais recente primeiro).
     *
     * @param userId ID do usuário
     * @return Result contendo lista de Payment
     */
    suspend fun getPaymentsByUser(userId: String): Result<List<Payment>>
}
