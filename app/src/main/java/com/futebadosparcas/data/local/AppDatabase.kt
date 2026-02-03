package com.futebadosparcas.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.local.dao.GroupDao
import com.futebadosparcas.data.local.dao.LocationSyncDao
import com.futebadosparcas.data.local.dao.UserDao
import com.futebadosparcas.data.local.model.GameEntity
import com.futebadosparcas.data.local.model.GroupEntity
import com.futebadosparcas.data.local.model.LocationSyncEntity
import com.futebadosparcas.data.local.model.UserEntity

@Database(
    entities = [
        GameEntity::class,
        UserEntity::class,
        LocationSyncEntity::class,
        GroupEntity::class
    ],
    version = 4,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun gameDao(): GameDao
    abstract fun userDao(): UserDao
    abstract fun locationSyncDao(): LocationSyncDao
    abstract fun groupDao(): GroupDao

    companion object {
        // Migracao v1 -> v2: Adiciona coluna cachedAt para TTL
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Adiciona cachedAt a tabela users
                db.execSQL("ALTER TABLE users ADD COLUMN cachedAt INTEGER NOT NULL DEFAULT ${System.currentTimeMillis()}")
                // Adiciona cachedAt a tabela games
                db.execSQL("ALTER TABLE games ADD COLUMN cachedAt INTEGER NOT NULL DEFAULT ${System.currentTimeMillis()}")
            }
        }

        // Migracao v2 -> v3: Adiciona tabela location_sync_queue para sincronizacao offline
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS location_sync_queue (
                        id TEXT NOT NULL PRIMARY KEY,
                        locationId TEXT NOT NULL,
                        action TEXT NOT NULL,
                        locationJson TEXT NOT NULL,
                        timestamp INTEGER NOT NULL,
                        retryCount INTEGER NOT NULL DEFAULT 0,
                        lastError TEXT,
                        nextRetryAt INTEGER NOT NULL DEFAULT 0
                    )
                """.trimIndent())

                // Indice para busca por locationId
                db.execSQL("CREATE INDEX IF NOT EXISTS index_location_sync_queue_locationId ON location_sync_queue(locationId)")

                // Indice para busca por nextRetryAt (para encontrar itens prontos para sync)
                db.execSQL("CREATE INDEX IF NOT EXISTS index_location_sync_queue_nextRetryAt ON location_sync_queue(nextRetryAt)")
            }
        }

        // Migracao v3 -> v4: Adiciona tabela groups para cache de grupos
        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS groups (
                        id TEXT NOT NULL PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        ownerId TEXT NOT NULL,
                        ownerName TEXT NOT NULL,
                        photoUrl TEXT,
                        memberCount INTEGER NOT NULL DEFAULT 0,
                        status TEXT NOT NULL DEFAULT 'ACTIVE',
                        createdAt INTEGER,
                        updatedAt INTEGER,
                        cachedAt INTEGER NOT NULL DEFAULT ${System.currentTimeMillis()}
                    )
                """.trimIndent())

                // Indice para busca por status (para filtrar grupos ativos)
                db.execSQL("CREATE INDEX IF NOT EXISTS index_groups_status ON groups(status)")

                // Indice para busca por ownerId
                db.execSQL("CREATE INDEX IF NOT EXISTS index_groups_ownerId ON groups(ownerId)")
            }
        }
    }
}
