package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Team(
    val id: String = "",
    val name: String = "",
    @SerialName("badge_url") val badgeUrl: String? = null,
    @SerialName("short_name") val shortName: String? = null,
    val category: String? = null,
    val state: String? = null
)
