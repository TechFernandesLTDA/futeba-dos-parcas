package com.futebadosparcas.di.koin

import androidx.room.Room
import com.futebadosparcas.data.local.AppDatabase
import com.futebadosparcas.data.local.SearchHistoryDao
import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.local.dao.GroupDao
import com.futebadosparcas.data.local.dao.LocationSyncDao
import com.futebadosparcas.data.local.dao.UserDao
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val databaseKoinModule = module {

    single<AppDatabase> {
        Room.databaseBuilder(
            androidContext(),
            AppDatabase::class.java,
            "futeba_db"
        )
            .addMigrations(
                AppDatabase.MIGRATION_1_2,
                AppDatabase.MIGRATION_2_3,
                AppDatabase.MIGRATION_3_4,
                AppDatabase.MIGRATION_4_5
            )
            .fallbackToDestructiveMigration()
            .build()
    }

    factory<GameDao> { get<AppDatabase>().gameDao() }

    factory<UserDao> { get<AppDatabase>().userDao() }

    factory<LocationSyncDao> { get<AppDatabase>().locationSyncDao() }

    factory<GroupDao> { get<AppDatabase>().groupDao() }

    factory<SearchHistoryDao> { get<AppDatabase>().searchHistoryDao() }
}
