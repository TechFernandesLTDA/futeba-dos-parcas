package com.futebadosparcas.data.model

import com.futebadosparcas.domain.model.CashboxCategory as KmpCashboxCategory
import com.futebadosparcas.domain.model.CashboxEntryType as KmpCashboxEntryType
import com.futebadosparcas.data.model.CashboxCategory as AndroidCashboxCategory
import com.futebadosparcas.data.model.CashboxEntryType as AndroidCashboxEntryType
import kotlinx.datetime.Instant
import java.util.Date
import com.futebadosparcas.domain.model.CashboxEntry as KmpCashboxEntry
import com.futebadosparcas.domain.model.CashboxFilter as KmpCashboxFilter
import com.futebadosparcas.domain.model.CashboxSummary as KmpCashboxSummary

/**
 * Type aliases para distinguir models Android (Firebase) de models KMP (domain)
 */
typealias AndroidCashboxEntry = CashboxEntry
typealias AndroidCashboxSummary = CashboxSummary
typealias AndroidCashboxFilter = CashboxFilter

/**
 * Extensões para converter Date (Java) ↔ Instant (Kotlin)
 * Nota: Renomeado para evitar conflito com java.util.Date.toInstant() nativo
 */
fun Date.toKotlinxInstant(): Instant = Instant.fromEpochMilliseconds(this.time)
fun Instant.toJavaDate(): Date = Date(this.toEpochMilliseconds())

/**
 * Converter AndroidCashboxEntry (Firebase/Date) → KmpCashboxEntry (Domain/Instant)
 */
fun AndroidCashboxEntry.toKmpCashboxEntry(): KmpCashboxEntry = KmpCashboxEntry(
    id = this.id,
    type = this.type,
    category = this.category,
    customCategory = this.customCategory,
    amount = this.amount,
    description = this.description,
    createdById = this.createdById,
    createdByName = this.createdByName,
    referenceDate = this.referenceDate.toKotlinxInstant(),
    createdAt = this.createdAt?.toKotlinxInstant(),
    playerId = this.playerId,
    playerName = this.playerName,
    gameId = this.gameId,
    receiptUrl = this.receiptUrl,
    status = this.status,
    voidedAt = this.voidedAt?.toKotlinxInstant(),
    voidedBy = this.voidedBy
)

/**
 * Converter KmpCashboxEntry (Domain/Instant) → AndroidCashboxEntry (Firebase/Date)
 */
fun KmpCashboxEntry.toAndroidCashboxEntry(): AndroidCashboxEntry = AndroidCashboxEntry(
    id = this.id,
    type = this.type,
    category = this.category,
    customCategory = this.customCategory,
    amount = this.amount,
    description = this.description,
    createdById = this.createdById,
    createdByName = this.createdByName,
    referenceDate = this.referenceDate.toJavaDate(),
    createdAt = this.createdAt?.toJavaDate(),
    playerId = this.playerId,
    playerName = this.playerName,
    gameId = this.gameId,
    receiptUrl = this.receiptUrl,
    status = this.status,
    voidedAt = this.voidedAt?.toJavaDate(),
    voidedBy = this.voidedBy
)

/**
 * Converter lista de KmpCashboxEntry → AndroidCashboxEntry
 */
fun List<KmpCashboxEntry>.toAndroidCashboxEntries(): List<AndroidCashboxEntry> =
    this.map { it.toAndroidCashboxEntry() }

/**
 * Converter AndroidCashboxSummary (Firebase/Date) → KmpCashboxSummary (Domain/Instant)
 */
fun AndroidCashboxSummary.toKmpCashboxSummary(): KmpCashboxSummary = KmpCashboxSummary(
    balance = this.balance,
    totalIncome = this.totalIncome,
    totalExpense = this.totalExpense,
    lastEntryAt = this.lastEntryAt?.toKotlinxInstant(),
    entryCount = this.entryCount
)

/**
 * Converter KmpCashboxSummary (Domain/Instant) → AndroidCashboxSummary (Firebase/Date)
 */
fun KmpCashboxSummary.toAndroidCashboxSummary(): AndroidCashboxSummary = AndroidCashboxSummary(
    balance = this.balance,
    totalIncome = this.totalIncome,
    totalExpense = this.totalExpense,
    lastEntryAt = this.lastEntryAt?.toJavaDate(),
    entryCount = this.entryCount
)

/**
 * Converter AndroidCashboxFilter (Date) → KmpCashboxFilter (Instant)
 * Nota: AndroidCashboxFilter já usa enums do domain, só precisa converter Date→Instant
 */
fun AndroidCashboxFilter.toKmpCashboxFilter(): KmpCashboxFilter = KmpCashboxFilter(
    type = this.type,
    category = this.category,
    startDate = this.startDate?.toKotlinxInstant(),
    endDate = this.endDate?.toKotlinxInstant(),
    playerId = this.playerId
)

/**
 * Converter KmpCashboxFilter (Instant) → AndroidCashboxFilter (Date)
 * Nota: AndroidCashboxFilter já usa enums do domain, só precisa converter Instant→Date
 */
fun KmpCashboxFilter.toAndroidCashboxFilter(): AndroidCashboxFilter = AndroidCashboxFilter(
    type = this.type,
    category = this.category,
    startDate = this.startDate?.toJavaDate(),
    endDate = this.endDate?.toJavaDate(),
    playerId = this.playerId
)

/**
 * Helper para criar AndroidCashboxEntry a partir de params primitivos
 * Usado no ViewModel quando criando novas entries antes de salvar
 */
fun createAndroidCashboxEntry(
    type: String,
    category: String,
    customCategory: String? = null,
    amount: Double,
    description: String,
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
    playerId = playerId,
    playerName = playerName,
    gameId = gameId,
    referenceDate = referenceDate
)
