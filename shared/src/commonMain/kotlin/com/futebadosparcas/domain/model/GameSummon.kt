package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Status da convocacao de jogador.
 */
// NOTA: SummonStatus nao usa @Serializable e nao tem companion object
// para evitar bug do compilador Kotlin 2.2.x com enums + companion object
// no mesmo arquivo que classes @Serializable.
// O campo 'status' e serializado como String no modelo GameSummon.
enum class SummonStatus(val displayName: String) {
    PENDING("Pendente"),
    CONFIRMED("Confirmado"),
    DECLINED("Recusado"),
    CANCELLED("Cancelado")
}

/**
 * Converte String para SummonStatus. Retorna PENDING se invalido.
 * Extraido do companion object para evitar bug do compilador Kotlin 2.2.x.
 */
fun summonStatusFromString(value: String?): SummonStatus {
    return SummonStatus.entries.find { it.name == value } ?: SummonStatus.PENDING
}

/**
 * Representa uma convocacao de jogador para um jogo especifico (versao KMP).
 *
 * Colecao Firestore: game_summons
 * ID do documento: {gameId}_{userId}
 */
@Serializable
data class GameSummon(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("group_id") val groupId: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("user_name") val userName: String = "",
    @SerialName("user_photo") val userPhoto: String? = null,
    val status: String = SummonStatus.PENDING.name,
    val position: String? = null,
    @SerialName("summoned_by") val summonedBy: String = "",
    @SerialName("summoned_by_name") val summonedByName: String = "",
    @SerialName("summoned_at") val summonedAt: Long? = null,
    @SerialName("responded_at") val respondedAt: Long? = null
) {
    /**
     * Retorna o enum do status da convocacao.
     */
    fun getStatusEnum(): SummonStatus = summonStatusFromString(status)

    /**
     * Retorna o enum da posicao, se definida.
     */
    fun getPositionEnum(): PlayerPosition? = position?.let {
        try { PlayerPosition.valueOf(it) } catch (_: Exception) { null }
    }

    fun isPending(): Boolean = getStatusEnum() == SummonStatus.PENDING
    fun isConfirmed(): Boolean = getStatusEnum() == SummonStatus.CONFIRMED
    fun isDeclined(): Boolean = getStatusEnum() == SummonStatus.DECLINED
    fun canRespond(): Boolean = isPending()
}

/**
 * Gera o ID do documento GameSummon no formato {gameId}_{userId}.
 * Extraido do companion object para evitar bug do compilador Kotlin 2.2.x
 * com @Serializable + companion object explicito.
 */
fun gameSummonId(gameId: String, userId: String): String = "${gameId}_${userId}"
