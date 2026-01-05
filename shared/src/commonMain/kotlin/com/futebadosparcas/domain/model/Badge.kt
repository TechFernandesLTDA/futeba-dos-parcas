package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Categoria de badges.
 */
@Serializable
enum class BadgeCategory(val displayName: String) {
    @SerialName("PERFORMANCE")
    PERFORMANCE("Desempenho"),

    @SerialName("PRESENCE")
    PRESENCE("Presenca"),

    @SerialName("COMMUNITY")
    COMMUNITY("Comunidade"),

    @SerialName("LEVEL")
    LEVEL("Nivel"),

    @SerialName("SPECIAL")
    SPECIAL("Especial")
}

/**
 * Raridade de badges.
 */
@Serializable
enum class BadgeRarity(val displayName: String, val xpBonus: Int) {
    @SerialName("COMMON")
    COMMON("Comum", 10),

    @SerialName("RARE")
    RARE("Raro", 25),

    @SerialName("EPIC")
    EPIC("Epico", 50),

    @SerialName("LEGENDARY")
    LEGENDARY("Lendario", 100)
}

/**
 * Definicao de uma badge no sistema.
 */
@Serializable
data class BadgeDefinition(
    val id: String,
    val name: String,
    val description: String,
    val emoji: String,
    val category: BadgeCategory,
    val rarity: BadgeRarity,
    val requiredValue: Int = 1,
    @SerialName("is_hidden") val isHidden: Boolean = false
)

/**
 * Badge desbloqueada por um usuario.
 */
@Serializable
data class UserBadge(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("badge_id") val badgeId: String = "",
    @SerialName("unlocked_at") val unlockedAt: Long = 0,
    @SerialName("unlock_count") val unlockCount: Int = 1
)
