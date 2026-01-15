package com.futebadosparcas.util

import com.futebadosparcas.data.model.User as DataUser
import com.futebadosparcas.domain.model.User as DomainUser
import com.futebadosparcas.data.model.FieldType

/**
 * Extensão para converter domain.model.User para data.model.User
 */
fun DomainUser.toDataModel(): DataUser {
    return DataUser(
        id = this.id,
        email = this.email,
        name = this.name,
        phone = null,
        nickname = this.nickname,
        photoUrl = this.photoUrl,
        preferredFieldTypes = emptyList(),
        isSearchable = true,
        isProfilePublic = true,
        fcmToken = this.fcmToken,
        experiencePoints = this.experiencePoints,
        level = this.level,
        milestonesAchieved = this.milestonesAchieved
    )
}

/**
 * Extensão para converter data.model.User para domain.model.User
 */
fun DataUser.toDomainModel(): DomainUser {
    return DomainUser(
        id = this.id,
        email = this.email,
        name = this.name,
        nickname = this.nickname,
        photoUrl = this.photoUrl,
        fcmToken = this.fcmToken,
        experiencePoints = this.experiencePoints.toLong(),
        level = this.level,
        milestonesAchieved = this.milestonesAchieved
    )
}
