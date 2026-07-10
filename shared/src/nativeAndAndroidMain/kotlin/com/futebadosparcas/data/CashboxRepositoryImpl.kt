package com.futebadosparcas.data

import com.futebadosparcas.domain.model.*
import com.futebadosparcas.domain.repository.CashboxRepository
import com.futebadosparcas.platform.UuidGenerator
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.logging.PlatformLogger
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

internal class CashboxRequestIdTracker(
    private val requestIdFactory: () -> String
) {
    private val mutex = Mutex()
    private val pending = mutableMapOf<String, String>()

    suspend fun requestId(operationKey: String, preferredId: String): String = mutex.withLock {
        pending.getOrPut(operationKey) {
            preferredId.takeIf { it.matches(Regex("^[A-Za-z0-9_-]{16,128}$")) }
                ?: requestIdFactory()
        }
    }

    suspend fun complete(operationKey: String, requestId: String) = mutex.withLock {
        if (pending[operationKey] == requestId) pending.remove(operationKey)
    }
}

/**
 * Implementação Android do CashboxRepository.
 *
 * Usa FirebaseDataSource para operações de Firebase.
 */
class CashboxRepositoryImpl internal constructor(
    private val firebaseDataSource: FirebaseDataSource,
    private val requestIds: CashboxRequestIdTracker
) : CashboxRepository {

    constructor(firebaseDataSource: FirebaseDataSource) : this(
        firebaseDataSource,
        CashboxRequestIdTracker(UuidGenerator::generate)
    )

    companion object {
        private const val TAG = "CashboxRepository"
    }

    override suspend fun uploadReceipt(groupId: String, filePath: String): Result<String> {
        return try {
            PlatformLogger.d(TAG, "Fazendo upload de comprovante para o grupo: $groupId")
            firebaseDataSource.uploadCashboxReceipt(groupId, filePath)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao fazer upload de comprovante", e)
            Result.failure(e)
        }
    }

    override suspend fun addEntry(
        groupId: String,
        entry: CashboxEntry,
        receiptFilePath: String?
    ): Result<String> {
        return try {
            PlatformLogger.d(TAG, "Adicionando entrada no caixa do grupo: $groupId")
            val operationKey = listOf(
                groupId,
                entry.type,
                entry.amount.toString(),
                entry.description,
                entry.category,
                entry.customCategory.orEmpty(),
                entry.referenceDate.toString(),
                entry.playerId.orEmpty(),
                entry.gameId.orEmpty(),
                receiptFilePath.orEmpty()
            ).joinToString("|")
            val requestId = requestIds.requestId(operationKey, entry.id)
            val result = firebaseDataSource.addCashboxEntry(
                groupId,
                entry.copy(id = requestId),
                receiptFilePath
            )
            if (result.isSuccess) requestIds.complete(operationKey, requestId)
            result
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao adicionar entrada no caixa", e)
            Result.failure(e)
        }
    }

    override suspend fun getSummary(groupId: String): Result<CashboxSummary> {
        return try {
            PlatformLogger.d(TAG, "Buscando resumo do caixa do grupo: $groupId")
            firebaseDataSource.getCashboxSummary(groupId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar resumo do caixa", e)
            Result.failure(e)
        }
    }

    override fun getSummaryFlow(groupId: String): Flow<CashboxSummary> {
        return firebaseDataSource.getCashboxSummaryFlow(groupId)
            .map { result ->
                result.getOrDefault(CashboxSummary())
            }
            .catch { e ->
                PlatformLogger.e(TAG, "Erro no fluxo de resumo do caixa", e)
                emit(CashboxSummary())
            }
    }

    override suspend fun getHistory(groupId: String, limit: Int): Result<List<CashboxEntry>> {
        return try {
            PlatformLogger.d(TAG, "Buscando histórico do caixa do grupo: $groupId, limit: $limit")
            firebaseDataSource.getCashboxHistory(groupId, limit)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar histórico do caixa", e)
            Result.failure(e)
        }
    }

    override fun getHistoryFlow(groupId: String, limit: Int): Flow<List<CashboxEntry>> {
        return firebaseDataSource.getCashboxHistoryFlow(groupId, limit)
            .map { result ->
                result.getOrDefault(emptyList())
            }
            .catch { e ->
                PlatformLogger.e(TAG, "Erro no fluxo de histórico do caixa", e)
                emit(emptyList())
            }
    }

    override suspend fun getHistoryFiltered(
        groupId: String,
        filter: CashboxFilter,
        limit: Int
    ): Result<List<CashboxEntry>> {
        return try {
            PlatformLogger.d(TAG, "Buscando histórico filtrado do grupo: $groupId")
            firebaseDataSource.getCashboxHistoryFiltered(groupId, filter, limit)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar histórico filtrado", e)
            Result.failure(e)
        }
    }

    override suspend fun getEntriesByMonth(
        groupId: String,
        year: Int,
        month: Int
    ): Result<List<CashboxEntry>> {
        return try {
            PlatformLogger.d(TAG, "Buscando entradas do mês $month/$year do grupo: $groupId")
            firebaseDataSource.getCashboxEntriesByMonth(groupId, year, month)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar entradas do mês", e)
            Result.failure(e)
        }
    }

    override suspend fun getEntryById(groupId: String, entryId: String): Result<CashboxEntry> {
        return try {
            PlatformLogger.d(TAG, "Buscando entrada: $entryId do grupo: $groupId")
            firebaseDataSource.getCashboxEntryById(groupId, entryId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar entrada", e)
            Result.failure(e)
        }
    }

    override suspend fun deleteEntry(groupId: String, entryId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Deletando entrada: $entryId do grupo: $groupId")
            firebaseDataSource.deleteCashboxEntry(groupId, entryId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao deletar entrada", e)
            Result.failure(e)
        }
    }

    override suspend fun recalculateBalance(groupId: String): Result<CashboxSummary> {
        return try {
            PlatformLogger.w(TAG, "Recalculando saldo do caixa do grupo: $groupId (operação custosa)")
            firebaseDataSource.recalculateCashboxBalance(groupId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao recalcular saldo", e)
            Result.failure(e)
        }
    }
}
