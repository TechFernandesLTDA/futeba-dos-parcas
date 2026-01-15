package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.*
import kotlinx.coroutines.flow.Flow

/**
 * Interface de repositório de caixa (fluxo financeiro dos grupos).
 * Implementações específicas de plataforma em androidMain/iosMain.
 */
interface CashboxRepository {

    /**
     * Faz upload do comprovante de pagamento
     * @param groupId ID do grupo
     * @param filePath Caminho do arquivo no dispositivo
     * @return URL da foto enviada
     */
    suspend fun uploadReceipt(groupId: String, filePath: String): Result<String>

    /**
     * Adiciona uma nova entrada no caixa
     * @param groupId ID do grupo
     * @param entry Dados da entrada
     * @param receiptFilePath Caminho do comprovante (opcional)
     * @return ID da entrada criada
     */
    suspend fun addEntry(
        groupId: String,
        entry: CashboxEntry,
        receiptFilePath: String? = null
    ): Result<String>

    /**
     * Busca o resumo do caixa de um grupo
     */
    suspend fun getSummary(groupId: String): Result<CashboxSummary>

    /**
     * Observa o resumo do caixa em tempo real
     */
    fun getSummaryFlow(groupId: String): Flow<CashboxSummary>

    /**
     * Busca histórico do caixa
     * @param groupId ID do grupo
     * @param limit Número máximo de entradas (padrão 50)
     */
    suspend fun getHistory(groupId: String, limit: Int = 50): Result<List<CashboxEntry>>

    /**
     * Observa histórico do caixa em tempo real
     */
    fun getHistoryFlow(groupId: String, limit: Int = 50): Flow<List<CashboxEntry>>

    /**
     * Busca histórico com filtros
     */
    suspend fun getHistoryFiltered(
        groupId: String,
        filter: CashboxFilter,
        limit: Int = 50
    ): Result<List<CashboxEntry>>

    /**
     * Busca entradas por mês
     */
    suspend fun getEntriesByMonth(
        groupId: String,
        year: Int,
        month: Int
    ): Result<List<CashboxEntry>>

    /**
     * Busca uma entrada específica
     */
    suspend fun getEntryById(groupId: String, entryId: String): Result<CashboxEntry>

    /**
     * Deleta uma entrada (soft delete com recálculo do saldo)
     */
    suspend fun deleteEntry(groupId: String, entryId: String): Result<Unit>

    /**
     * Recalcula o saldo do caixa (para correção manual)
     * WARN: Operação custosa que lê todas as entradas
     */
    suspend fun recalculateBalance(groupId: String): Result<CashboxSummary>
}
