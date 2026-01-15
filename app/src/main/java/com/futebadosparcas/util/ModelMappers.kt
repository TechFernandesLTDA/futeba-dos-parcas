package com.futebadosparcas.util

import com.futebadosparcas.data.model.AppNotification as AndroidAppNotification
import com.futebadosparcas.data.model.GroupInvite as AndroidGroupInvite
import com.futebadosparcas.data.model.InviteStatus as AndroidInviteStatus
import com.futebadosparcas.data.model.CashboxAppStatus as AndroidCashboxAppStatus
import com.futebadosparcas.data.model.CashboxCategory as AndroidCashboxCategory
import com.futebadosparcas.data.model.CashboxEntry as AndroidCashboxEntry
import com.futebadosparcas.data.model.CashboxEntryType as AndroidCashboxEntryType
import com.futebadosparcas.data.model.CashboxFilter as AndroidCashboxFilter
import com.futebadosparcas.data.model.CashboxSummary as AndroidCashboxSummary
import com.futebadosparcas.data.model.Field as AndroidField
import com.futebadosparcas.data.model.Game as AndroidGame
import com.futebadosparcas.data.model.Group as AndroidGroup
import com.futebadosparcas.data.model.GroupMember as AndroidGroupMember
import com.futebadosparcas.data.model.GroupMemberRole as AndroidGroupMemberRole
import com.futebadosparcas.data.model.Location as AndroidLocation
import com.futebadosparcas.data.model.LocationReview as AndroidLocationReview
import com.futebadosparcas.data.model.NotificationType as AndroidNotificationType
import com.futebadosparcas.data.model.UserBadge as AndroidUserBadge
import com.futebadosparcas.data.model.UserGroup as AndroidUserGroup
import com.futebadosparcas.data.model.RecurrenceType as AndroidRecurrenceType
import com.futebadosparcas.data.model.Schedule as AndroidSchedule
import com.futebadosparcas.data.model.GameTemplate as AndroidGameTemplate

// GameExperience imports - arquivo GameExperience.kt cont varias classes
import com.futebadosparcas.data.model.MVPVote as AndroidMVPVote
import com.futebadosparcas.data.model.VoteCategory
import com.futebadosparcas.data.model.LiveScore as AndroidLiveScore
import com.futebadosparcas.data.model.ScoreEventType
import com.futebadosparcas.data.model.TacticalBoard as AndroidTacticalBoard
import com.futebadosparcas.data.model.TacticalPlayerPosition as AndroidTacticalPlayerPosition

// GameSummon imports
import com.futebadosparcas.data.model.GameSummon as AndroidGameSummon
import com.futebadosparcas.data.model.UpcomingGame as AndroidUpcomingGame

// GameRequest imports
import com.futebadosparcas.data.model.GameJoinRequest as AndroidGameJoinRequest

// Gamification imports
import com.futebadosparcas.data.model.Season as AndroidSeason
import com.futebadosparcas.data.model.SeasonParticipation as AndroidSeasonParticipation
import com.futebadosparcas.data.model.LeagueDivision
import com.futebadosparcas.data.model.UserStreak as AndroidUserStreak

// Ranking imports
import com.futebadosparcas.data.model.RankingEntryV2 as AndroidRankingEntryV2
import com.futebadosparcas.data.model.RankingDocument as AndroidRankingDocument
import com.futebadosparcas.data.model.XpLog as AndroidXpLog

import com.futebadosparcas.domain.model.AppNotification as KmpAppNotification
import com.futebadosparcas.domain.model.GameTemplate as KmpGameTemplate
import com.futebadosparcas.domain.model.RecurrenceType as KmpRecurrenceType
import com.futebadosparcas.domain.model.Schedule as KmpSchedule
import com.futebadosparcas.domain.model.CashboxAppStatus as KmpCashboxAppStatus
import com.futebadosparcas.domain.model.CashboxCategory as KmpCashboxCategory
import com.futebadosparcas.domain.model.CashboxEntry as KmpCashboxEntry
import com.futebadosparcas.domain.model.CashboxEntryType as KmpCashboxEntryType
import com.futebadosparcas.domain.model.CashboxFilter as KmpCashboxFilter
import com.futebadosparcas.domain.model.CashboxSummary as KmpCashboxSummary
import com.futebadosparcas.domain.model.Field as KmpField
import com.futebadosparcas.domain.model.Game as KmpGame
import com.futebadosparcas.domain.model.GameVisibility as KmpGameVisibility
import com.futebadosparcas.domain.model.Group as KmpGroup
import com.futebadosparcas.domain.model.GroupMember as KmpGroupMember
import com.futebadosparcas.domain.model.GroupMemberRole as KmpGroupMemberRole
import com.futebadosparcas.domain.model.Location as KmpLocation
import com.futebadosparcas.domain.model.LocationReview as KmpLocationReview
import com.futebadosparcas.domain.model.NotificationAction
import com.futebadosparcas.domain.model.NotificationType as KmpNotificationType
import com.futebadosparcas.domain.model.UserBadge as KmpUserBadge
import com.futebadosparcas.domain.model.UserGroup as KmpUserGroup
import com.futebadosparcas.domain.model.GroupInvite as KmpGroupInvite
import com.futebadosparcas.domain.model.InviteStatus as KmpInviteStatus
import kotlinx.datetime.Instant
import kotlinx.datetime.Clock

/**
 * Funções de conversão entre models Android (data.model) e models KMP (domain.model).
 *
 * NOTA: Estas são soluções temporárias durante a migração KMP.
 * Quando a migração estiver completa, os models Android serão removidos.
 */

// ========== Location Mappers ==========

/**
 * Converte Location Android para Location KMP.
 */
fun AndroidLocation.toKmpLocation(): KmpLocation {
    return KmpLocation(
        id = id,
        name = name,
        address = address,
        cep = cep,
        street = street,
        number = number,
        complement = complement,
        district = neighborhood,
        city = city,
        state = state,
        country = country,
        neighborhood = neighborhood,
        region = region,
        latitude = latitude,
        longitude = longitude,
        placeId = null,
        ownerId = ownerId,
        isVerified = false,
        isActive = isActive,
        rating = rating,
        ratingCount = ratingCount,
        description = description,
        photoUrl = photoUrl,
        amenities = amenities,
        phone = phone,
        website = null,
        instagram = instagram,
        openingTime = openingTime,
        closingTime = closingTime,
        operatingDays = listOf(1, 2, 3, 4, 5, 6, 7),
        minGameDurationMinutes = minGameDurationMinutes,
        createdAt = createdAt?.time
    )
}

/**
 * Converte Location KMP para Location Android.
 */
fun KmpLocation.toAndroidLocation(): AndroidLocation {
    return AndroidLocation(
        id = id,
        ownerId = ownerId,
        name = name,
        address = address,
        phone = phone,
        openingTime = openingTime,
        closingTime = closingTime,
        minGameDurationMinutes = minGameDurationMinutes,
        region = region,
        neighborhood = neighborhood,
        description = description,
        amenities = amenities,
        isActive = isActive,
        instagram = instagram,
        cep = cep,
        street = street,
        number = number,
        complement = complement,
        city = city,
        state = state,
        country = country,
        latitude = latitude,
        longitude = longitude,
        rating = rating,
        ratingCount = ratingCount,
        photoUrl = photoUrl,
        createdAt = createdAt?.let { java.util.Date(it) }
    )
}

/**
 * Converte uma lista de Location Android para Location KMP.
 */
fun List<AndroidLocation>.toKmpLocations(): List<KmpLocation> = map { it.toKmpLocation() }

/**
 * Converte uma lista de Location KMP para Location Android.
 */
fun List<KmpLocation>.toAndroidLocations(): List<AndroidLocation> = map { it.toAndroidLocation() }

// ========== Field Mappers ==========

/**
 * Converte Field Android para Field KMP.
 */
fun AndroidField.toKmpField(): KmpField {
    return KmpField(
        id = id,
        locationId = locationId,
        name = name,
        type = type, // Ja é String no Android model
        description = description,
        photoUrl = if (photos.isNotEmpty()) photos[0] else null,
        isActive = isActive,
        hourlyPrice = hourlyPrice,
        photos = photos,
        managers = managers,
        surface = surface,
        isCovered = isCovered,
        dimensions = dimensions
    )
}

/**
 * Converte Field KMP para Field Android.
 */
fun KmpField.toAndroidField(): AndroidField {
    return AndroidField(
        id = id,
        locationId = locationId,
        name = name,
        type = type, // Ja é String no Android model
        description = description,
        photoUrl = photoUrl,
        isActive = isActive,
        hourlyPrice = hourlyPrice,
        photos = photos,
        managers = managers,
        surface = surface,
        isCovered = isCovered,
        dimensions = dimensions
    )
}

/**
 * Converte uma lista de Field Android para Field KMP.
 */
fun List<AndroidField>.toKmpFields(): List<KmpField> = map { it.toKmpField() }

/**
 * Converte uma lista de Field KMP para Field Android.
 */
fun List<KmpField>.toAndroidFields(): List<AndroidField> = map { it.toAndroidField() }

// ========== LocationReview Mappers ==========

/**
 * Converte LocationReview Android para LocationReview KMP.
 */
fun AndroidLocationReview.toKmpLocationReview(): KmpLocationReview {
    return KmpLocationReview(
        id = id,
        locationId = locationId,
        userId = userId,
        userName = userName,
        userPhotoUrl = userPhotoUrl,
        rating = rating,
        comment = comment,
        createdAt = createdAt?.time
    )
}

/**
 * Converte LocationReview KMP para LocationReview Android.
 */
fun KmpLocationReview.toAndroidLocationReview(): AndroidLocationReview {
    return AndroidLocationReview(
        id = id,
        locationId = locationId,
        userId = userId,
        userName = userName,
        userPhotoUrl = userPhotoUrl,
        rating = rating,
        comment = comment,
        createdAt = createdAt?.let { java.util.Date(it) }
    )
}

/**
 * Converte uma lista de LocationReview Android para LocationReview KMP.
 */
fun List<AndroidLocationReview>.toKmpLocationReviews(): List<KmpLocationReview> = map { it.toKmpLocationReview() }

/**
 * Converte uma lista de LocationReview KMP para LocationReview Android.
 */
fun List<KmpLocationReview>.toAndroidLocationReviews(): List<AndroidLocationReview> = map { it.toAndroidLocationReview() }

// ========== AppNotification Mappers ==========

/**
 * Converte NotificationType Android para NotificationType KMP.
 */
fun AndroidNotificationType.toKmpNotificationType(): KmpNotificationType {
    return when (this) {
        AndroidNotificationType.GROUP_INVITE -> KmpNotificationType.GROUP_INVITE
        AndroidNotificationType.GROUP_INVITE_ACCEPTED -> KmpNotificationType.GROUP_INVITE_ACCEPTED
        AndroidNotificationType.GROUP_INVITE_DECLINED -> KmpNotificationType.GROUP_INVITE_DECLINED
        AndroidNotificationType.GAME_SUMMON -> KmpNotificationType.GAME_SUMMON
        AndroidNotificationType.GAME_REMINDER -> KmpNotificationType.GAME_REMINDER
        AndroidNotificationType.GAME_CANCELLED -> KmpNotificationType.GAME_CANCELLED
        AndroidNotificationType.GAME_CONFIRMED -> KmpNotificationType.GAME_CONFIRMED
        AndroidNotificationType.MEMBER_JOINED -> KmpNotificationType.MEMBER_JOINED
        AndroidNotificationType.MEMBER_LEFT -> KmpNotificationType.MEMBER_LEFT
        AndroidNotificationType.CASHBOX_ENTRY -> KmpNotificationType.CASHBOX_ENTRY
        AndroidNotificationType.CASHBOX_EXIT -> KmpNotificationType.CASHBOX_EXIT
        AndroidNotificationType.ACHIEVEMENT -> KmpNotificationType.ACHIEVEMENT
        AndroidNotificationType.ADMIN_MESSAGE -> KmpNotificationType.ADMIN_MESSAGE
        AndroidNotificationType.SYSTEM -> KmpNotificationType.SYSTEM
        AndroidNotificationType.GENERAL -> KmpNotificationType.GENERAL
    }
}

/**
 * Converte NotificationType KMP para NotificationType Android.
 */
fun KmpNotificationType.toAndroidNotificationType(): AndroidNotificationType {
    return when (this) {
        KmpNotificationType.GROUP_INVITE -> AndroidNotificationType.GROUP_INVITE
        KmpNotificationType.GROUP_INVITE_ACCEPTED -> AndroidNotificationType.GROUP_INVITE_ACCEPTED
        KmpNotificationType.GROUP_INVITE_DECLINED -> AndroidNotificationType.GROUP_INVITE_DECLINED
        KmpNotificationType.GAME_SUMMON -> AndroidNotificationType.GAME_SUMMON
        KmpNotificationType.GAME_REMINDER -> AndroidNotificationType.GAME_REMINDER
        KmpNotificationType.GAME_CANCELLED -> AndroidNotificationType.GAME_CANCELLED
        KmpNotificationType.GAME_CONFIRMED -> AndroidNotificationType.GAME_CONFIRMED
        KmpNotificationType.MEMBER_JOINED -> AndroidNotificationType.MEMBER_JOINED
        KmpNotificationType.MEMBER_LEFT -> AndroidNotificationType.MEMBER_LEFT
        KmpNotificationType.CASHBOX_ENTRY -> AndroidNotificationType.CASHBOX_ENTRY
        KmpNotificationType.CASHBOX_EXIT -> AndroidNotificationType.CASHBOX_EXIT
        KmpNotificationType.ACHIEVEMENT -> AndroidNotificationType.ACHIEVEMENT
        KmpNotificationType.ADMIN_MESSAGE -> AndroidNotificationType.ADMIN_MESSAGE
        KmpNotificationType.SYSTEM -> AndroidNotificationType.SYSTEM
        KmpNotificationType.GENERAL -> AndroidNotificationType.GENERAL
    }
}

/**
 * Converte AppNotification Android para AppNotification KMP.
 */
fun AndroidAppNotification.toKmpAppNotification(): KmpAppNotification {
    return KmpAppNotification(
        id = id,
        userId = userId,
        type = try {
            AndroidNotificationType.valueOf(type).toKmpNotificationType()
        } catch (e: Exception) {
            KmpNotificationType.GENERAL
        },
        title = title,
        message = message,
        senderId = senderId,
        senderName = senderName,
        senderPhoto = senderPhoto,
        referenceId = referenceId,
        referenceType = referenceType,
        actionType = try {
            NotificationAction.valueOf(actionType ?: "VIEW_DETAILS")
        } catch (e: Exception) {
            NotificationAction.VIEW_DETAILS
        },
        read = read,
        readAt = readAt?.time,
        createdAt = createdAt?.time,
        expiresAt = expiresAt?.time
    )
}

/**
 * Converte AppNotification KMP para AppNotification Android.
 */
fun KmpAppNotification.toAndroidAppNotification(): AndroidAppNotification {
    return AndroidAppNotification(
        id = id,
        userId = userId,
        type = type.toAndroidNotificationType().name, // Converter enum para String
        title = title,
        message = message,
        senderId = senderId,
        senderName = senderName,
        senderPhoto = senderPhoto,
        referenceId = referenceId,
        referenceType = referenceType,
        actionType = actionType.name,
        read = read,
        readAt = readAt?.let { java.util.Date(it) },
        createdAtRaw = createdAt?.let { java.util.Date(it) },
        expiresAtRaw = expiresAt?.let { java.util.Date(it) }
    )
}

/**
 * Converte uma lista de AppNotification Android para AppNotification KMP.
 */
fun List<AndroidAppNotification>.toKmpAppNotifications(): List<KmpAppNotification> = map { it.toKmpAppNotification() }

/**
 * Converte uma lista de AppNotification KMP para AppNotification Android.
 */
fun List<KmpAppNotification>.toAndroidAppNotifications(): List<AndroidAppNotification> = map { it.toAndroidAppNotification() }

// ========== UserBadge Mappers ==========

/**
 * Converte UserBadge Android para UserBadge KMP.
 */
fun AndroidUserBadge.toKmpUserBadge(): KmpUserBadge {
    return KmpUserBadge(
        id = id,
        userId = userId,
        badgeId = badgeId,
        unlockedAt = unlockedAt?.time ?: 0,
        unlockCount = count
    )
}

/**
 * Converte UserBadge KMP para UserBadge Android.
 */
fun KmpUserBadge.toAndroidUserBadge(): AndroidUserBadge {
    return AndroidUserBadge(
        id = id,
        userId = userId,
        badgeId = badgeId,
        count = unlockCount,
        unlockedAt = if (unlockedAt > 0) java.util.Date(unlockedAt) else null,
        lastEarnedAt = if (unlockedAt > 0) java.util.Date(unlockedAt) else null
    )
}

/**
 * Converte uma lista de UserBadge Android para UserBadge KMP.
 */
fun List<AndroidUserBadge>.toKmpUserBadges(): List<KmpUserBadge> = map { it.toKmpUserBadge() }

/**
 * Converte uma lista de UserBadge KMP para UserBadge Android.
 */
fun List<KmpUserBadge>.toAndroidUserBadges(): List<AndroidUserBadge> = map { it.toAndroidUserBadge() }

// ========== Game Mappers ==========

/**
 * Converte Game Android para Game KMP.
 */
fun AndroidGame.toKmpGame(): KmpGame {
    return KmpGame(
        id = id,
        scheduleId = scheduleId,
        date = date,
        time = time,
        endTime = endTime,
        status = status,
        maxPlayers = maxPlayers,
        maxGoalkeepers = maxGoalkeepers,
        playersCount = playersCount,
        goalkeepersCount = goalkeepersCount,
        dailyPrice = dailyPrice,
        totalCost = totalCost,
        pixKey = pixKey,
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
        visibility = getVisibilityEnum().name,
        createdAt = dateTime?.time,
        xpProcessed = xpProcessed,
        mvpId = mvpId,
        team1Score = team1Score,
        team2Score = team2Score,
        team1Name = team1Name,
        team2Name = team2Name,
        groupId = groupId,
        groupName = groupName
    )
}

/**
 * Converte Game KMP para Game Android.
 */
fun KmpGame.toAndroidGame(): AndroidGame {
    val visibilityEnum = try {
        KmpGameVisibility.valueOf(visibility)
    } catch (e: Exception) {
        KmpGameVisibility.GROUP_ONLY
    }

    return AndroidGame(
        id = id,
        scheduleId = scheduleId,
        date = date,
        time = time,
        endTime = endTime,
        status = status,
        maxPlayers = maxPlayers,
        maxGoalkeepers = maxGoalkeepers,
        playersCount = playersCount,
        goalkeepersCount = goalkeepersCount,
        players = emptyList(),
        dailyPrice = dailyPrice,
        confirmationClosesAt = null,
        totalCost = totalCost,
        pixKey = pixKey,
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
        isPublic = visibilityEnum != KmpGameVisibility.GROUP_ONLY,
        visibility = visibility,
        dateTimeRaw = createdAt?.let { java.util.Date(it) },
        createdAt = createdAt?.let { java.util.Date(it) },
        xpProcessed = xpProcessed,
        xpProcessedAt = null,
        mvpId = mvpId,
        team1Score = team1Score,
        team2Score = team2Score,
        team1Name = team1Name,
        team2Name = team2Name,
        groupId = groupId,
        groupName = groupName
    )
}

/**
 * Converte uma lista de Game Android para Game KMP.
 */
fun List<AndroidGame>.toKmpGames(): List<KmpGame> = map { it.toKmpGame() }

/**
 * Converte uma lista de Game KMP para Game Android.
 */
fun List<KmpGame>.toAndroidGames(): List<AndroidGame> = map { it.toAndroidGame() }

// ========== Group Mappers ==========

/**
 * Converte Group Android para Group KMP.
 */
fun AndroidGroup.toKmpGroup(): KmpGroup {
    return KmpGroup(
        id = id,
        name = name,
        description = description,
        photoUrl = photoUrl,
        ownerId = ownerId,
        ownerName = ownerName,
        membersCount = memberCount,
        gamesCount = 0,
        isPublic = isPublic,
        inviteCode = null,
        pixKey = null,
        defaultLocationId = null,
        defaultLocationName = null,
        defaultDayOfWeek = null,
        defaultTime = null,
        defaultMaxPlayers = 14,
        defaultPrice = 0.0,
        createdAt = createdAt?.time,
        updatedAt = updatedAt?.time
    )
}

/**
 * Converte Group KMP para Group Android.
 */
fun KmpGroup.toAndroidGroup(): AndroidGroup {
    return AndroidGroup(
        id = id,
        name = name,
        description = description,
        photoUrl = photoUrl,
        ownerId = ownerId,
        ownerName = ownerName,
        memberCount = membersCount,
        status = "ACTIVE",
        createdAt = createdAt?.let { java.util.Date(it) },
        updatedAt = updatedAt?.let { java.util.Date(it) },
        isPublic = isPublic
    )
}

/**
 * Converte uma lista de Group Android para Group KMP.
 */
fun List<AndroidGroup>.toKmpGroups(): List<KmpGroup> = map { it.toKmpGroup() }

/**
 * Converte uma lista de Group KMP para Group Android.
 */
fun List<KmpGroup>.toAndroidGroups(): List<AndroidGroup> = map { it.toAndroidGroup() }

// ========== GroupMember Mappers ==========

/**
 * Converte GroupMemberRole Android para GroupMemberRole KMP.
 */
fun AndroidGroupMemberRole.toKmpGroupMemberRole(): KmpGroupMemberRole {
    return when (this) {
        AndroidGroupMemberRole.OWNER -> KmpGroupMemberRole.OWNER
        AndroidGroupMemberRole.ADMIN -> KmpGroupMemberRole.ADMIN
        AndroidGroupMemberRole.MEMBER -> KmpGroupMemberRole.MEMBER
    }
}

/**
 * Converte GroupMemberRole KMP para GroupMemberRole Android.
 */
fun KmpGroupMemberRole.toAndroidGroupMemberRole(): AndroidGroupMemberRole {
    return when (this) {
        KmpGroupMemberRole.OWNER -> AndroidGroupMemberRole.OWNER
        KmpGroupMemberRole.ADMIN -> AndroidGroupMemberRole.ADMIN
        KmpGroupMemberRole.MEMBER -> AndroidGroupMemberRole.MEMBER
    }
}

/**
 * Converte GroupMember Android para GroupMember KMP.
 */
fun AndroidGroupMember.toKmpGroupMember(): KmpGroupMember {
    return KmpGroupMember(
        id = id,
        groupId = "", // Nao disponivel no Android model
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        role = role, // Ja é String no Android model
        nickname = nickname,
        joinedAt = joinedAt?.time,
        gamesPlayed = 0,
        goals = 0,
        assists = 0
    )
}

/**
 * Converte GroupMember KMP para GroupMember Android.
 */
fun KmpGroupMember.toAndroidGroupMember(): AndroidGroupMember {
    val roleEnum = try {
        AndroidGroupMemberRole.valueOf(role)
    } catch (e: Exception) {
        AndroidGroupMemberRole.MEMBER
    }

    return AndroidGroupMember(
        id = id,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        role = roleEnum.name, // Converter enum para String
        status = "ACTIVE",
        joinedAt = joinedAt?.let { java.util.Date(it) },
        invitedBy = null,
        nickname = nickname
    )
}

/**
 * Converte uma lista de GroupMember Android para GroupMember KMP.
 */
fun List<AndroidGroupMember>.toKmpGroupMembers(): List<KmpGroupMember> = map { it.toKmpGroupMember() }

/**
 * Converte uma lista de GroupMember KMP para GroupMember Android.
 */
fun List<KmpGroupMember>.toAndroidGroupMembers(): List<AndroidGroupMember> = map { it.toAndroidGroupMember() }

// ========== UserGroup Mappers ==========

/**
 * Converte UserGroup Android para UserGroup KMP.
 */
fun AndroidUserGroup.toKmpUserGroup(): KmpUserGroup {
    return KmpUserGroup(
        id = id,
        userId = "", // Nao disponivel no Android model
        groupId = groupId,
        groupName = groupName,
        groupPhoto = groupPhoto,
        role = role, // Ja é String no Android model
        joinedAt = joinedAt?.time
    )
}

/**
 * Converte UserGroup KMP para UserGroup Android.
 */
fun KmpUserGroup.toAndroidUserGroup(): AndroidUserGroup {
    val roleEnum = try {
        AndroidGroupMemberRole.valueOf(role)
    } catch (e: Exception) {
        AndroidGroupMemberRole.MEMBER
    }

    return AndroidUserGroup(
        id = id,
        groupId = groupId,
        groupName = groupName,
        groupPhoto = groupPhoto,
        role = roleEnum.name, // Converter enum para String
        memberCount = 0, // Nao disponivel no KMP model
        joinedAt = joinedAt?.let { java.util.Date(it) }
    )
}

/**
 * Converte uma lista de UserGroup Android para UserGroup KMP.
 */
fun List<AndroidUserGroup>.toKmpUserGroups(): List<KmpUserGroup> = map { it.toKmpUserGroup() }

/**
 * Converte uma lista de UserGroup KMP para UserGroup Android.
 */
fun List<KmpUserGroup>.toAndroidUserGroups(): List<AndroidUserGroup> = map { it.toAndroidUserGroup() }

// ========== Cashbox Mappers ==========

/**
 * Converte CashboxEntryType Android para CashboxEntryType KMP.
 */
fun AndroidCashboxEntryType.toKmpCashboxEntryType(): KmpCashboxEntryType {
    return when (this) {
        AndroidCashboxEntryType.INCOME -> KmpCashboxEntryType.INCOME
        AndroidCashboxEntryType.EXPENSE -> KmpCashboxEntryType.EXPENSE
    }
}

/**
 * Converte CashboxEntryType KMP para CashboxEntryType Android.
 */
fun KmpCashboxEntryType.toAndroidCashboxEntryType(): AndroidCashboxEntryType {
    return when (this) {
        KmpCashboxEntryType.INCOME -> AndroidCashboxEntryType.INCOME
        KmpCashboxEntryType.EXPENSE -> AndroidCashboxEntryType.EXPENSE
    }
}

/**
 * Converte CashboxCategory Android para CashboxCategory KMP.
 */
fun AndroidCashboxCategory.toKmpCashboxCategory(): KmpCashboxCategory {
    return when (this) {
        AndroidCashboxCategory.MONTHLY_FEE -> KmpCashboxCategory.MONTHLY_FEE
        AndroidCashboxCategory.WEEKLY_FEE -> KmpCashboxCategory.WEEKLY_FEE
        AndroidCashboxCategory.SINGLE_PAYMENT -> KmpCashboxCategory.SINGLE_PAYMENT
        AndroidCashboxCategory.DONATION -> KmpCashboxCategory.DONATION
        AndroidCashboxCategory.FIELD_RENTAL -> KmpCashboxCategory.FIELD_RENTAL
        AndroidCashboxCategory.EQUIPMENT -> KmpCashboxCategory.EQUIPMENT
        AndroidCashboxCategory.CELEBRATION -> KmpCashboxCategory.CELEBRATION
        AndroidCashboxCategory.REFUND -> KmpCashboxCategory.REFUND
        AndroidCashboxCategory.OTHER -> KmpCashboxCategory.OTHER
    }
}

/**
 * Converte CashboxCategory KMP para CashboxCategory Android.
 */
fun KmpCashboxCategory.toAndroidCashboxCategory(): AndroidCashboxCategory {
    return when (this) {
        KmpCashboxCategory.MONTHLY_FEE -> AndroidCashboxCategory.MONTHLY_FEE
        KmpCashboxCategory.WEEKLY_FEE -> AndroidCashboxCategory.WEEKLY_FEE
        KmpCashboxCategory.SINGLE_PAYMENT -> AndroidCashboxCategory.SINGLE_PAYMENT
        KmpCashboxCategory.DONATION -> AndroidCashboxCategory.DONATION
        KmpCashboxCategory.FIELD_RENTAL -> AndroidCashboxCategory.FIELD_RENTAL
        KmpCashboxCategory.EQUIPMENT -> AndroidCashboxCategory.EQUIPMENT
        KmpCashboxCategory.CELEBRATION -> AndroidCashboxCategory.CELEBRATION
        KmpCashboxCategory.REFUND -> AndroidCashboxCategory.REFUND
        KmpCashboxCategory.OTHER -> AndroidCashboxCategory.OTHER
    }
}

/**
 * Converte CashboxEntry Android para CashboxEntry KMP.
 */
fun AndroidCashboxEntry.toKmpCashboxEntry(): KmpCashboxEntry {
    return KmpCashboxEntry(
        id = id,
        type = type,
        category = category,
        customCategory = customCategory,
        amount = amount,
        description = description,
        createdById = createdById,
        createdByName = createdByName,
        referenceDate = kotlinx.datetime.Clock.System.now(), // Default to now, can be improved
        createdAt = createdAt?.time?.let { Instant.fromEpochMilliseconds(it) },
        playerId = playerId,
        playerName = playerName,
        gameId = gameId,
        receiptUrl = receiptUrl,
        status = status,
        voidedAt = voidedAt?.time?.let { Instant.fromEpochMilliseconds(it) },
        voidedBy = voidedBy
    )
}

/**
 * Converte CashboxEntry KMP para CashboxEntry Android.
 */
fun KmpCashboxEntry.toAndroidCashboxEntry(): AndroidCashboxEntry {
    return AndroidCashboxEntry(
        id = id,
        type = type,
        category = category,
        customCategory = customCategory,
        amount = amount,
        description = description,
        createdById = createdById,
        createdByName = createdByName,
        referenceDate = java.util.Date(referenceDate.toEpochMilliseconds()),
        createdAt = createdAt?.toEpochMilliseconds()?.let { java.util.Date(it) },
        playerId = playerId,
        playerName = playerName,
        gameId = gameId,
        receiptUrl = receiptUrl,
        status = status,
        voidedAt = voidedAt?.toEpochMilliseconds()?.let { java.util.Date(it) },
        voidedBy = voidedBy
    )
}

/**
 * Converte uma lista de CashboxEntry Android para CashboxEntry KMP.
 */
fun List<AndroidCashboxEntry>.toKmpCashboxEntries(): List<KmpCashboxEntry> = map { it.toKmpCashboxEntry() }

/**
 * Converte uma lista de CashboxEntry KMP para CashboxEntry Android.
 */
fun List<KmpCashboxEntry>.toAndroidCashboxEntries(): List<AndroidCashboxEntry> = map { it.toAndroidCashboxEntry() }

/**
 * Converte CashboxSummary Android para CashboxSummary KMP.
 */
fun AndroidCashboxSummary.toKmpCashboxSummary(): KmpCashboxSummary {
    return KmpCashboxSummary(
        balance = balance,
        totalIncome = totalIncome,
        totalExpense = totalExpense,
        lastEntryAt = lastEntryAt?.time?.let { Instant.fromEpochMilliseconds(it) },
        entryCount = entryCount
    )
}

/**
 * Converte CashboxSummary KMP para CashboxSummary Android.
 */
fun KmpCashboxSummary.toAndroidCashboxSummary(): AndroidCashboxSummary {
    return AndroidCashboxSummary(
        balance = balance,
        totalIncome = totalIncome,
        totalExpense = totalExpense,
        lastEntryAt = lastEntryAt?.toEpochMilliseconds()?.let { java.util.Date(it) },
        entryCount = entryCount
    )
}

/**
 * Converte CashboxFilter Android para CashboxFilter KMP.
 */
fun AndroidCashboxFilter.toKmpCashboxFilter(): KmpCashboxFilter {
    return KmpCashboxFilter(
        type = type?.toKmpCashboxEntryType(),
        category = category?.toKmpCashboxCategory(),
        startDate = startDate?.time?.let { Instant.fromEpochMilliseconds(it) },
        endDate = endDate?.time?.let { Instant.fromEpochMilliseconds(it) },
        playerId = playerId
    )
}

/**
 * Converte CashboxFilter KMP para CashboxFilter Android.
 */
fun KmpCashboxFilter.toAndroidCashboxFilter(): AndroidCashboxFilter {
    return AndroidCashboxFilter(
        type = type?.toAndroidCashboxEntryType(),
        category = category?.toAndroidCashboxCategory(),
        startDate = startDate?.toEpochMilliseconds()?.let { java.util.Date(it) },
        endDate = endDate?.toEpochMilliseconds()?.let { java.util.Date(it) },
        playerId = playerId
    )
}

// ========== Schedule Mappers ==========

/**
 * Converte RecurrenceType Android para RecurrenceType KMP.
 */
fun AndroidRecurrenceType.toKmpRecurrenceType(): KmpRecurrenceType {
    return when (this) {
        AndroidRecurrenceType.weekly -> KmpRecurrenceType.WEEKLY
        AndroidRecurrenceType.biweekly -> KmpRecurrenceType.BIWEEKLY
        AndroidRecurrenceType.monthly -> KmpRecurrenceType.MONTHLY
    }
}

/**
 * Converte RecurrenceType KMP para RecurrenceType Android.
 */
fun KmpRecurrenceType.toAndroidRecurrenceType(): AndroidRecurrenceType {
    return when (this) {
        KmpRecurrenceType.WEEKLY -> AndroidRecurrenceType.weekly
        KmpRecurrenceType.BIWEEKLY -> AndroidRecurrenceType.biweekly
        KmpRecurrenceType.MONTHLY -> AndroidRecurrenceType.monthly
    }
}

/**
 * Converte Schedule Android para Schedule KMP.
 */
fun AndroidSchedule.toKmpSchedule(): KmpSchedule {
    return KmpSchedule(
        id = id,
        ownerId = ownerId,
        ownerName = ownerName,
        name = name,
        locationId = locationId,
        locationName = locationName,
        locationAddress = locationAddress,
        locationLat = locationLat,
        locationLng = locationLng,
        fieldId = fieldId,
        fieldName = fieldName,
        fieldType = fieldType,
        recurrenceType = recurrenceType.toKmpRecurrenceType(),
        dayOfWeek = dayOfWeek,
        time = time,
        duration = duration,
        isPublic = isPublic,
        maxPlayers = maxPlayers,
        dailyPrice = dailyPrice,
        monthlyPrice = monthlyPrice,
        groupId = groupId,
        groupName = groupName,
        memberIds = memberIds,
        createdAt = createdAt?.time
    )
}

/**
 * Converte Schedule KMP para Schedule Android.
 */
fun KmpSchedule.toAndroidSchedule(): AndroidSchedule {
    return AndroidSchedule(
        id = id,
        ownerId = ownerId,
        ownerName = ownerName,
        name = name,
        locationId = locationId,
        locationName = locationName,
        locationAddress = locationAddress,
        locationLat = locationLat,
        locationLng = locationLng,
        fieldId = fieldId,
        fieldName = fieldName,
        fieldType = fieldType,
        recurrenceType = recurrenceType.toAndroidRecurrenceType(),
        dayOfWeek = dayOfWeek,
        time = time,
        duration = duration,
        isPublic = isPublic,
        maxPlayers = maxPlayers,
        dailyPrice = dailyPrice,
        monthlyPrice = monthlyPrice,
        groupId = groupId,
        groupName = groupName,
        memberIds = memberIds,
        createdAt = createdAt?.let { java.util.Date(it) }
    )
}

/**
 * Converte uma lista de Schedule Android para Schedule KMP.
 */
fun List<AndroidSchedule>.toKmpSchedules(): List<KmpSchedule> = map { it.toKmpSchedule() }

/**
 * Converte uma lista de Schedule KMP para Schedule Android.
 */
fun List<KmpSchedule>.toAndroidSchedules(): List<AndroidSchedule> = map { it.toAndroidSchedule() }

// ========== GroupInvite Mappers ==========

/**
 * Converte InviteStatus Android para InviteStatus KMP.
 */
fun AndroidInviteStatus.toKmpInviteStatus(): KmpInviteStatus {
    return when (this) {
        AndroidInviteStatus.PENDING -> KmpInviteStatus.PENDING
        AndroidInviteStatus.ACCEPTED -> KmpInviteStatus.ACCEPTED
        AndroidInviteStatus.DECLINED -> KmpInviteStatus.DECLINED
        AndroidInviteStatus.EXPIRED -> KmpInviteStatus.EXPIRED
        AndroidInviteStatus.CANCELLED -> KmpInviteStatus.CANCELLED
    }
}

/**
 * Converte InviteStatus KMP para InviteStatus Android.
 */
fun KmpInviteStatus.toAndroidInviteStatus(): AndroidInviteStatus {
    return when (this) {
        KmpInviteStatus.PENDING -> AndroidInviteStatus.PENDING
        KmpInviteStatus.ACCEPTED -> AndroidInviteStatus.ACCEPTED
        KmpInviteStatus.DECLINED -> AndroidInviteStatus.DECLINED
        KmpInviteStatus.EXPIRED -> AndroidInviteStatus.EXPIRED
        KmpInviteStatus.CANCELLED -> AndroidInviteStatus.CANCELLED
    }
}

/**
 * Converte GroupInvite Android para GroupInvite KMP.
 */
fun AndroidGroupInvite.toKmpGroupInvite(): KmpGroupInvite {
    return KmpGroupInvite(
        id = id,
        groupId = groupId,
        groupName = groupName,
        groupPhoto = groupPhoto,
        invitedUserId = invitedUserId,
        invitedUserName = invitedUserName,
        invitedUserEmail = invitedUserEmail,
        invitedById = invitedById,
        invitedByName = invitedByName,
        status = status,
        createdAt = createdAt?.time,
        expiresAt = expiresAt?.time,
        respondedAt = respondedAt?.time
    )
}

/**
 * Converte GroupInvite KMP para GroupInvite Android.
 */
fun KmpGroupInvite.toAndroidGroupInvite(): AndroidGroupInvite {
    return AndroidGroupInvite(
        id = id,
        groupId = groupId,
        groupName = groupName,
        groupPhoto = groupPhoto,
        invitedUserId = invitedUserId,
        invitedUserName = invitedUserName,
        invitedUserEmail = invitedUserEmail,
        invitedById = invitedById,
        invitedByName = invitedByName,
        status = status,
        createdAt = createdAt?.let { java.util.Date(it) },
        expiresAt = expiresAt?.let { java.util.Date(it) },
        respondedAt = respondedAt?.let { java.util.Date(it) }
    )
}

/**
 * Converte uma lista de GroupInvite Android para GroupInvite KMP.
 */
fun List<AndroidGroupInvite>.toKmpGroupInvites(): List<KmpGroupInvite> = map { it.toKmpGroupInvite() }

/**
 * Converte uma lista de GroupInvite KMP para GroupInvite Android.
 */
fun List<KmpGroupInvite>.toAndroidGroupInvites(): List<AndroidGroupInvite> = map { it.toAndroidGroupInvite() }

// ========== GameTemplate Mappers ==========

/**
 * Converte GameTemplate Android para GameTemplate KMP.
 */
fun AndroidGameTemplate.toKmpGameTemplate(): KmpGameTemplate {
    return KmpGameTemplate(
        id = id,
        userId = userId,
        templateName = templateName,
        locationName = locationName,
        locationAddress = locationAddress,
        locationId = locationId,
        fieldName = fieldName,
        fieldId = fieldId,
        gameTime = gameTime,
        gameEndTime = gameEndTime,
        maxPlayers = maxPlayers,
        dailyPrice = dailyPrice,
        recurrence = recurrence,
        createdAt = createdAt?.time
    )
}

/**
 * Converte GameTemplate KMP para GameTemplate Android.
 */
fun KmpGameTemplate.toAndroidGameTemplate(): AndroidGameTemplate {
    return AndroidGameTemplate(
        id = id,
        userId = userId,
        templateName = templateName,
        locationName = locationName,
        locationAddress = locationAddress,
        locationId = locationId,
        fieldName = fieldName,
        fieldId = fieldId,
        gameTime = gameTime,
        gameEndTime = gameEndTime,
        maxPlayers = maxPlayers,
        dailyPrice = dailyPrice,
        recurrence = recurrence,
        createdAt = createdAt?.let { java.util.Date(it) }
    )
}

/**
 * Converte uma lista de GameTemplate Android para GameTemplate KMP.
 */
fun List<AndroidGameTemplate>.toKmpGameTemplates(): List<KmpGameTemplate> = map { it.toKmpGameTemplate() }

/**
 * Converte uma lista de GameTemplate KMP para GameTemplate Android.
 */
fun List<KmpGameTemplate>.toAndroidGameTemplates(): List<AndroidGameTemplate> = map { it.toAndroidGameTemplate() }

// ========== GameExperience Mappers (MVPVote, LiveScore, TacticalBoard, SocialCard) ==========

/**
 * Converte MVPVote Android para MVPVote KMP.
 */
fun AndroidMVPVote.toKmpMVPVote(): com.futebadosparcas.domain.model.MVPVote {
    return com.futebadosparcas.domain.model.MVPVote(
        id = id,
        gameId = gameId,
        voterId = voterId,
        votedPlayerId = votedPlayerId,
        category = when (category) {
            VoteCategory.MVP -> com.futebadosparcas.domain.model.VoteCategory.MVP
            VoteCategory.WORST -> com.futebadosparcas.domain.model.VoteCategory.WORST
            VoteCategory.BEST_GOALKEEPER -> com.futebadosparcas.domain.model.VoteCategory.BEST_GOALKEEPER
        },
        votedAt = votedAt?.time
    )
}

/**
 * Converte MVPVote KMP para MVPVote Android.
 */
fun com.futebadosparcas.domain.model.MVPVote.toAndroidMVPVote(): AndroidMVPVote {
    return AndroidMVPVote(
        id = id,
        gameId = gameId,
        voterId = voterId,
        votedPlayerId = votedPlayerId,
        category = when (this.category) {
            com.futebadosparcas.domain.model.VoteCategory.MVP -> VoteCategory.MVP
            com.futebadosparcas.domain.model.VoteCategory.WORST -> VoteCategory.WORST
            com.futebadosparcas.domain.model.VoteCategory.BEST_GOALKEEPER -> VoteCategory.BEST_GOALKEEPER
        },
        votedAt = votedAt?.let { java.util.Date(it) }
    )
}

/**
 * Converte LiveScore Android para LiveScoreEvent KMP.
 * NOTA: LiveScoreEvent pode nao existir mais no modulo KMP.
 */
/*
fun AndroidLiveScore.toKmpLiveScoreEvent(): com.futebadosparcas.domain.model.LiveScoreEvent {
    return com.futebadosparcas.domain.model.LiveScoreEvent(
        id = id,
        gameId = gameId,
        playerId = playerId,
        teamId = teamId,
        eventType = when (eventType) {
            ScoreEventType.GOAL -> com.futebadosparcas.domain.model.ScoreEventType.GOAL
            ScoreEventType.OWN_GOAL -> com.futebadosparcas.domain.model.ScoreEventType.OWN_GOAL
            ScoreEventType.ASSIST -> com.futebadosparcas.domain.model.ScoreEventType.ASSIST
            ScoreEventType.SAVE -> com.futebadosparcas.domain.model.ScoreEventType.SAVE
            ScoreEventType.YELLOW_CARD -> com.futebadosparcas.domain.model.ScoreEventType.YELLOW_CARD
            ScoreEventType.RED_CARD -> com.futebadosparcas.domain.model.ScoreEventType.RED_CARD
        },
        minute = minute,
        assistedById = assistedById,
        reporterId = reporterId,
        createdAt = createdAt?.time
    )
}
*/

/**
 * Converte LiveScoreEvent KMP para LiveScore Android.
 * NOTA: LiveScoreEvent pode nao existir mais no modulo KMP.
 */
/*
fun com.futebadosparcas.domain.model.LiveScoreEvent.toAndroidLiveScore(): AndroidLiveScore {
    return AndroidLiveScore(
        id = id,
        gameId = gameId,
        playerId = playerId,
        teamId = teamId,
        eventType = when (this.eventType) {
            com.futebadosparcas.domain.model.ScoreEventType.GOAL -> ScoreEventType.GOAL
            com.futebadosparcas.domain.model.ScoreEventType.OWN_GOAL -> ScoreEventType.OWN_GOAL
            com.futebadosparcas.domain.model.ScoreEventType.ASSIST -> ScoreEventType.ASSIST
            com.futebadosparcas.domain.model.ScoreEventType.SAVE -> ScoreEventType.SAVE
            com.futebadosparcas.domain.model.ScoreEventType.YELLOW_CARD -> ScoreEventType.YELLOW_CARD
            com.futebadosparcas.domain.model.ScoreEventType.RED_CARD -> ScoreEventType.RED_CARD
        },
        minute = minute,
        assistedById = assistedById,
        reporterId = reporterId,
        createdAt = createdAt?.let { java.util.Date(it) }
    )
}
*/

/**
 * Converte TacticalBoard Android para TacticalBoard KMP.
 * NOTA: TacticalBoard pode nao existir mais no modulo KMP.
 */
/*
fun AndroidTacticalBoard.toKmpTacticalBoard(): com.futebadosparcas.domain.model.TacticalBoard {
    return com.futebadosparcas.domain.model.TacticalBoard(
        id = id,
        gameId = gameId,
        creatorId = creatorId,
        formationName = formationName,
        playerPositions = playerPositions.mapKeys { it.key }
            .mapValues { AndroidTacticalPlayerPosition.toKmp(it.value) },
        notes = notes,
        imageUrl = imageUrl,
        createdAt = createdAt?.time
    )
}
*/

/**
 * Converte TacticalBoard KMP para TacticalBoard Android.
 * NOTA: TacticalBoard pode nao existir mais no modulo KMP.
 */
/*
fun com.futebadosparcas.domain.model.TacticalBoard.toAndroidTacticalBoard(): AndroidTacticalBoard {
    return AndroidTacticalBoard(
        id = id,
        gameId = gameId,
        creatorId = creatorId,
        formationName = formationName,
        playerPositions = playerPositions.mapKeys { it.key }
            .mapValues { com.futebadosparcas.domain.model.TacticalPlayerPosition.toAndroid(it.value) },
        notes = notes,
        imageUrl = imageUrl,
        createdAt = createdAt?.let { java.util.Date(it) }
    )
}
*/

/**
 * Converte TacticalPlayerPosition Android para TacticalPlayerPosition KMP.
 * NOTA: TacticalPlayerPosition nao existe mais no modulo KMP.
 */
/*
fun AndroidTacticalPlayerPosition.toKmp(): com.futebadosparcas.domain.model.TacticalPlayerPosition {
    return com.futebadosparcas.domain.model.TacticalPlayerPosition(
        playerId = playerId,
        x = x,
        y = y,
        role = role
    )
}
*/

/**
 * Converte TacticalPlayerPosition KMP para TacticalPlayerPosition Android.
 * NOTA: TacticalPlayerPosition nao existe mais no modulo KMP.
 */
/*
fun com.futebadosparcas.domain.model.TacticalPlayerPosition.toAndroid(): AndroidTacticalPlayerPosition {
    return AndroidTacticalPlayerPosition(
        playerId = playerId,
        x = x,
        y = y,
        role = role
    )
}
*/

// ========== GameSummon Mappers ==========

/**
 * Converte GameSummon Android para GameSummon KMP.
 */
fun AndroidGameSummon.toKmpGameSummon(): com.futebadosparcas.domain.model.GameSummon {
    return com.futebadosparcas.domain.model.GameSummon(
        id = id,
        gameId = gameId,
        groupId = groupId,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        status = status,
        position = position,
        summonedBy = summonedBy,
        summonedByName = summonedByName,
        summonedAt = summonedAt?.time,
        respondedAt = respondedAt?.time
    )
}

/**
 * Converte GameSummon KMP para GameSummon Android.
 */
fun com.futebadosparcas.domain.model.GameSummon.toAndroidGameSummon(): AndroidGameSummon {
    return AndroidGameSummon(
        id = id,
        gameId = gameId,
        groupId = groupId,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        status = status,
        position = position,
        summonedBy = summonedBy,
        summonedByName = summonedByName,
        summonedAt = summonedAt?.let { java.util.Date(it) },
        respondedAt = respondedAt?.let { java.util.Date(it) }
    )
}

/**
 * Converte UpcomingGame Android para UpcomingGame KMP.
 */
fun AndroidUpcomingGame.toKmpUpcomingGame(): com.futebadosparcas.domain.model.UpcomingGame {
    return com.futebadosparcas.domain.model.UpcomingGame(
        id = id,
        gameId = gameId,
        groupId = groupId,
        groupName = groupName,
        dateTime = dateTime.time,
        locationName = locationName,
        locationAddress = locationAddress,
        fieldName = fieldName,
        status = status,
        myPosition = myPosition,
        confirmedCount = confirmedCount,
        maxPlayers = maxPlayers
    )
}

/**
 * Converte UpcomingGame KMP para UpcomingGame Android.
 */
fun com.futebadosparcas.domain.model.UpcomingGame.toAndroidUpcomingGame(): AndroidUpcomingGame {
    return AndroidUpcomingGame(
        id = id,
        gameId = gameId,
        groupId = groupId,
        groupName = groupName,
        dateTime = java.util.Date(dateTime),
        locationName = locationName,
        locationAddress = locationAddress,
        fieldName = fieldName,
        status = status,
        myPosition = myPosition,
        confirmedCount = confirmedCount,
        maxPlayers = maxPlayers
    )
}

// ========== GameRequest Mappers ==========

/**
 * Converte GameJoinRequest Android para GameJoinRequest KMP.
 */
fun AndroidGameJoinRequest.toKmpGameJoinRequest(): com.futebadosparcas.domain.model.GameJoinRequest {
    return com.futebadosparcas.domain.model.GameJoinRequest(
        id = id,
        gameId = gameId,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        userLevel = userLevel,
        userPosition = userPosition,
        message = message,
        status = status,
        requestedAt = requestedAt?.time,
        reviewedAt = reviewedAt?.time,
        reviewedBy = reviewedBy,
        rejectionReason = rejectionReason
    )
}

/**
 * Converte GameJoinRequest KMP para GameJoinRequest Android.
 */
fun com.futebadosparcas.domain.model.GameJoinRequest.toAndroidGameJoinRequest(): AndroidGameJoinRequest {
    return AndroidGameJoinRequest(
        id = id,
        gameId = gameId,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        userLevel = userLevel,
        userPosition = userPosition,
        message = message,
        status = status,
        requestedAt = requestedAt?.let { java.util.Date(it) },
        reviewedAt = reviewedAt?.let { java.util.Date(it) },
        reviewedBy = reviewedBy,
        rejectionReason = rejectionReason
    )
}

// ========== Gamification Mappers (Season, SeasonParticipation, UserBadge, etc.) ==========

/**
 * Converte Season Android para Season KMP.
 */
fun AndroidSeason.toKmpSeason(): com.futebadosparcas.domain.model.Season {
    return com.futebadosparcas.domain.model.Season(
        id = id,
        name = name,
        description = "", // Campo novo no KMP
        startDate = 0,    // Android usa String, KMP usa Long - conversao requer parser
        endDate = 0,      // Android usa String, KMP usa Long - conversao requer parser
        isActive = isActive,
        createdAt = createdAt?.time,
        closedAt = closedAt?.time
        // scheduleId nao existe mais no KMP
    )
}

/**
 * Converte Season KMP para Season Android.
 */
fun com.futebadosparcas.domain.model.Season.toAndroidSeason(): AndroidSeason {
    return AndroidSeason(
        id = id,
        name = name,
        startDate = "",  // KMP usa Long, Android usa String - conversao perdida
        endDate = "",    // KMP usa Long, Android usa String - conversao perdida
        isActive = isActive,
        scheduleId = "", // Campo nao existe mais no KMP
        createdAt = createdAt?.let { java.util.Date(it) },
        closedAt = closedAt?.let { java.util.Date(it) }
    )
}

/**
 * Converte SeasonParticipation Android para SeasonParticipation KMP.
 */
fun AndroidSeasonParticipation.toKmpSeasonParticipation(): com.futebadosparcas.domain.model.SeasonParticipation {
    return com.futebadosparcas.domain.model.SeasonParticipation(
        id = id,
        userId = userId,
        seasonId = seasonId,
        division = division.name,  // KMP usa String, nao enum
        leagueRating = 1000,        // Campo novo no KMP
        points = points,
        gamesPlayed = gamesPlayed,
        wins = wins,
        draws = draws,
        losses = losses,
        goals = goalsScored,        // KMP usa 'goals', nao 'goalsScored'
        assists = 0,                // Campo novo no KMP
        saves = 0,                  // Campo novo no KMP
        mvpCount = mvpCount,
        bestGkCount = 0,            // Campo novo no KMP
        worstPlayerCount = 0,       // Campo novo no KMP
        currentStreak = 0,          // Campo novo no KMP
        bestStreak = 0,             // Campo novo no KMP
        xpEarned = 0,               // Campo novo no KMP
        createdAt = null,           // AndroidSeasonParticipation nao tem createdAt
        updatedAt = null            // AndroidSeasonParticipation nao tem updatedAt
    )
}

/**
 * Converte SeasonParticipation KMP para SeasonParticipation Android.
 */
fun com.futebadosparcas.domain.model.SeasonParticipation.toAndroidSeasonParticipation(): AndroidSeasonParticipation {
    return AndroidSeasonParticipation(
        id = id,
        userId = userId,
        seasonId = seasonId,
        division = when (getDivisionEnum()) {
            com.futebadosparcas.domain.model.LeagueDivision.BRONZE -> LeagueDivision.BRONZE
            com.futebadosparcas.domain.model.LeagueDivision.PRATA -> LeagueDivision.PRATA
            com.futebadosparcas.domain.model.LeagueDivision.OURO -> LeagueDivision.OURO
            com.futebadosparcas.domain.model.LeagueDivision.DIAMANTE -> LeagueDivision.DIAMANTE
        },
        points = points,
        gamesPlayed = gamesPlayed,
        wins = wins,
        draws = draws,
        losses = losses,
        goalsScored = goals,  // KMP usa apenas 'goals'
        goalsConceded = 0,   // Campo nao existe mais no KMP
        mvpCount = mvpCount
    )
}

/**
 * Converte UserBadge Android para UserBadge KMP (compatibilidade com a verso j existente em shared).
 */
fun AndroidUserBadge.toKmpUserBadgeV2(): com.futebadosparcas.domain.model.UserBadge {
    return com.futebadosparcas.domain.model.UserBadge(
        id = id,
        userId = userId,
        badgeId = badgeId,
        unlockedAt = unlockedAt?.time ?: 0
        // 'count' nao existe mais no UserBadge KMP
    )
}

/**
 * Converte UserStreak Android para UserStreak KMP.
 */
fun AndroidUserStreak.toKmpUserStreak(): com.futebadosparcas.domain.model.UserStreak {
    return com.futebadosparcas.domain.model.UserStreak(
        id = id,
        userId = userId,
        scheduleId = scheduleId,
        currentStreak = currentStreak,
        longestStreak = longestStreak,
        lastGameDate = lastGameDate,
        streakStartedAt = streakStartedAt
    )
}

/**
 * Converte UserStreak KMP para UserStreak Android.
 */
fun com.futebadosparcas.domain.model.UserStreak.toAndroidUserStreak(): AndroidUserStreak {
    return AndroidUserStreak(
        id = id,
        userId = userId,
        scheduleId = scheduleId,
        currentStreak = currentStreak,
        longestStreak = longestStreak,
        lastGameDate = lastGameDate,
        streakStartedAt = streakStartedAt
    )
}

// ========== Ranking Mappers (XpLog, RankingEntryV2, RankingDocument) ==========

/**
 * Converte XpLog Android para XpLog KMP.
 */
fun AndroidXpLog.toKmpXpLog(): com.futebadosparcas.domain.model.XpLog {
    return com.futebadosparcas.domain.model.XpLog(
        id = id,
        userId = userId,
        gameId = gameId,
        xpEarned = xpEarned,
        xpBefore = xpBefore,
        xpAfter = xpAfter,
        levelBefore = levelBefore,
        levelAfter = levelAfter,
        xpParticipation = xpParticipation,
        xpGoals = xpGoals,
        xpAssists = xpAssists,
        xpSaves = xpSaves,
        xpResult = xpResult,
        xpMvp = xpMvp,
        xpMilestones = xpMilestones,
        xpStreak = xpStreak,
        goals = goals,
        assists = assists,
        saves = saves,
        wasMvp = wasMvp,
        gameResult = gameResult,
        milestonesUnlocked = milestonesUnlocked,
        createdAt = createdAt?.time
    )
}

/**
 * Converte XpLog KMP para XpLog Android.
 */
fun com.futebadosparcas.domain.model.XpLog.toAndroidXpLog(): AndroidXpLog {
    return AndroidXpLog(
        id = id,
        userId = userId,
        gameId = gameId,
        xpEarned = xpEarned,
        xpBefore = xpBefore,
        xpAfter = xpAfter,
        levelBefore = levelBefore,
        levelAfter = levelAfter,
        xpParticipation = xpParticipation,
        xpGoals = xpGoals,
        xpAssists = xpAssists,
        xpSaves = xpSaves,
        xpResult = xpResult,
        xpMvp = xpMvp,
        xpMilestones = xpMilestones,
        xpStreak = xpStreak,
        goals = goals,
        assists = assists,
        saves = saves,
        wasMvp = wasMvp,
        gameResult = gameResult,
        milestonesUnlocked = milestonesUnlocked,
        createdAt = createdAt?.let { java.util.Date(it) }
    )
}

/**
 * Converte RankingEntryV2 Android para RankingEntryV2 KMP.
 * NOTA: RankingEntryV2 nao existe mais no modulo KMP.
 */
/*
fun AndroidRankingEntryV2.toKmpRankingEntryV2(): com.futebadosparcas.domain.model.RankingEntryV2 {
    return com.futebadosparcas.domain.model.RankingEntryV2(
        rank = rank,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        value = value,
        gamesPlayed = gamesPlayed,
        average = average,
        nickname = nickname
    )
}
*/

/**
 * Converte RankingEntryV2 KMP para RankingEntryV2 Android.
 * NOTA: RankingEntryV2 nao existe mais no modulo KMP.
 */
/*
fun com.futebadosparcas.domain.model.RankingEntryV2.toAndroidRankingEntryV2(): AndroidRankingEntryV2 {
    return AndroidRankingEntryV2(
        rank = rank,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        value = value,
        gamesPlayed = gamesPlayed,
        average = average,
        nickname = nickname
    )
}
*/

/**
 * Converte RankingDocument Android para RankingDocument KMP.
 * NOTA: RankingDocument nao existe mais no modulo KMP.
 */
/*
fun AndroidRankingDocument.toKmpRankingDocument(): com.futebadosparcas.domain.model.RankingDocument {
    return com.futebadosparcas.domain.model.RankingDocument(
        id = id,
        period = period,
        periodKey = periodKey,
        category = category,
        entries = entries.map { it.toKmpRankingEntryV2() },
        minGames = minGames,
        updatedAt = updatedAt?.time
    )
}
*/

/**
 * Converte RankingDocument KMP para RankingDocument Android.
 * NOTA: RankingDocument nao existe mais no modulo KMP.
 */
/*
fun com.futebadosparcas.domain.model.RankingDocument.toAndroidRankingDocument(): AndroidRankingDocument {
    return AndroidRankingDocument(
        id = id,
        period = period,
        periodKey = periodKey,
        category = category,
        entries = entries.map { it.toAndroidRankingEntryV2() },
        minGames = minGames,
        updatedAt = updatedAt?.let { java.util.Date(it) }
    )
}
*/
