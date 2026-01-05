package com.futebadosparcas.data.local.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.User
import java.util.Date

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val id: String,
    val email: String,
    val name: String,
    val photoUrl: String?,
    val fcmToken: String?,
    val createdAt: Long?,
    val updatedAt: Long?
)

@Entity(tableName = "games")
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
    val dateTime: Long? = null
)

// Extensions to map between Domain/Network and Local
fun UserEntity.toDomain() = User(
    id = id,
    email = email,
    name = name,
    photoUrl = photoUrl,
    fcmToken = fcmToken,
    createdAt = createdAt?.let { Date(it) },
    updatedAt = updatedAt?.let { Date(it) }
)

fun User.toEntity() = UserEntity(
    id = id,
    email = email,
    name = name,
    photoUrl = photoUrl,
    fcmToken = fcmToken,
    createdAt = createdAt?.time,
    updatedAt = updatedAt?.time
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
    players = players,
    dailyPrice = dailyPrice,
    confirmationClosesAt = confirmationClosesAt,
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
    createdAt = createdAt?.let { Date(it) },
    dateTimeRaw = dateTime?.let { Date(it) }
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
    players = players,
    dailyPrice = dailyPrice,
    confirmationClosesAt = confirmationClosesAt,
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
    createdAt = createdAt?.time,
    dateTime = dateTime?.time
)
