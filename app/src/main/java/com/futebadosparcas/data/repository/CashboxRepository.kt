package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.CashboxAppStatus
import com.futebadosparcas.data.model.CashboxCategory
import com.futebadosparcas.data.model.CashboxEntry
import com.futebadosparcas.data.model.CashboxEntryType
import com.futebadosparcas.data.model.CashboxFilter
import com.futebadosparcas.data.model.CashboxSummary
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import android.net.Uri
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.Date
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CashboxRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val storage: FirebaseStorage
) {
    private val groupsCollection = firestore.collection("groups")
    private val usersCollection = firestore.collection("users")

    /**
     * Faz upload do comprovante de pagamento
     */
    suspend fun uploadReceipt(groupId: String, imageUri: Uri): Result<String> {
        return try {
            val filename = "receipt_${System.currentTimeMillis()}.jpg"
            val ref = storage.reference.child("groups/$groupId/cashbox_receipts/$filename")

            ref.putFile(imageUri).await()
            val downloadUrl = ref.downloadUrl.await()

            Result.success(downloadUrl.toString())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Adiciona uma nova entrada no caixa
     */
    suspend fun addEntry(groupId: String, entry: CashboxEntry, photoUri: Uri? = null): Result<String> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar permissão
            val memberDoc = groupsCollection.document(groupId)
                .collection("members").document(userId).get().await()

            val role = memberDoc.getString("role")
            if (role != GroupMemberRole.ADMIN.name && role != GroupMemberRole.OWNER.name) {
                return Result.failure(Exception("Apenas administradores podem lançar no caixa"))
            }

            // Upload da foto se houver
            val finalEntry = if (photoUri != null) {
                val uploadResult = uploadReceipt(groupId, photoUri)
                if (uploadResult.isSuccess) {
                    entry.copy(receiptUrl = uploadResult.getOrNull())
                } else {
                    return Result.failure(uploadResult.exceptionOrNull()!!)
                }
            } else {
                entry
            }

            val userName = memberDoc.getString("user_name") ?: ""

            val entryRef = groupsCollection.document(groupId).collection("cashbox").document()
            val summaryRef = groupsCollection.document(groupId).collection("cashbox_summary").document("current")

            if (finalEntry.amount <= 0) {
                return Result.failure(Exception("O valor deve ser maior que zero"))
            }

            val entryWithData = finalEntry.copy(
                id = entryRef.id,
                createdById = userId,
                createdByName = userName,
                createdAt = Date(),
                referenceDate = finalEntry.referenceDate ?: Date(),
                status = CashboxAppStatus.ACTIVE.name
            )

            firestore.runTransaction { transaction ->
                // 1. Buscar sumário atual
                val summary = transaction.get(summaryRef).toObject(CashboxSummary::class.java) 
                    ?: CashboxSummary()

                // 2. Calcular novos valores
                val amount = entryWithData.amount
                val newSummary = if (entryWithData.isIncome()) {
                    summary.copy(
                        balance = summary.balance + amount,
                        totalIncome = summary.totalIncome + amount,
                        lastEntryAt = entryWithData.createdAt,
                        entryCount = summary.entryCount + 1
                    )
                } else {
                    summary.copy(
                        balance = summary.balance - amount,
                        totalExpense = summary.totalExpense + amount,
                        lastEntryAt = entryWithData.createdAt,
                        entryCount = summary.entryCount + 1
                    )
                }

                // 3. Atualizar resumo
                transaction.set(summaryRef, newSummary)

                // 4. Adicionar entrada
                transaction.set(entryRef, entryWithData)

                entryRef.id
            }.await()

            Result.success(entryRef.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca o resumo do caixa de um grupo
     */
    suspend fun getSummary(groupId: String): Result<CashboxSummary> {
        return try {
            val doc = groupsCollection.document(groupId)
                .collection("cashbox_summary")
                .document("current")
                .get()
                .await()

            if (doc.exists()) {
                val summary = doc.toObject(CashboxSummary::class.java)
                    ?: CashboxSummary()
                Result.success(summary)
            } else {
                Result.success(CashboxSummary())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Observa o resumo do caixa em tempo real
     */
    fun getSummaryFlow(groupId: String): Flow<CashboxSummary> = callbackFlow {
        val listener = groupsCollection.document(groupId)
            .collection("cashbox_summary")
            .document("current")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(CashboxSummary())
                    return@addSnapshotListener
                }

                val summary = snapshot?.toObject(CashboxSummary::class.java)
                    ?: CashboxSummary()
                trySend(summary)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Busca histórico do caixa
     */
    suspend fun getHistory(groupId: String, limit: Int = 50): Result<List<CashboxEntry>> {
        return try {
            val snapshot = groupsCollection.document(groupId)
                .collection("cashbox")
                .whereEqualTo("status", CashboxAppStatus.ACTIVE.name)
                .orderBy("created_at", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val entries = snapshot.toObjects(CashboxEntry::class.java)
            Result.success(entries)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Observa histórico do caixa em tempo real
     */
    fun getHistoryFlow(groupId: String, limit: Int = 50): Flow<List<CashboxEntry>> = callbackFlow {
        val listener = groupsCollection.document(groupId)
            .collection("cashbox")
            .whereEqualTo("status", CashboxAppStatus.ACTIVE.name)
            .orderBy("created_at", Query.Direction.DESCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val entries = snapshot?.toObjects(CashboxEntry::class.java) ?: emptyList()
                trySend(entries)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Busca histórico com filtros
     */
    suspend fun getHistoryFiltered(
        groupId: String,
        filter: CashboxFilter,
        limit: Int = 50
    ): Result<List<CashboxEntry>> {
        return try {
            var query: Query = groupsCollection.document(groupId)
                .collection("cashbox")
                .whereEqualTo("status", CashboxAppStatus.ACTIVE.name)

            // Aplicar filtro de tipo
            filter.type?.let {
                query = query.whereEqualTo("type", it.name)
            }

            // Aplicar filtro de categoria
            filter.category?.let {
                query = query.whereEqualTo("category", it.name)
            }

            // Aplicar filtro de jogador
            filter.playerId?.let {
                query = query.whereEqualTo("player_id", it)
            }

            // Aplicar filtro de data inicial
            filter.startDate?.let {
                query = query.whereGreaterThanOrEqualTo("reference_date", it)
            }

            // Aplicar filtro de data final
            filter.endDate?.let {
                query = query.whereLessThanOrEqualTo("reference_date", it)
            }

            // Determinar campo de ordenação
            val orderByField = if (filter.startDate != null || filter.endDate != null) {
                "reference_date"
            } else {
                "created_at"
            }

            val snapshot = query
                .orderBy(orderByField, Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val entries = snapshot.toObjects(CashboxEntry::class.java)
            Result.success(entries)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca entradas por mês
     */
    suspend fun getEntriesByMonth(
        groupId: String,
        year: Int,
        month: Int
    ): Result<List<CashboxEntry>> {
        return try {
            val calendar = java.util.Calendar.getInstance()
            calendar.set(year, month - 1, 1, 0, 0, 0)
            val startDate = calendar.time

            calendar.set(year, month, 1, 0, 0, 0)
            val endDate = calendar.time

            val snapshot = groupsCollection.document(groupId)
                .collection("cashbox")
                .whereEqualTo("status", CashboxAppStatus.ACTIVE.name)
                .whereGreaterThanOrEqualTo("reference_date", startDate)
                .whereLessThan("reference_date", endDate)
                .orderBy("reference_date", Query.Direction.DESCENDING)
                .get()
                .await()

            val entries = snapshot.toObjects(CashboxEntry::class.java)
            Result.success(entries)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca uma entrada específica
     */
    suspend fun getEntryById(groupId: String, entryId: String): Result<CashboxEntry> {
        return try {
            val doc = groupsCollection.document(groupId)
                .collection("cashbox")
                .document(entryId)
                .get()
                .await()

            if (doc.exists()) {
                val entry = doc.toObject(CashboxEntry::class.java)
                    ?: return Result.failure(Exception("Erro ao converter entrada"))
                Result.success(entry)
            } else {
                Result.failure(Exception("Entrada não encontrada"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Deleta uma entrada (com recálculo do saldo)
     */
    suspend fun deleteEntry(groupId: String, entryId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se é admin do grupo
            val memberDoc = groupsCollection.document(groupId)
                .collection("members")
                .document(userId)
                .get()
                .await()

            if (!memberDoc.exists()) {
                return Result.failure(Exception("Você não é membro deste grupo"))
            }

            val member = memberDoc.toObject(GroupMember::class.java)
            if (member?.getRoleEnum() != GroupMemberRole.OWNER) {
                return Result.failure(Exception("Apenas o dono do grupo pode estornar entradas"))
            }

            // Buscar entrada para saber o valor
            val entryDoc = groupsCollection.document(groupId)
                .collection("cashbox")
                .document(entryId)
                .get()
                .await()

            if (!entryDoc.exists()) {
                return Result.failure(Exception("Entrada não encontrada"))
            }

            val entry = entryDoc.toObject(CashboxEntry::class.java)
                ?: return Result.failure(Exception("Erro ao converter entrada"))

            if (entry.status == CashboxAppStatus.VOIDED.name) {
                return Result.failure(Exception("Esta entrada já foi estornada"))
            }

            // Executar transação
            firestore.runTransaction { transaction ->
                // 1. Atualizar resumo
                val summaryRef = groupsCollection.document(groupId)
                    .collection("cashbox_summary")
                    .document("current")

                val summaryDoc = transaction.get(summaryRef)
                val currentSummary = if (summaryDoc.exists()) {
                    summaryDoc.toObject(CashboxSummary::class.java) ?: CashboxSummary()
                } else {
                    CashboxSummary()
                }

                val amountDelta = if (entry.isIncome()) -entry.amount else entry.amount
                val newBalance = currentSummary.balance + amountDelta
                val newTotalIncome = if (entry.isIncome()) {
                    currentSummary.totalIncome - entry.amount
                } else {
                    currentSummary.totalIncome
                }
                val newTotalExpense = if (entry.isExpense()) {
                    currentSummary.totalExpense - entry.amount
                } else {
                    currentSummary.totalExpense
                }

                transaction.set(summaryRef, mapOf(
                    "balance" to newBalance,
                    "total_income" to newTotalIncome,
                    "total_expense" to newTotalExpense,
                    "last_entry_at" to FieldValue.serverTimestamp(),
                    "entry_count" to (currentSummary.entryCount - 1).coerceAtLeast(0)
                ))

                // 2. Marcar como cancelada (Soft Delete)
                val entryRef = groupsCollection.document(groupId)
                    .collection("cashbox")
                    .document(entryId)
                transaction.update(entryRef, mapOf(
                    "status" to CashboxAppStatus.VOIDED.name,
                    "voided_at" to FieldValue.serverTimestamp(),
                    "voided_by" to userId
                ))
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Cria entrada de mensalidade para um jogador
     */
    suspend fun addMonthlyFee(
        groupId: String,
        playerId: String,
        playerName: String,
        amount: Double,
        referenceMonth: Date,
        description: String = ""
    ): Result<String> {
        val entry = CashboxEntry(
            type = CashboxEntryType.INCOME.name,
            category = CashboxCategory.MONTHLY_FEE.name,
            amount = amount,
            description = description.ifEmpty { "Mensalidade - $playerName" },
            playerId = playerId,
            playerName = playerName,
            referenceDate = referenceMonth
        )
        return addEntry(groupId, entry)
    }

    /**
     * Cria entrada de aluguel de quadra
     */
    suspend fun addFieldRental(
        groupId: String,
        amount: Double,
        description: String,
        gameId: String? = null,
        referenceDate: Date = Date()
    ): Result<String> {
        val entry = CashboxEntry(
            type = CashboxEntryType.EXPENSE.name,
            category = CashboxCategory.FIELD_RENTAL.name,
            amount = amount,
            description = description,
            gameId = gameId,
            referenceDate = referenceDate
        )
        return addEntry(groupId, entry)
    }

    /**
     * Calcula totais por categoria
     */
    suspend fun getTotalsByCategory(groupId: String): Result<Map<CashboxCategory, Double>> {
        return try {
            val entries = getHistory(groupId, 1000).getOrDefault(emptyList())

            val totals = entries.groupBy { it.getCategoryEnum() }
                .mapValues { (_, entries) -> entries.sumOf { it.amount } }

            Result.success(totals)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Calcula totais por jogador (mensalidades)
     */
    suspend fun getTotalsByPlayer(groupId: String): Result<Map<String, Double>> {
        return try {
            val entries = getHistory(groupId, 1000).getOrDefault(emptyList())
                .filter { !it.playerId.isNullOrEmpty() }

            val totals = entries.groupBy { it.playerId!! }
                .mapValues { (_, entries) -> entries.sumOf { it.amount } }

            Result.success(totals)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Recalcula o saldo do caixa (para correção)
     */
    suspend fun recalculateBalance(groupId: String): Result<CashboxSummary> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se é admin do grupo
            val memberDoc = groupsCollection.document(groupId)
                .collection("members")
                .document(userId)
                .get()
                .await()

            val member = memberDoc.toObject(GroupMember::class.java)
            if (member?.isAdmin() != true) {
                return Result.failure(Exception("Apenas administradores podem recalcular o saldo"))
            }

            // Buscar todas as entradas
            // WARN: Esta operacao e custosa. Use com cuidado.
            // Idealmente deveria usar Aggregation queries (count, sum) do Firestore quando disponivel
            val entriesSnapshot = groupsCollection.document(groupId)
                .collection("cashbox")
                .whereEqualTo("status", CashboxAppStatus.ACTIVE.name)
                .get()
                .await()

            var totalIncome = 0.0
            var totalExpense = 0.0
            var lastEntryDate: Date? = null

            // Calcular totais em memoria (melhor que ler 10k docs individualmente, snapshot le em batch)
            val entries = entriesSnapshot.toObjects(CashboxEntry::class.java)
            
            // Ordenar para pegar a data mais recente corretamente
            val sortedEntries = entries.sortedByDescending { it.createdAt }

            sortedEntries.forEach { entry ->
                // Status ja filtrado na query, mas verificamos por segurança se mudou algo
                if (entry.status == CashboxAppStatus.ACTIVE.name) {
                    if (entry.isIncome()) {
                        totalIncome += entry.amount
                    } else {
                        totalExpense += entry.amount
                    }
                }
            }
            
            lastEntryDate = sortedEntries.firstOrNull()?.createdAt

            val balance = totalIncome - totalExpense

            // Atualizar resumo
            val summary = CashboxSummary(
                balance = balance,
                totalIncome = totalIncome,
                totalExpense = totalExpense,
                lastEntryAt = lastEntryDate,
                entryCount = entries.size
            )

            groupsCollection.document(groupId)
                .collection("cashbox_summary")
                .document("current")
                .set(summary)
                .await()

            Result.success(summary)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
