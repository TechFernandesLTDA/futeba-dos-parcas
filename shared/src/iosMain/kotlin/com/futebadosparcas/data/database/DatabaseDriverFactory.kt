package com.futebadosparcas.data.database

import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.native.NativeSqliteDriver
import com.futebadosparcas.db.FutebaDatabase

/**
 * Implementação iOS do DatabaseDriverFactory.
 *
 * Usa NativeSqliteDriver do SQLDelight para persistência local no iOS.
 *
 * NOTA: Este código está preparado mas NÃO foi testado sem Mac.
 * Quando tiver acesso a Mac/Xcode, validar funcionamento.
 */
actual class DatabaseDriverFactory {
    actual fun createDriver(): SqlDriver {
        return NativeSqliteDriver(
            schema = FutebaDatabase.Schema,
            name = "futeba.db"
        )
    }
}
