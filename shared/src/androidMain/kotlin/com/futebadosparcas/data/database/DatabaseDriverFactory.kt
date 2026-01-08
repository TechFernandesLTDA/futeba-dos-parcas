package com.futebadosparcas.data.database

import android.content.Context
import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import com.futebadosparcas.db.FutebaDatabase

/**
 * Implementação Android do DatabaseDriverFactory.
 *
 * Usa AndroidSqliteDriver do SQLDelight para persistência local.
 */
actual class DatabaseDriverFactory(private val context: Context) {
    actual fun createDriver(): SqlDriver {
        return AndroidSqliteDriver(
            schema = FutebaDatabase.Schema,
            context = context,
            name = "futeba.db"
        )
    }
}
