package com.futebadosparcas.util

import com.futebadosparcas.data.model.User as AndroidUser
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.domain.model.User as KmpUser

/**
 * Funções de conversão entre User Android (Firestore) e User KMP (domínio compartilhado).
 *
 * NOTA: Estas são soluções temporárias durante a migração KMP.
 * Quando a migração estiver completa, o AndroidUser será removido.
 */

/**
 * Converte User Android para User KMP.
 */
fun AndroidUser.toKmpUser(): KmpUser {
    return KmpUser(
        id = id,
        email = email,
        name = name,
        phone = phone,
        nickname = nickname,
        photoUrl = photoUrl,
        fcmToken = fcmToken,
        isSearchable = isSearchable,
        isProfilePublic = isProfilePublic,
        role = role,
        createdAt = createdAt?.time,
        updatedAt = updatedAt?.time,
        strikerRating = strikerRating,
        midRating = midRating,
        defenderRating = defenderRating,
        gkRating = gkRating,
        preferredPosition = preferredPosition,
        preferredFieldTypes = preferredFieldTypes.map { it.toKmpFieldType() },
        birthDate = birthDate?.time,
        gender = gender,
        heightCm = heightCm,
        weightKg = weightKg,
        dominantFoot = dominantFoot,
        primaryPosition = primaryPosition,
        secondaryPosition = secondaryPosition,
        playStyle = playStyle,
        experienceYears = experienceYears,
        level = level,
        experiencePoints = experiencePoints,
        milestonesAchieved = milestonesAchieved,
        autoStrikerRating = autoStrikerRating,
        autoMidRating = autoMidRating,
        autoDefenderRating = autoDefenderRating,
        autoGkRating = autoGkRating,
        autoRatingSamples = autoRatingSamples
    )
}

/**
 * Converte User KMP para User Android.
 */
fun KmpUser.toAndroidUser(): AndroidUser {
    return AndroidUser(
        id = id,
        email = email,
        name = name,
        phone = phone,
        nickname = nickname,
        photoUrl = photoUrl,
        preferredFieldTypes = preferredFieldTypes.map { it.toAndroidFieldType() },
        isSearchable = isSearchable,
        isProfilePublic = isProfilePublic,
        fcmToken = fcmToken,
        role = role,
        createdAt = createdAt?.let { java.util.Date(it) },
        updatedAt = updatedAt?.let { java.util.Date(it) },
        strikerRating = strikerRating,
        midRating = midRating,
        defenderRating = defenderRating,
        gkRating = gkRating,
        preferredPosition = preferredPosition,
        birthDate = birthDate?.let { java.util.Date(it) },
        gender = gender,
        heightCm = heightCm,
        weightKg = weightKg,
        dominantFoot = dominantFoot,
        primaryPosition = primaryPosition,
        secondaryPosition = secondaryPosition,
        playStyle = playStyle,
        experienceYears = experienceYears,
        level = level,
        experiencePoints = experiencePoints,
        milestonesAchieved = milestonesAchieved,
        autoStrikerRating = autoStrikerRating,
        autoMidRating = autoMidRating,
        autoDefenderRating = autoDefenderRating,
        autoGkRating = autoGkRating,
        autoRatingSamples = autoRatingSamples
    )
}

/**
 * Converte FieldType Android para FieldType KMP.
 */
fun FieldType.toKmpFieldType(): com.futebadosparcas.domain.model.FieldType {
    return when (this) {
        FieldType.SOCIETY -> com.futebadosparcas.domain.model.FieldType.SOCIETY
        FieldType.FUTSAL -> com.futebadosparcas.domain.model.FieldType.FUTSAL
        FieldType.CAMPO -> com.futebadosparcas.domain.model.FieldType.CAMPO
        FieldType.AREIA -> com.futebadosparcas.domain.model.FieldType.AREIA
        FieldType.OUTROS -> com.futebadosparcas.domain.model.FieldType.OUTROS
    }
}

/**
 * Converte FieldType KMP para FieldType Android.
 */
fun com.futebadosparcas.domain.model.FieldType.toAndroidFieldType(): FieldType {
    return when (this) {
        com.futebadosparcas.domain.model.FieldType.SOCIETY -> FieldType.SOCIETY
        com.futebadosparcas.domain.model.FieldType.FUTSAL -> FieldType.FUTSAL
        com.futebadosparcas.domain.model.FieldType.CAMPO -> FieldType.CAMPO
        com.futebadosparcas.domain.model.FieldType.AREIA -> FieldType.AREIA
        com.futebadosparcas.domain.model.FieldType.OUTROS -> FieldType.OUTROS
    }
}

/**
 * Converte uma lista de User Android para User KMP.
 */
fun List<AndroidUser>.toKmpUsers(): List<KmpUser> = map { it.toKmpUser() }

/**
 * Converte uma lista de User KMP para User Android.
 */
fun List<KmpUser>.toAndroidUsers(): List<AndroidUser> = map { it.toAndroidUser() }
