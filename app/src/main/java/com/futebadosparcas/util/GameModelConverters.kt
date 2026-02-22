package com.futebadosparcas.util

import com.futebadosparcas.data.model.Team as AndroidTeam
import com.futebadosparcas.data.model.GameConfirmation as AndroidGameConfirmation
import com.futebadosparcas.domain.model.Team as KmpTeam
import com.futebadosparcas.domain.model.GameConfirmation as KmpGameConfirmation

/**
 * Conversores entre modelos Android (data.model) e KMP (domain.model) para Team e GameConfirmation.
 */

// ============================================================================
// Team Converters
// ============================================================================

/**
 * Converte AndroidTeam para KmpTeam.
 */
fun AndroidTeam.toKmpTeam(): KmpTeam {
    return KmpTeam(
        id = id,
        gameId = gameId,
        name = name,
        color = color,
        playerIds = playerIds,
        score = score
    )
}

/**
 * Converte KmpTeam para AndroidTeam.
 */
fun KmpTeam.toAndroidTeam(): AndroidTeam {
    return AndroidTeam(
        id = id,
        gameId = gameId,
        name = name,
        color = color,
        playerIds = playerIds,
        score = score
    )
}

/**
 * Converte lista de AndroidTeam para lista de KmpTeam.
 */
fun List<AndroidTeam>.toKmpTeams(): List<KmpTeam> {
    return map { it.toKmpTeam() }
}

/**
 * Converte lista de KmpTeam para lista de AndroidTeam.
 */
fun List<KmpTeam>.toAndroidTeams(): List<AndroidTeam> {
    return map { it.toAndroidTeam() }
}

// ============================================================================
// GameConfirmation Converters
// ============================================================================

/**
 * Converte AndroidGameConfirmation para KmpGameConfirmation.
 */
fun AndroidGameConfirmation.toKmpGameConfirmation(): KmpGameConfirmation {
    return KmpGameConfirmation(
        id = id,
        gameId = gameId,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        position = position,
        teamId = null, // AndroidGameConfirmation não tem teamId
        status = status,
        paymentStatus = paymentStatus,
        isCasualPlayer = isCasualPlayer,
        goals = goals,
        assists = assists,
        saves = saves,
        yellowCards = yellowCards,
        redCards = redCards,
        nickname = nickname,
        xpEarned = xpEarned,
        isMvp = isMvp,
        isBestGk = isBestGk,
        isWorstPlayer = isWorstPlayer,
        confirmedAt = confirmedAt?.time,
        partialPayment = partialPayment,
        wasPresent = wasPresent
    )
}

/**
 * Converte KmpGameConfirmation para AndroidGameConfirmation.
 */
fun KmpGameConfirmation.toAndroidGameConfirmation(): AndroidGameConfirmation {
    return AndroidGameConfirmation(
        id = id,
        gameId = gameId,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        position = position,
        // teamId não existe em AndroidGameConfirmation
        status = status,
        paymentStatus = paymentStatus,
        isCasualPlayer = isCasualPlayer,
        goals = goals,
        assists = assists,
        saves = saves,
        yellowCards = yellowCards,
        redCards = redCards,
        nickname = nickname,
        xpEarned = xpEarned,
        isMvp = isMvp,
        isBestGk = isBestGk,
        isWorstPlayer = isWorstPlayer,
        confirmedAt = confirmedAt?.let { java.util.Date(it) },
        partialPayment = partialPayment,
        wasPresent = wasPresent
    )
}

/**
 * Converte lista de AndroidGameConfirmation para lista de KmpGameConfirmation.
 */
fun List<AndroidGameConfirmation>.toKmpGameConfirmations(): List<KmpGameConfirmation> {
    return map { it.toKmpGameConfirmation() }
}

/**
 * Converte lista de KmpGameConfirmation para lista de AndroidGameConfirmation.
 */
fun List<KmpGameConfirmation>.toAndroidGameConfirmations(): List<AndroidGameConfirmation> {
    return map { it.toAndroidGameConfirmation() }
}
