package com.futebadosparcas.data.local.model

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.User
import java.util.Date

@Entity(
    tableName = "users",
    indices = [
        Index(value = ["cachedAt"], name = "index_users_cachedAt")
    ]
)
data class UserEntity(
    @PrimaryKey val id: String,
    val email: String,
    val name: String,
    val photoUrl: String?,
    val fcmToken: String?,
    val createdAt: Long?,
    val updatedAt: Long?,
    val cachedAt: Long = System.currentTimeMillis() // TTL tracking
)

@Entity(
    tableName = "groups",
    indices = [
        Index(value = ["status"], name = "index_groups_status"),
        Index(value = ["ownerId"], name = "index_groups_ownerId")
    ]
)
data class GroupEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String?,
    val ownerId: String,
    val ownerName: String,
    val photoUrl: String?,
    val memberCount: Int = 0,
    val status: String = "ACTIVE", // ACTIVE, ARCHIVED
    val createdAt: Long?,
    val updatedAt: Long?,
    val cachedAt: Long = System.currentTimeMillis() // TTL tracking
)

@Entity(
    tableName = "games",
    indices = [
        Index(value = ["status"], name = "index_games_status"),
        Index(value = ["cachedAt"], name = "index_games_cachedAt"),
        Index(value = ["dateTime"], name = "index_games_dateTime"),
        Index(value = ["ownerId"], name = "index_games_ownerId")
    ]
)
data class GameEntity(
    @PrimaryKey val id: String,
    val scheduleId: String,
    val date: String,
    val time: String,
    val endTime: String,
    val status: String,
    val maxPlayers: Int,
    val maxGoalkeepers: Int,
    val players: List<String>, // Needs Converter
    val dailyPrice: Double,
    val confirmationClosesAt: String?,
    val numberOfTeams: Int,
    val ownerId: String,
    val ownerName: String,
    val locationId: String,
    val fieldId: String,
    val locationName: String,
    val locationAddress: String,
    val locationLat: Double?,
    val locationLng: Double?,
    val fieldName: String,
    val gameType: String,
    val recurrence: String,
    val createdAt: Long?,
    val dateTime: Long? = null,
    val cachedAt: Long = System.currentTimeMillis() // TTL tracking
)

// Extensions to map between Domain/Network and Local
fun UserEntity.toDomain() = User(
    id = id,
    email = email,
    name = name,
    photoUrl = photoUrl,
    fcmToken = fcmToken,
    createdAt = createdAt, // UserEntity.createdAt é Long?, User.createdAt é Long?
    updatedAt = updatedAt
)

fun User.toEntity() = UserEntity(
    id = id,
    email = email,
    name = name,
    photoUrl = photoUrl,
    fcmToken = fcmToken,
    createdAt = createdAt, // User.createdAt é Long?, UserEntity.createdAt é Long?
    updatedAt = updatedAt
)

fun GameEntity.toDomain() = Game(
    id = id,
    scheduleId = scheduleId,
    date = date,
    time = time,
    endTime = endTime,
    status = status,
    maxPlayers = maxPlayers,
    maxGoalkeepers = maxGoalkeepers,
<<<<<<< HEAD
    players = emptyList(), // KMP Game não tem players list
=======
>>>>>>> f3237fc2328fe3c708bd99fb005154a8d51298a3
    dailyPrice = dailyPrice,
    numberOfTeams = numberOfTeams,
    ownerId = ownerId,
    ownerName = ownerName,
    locationId = locationId,
    fieldId = fieldId,
    locationName = locationName,
    locationAddress = locationAddress,
    locationLat = locationLat,
    locationLng = locationLng,
    fieldName = fieldName,
    gameType = gameType,
    recurrence = recurrence,
    createdAt = createdAt // GameEntity.createdAt é Long?, Game.createdAt é Long?
)

fun Game.toEntity() = GameEntity(
    id = id,
    scheduleId = scheduleId,
    date = date,
    time = time,
    endTime = endTime,
    status = status,
    maxPlayers = maxPlayers,
    maxGoalkeepers = maxGoalkeepers,
    players = emptyList(), // KMP Game não tem players list
    dailyPrice = dailyPrice,
    confirmationClosesAt = null, // KMP Game não tem confirmationClosesAt
    numberOfTeams = numberOfTeams,
    ownerId = ownerId,
    ownerName = ownerName,
    locationId = locationId,
    fieldId = fieldId,
    locationName = locationName,
    locationAddress = locationAddress,
    locationLat = locationLat,
    locationLng = locationLng,
    fieldName = fieldName,
    gameType = gameType,
    recurrence = recurrence,
    createdAt = createdAt, // Já é Long?
    dateTime = createdAt // Use createdAt (já é Long?)
)
