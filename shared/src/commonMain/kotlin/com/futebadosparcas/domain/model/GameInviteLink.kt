package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Representa um link de convite para um jogo (versao KMP).
 *
 * Permite convidar jogadores que nao estao no grupo.
 * Colecao Firestore: game_invites
 */
@Serializable
data class GameInviteLink(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("invite_token") val inviteToken: String = "",
    @SerialName("created_by_id") val createdById: String = "",
    @SerialName("created_by_name") val createdByName: String = "",

    // Dados desnormalizados do jogo para exibicao
    @SerialName("game_date") val gameDate: String = "",
    @SerialName("game_time") val gameTime: String = "",
    @SerialName("game_location") val gameLocation: String = "",

    @SerialName("max_uses") val maxUses: Int = 1,
    @SerialName("current_uses") val currentUses: Int = 0,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("created_at") val createdAt: Long? = null,
    @SerialName("expires_at") val expiresAt: Long? = null,

    // Lista de IDs de usuarios que usaram o link
    @SerialName("used_by") val usedBy: List<String> = emptyList()
) {
    /**
     * Verifica se o link expirou baseado no timestamp atual.
     *
     * @param currentTimeMs Timestamp atual em milissegundos
     */
    fun isExpired(currentTimeMs: Long): Boolean {
        val expiry = expiresAt ?: return false
        return currentTimeMs > expiry
    }

    /**
     * Verifica se o link pode ser usado.
     *
     * @param currentTimeMs Timestamp atual em milissegundos
     */
    fun canBeUsed(currentTimeMs: Long): Boolean {
        return isActive && !isExpired(currentTimeMs) && (maxUses == 0 || currentUses < maxUses)
    }

    /**
     * Verifica se um usuario ja usou este link.
     */
    fun hasUserUsed(userId: String): Boolean = usedBy.contains(userId)

    /**
     * Retorna o link compartilhavel (web).
     */
    fun getShareableLink(): String = "https://futebadosparcas.app/invite/$inviteToken"

    /**
     * Retorna o deep link para o app.
     */
    fun getDeepLink(): String = "futeba://game-invite/$inviteToken"

    companion object {
        /** Expiracao padrao: 48 horas em milissegundos */
        const val DEFAULT_EXPIRATION_MS = 48L * 60 * 60 * 1000
    }
}
