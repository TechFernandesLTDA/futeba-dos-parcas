package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.FirebaseAuth
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.*
import dev.gitlive.firebase.functions.functions
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toInstant

internal class FirebaseFinanceDataSource(
    private val firestore: FirebaseFirestore = Firebase.firestore,
    private val auth: FirebaseAuth = Firebase.auth
) {
    // ========== BATCH OPERATIONS ==========

    suspend fun executeBatch(operations: List<BatchOperation>): Result<Unit> {
        return try {
            val chunks = operations.chunked(450)

            chunks.forEach { chunk ->
                val batch = firestore.batch()

                chunk.forEach { operation ->
                    when (operation) {
                        is BatchOperation.Set -> {
                            val ref = firestore.collection(operation.collection).document(operation.documentId)
                            batch.set(ref, operation.data)
                        }
                        is BatchOperation.Update -> {
                            val ref = firestore.collection(operation.collection).document(operation.documentId)
                            batch.update(ref, operation.updates)
                        }
                        is BatchOperation.Delete -> {
                            val ref = firestore.collection(operation.collection).document(operation.documentId)
                            batch.delete(ref)
                        }
                    }
                }

                batch.commit()
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getLivePlayerStats(gameId: String): Result<List<LivePlayerStats>> {
        return try {
            val snapshot = firestore.collection("live_player_stats")
                .where { "game_id" equalTo gameId }
                .get()

            val stats = snapshot.documents.mapNotNull { doc ->
                LivePlayerStats(
                    id = doc.id,
                    gameId = doc.get<String?>("game_id") ?: "",
                    playerId = doc.get<String?>("player_id") ?: "",
                    playerName = doc.get<String?>("player_name") ?: "",
                    teamId = doc.get<String?>("team_id") ?: "",
                    position = doc.get<String?>("position") ?: "LINE",
                    goals = doc.get<Long?>("goals")?.toInt() ?: 0,
                    assists = doc.get<Long?>("assists")?.toInt() ?: 0,
                    saves = doc.get<Long?>("saves")?.toInt() ?: 0,
                    yellowCards = doc.get<Long?>("yellow_cards")?.toInt() ?: 0,
                    redCards = doc.get<Long?>("red_cards")?.toInt() ?: 0,
                    isPlaying = doc.get<Boolean?>("is_playing") ?: true
                )
            }

            Result.success(stats)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getLivePlayerStatsFlow(gameId: String): Flow<Result<List<LivePlayerStats>>> {
        return firestore.collection("live_player_stats")
            .where { "game_id" equalTo gameId }
            .snapshots()
            .map { snapshot ->
                val stats = snapshot.documents.mapNotNull { doc ->
                    LivePlayerStats(
                        id = doc.id,
                        gameId = doc.get<String?>("game_id") ?: "",
                        playerId = doc.get<String?>("player_id") ?: "",
                        playerName = doc.get<String?>("player_name") ?: "",
                        teamId = doc.get<String?>("team_id") ?: "",
                        position = doc.get<String?>("position") ?: "LINE",
                        goals = doc.get<Long?>("goals")?.toInt() ?: 0,
                        assists = doc.get<Long?>("assists")?.toInt() ?: 0,
                        saves = doc.get<Long?>("saves")?.toInt() ?: 0,
                        yellowCards = doc.get<Long?>("yellow_cards")?.toInt() ?: 0,
                        redCards = doc.get<Long?>("red_cards")?.toInt() ?: 0,
                        isPlaying = doc.get<Boolean?>("is_playing") ?: true
                    )
                }
                Result.success(stats)
            }
            .catch { e -> emit(Result.failure(e)) }
    }

    suspend fun finishGame(gameId: String): Result<Unit> {
        return try {
            firestore.collection("live_scores")
                .document(gameId)
                .update(mapOf("finished_at" to FieldValue.serverTimestamp))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun clearAllLiveGameData(): Result<Unit> {
        return try {
            // Buscar documentos de cada coleção
            val scoresSnapshot = firestore.collection("live_scores").limit(500).get()
            val eventsSnapshot = firestore.collection("game_events").limit(500).get()
            val liveStatsSnapshot = firestore.collection("live_player_stats").limit(500).get()

            // Juntar todos os docs e processar em chunks de 450 (limite do batch é 500)
            val allDocs = scoresSnapshot.documents + eventsSnapshot.documents + liveStatsSnapshot.documents
            allDocs.chunked(450).forEach { chunk ->
                val batch = firestore.batch()
                chunk.forEach { doc -> batch.delete(doc.reference) }
                batch.commit()
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== PAYMENTS ==========

    suspend fun createPayment(payment: Payment): Result<Payment> {
        return try {
            val paymentRef = if (payment.id.isEmpty()) firestore.collection(COLLECTION_PAYMENTS).document
            else firestore.collection(COLLECTION_PAYMENTS).document(payment.id)
            val paymentData = mapOf(
                "id" to paymentRef.id, "user_id" to payment.userId, "game_id" to (payment.gameId ?: ""),
                "schedule_id" to (payment.scheduleId ?: ""), "type" to payment.type.name,
                "amount" to payment.amount, "status" to payment.status.name,
                "payment_method" to (payment.paymentMethod?.name ?: ""), "due_date" to payment.dueDate,
                // paid_at: usa serverTimestamp se já pago sem timestamp local; 0L se ainda não pago (issue #878)
                "paid_at" to (payment.paidAt?.let { if (it == 0L) 0L else it } ?: 0L),
                "pix_key" to (payment.pixKey ?: ""),
                "pix_qrcode" to (payment.pixQrcode ?: ""), "pix_txid" to (payment.pixTxid ?: ""),
                "receipt_url" to (payment.receiptUrl ?: ""), "notes" to (payment.notes ?: ""),
                // created_at: usa serverTimestamp para evitar clock skew do cliente (issue #878)
                "created_at" to FieldValue.serverTimestamp
            )
            paymentRef.set(paymentData)
            Result.success(payment.copy(id = paymentRef.id))
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao criar pagamento: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun confirmPayment(paymentId: String): Result<Unit> {
        return try {
            // paid_at: usa serverTimestamp para evitar clock skew do cliente (issue #878)
            firestore.collection(COLLECTION_PAYMENTS).document(paymentId)
                .update(mapOf("status" to PaymentStatus.PAID.name, "paid_at" to FieldValue.serverTimestamp))
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao confirmar pagamento: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun getPaymentsByUser(userId: String): Result<List<Payment>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_PAYMENTS)
                .where { "user_id" equalTo userId }.orderBy("created_at", Direction.DESCENDING).get()
            Result.success(snapshot.documents.mapNotNull { it.toPaymentOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar pagamentos do usuário: ${e.message}")
            Result.failure(e)
        }
    }

    // ========== CASHBOX ==========

    suspend fun uploadCashboxReceipt(groupId: String, filePath: String): Result<String> {
        return Result.failure(Exception("Upload de recibo requer URI Android — não disponível nesta plataforma"))
    }

    suspend fun addCashboxEntry(groupId: String, entry: CashboxEntry, receiptFilePath: String?): Result<String> {
        return try {
            val requestId = entry.id.trim()
            if (!requestId.matches(Regex("^[A-Za-z0-9_-]{16,128}$"))) {
                return Result.failure(Exception("requestId idempotente inválido"))
            }
            val finalEntry = if (receiptFilePath != null) {
                val up = uploadCashboxReceipt(groupId, receiptFilePath)
                if (up.isSuccess) entry.copy(receiptUrl = up.getOrNull()) else entry
            } else entry
            val response = Firebase.functions(FUNCTIONS_REGION)
                .httpsCallable("createCashboxEntry")
                .invoke(
                    mapOf(
                        "groupId" to groupId,
                        "type" to finalEntry.type,
                        "amount" to finalEntry.amount,
                        "description" to finalEntry.description,
                        "receiptUrl" to finalEntry.receiptUrl,
                        "requestId" to requestId,
                        "category" to finalEntry.category,
                        "customCategory" to finalEntry.customCategory,
                        "referenceDate" to finalEntry.referenceDate,
                        "playerId" to finalEntry.playerId,
                        "playerName" to finalEntry.playerName,
                        "gameId" to finalEntry.gameId
                    )
                )
                .data<Map<String, Any?>>()
            val entryId = response["entryId"] as? String
                ?: return Result.failure(Exception("Resposta inválida ao criar entrada"))
            Result.success(entryId)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao adicionar entrada no caixa: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun getCashboxSummary(groupId: String): Result<CashboxSummary> {
        return try {
            val doc = firestore.collection(COLLECTION_GROUPS).document(groupId)
                .collection(SUBCOLLECTION_CASHBOX_SUMMARY).document("current").get()
            Result.success(if (doc.exists) doc.toCashboxSummaryOrNull() ?: CashboxSummary() else CashboxSummary())
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar resumo do caixa: ${e.message}")
            Result.failure(e)
        }
    }

    fun getCashboxSummaryFlow(groupId: String): Flow<Result<CashboxSummary>> {
        return firestore.collection(COLLECTION_GROUPS).document(groupId)
            .collection(SUBCOLLECTION_CASHBOX_SUMMARY).document("current").snapshots()
            .map { s -> Result.success(if (s.exists) s.toCashboxSummaryOrNull() ?: CashboxSummary() else CashboxSummary()) }
            .catch { e -> emit(Result.failure(e)) }
    }

    suspend fun getCashboxHistory(groupId: String, limit: Int): Result<List<CashboxEntry>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS).document(groupId)
                .collection(SUBCOLLECTION_CASHBOX).where { "status" equalTo CashboxAppStatus.ACTIVE.name }
                .orderBy("created_at", Direction.DESCENDING).limit(limit).get()
            Result.success(snapshot.documents.mapNotNull { it.toCashboxEntryOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar histórico do caixa: ${e.message}")
            Result.failure(e)
        }
    }

    fun getCashboxHistoryFlow(groupId: String, limit: Int): Flow<Result<List<CashboxEntry>>> {
        return firestore.collection(COLLECTION_GROUPS).document(groupId)
            .collection(SUBCOLLECTION_CASHBOX).where { "status" equalTo CashboxAppStatus.ACTIVE.name }
            .orderBy("created_at", Direction.DESCENDING).limit(limit).snapshots()
            .map { s -> Result.success(s.documents.mapNotNull { it.toCashboxEntryOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    suspend fun getCashboxHistoryFiltered(groupId: String, filter: CashboxFilter, limit: Int): Result<List<CashboxEntry>> {
        return try {
            var query: Query = firestore.collection(COLLECTION_GROUPS).document(groupId)
                .collection(SUBCOLLECTION_CASHBOX).where { "status" equalTo CashboxAppStatus.ACTIVE.name }
            filter.type?.let { query = query.where { "type" equalTo it.name } }
            filter.category?.let { query = query.where { "category" equalTo it.name } }
            filter.playerId?.let { query = query.where { "player_id" equalTo it } }
            filter.startDate?.let { query = query.where { "reference_date" greaterThanOrEqualTo it.toString() } }
            filter.endDate?.let { query = query.where { "reference_date" lessThanOrEqualTo it.toString() } }
            val orderField = if (filter.startDate != null || filter.endDate != null) "reference_date" else "created_at"
            Result.success(query.orderBy(orderField, Direction.DESCENDING).limit(limit).get().documents.mapNotNull { it.toCashboxEntryOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar histórico filtrado do caixa: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun getCashboxEntriesByMonth(groupId: String, year: Int, month: Int): Result<List<CashboxEntry>> {
        return try {
            val startMillis = kotlinx.datetime.LocalDateTime(year, month, 1, 0, 0, 0).toInstant(TimeZone.currentSystemDefault()).toEpochMilliseconds()
            val ny = if (month == 12) year + 1 else year; val nm = if (month == 12) 1 else month + 1
            val endMillis = kotlinx.datetime.LocalDateTime(ny, nm, 1, 0, 0, 0).toInstant(TimeZone.currentSystemDefault()).toEpochMilliseconds()
            val snapshot = firestore.collection(COLLECTION_GROUPS).document(groupId)
                .collection(SUBCOLLECTION_CASHBOX).where { "status" equalTo CashboxAppStatus.ACTIVE.name }
                .where { "reference_date" greaterThanOrEqualTo Timestamp(startMillis / 1000, 0) }
                .where { "reference_date" lessThan Timestamp(endMillis / 1000, 0) }
                .orderBy("reference_date", Direction.DESCENDING).get()
            Result.success(snapshot.documents.mapNotNull { it.toCashboxEntryOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar entradas por mês: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun getCashboxEntryById(groupId: String, entryId: String): Result<CashboxEntry> {
        return try {
            val doc = firestore.collection(COLLECTION_GROUPS).document(groupId).collection(SUBCOLLECTION_CASHBOX).document(entryId).get()
            if (doc.exists) Result.success(doc.toCashboxEntryOrNull() ?: return Result.failure(Exception("Erro ao converter entrada")))
            else Result.failure(Exception("Entrada não encontrada"))
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar entrada por ID: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun deleteCashboxEntry(groupId: String, entryId: String): Result<Unit> {
        return try {
            Firebase.functions(FUNCTIONS_REGION)
                .httpsCallable("voidCashboxEntry")
                .invoke(mapOf("groupId" to groupId, "entryId" to entryId))
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao deletar entrada do caixa: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun recalculateCashboxBalance(groupId: String): Result<CashboxSummary> {
        return try {
            val response = Firebase.functions(FUNCTIONS_REGION)
                .httpsCallable("reconcileCashboxSummary")
                .invoke(mapOf("groupId" to groupId))
                .data<Map<String, Any?>>()
            val balance = (response["balance"] as? Number)?.toDouble() ?: 0.0
            val totalIncome = (response["totalIncome"] as? Number)?.toDouble() ?: 0.0
            val totalExpense = (response["totalExpense"] as? Number)?.toDouble() ?: 0.0
            val entryCount = (response["entryCount"] as? Number)?.toInt() ?: 0
            Result.success(
                CashboxSummary(
                    balance = balance,
                    totalIncome = totalIncome,
                    totalExpense = totalExpense,
                    entryCount = entryCount
                )
            )
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao recalcular saldo do caixa: ${e.message}")
            Result.failure(e)
        }
    }

}
