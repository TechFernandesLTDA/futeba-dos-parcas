package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import kotlinx.datetime.Instant

/**
 * Extensão para converter DocumentSnapshot para CashboxEntry.
 *
 * NOTA: Os campos de data no Firestore podem ser Timestamp ou Long (millis),
 * dependendo de como foram salvos. Esta função trata ambos os casos.
 */
internal fun DocumentSnapshot.toCashboxEntryOrNull(): CashboxEntry? {
    if (!exists()) return null

    return try {
        CashboxEntry(
            id = id,
            type = getString("type") ?: CashboxEntryType.INCOME.name,
            category = getString("category") ?: CashboxCategory.OTHER.name,
            customCategory = getString("custom_category"),
            amount = getDouble("amount") ?: 0.0,
            description = getString("description") ?: "",
            createdById = getString("created_by_id") ?: "",
            createdByName = getString("created_by_name") ?: "",
            referenceDate = getDateFieldAsInstant("reference_date")
                ?: Instant.fromEpochMilliseconds(System.currentTimeMillis()),
            createdAt = getDateFieldAsInstant("created_at"),
            playerId = getString("player_id"),
            playerName = getString("player_name"),
            gameId = getString("game_id"),
            receiptUrl = getString("receipt_url"),
            status = getString("status") ?: CashboxAppStatus.ACTIVE.name,
            voidedAt = getDateFieldAsInstant("voided_at"),
            voidedBy = getString("voided_by")
        )
    } catch (e: Exception) {
        android.util.Log.e("CashboxFirebaseExt", "Erro ao converter documento ${id}: ${e.message}")
        null
    }
}

/**
 * Converte campo de data do Firestore para Instant.
 * Suporta Timestamp (Date do Firebase), Long (millis) ou null.
 */
private fun DocumentSnapshot.getDateFieldAsInstant(field: String): Instant? {
    return try {
        // Tenta como Timestamp primeiro (formato padrão do Firestore)
        val timestamp = getTimestamp(field)
        if (timestamp != null) {
            return Instant.fromEpochMilliseconds(timestamp.toDate().time)
        }

        // Fallback: tenta como Long (milliseconds)
        val longValue = getLong(field)
        if (longValue != null) {
            return Instant.fromEpochMilliseconds(longValue)
        }

        null
    } catch (e: Exception) {
        // Log silencioso, retorna null
        null
    }
}

/**
 * Extensão para converter DocumentSnapshot para CashboxSummary.
 */
internal fun DocumentSnapshot.toCashboxSummaryOrNull(): CashboxSummary? {
    if (!exists()) return null

    return try {
        CashboxSummary(
            balance = getDouble("balance") ?: 0.0,
            totalIncome = getDouble("total_income") ?: 0.0,
            totalExpense = getDouble("total_expense") ?: 0.0,
            lastEntryAt = getDateFieldAsInstant("last_entry_at"),
            entryCount = getLong("entry_count")?.toInt() ?: 0
        )
    } catch (e: Exception) {
        android.util.Log.e("CashboxFirebaseExt", "Erro ao converter summary: ${e.message}")
        null
    }
}
