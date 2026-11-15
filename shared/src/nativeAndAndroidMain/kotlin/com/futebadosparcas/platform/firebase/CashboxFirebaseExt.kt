package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import dev.gitlive.firebase.firestore.DocumentSnapshot
import dev.gitlive.firebase.firestore.Timestamp

/**
 * Extensão para converter DocumentSnapshot para CashboxEntry.
 *
 * NOTA: Os campos de data no Firestore podem ser Timestamp ou Long (millis),
 * dependendo de como foram salvos. Esta função trata ambos os casos.
 *
 * BUGFIX_CASHBOX_SERIALIZABLE (#1615): campos Instant migrados para Long (epoch ms)
 * para compatibilidade com kotlinx.serialization sem dependências extras.
 */
internal fun DocumentSnapshot.toCashboxEntryOrNull(): CashboxEntry? {
    if (!exists) return null

    return try {
        // Fase 1 (compat read) BUGFIX_CASHBOX_DOUBLE_AND_TIMESTAMP:
        // Aceita amount_cents (Long, novo) OU amount (Double, legacy).
        // Quando ambos presentes, prefere amount_cents (autoritativo).
        val amountCents = get<Long?>("amount_cents")
        val amount = amountCents?.let { it / 100.0 }
            ?: get<Double?>("amount")
            ?: 0.0
        CashboxEntry(
            id = id,
            type = get<String?>("type") ?: CashboxEntryType.INCOME.name,
            category = get<String?>("category") ?: CashboxCategory.OTHER.name,
            customCategory = get<String?>("custom_category"),
            amount = amount,
            description = get<String?>("description") ?: "",
            createdById = get<String?>("created_by_id") ?: "",
            createdByName = get<String?>("created_by_name") ?: "",
            referenceDate = getDateFieldAsEpochMs("reference_date")
                ?: kotlinx.datetime.Clock.System.now().toEpochMilliseconds(),
            createdAt = getDateFieldAsEpochMs("created_at"),
            playerId = get<String?>("player_id"),
            playerName = get<String?>("player_name"),
            gameId = get<String?>("game_id"),
            receiptUrl = get<String?>("receipt_url"),
            status = get<String?>("status") ?: CashboxAppStatus.ACTIVE.name,
            voidedAt = getDateFieldAsEpochMs("voided_at"),
            voidedBy = get<String?>("voided_by")
        )
    } catch (e: Exception) {
        println("CashboxFirebaseExt: Erro ao converter documento $id: ${e.message}")
        null
    }
}

/**
 * Converte campo de data do Firestore para Long (epoch ms).
 * Suporta Timestamp (preferido), Long (millis), String ISO-8601 ou String numérica legacy.
 *
 * Fase 1 BUGFIX_CASHBOX_DOUBLE_AND_TIMESTAMP: aceita Instant.toString() legacy.
 */
private fun DocumentSnapshot.getDateFieldAsEpochMs(field: String): Long? {
    return try {
        val value = getScalar(field)
        when (value) {
            is Timestamp -> value.seconds * 1000L + value.nanoseconds / 1_000_000L
            is Number -> value.toLong()
            is String -> {
                // String pode ser: 1) millis numérico, 2) ISO-8601 (Instant.toString())
                value.toLongOrNull()
                    ?: runCatching {
                        kotlinx.datetime.Instant.parse(value).toEpochMilliseconds()
                    }.getOrNull()
            }
            else -> null
        }
    } catch (e: Exception) {
        // Log silencioso, retorna null
        null
    }
}

/**
 * Extensão para converter DocumentSnapshot para CashboxSummary.
 */
internal fun DocumentSnapshot.toCashboxSummaryOrNull(): CashboxSummary? {
    if (!exists) return null

    return try {
        CashboxSummary(
            balance = get<Double?>("balance") ?: 0.0,
            totalIncome = get<Double?>("total_income") ?: 0.0,
            totalExpense = get<Double?>("total_expense") ?: 0.0,
            lastEntryAt = getDateFieldAsEpochMs("last_entry_at"),
            entryCount = get<Long?>("entry_count")?.toInt() ?: 0
        )
    } catch (e: Exception) {
        println("CashboxFirebaseExt: Erro ao converter summary: ${e.message}")
        null
    }
}
