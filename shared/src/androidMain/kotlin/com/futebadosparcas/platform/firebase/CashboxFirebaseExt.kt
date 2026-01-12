package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import com.google.firebase.firestore.DocumentSnapshot
import kotlinx.datetime.Instant

/**
 * Extensão para converter DocumentSnapshot para CashboxEntry.
 */
internal fun DocumentSnapshot.toCashboxEntryOrNull(): CashboxEntry? {
    if (!exists()) return null

    return CashboxEntry(
        id = id,
        type = getString("type") ?: CashboxEntryType.INCOME.name,
        category = getString("category") ?: CashboxCategory.OTHER.name,
        customCategory = getString("custom_category"),
        amount = getDouble("amount") ?: 0.0,
        description = getString("description") ?: "",
        createdById = getString("created_by_id") ?: "",
        createdByName = getString("created_by_name") ?: "",
        referenceDate = Instant.fromEpochMilliseconds(
            getLong("reference_date") ?: System.currentTimeMillis()
        ),
        createdAt = getLong("created_at")?.let {
            Instant.fromEpochMilliseconds(it)
        },
        playerId = getString("player_id"),
        playerName = getString("player_name"),
        gameId = getString("game_id"),
        receiptUrl = getString("receipt_url"),
        status = getString("status") ?: CashboxAppStatus.ACTIVE.name,
        voidedAt = getLong("voided_at")?.let {
            Instant.fromEpochMilliseconds(it)
        },
        voidedBy = getString("voided_by")
    )
}

/**
 * Extensão para converter DocumentSnapshot para CashboxSummary.
 */
internal fun DocumentSnapshot.toCashboxSummaryOrNull(): CashboxSummary? {
    if (!exists()) return null

    return CashboxSummary(
        balance = getDouble("balance") ?: 0.0,
        totalIncome = getDouble("total_income") ?: 0.0,
        totalExpense = getDouble("total_expense") ?: 0.0,
        lastEntryAt = getLong("last_entry_at")?.let {
            Instant.fromEpochMilliseconds(it)
        },
        entryCount = getLong("entry_count")?.toInt() ?: 0
    )
}
