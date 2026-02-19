package com.futebadosparcas.data.database

import app.cash.sqldelight.db.SqlDriver
import com.futebadosparcas.db.FutebaDatabase

/**
 * Platform-specific database driver factory.
 *
 * Use expect/actual para criar drivers específicos de plataforma:
 * - Android: AndroidSqliteDriver
 * - iOS: NativeSqliteDriver
 */
expect class DatabaseDriverFactory {
    fun createDriver(): SqlDriver
}

/**
 * Factory para criar instância do FutebaDatabase.
 *
 * Usa o DatabaseDriverFactory específico de cada plataforma.
 */
class DatabaseFactory(private val driverFactory: DatabaseDriverFactory) {
    fun createDatabase(): FutebaDatabase {
        val driver = driverFactory.createDriver()
        return FutebaDatabase(driver)
    }
}
