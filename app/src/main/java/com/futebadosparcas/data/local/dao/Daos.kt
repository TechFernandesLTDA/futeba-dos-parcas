package com.futebadosparcas.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.futebadosparcas.data.local.model.GameEntity
import com.futebadosparcas.data.local.model.UserEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface GameDao {
    @Query("SELECT * FROM games ORDER BY date DESC, time DESC")
    fun getAllGames(): Flow<List<GameEntity>>

    @Query("SELECT * FROM games ORDER BY date DESC, time DESC")
    suspend fun getAllGamesSnapshot(): List<GameEntity>

    @Query("SELECT * FROM games WHERE status IN ('SCHEDULED', 'CONFIRMED') ORDER BY date ASC")
    fun getUpcomingGames(): Flow<List<GameEntity>>

    @Query("SELECT * FROM games WHERE status IN ('SCHEDULED', 'CONFIRMED') ORDER BY date ASC")
    suspend fun getUpcomingGamesSnapshot(): List<GameEntity>

    @Query("SELECT * FROM games WHERE id = :gameId")
    suspend fun getGameById(gameId: String): GameEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGame(game: GameEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGames(games: List<GameEntity>)

    @Query("DELETE FROM games WHERE id = :gameId")
    suspend fun deleteGame(gameId: String)

    @Query("DELETE FROM games")
    suspend fun clearAll()

    // TTL: Remove jogos cacheados ha mais de X ms (padrao: 7 dias)
    @Query("DELETE FROM games WHERE cachedAt < :expirationTime")
    suspend fun deleteExpiredGames(expirationTime: Long)

    // TTL: Remove jogos finalizados ha mais de X dias
    @Query("DELETE FROM games WHERE status = 'FINISHED' AND cachedAt < :expirationTime")
    suspend fun deleteOldFinishedGames(expirationTime: Long)
}

@Dao
interface UserDao {
    @Query("SELECT * FROM users WHERE id = :userId")
    suspend fun getUserById(userId: String): UserEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUser(user: UserEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUsers(users: List<UserEntity>)

    // TTL: Remove usuarios cacheados ha mais de X ms (padrao: 24 horas)
    @Query("DELETE FROM users WHERE cachedAt < :expirationTime")
    suspend fun deleteExpiredUsers(expirationTime: Long)

    @Query("DELETE FROM users")
    suspend fun clearAll()
}
