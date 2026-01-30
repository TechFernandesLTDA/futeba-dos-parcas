package com.futebadosparcas.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date
import java.util.UUID

/**
 * Representa um link de convite para um jogo.
 * Permite convidar jogadores que nao estao no grupo.
 *
 * Colecao: game_invites
 */
@IgnoreExtraProperties
data class GameInviteLink(
    @DocumentId
    var id: String = "",

    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",

    @get:PropertyName("invite_token")
    @set:PropertyName("invite_token")
    var inviteToken: String = "",

    @get:PropertyName("created_by_id")
    @set:PropertyName("created_by_id")
    var createdById: String = "",

    @get:PropertyName("created_by_name")
    @set:PropertyName("created_by_name")
    var createdByName: String = "",

    // Dados desnormalizados do jogo para exibicao
    @get:PropertyName("game_date")
    @set:PropertyName("game_date")
    var gameDate: String = "",

    @get:PropertyName("game_time")
    @set:PropertyName("game_time")
    var gameTime: String = "",

    @get:PropertyName("game_location")
    @set:PropertyName("game_location")
    var gameLocation: String = "",

    @get:PropertyName("max_uses")
    @set:PropertyName("max_uses")
    var maxUses: Int = 1,

    @get:PropertyName("current_uses")
    @set:PropertyName("current_uses")
    var currentUses: Int = 0,

    @get:PropertyName("is_active")
    @set:PropertyName("is_active")
    var isActive: Boolean = true,

    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAtRaw: Any? = null,

    @get:PropertyName("expires_at")
    @set:PropertyName("expires_at")
    var expiresAtRaw: Any? = null,

    // Lista de IDs de usuarios que usaram o link
    @get:PropertyName("used_by")
    @set:PropertyName("used_by")
    var usedBy: List<String> = emptyList()
) {
    constructor() : this(id = "")

    val createdAt: Date?
        @Exclude
        get() = when (val raw = createdAtRaw) {
            is Date -> raw
            is Timestamp -> raw.toDate()
            is Long -> Date(raw)
            else -> null
        }

    val expiresAt: Date?
        @Exclude
        get() = when (val raw = expiresAtRaw) {
            is Date -> raw
            is Timestamp -> raw.toDate()
            is Long -> Date(raw)
            else -> null
        }

    @Exclude
    fun isExpired(): Boolean {
        val expiry = expiresAt ?: return false
        return Date().after(expiry)
    }

    @Exclude
    fun canBeUsed(): Boolean {
        return isActive && !isExpired() && (maxUses == 0 || currentUses < maxUses)
    }

    @Exclude
    fun hasUserUsed(userId: String): Boolean {
        return usedBy.contains(userId)
    }

    @Exclude
    fun getShareableLink(): String {
        return "https://futebadosparcas.app/invite/$inviteToken"
    }

    @Exclude
    fun getDeepLink(): String {
        return "futeba://game-invite/$inviteToken"
    }

    companion object {
        // Expiracao padrao: 48 horas
        const val DEFAULT_EXPIRATION_MS = 48L * 60 * 60 * 1000

        fun generate(
            gameId: String,
            game: Game,
            createdById: String,
            createdByName: String,
            maxUses: Int = 0 // 0 = ilimitado
        ): GameInviteLink {
            return GameInviteLink(
                gameId = gameId,
                inviteToken = UUID.randomUUID().toString().replace("-", "").take(12),
                createdById = createdById,
                createdByName = createdByName,
                gameDate = game.date,
                gameTime = game.time,
                gameLocation = game.locationName,
                maxUses = maxUses,
                createdAtRaw = Date(),
                expiresAtRaw = Date(System.currentTimeMillis() + DEFAULT_EXPIRATION_MS)
            )
        }
    }
}
