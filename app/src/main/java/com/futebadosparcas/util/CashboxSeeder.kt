package com.futebadosparcas.util

import android.content.Context
import com.futebadosparcas.R
import com.futebadosparcas.data.model.CashboxAppStatus
import com.futebadosparcas.data.model.CashboxCategory
import com.futebadosparcas.data.model.CashboxEntryType
import com.futebadosparcas.domain.model.CashboxEntry
import com.futebadosparcas.domain.repository.CashboxRepository
import java.util.Calendar
import java.util.Date
import kotlin.random.Random

class CashboxSeeder constructor(
    private val context: Context,
    private val cashboxRepository: CashboxRepository
) {

    suspend fun seedHistory(groupId: String, memberId: String, memberName: String) {
        val calendar = Calendar.getInstance()

        // Generate entries for the last 3 months
        for (i in 90 downTo 0 step 2) {
            calendar.time = Date()
            calendar.add(Calendar.DAY_OF_YEAR, -i)
            val date = calendar.time

            val isIncome = Random.nextBoolean()
            val entryType = if (isIncome) CashboxEntryType.INCOME else CashboxEntryType.EXPENSE

            val category = if (isIncome) {
                if (Random.nextBoolean()) CashboxCategory.MONTHLY_FEE else CashboxCategory.DONATION
            } else {
                if (Random.nextBoolean()) CashboxCategory.FIELD_RENTAL else CashboxCategory.EQUIPMENT
            }

            val amount = if (isIncome) {
                Random.nextDouble(20.0, 50.0)
            } else {
                Random.nextDouble(100.0, 300.0)
            }

            val description = when (category) {
                CashboxCategory.MONTHLY_FEE -> context.getString(R.string.cashbox_monthly_fee, i)
                CashboxCategory.DONATION -> context.getString(R.string.cashbox_donation)
                CashboxCategory.FIELD_RENTAL -> context.getString(R.string.cashbox_field_rental)
                CashboxCategory.EQUIPMENT -> context.getString(R.string.cashbox_equipment)
                else -> context.getString(R.string.cashbox_general_movement)
            }

            val entry = CashboxEntry(
                type = entryType.name,
                category = category.name,
                amount = amount,
                description = description,
                createdById = memberId,
                createdByName = memberName,
                referenceDate = kotlinx.datetime.Instant.fromEpochMilliseconds(date.time),
                createdAt = kotlinx.datetime.Instant.fromEpochMilliseconds(System.currentTimeMillis()),
                playerId = if (isIncome) memberId else null,
                playerName = if (isIncome) memberName else null,
                status = CashboxAppStatus.ACTIVE.name
            )

            // Calculate 'created_at' to match reference date for history sort simulation?
            // Repository usually uses serverTimestamp for created_at, but we can't easily spoof that back in time 
            // easily without Admin SDK custom claims or import tools.
            // But 'reference_date' is what we filter by often. 
            // The history view orders by 'created_at', so newer entries (inserted now) will appear at top.
            // This is a limitation of client-side seeding: all entries will have "now" as created_at.
            // Users will see them in history as "created just now" but with old reference dates.
            // To fix visuals, the app should probably sort by referenceDate for display?
            // The current app sorts by 'created_at'.
            // For testing volume it's fine.
            
            cashboxRepository.addEntry(groupId, entry)
        }
    }
}
