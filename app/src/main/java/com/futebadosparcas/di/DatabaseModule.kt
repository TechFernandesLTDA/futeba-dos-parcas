package com.futebadosparcas.di

import android.content.Context
import androidx.room.Room
import com.futebadosparcas.data.local.AppDatabase
import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.local.dao.LocationSyncDao
import com.futebadosparcas.data.local.dao.UserDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "futeba_db"
        )
            .addMigrations(
                AppDatabase.MIGRATION_1_2,
                AppDatabase.MIGRATION_2_3
            )
            .fallbackToDestructiveMigration() // Fallback para versoes muito antigas
            .build()
    }

    @Provides
    fun provideGameDao(database: AppDatabase): GameDao {
        return database.gameDao()
    }

    @Provides
    fun provideUserDao(database: AppDatabase): UserDao {
        return database.userDao()
    }

    @Provides
    fun provideLocationSyncDao(database: AppDatabase): LocationSyncDao {
        return database.locationSyncDao()
    }
}
