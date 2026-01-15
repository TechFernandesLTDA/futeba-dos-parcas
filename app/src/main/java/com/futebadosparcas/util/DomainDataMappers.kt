package com.futebadosparcas.util

import com.futebadosparcas.data.model.FieldType as DataFieldType
import com.futebadosparcas.data.model.Game as DataGame
import com.futebadosparcas.data.model.GameConfirmation as DataGameConfirmation
import com.futebadosparcas.data.model.GameEvent as DataGameEvent
import com.futebadosparcas.data.model.LiveGameScore as DataLiveGameScore
import com.futebadosparcas.data.model.LivePlayerStats as DataLivePlayerStats
import com.futebadosparcas.data.model.Location as DataLocation
import com.futebadosparcas.data.model.Team as DataTeam
import com.futebadosparcas.data.model.User as DataUser
import com.futebadosparcas.data.model.UserBadge as DataUserBadge
import com.futebadosparcas.data.model.UserGroup
import com.futebadosparcas.data.model.UserStatistics as DataUserStatistics
import com.futebadosparcas.domain.model.FieldType as DomainFieldType
import com.futebadosparcas.domain.model.Game as DomainGame
import com.futebadosparcas.domain.model.GameConfirmation as DomainGameConfirmation
import com.futebadosparcas.domain.model.GameEvent as DomainGameEvent
import com.futebadosparcas.domain.model.LivePlayerStats as DomainLivePlayerStats
import com.futebadosparcas.domain.model.LiveScore as DomainLiveScore
import com.futebadosparcas.domain.model.Location as DomainLocation
import com.futebadosparcas.domain.model.Team as DomainTeam
import com.futebadosparcas.domain.model.User as DomainUser
import com.futebadosparcas.domain.model.UserBadge as DomainUserBadge
import com.futebadosparcas.domain.model.Statistics as DomainStatistics
import java.util.Date

/**
 * Mappers entre modelos de domínio (KMP/shared) e modelos de dados (Android app).
 * Usado durante a migração KMP para manter compatibilidade com UI existente.
 */

// ========== FieldType ==========

/**
 * Converte FieldType do domínio para FieldType da camada de dados.
 */
fun DomainFieldType.toDataModel(): DataFieldType {
    return DataFieldType.valueOf(this.name)
}

/**
 * Converte FieldType da camada de dados para FieldType do domínio.
 */
fun DataFieldType.toDomainModel(): DomainFieldType {
    return DomainFieldType.valueOf(this.name)
}

/**
 * Converte lista de FieldType do domínio para FieldType da camada de dados.
 */
fun List<DomainFieldType>.toDataFieldTypes(): List<DataFieldType> {
    return map { it.toDataModel() }
}

/**
 * Converte lista de FieldType da camada de dados para FieldType do domínio.
 */
fun List<DataFieldType>.toDomainFieldTypes(): List<DomainFieldType> {
    return map { it.toDomainModel() }
}

// ========== Location ==========

/**
 * Converte Location do domínio para Location da camada de dados.
 */
fun DomainLocation.toDataModel(): DataLocation {
    return DataLocation(
        id = this.id,
        name = this.name,
        address = this.address,
        cep = this.cep,
        street = this.street,
        number = this.number,
        complement = this.complement,
        district = this.district,
        city = this.city,
        state = this.state,
        country = this.country,
        neighborhood = this.neighborhood,
        region = this.region,
        latitude = this.latitude,
        longitude = this.longitude,
        placeId = this.placeId,
        ownerId = this.ownerId,
        managers = this.managers,
        isVerified = this.isVerified,
        isActive = this.isActive,
        rating = this.rating,
        ratingCount = this.ratingCount,
        description = this.description,
        photoUrl = this.photoUrl,
        amenities = this.amenities,
        phone = this.phone,
        website = this.website,
        instagram = this.instagram,
        openingTime = this.openingTime,
        closingTime = this.closingTime,
        operatingDays = this.operatingDays,
        minGameDurationMinutes = this.minGameDurationMinutes
    )
}

/**
 * Converte lista de Location do domínio para Location da camada de dados.
 */
fun List<DomainLocation>.toDataLocations(): List<DataLocation> {
    return map { it.toDataModel() }
}

// ========== UserBadge ==========

/**
 * Converte UserBadge do domínio para UserBadge da camada de dados.
 */
fun DomainUserBadge.toDataModel(): DataUserBadge {
    return DataUserBadge(
        id = this.id,
        userId = this.userId,
        badgeId = this.badgeId,
        count = this.unlockCount,
        unlockedAt = if (this.unlockedAt > 0) Date(this.unlockedAt) else null,
        lastEarnedAt = if (this.unlockedAt > 0) Date(this.unlockedAt) else null
    )
}

/**
 * Converte lista de UserBadge do domínio para UserBadge da camada de dados.
 */
fun List<DomainUserBadge>.toDataBadges(): List<DataUserBadge> {
    return map { it.toDataModel() }
}

// ========== Statistics ==========

/**
 * Converte Statistics do domínio para UserStatistics da camada de dados.
 */
fun DomainStatistics.toDataModel(userId: String = ""): DataUserStatistics {
    return DataUserStatistics(
        id = if (this.id.isNotEmpty()) this.id else userId,
        totalGames = this.totalGames ?: 0,
        totalGoals = this.totalGoals ?: 0,
        totalAssists = this.totalAssists ?: 0,
        totalSaves = this.totalSaves ?: 0,
        totalYellowCards = this.yellowCards ?: 0,
        totalRedCards = this.redCards ?: 0,
        bestPlayerCount = this.mvpCount ?: 0,
        worstPlayerCount = this.worstPlayerCount ?: 0,
        bestGoalCount = 0, // Não existe no domínio ainda
        gamesWon = this.totalWins ?: 0,
        gamesLost = this.totalLosses ?: 0,
        gamesDraw = this.totalDraws ?: 0,
        gamesInvited = 0, // Não existe no domínio
        gamesAttended = 0 // Não existe no domínio
    )
}

/**
 * Converte UserStatistics da camada de dados para Statistics do domínio.
 */
fun DataUserStatistics.toDomainModel(): DomainStatistics {
    return DomainStatistics(
        id = this.id,
        userId = this.id,
        totalGames = this.totalGames,
        totalGoals = this.totalGoals,
        totalAssists = this.totalAssists,
        totalSaves = this.totalSaves,
        totalWins = this.gamesWon,
        totalDraws = this.gamesDraw,
        totalLosses = this.gamesLost,
        mvpCount = this.bestPlayerCount,
        bestGkCount = 0, // Não existe no modelo de dados
        worstPlayerCount = this.worstPlayerCount,
        currentStreak = 0, // Não existe no modelo de dados
        bestStreak = 0, // Não existe no modelo de dados
        yellowCards = this.totalYellowCards,
        redCards = this.totalRedCards,
        lastGameDate = null, // Não existe no modelo de dados
        updatedAt = null // Não existe no modelo de dados
    )
}

// ========== User ==========

/**
 * Converte User do domínio para User da camada de dados.
 */
fun DomainUser.toDataModel(): DataUser {
    return DataUser(
        id = this.id,
        email = this.email,
        name = this.name,
        phone = this.phone,
        nickname = this.nickname,
        photoUrl = this.photoUrl,
        fcmToken = this.fcmToken,
        isSearchable = this.isSearchable,
        isProfilePublic = this.isProfilePublic,
        role = this.role,
        createdAt = this.createdAt?.let { Date(it) },
        updatedAt = this.updatedAt?.let { Date(it) },
        // Ratings manuais
        strikerRating = this.strikerRating,
        midRating = this.midRating,
        defenderRating = this.defenderRating,
        gkRating = this.gkRating,
        // Posicao preferida
        preferredPosition = this.preferredPosition,
        preferredFieldTypes = this.preferredFieldTypes.toDataFieldTypes(),
        // Informacoes pessoais
        birthDate = this.birthDate?.let { Date(it) },
        gender = this.gender,
        heightCm = this.heightCm,
        weightKg = this.weightKg,
        dominantFoot = this.dominantFoot,
        primaryPosition = this.primaryPosition,
        secondaryPosition = this.secondaryPosition,
        playStyle = this.playStyle,
        experienceYears = this.experienceYears,
        // Gamificacao
        level = this.level,
        experiencePoints = this.experiencePoints,
        milestonesAchieved = this.milestonesAchieved,
        // Ratings automaticos
        autoStrikerRating = this.autoStrikerRating,
        autoMidRating = this.autoMidRating,
        autoDefenderRating = this.autoDefenderRating,
        autoGkRating = this.autoGkRating,
        autoRatingSamples = this.autoRatingSamples
    )
}

/**
 * Converte User da camada de dados para User do domínio.
 */
fun DataUser.toDomainModel(): DomainUser {
    return DomainUser(
        id = this.id,
        email = this.email,
        name = this.name,
        phone = this.phone,
        nickname = this.nickname,
        photoUrl = this.photoUrl,
        fcmToken = this.fcmToken,
        isSearchable = this.isSearchable ?: true,
        isProfilePublic = this.isProfilePublic ?: true,
        role = this.role ?: "PLAYER",
        createdAt = this.createdAt?.time,
        updatedAt = this.updatedAt?.time,
        // Ratings manuais
        strikerRating = this.strikerRating,
        midRating = this.midRating,
        defenderRating = this.defenderRating,
        gkRating = this.gkRating,
        // Posicao preferida
        preferredPosition = this.preferredPosition,
        preferredFieldTypes = (this.preferredFieldTypes ?: emptyList()).toDomainFieldTypes(),
        // Informacoes pessoais
        birthDate = this.birthDate?.time,
        gender = this.gender,
        heightCm = this.heightCm,
        weightKg = this.weightKg,
        dominantFoot = this.dominantFoot,
        primaryPosition = this.primaryPosition,
        secondaryPosition = this.secondaryPosition,
        playStyle = this.playStyle,
        experienceYears = this.experienceYears,
        // Gamificacao
        level = this.level,
        experiencePoints = this.experiencePoints,
        milestonesAchieved = this.milestonesAchieved ?: emptyList(),
        // Ratings automaticos
        autoStrikerRating = this.autoStrikerRating,
        autoMidRating = this.autoMidRating,
        autoDefenderRating = this.autoDefenderRating,
        autoGkRating = this.autoGkRating,
        autoRatingSamples = this.autoRatingSamples
    )
}

/**
 * Converte lista de User do domínio para User da camada de dados.
 */
fun List<DomainUser>.toDataUsers(): List<DataUser> {
    return map { it.toDataModel() }
}

/**
 * Converte lista de User da camada de dados para User do domínio.
 */
fun List<DataUser>.toDomainUsers(): List<DomainUser> {
    return map { it.toDomainModel() }
}

// ========== Game ==========

/**
 * Converte Game do domínio para Game da camada de dados.
 */
fun DomainGame.toDataModel(): DataGame {
    return DataGame(
        id = this.id,
        scheduleId = this.scheduleId,
        date = this.date,
        time = this.time,
        endTime = this.endTime,
        status = this.status,
        maxPlayers = this.maxPlayers,
        maxGoalkeepers = this.maxGoalkeepers,
        playersCount = this.playersCount,
        goalkeepersCount = this.goalkeepersCount,
        dailyPrice = this.dailyPrice,
        totalCost = this.totalCost,
        pixKey = this.pixKey,
        numberOfTeams = this.numberOfTeams,
        ownerId = this.ownerId,
        ownerName = this.ownerName,
        locationId = this.locationId,
        fieldId = this.fieldId,
        locationName = this.locationName,
        locationAddress = this.locationAddress,
        locationLat = this.locationLat,
        locationLng = this.locationLng,
        fieldName = this.fieldName,
        gameType = this.gameType,
        recurrence = this.recurrence,
        visibility = this.visibility,
        createdAt = this.createdAt?.let { Date(it) },
        xpProcessed = this.xpProcessed,
        mvpId = this.mvpId,
        team1Score = this.team1Score,
        team2Score = this.team2Score,
        team1Name = this.team1Name,
        team2Name = this.team2Name,
        groupId = this.groupId,
        groupName = this.groupName
    )
}

/**
 * Converte Game da camada de dados para Game do domínio.
 */
fun DataGame.toDomainModel(): DomainGame {
    return DomainGame(
        id = this.id,
        scheduleId = this.scheduleId,
        date = this.date,
        time = this.time,
        endTime = this.endTime,
        status = this.status,
        maxPlayers = this.maxPlayers,
        maxGoalkeepers = this.maxGoalkeepers,
        playersCount = this.playersCount,
        goalkeepersCount = this.goalkeepersCount,
        dailyPrice = this.dailyPrice,
        totalCost = this.totalCost,
        pixKey = this.pixKey,
        numberOfTeams = this.numberOfTeams,
        ownerId = this.ownerId,
        ownerName = this.ownerName,
        locationId = this.locationId,
        fieldId = this.fieldId,
        locationName = this.locationName,
        locationAddress = this.locationAddress,
        locationLat = this.locationLat,
        locationLng = this.locationLng,
        fieldName = this.fieldName,
        gameType = this.gameType,
        recurrence = this.recurrence,
        visibility = this.visibility,
        createdAt = this.createdAt?.time,
        xpProcessed = this.xpProcessed,
        mvpId = this.mvpId,
        team1Score = this.team1Score,
        team2Score = this.team2Score,
        team1Name = this.team1Name,
        team2Name = this.team2Name,
        groupId = this.groupId,
        groupName = this.groupName
    )
}

/**
 * Converte lista de Game do domínio para Game da camada de dados.
 */
fun List<DomainGame>.toDataGames(): List<DataGame> {
    return map { it.toDataModel() }
}

/**
 * Converte lista de Game da camada de dados para Game do domínio.
 */
fun List<DataGame>.toDomainGames(): List<DomainGame> {
    return map { it.toDomainModel() }
}

// ========== GameConfirmation ==========

/**
 * Converte GameConfirmation do domínio para GameConfirmation da camada de dados.
 * Nota: teamId não existe no modelo de dados do Android, é ignorado.
 */
fun DomainGameConfirmation.toDataModel(): DataGameConfirmation {
    return DataGameConfirmation(
        id = this.id,
        gameId = this.gameId,
        userId = this.userId,
        userName = this.userName,
        userPhoto = this.userPhoto,
        position = this.position,
        status = this.status,
        paymentStatus = this.paymentStatus,
        isCasualPlayer = this.isCasualPlayer,
        goals = this.goals,
        yellowCards = this.yellowCards,
        redCards = this.redCards,
        assists = this.assists,
        saves = this.saves,
        confirmedAt = this.confirmedAt?.let { Date(it) },
        nickname = this.nickname,
        xpEarned = this.xpEarned,
        isMvp = this.isMvp,
        isBestGk = this.isBestGk,
        isWorstPlayer = this.isWorstPlayer
    )
}

/**
 * Converte GameConfirmation da camada de dados para GameConfirmation do domínio.
 */
fun DataGameConfirmation.toDomainModel(): DomainGameConfirmation {
    return DomainGameConfirmation(
        id = this.id,
        gameId = this.gameId,
        userId = this.userId,
        userName = this.userName,
        userPhoto = this.userPhoto,
        position = this.position,
        teamId = null, // Não existe no modelo de dados
        status = this.status,
        paymentStatus = this.paymentStatus,
        isCasualPlayer = this.isCasualPlayer,
        goals = this.goals,
        assists = this.assists,
        saves = this.saves,
        yellowCards = this.yellowCards,
        redCards = this.redCards,
        nickname = this.nickname,
        xpEarned = this.xpEarned,
        isMvp = this.isMvp,
        isBestGk = this.isBestGk,
        isWorstPlayer = this.isWorstPlayer,
        confirmedAt = this.confirmedAt?.time
    )
}

/**
 * Converte lista de GameConfirmation do domínio para GameConfirmation da camada de dados.
 */
fun List<DomainGameConfirmation>.toDataGameConfirmations(): List<DataGameConfirmation> {
    return map { it.toDataModel() }
}

/**
 * Converte lista de GameConfirmation da camada de dados para GameConfirmation do domínio.
 */
fun List<DataGameConfirmation>.toDomainGameConfirmations(): List<DomainGameConfirmation> {
    return map { it.toDomainModel() }
}

// ========== GameEvent ==========

/**
 * Converte GameEvent do domínio para GameEvent da camada de dados.
 */
fun DomainGameEvent.toDataModel(): DataGameEvent {
    return DataGameEvent(
        id = this.id,
        gameId = this.gameId,
        eventType = this.eventType,
        playerId = this.playerId,
        playerName = this.playerName,
        teamId = this.teamId,
        assistedById = this.assistedById,
        assistedByName = this.assistedByName,
        minute = this.minute,
        createdBy = this.createdBy,
        createdAt = this.createdAt?.let { Date(it) }
    )
}

/**
 * Converte GameEvent da camada de dados para GameEvent do domínio.
 */
fun DataGameEvent.toDomainModel(): DomainGameEvent {
    return DomainGameEvent(
        id = this.id,
        gameId = this.gameId,
        eventType = this.eventType,
        playerId = this.playerId,
        playerName = this.playerName,
        teamId = this.teamId,
        assistedById = this.assistedById,
        assistedByName = this.assistedByName,
        minute = this.minute,
        createdBy = this.createdBy,
        createdAt = this.createdAt?.time
    )
}

// ========== Team ==========

/**
 * Converte Team do domínio para Team da camada de dados.
 */
fun DomainTeam.toDataModel(): DataTeam {
    return DataTeam(
        id = this.id,
        gameId = this.gameId,
        name = this.name,
        color = this.color,
        playerIds = this.playerIds,
        score = this.score
    )
}

/**
 * Converte Team da camada de dados para Team do domínio.
 */
fun DataTeam.toDomainModel(): DomainTeam {
    return DomainTeam(
        id = this.id,
        gameId = this.gameId,
        name = this.name,
        color = this.color,
        playerIds = this.playerIds,
        score = this.score
    )
}

/**
 * Converte lista de Team do domínio para Team da camada de dados.
 */
fun List<DomainTeam>.toDataTeams(): List<DataTeam> {
    return map { it.toDataModel() }
}

/**
 * Converte lista de Team da camada de dados para Team do domínio.
 */
fun List<DataTeam>.toDomainTeams(): List<DomainTeam> {
    return map { it.toDomainModel() }
}

// ========== LiveScore ==========

/**
 * Converte LiveScore do domínio para LiveGameScore da camada de dados.
 */
fun DomainLiveScore.toDataModel(): DataLiveGameScore {
    return DataLiveGameScore(
        id = this.id,
        gameId = this.gameId,
        team1Id = this.team1Id,
        team1Score = this.team1Score,
        team2Id = this.team2Id,
        team2Score = this.team2Score,
        startedAt = this.startedAt?.let { Date(it) },
        finishedAt = this.finishedAt?.let { Date(it) }
    )
}

/**
 * Converte LiveGameScore da camada de dados para LiveScore do domínio.
 */
fun DataLiveGameScore.toDomainModel(): DomainLiveScore {
    return DomainLiveScore(
        id = this.id,
        gameId = this.gameId,
        team1Id = this.team1Id,
        team1Score = this.team1Score,
        team2Id = this.team2Id,
        team2Score = this.team2Score,
        startedAt = this.startedAt?.time,
        finishedAt = this.finishedAt?.time
    )
}

// ========== LivePlayerStats ==========

/**
 * Converte LivePlayerStats do domínio para LivePlayerStats da camada de dados.
 */
fun DomainLivePlayerStats.toDataModel(): DataLivePlayerStats {
    return DataLivePlayerStats(
        id = this.id,
        gameId = this.gameId,
        playerId = this.playerId,
        playerName = this.playerName,
        teamId = this.teamId,
        position = this.position,
        goals = this.goals,
        assists = this.assists,
        saves = this.saves,
        yellowCards = this.yellowCards,
        redCards = this.redCards,
        isPlaying = this.isPlaying
    )
}

/**
 * Converte LivePlayerStats da camada de dados para LivePlayerStats do domínio.
 */
fun DataLivePlayerStats.toDomainModel(): DomainLivePlayerStats {
    return DomainLivePlayerStats(
        id = this.id,
        gameId = this.gameId,
        playerId = this.playerId,
        playerName = this.playerName,
        teamId = this.teamId,
        position = this.position,
        goals = this.goals,
        assists = this.assists,
        saves = this.saves,
        yellowCards = this.yellowCards,
        redCards = this.redCards,
        isPlaying = this.isPlaying
    )
}
