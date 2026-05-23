package com.futebadosparcas.data.model

import com.futebadosparcas.domain.model.CashboxCategory as KmpCashboxCategory
import com.futebadosparcas.domain.model.CashboxEntryType as KmpCashboxEntryType
import com.futebadosparcas.data.model.CashboxCategory as AndroidCashboxCategory
import com.futebadosparcas.data.model.CashboxEntryType as AndroidCashboxEntryType
import java.util.Date
import com.futebadosparcas.domain.model.CashboxEntry as KmpCashboxEntry
import com.futebadosparcas.domain.model.CashboxFilter as KmpCashboxFilter
import com.futebadosparcas.domain.model.CashboxSummary as KmpCashboxSummary

typealias AndroidCashboxEntry = CashboxEntry
typealias AndroidCashboxSummary = CashboxSummary
typealias AndroidCashboxFilter = CashboxFilter

fun AndroidCashboxEntry.toKmpCashboxEntry(): KmpCashboxEntry = KmpCashboxEntry(
    id = this.id,
    type = this.type,
    category = this.category,
    customCategory = this.customCategory,
    amount = this.amount,
    description = this.description,
    createdById = this.createdById,
    createdByName = this.createdByName,
    referenceDate = this.referenceDate.time,
    createdAt = this.createdAt?.time,
    playerId = this.playerId,
    playerName = this.playerName,
    gameId = this.gameId,
    receiptUrl = this.receiptUrl,
    status = this.status,
    voidedAt = this.voidedAt?.time,
    voidedBy = this.voidedBy
)

fun KmpCashboxEntry.toAndroidCashboxEntry(): AndroidCashboxEntry = AndroidCashboxEntry(
    id = this.id,
    type = this.type,
    category = this.category,
    customCategory = this.customCategory,
    amount = this.amount,
    description = this.description,
    createdById = this.createdById,
    createdByName = this.createdByName,
    referenceDate = Date(this.referenceDate),
    createdAt = this.createdAt?.let { Date(it) },
    playerId = this.playerId,
    playerName = this.playerName,
    gameId = this.gameId,
    receiptUrl = this.receiptUrl,
    status = this.status,
    voidedAt = this.voidedAt?.let { Date(it) },
    voidedBy = this.voidedBy
)

fun List<KmpCashboxEntry>.toAndroidCashboxEntries(): List<AndroidCashboxEntry> =
    this.map { it.toAndroidCashboxEntry() }

fun AndroidCashboxSummary.toKmpCashboxSummary(): KmpCashboxSummary = KmpCashboxSummary(
    balance = this.balance,
    totalIncome = this.totalIncome,
    totalExpense = this.totalExpense,
    lastEntryAt = this.lastEntryAt?.time,
    entryCount = this.entryCount
)

fun KmpCashboxSummary.toAndroidCashboxSummary(): AndroidCashboxSummary = AndroidCashboxSummary(
    balance = this.balance,
    totalIncome = this.totalIncome,
    totalExpense = this.totalExpense,
    lastEntryAt = this.lastEntryAt?.let { Date(it) },
    entryCount = this.entryCount
)

fun AndroidCashboxFilter.toKmpCashboxFilter(): KmpCashboxFilter = KmpCashboxFilter(
    type = this.type,
    category = this.category,
    startDate = this.startDate?.time,
    endDate = this.endDate?.time,
    playerId = this.playerId
)

fun KmpCashboxFilter.toAndroidCashboxFilter(): AndroidCashboxFilter = AndroidCashboxFilter(
    type = this.type,
    category = this.category,
    startDate = this.startDate?.let { Date(it) },
    endDate = this.endDate?.let { Date(it) },
    playerId = this.playerId
)

fun createAndroidCashboxEntry(
    type: String,
    category: String,
    customCategory: String? = null,
    amount: Double,
    description: String,
    createdById: String,
    createdByName: String,
    playerId: String? = null,
    playerName: String? = null,
    gameId: String? = null,
    referenceDate: Date = Date()
): AndroidCashboxEntry = AndroidCashboxEntry(
    type = type,
    category = category,
    customCategory = customCategory,
    amount = amount,
    description = description,
    createdById = createdById,
    createdByName = createdByName,
    playerId = playerId,
    playerName = playerName,
    gameId = gameId,
    referenceDate = referenceDate
)
