package com.futebadosparcas.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.local.dao.UserDao
import com.futebadosparcas.data.local.model.GameEntity
import com.futebadosparcas.data.local.model.UserEntity

@Database(entities = [GameEntity::class, UserEntity::class], version = 1, exportSchema = false)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun gameDao(): GameDao
    abstract fun userDao(): UserDao
}
