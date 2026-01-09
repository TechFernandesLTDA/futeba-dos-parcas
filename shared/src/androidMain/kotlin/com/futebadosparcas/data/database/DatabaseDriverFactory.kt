package com.futebadosparcas.data.database

import android.content.Context
import android.util.Log
import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import com.futebadosparcas.db.FutebaDatabase

/**
 * Implementação Android do DatabaseDriverFactory.
 *
 * Usa AndroidSqliteDriver do SQLDelight 2.x para persistência local.
 * Migrações são gerenciadas automaticamente via arquivos .sqm.
 */
actual class DatabaseDriverFactory(private val context: Context) {
    
    companion object {
        private const val TAG = "DatabaseDriverFactory"
        private const val DATABASE_NAME = "futeba.db"
    }
    
    actual fun createDriver(): SqlDriver {
        Log.d(TAG, "Creating database driver with schema version: ${FutebaDatabase.Schema.version}")
        
        return AndroidSqliteDriver(
            schema = FutebaDatabase.Schema,
            context = context,
            name = DATABASE_NAME
        )
    }
}
