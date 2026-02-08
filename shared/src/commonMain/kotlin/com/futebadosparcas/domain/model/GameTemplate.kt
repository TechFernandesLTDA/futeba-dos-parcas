package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Tipos de recorrencia para templates de jogo.
 */
@Serializable
enum class GameRecurrence(val displayName: String) {
    @SerialName("none")
    NONE("Sem recorrencia"),

    @SerialName("weekly")
    WEEKLY("Semanal"),

    @SerialName("biweekly")
    BIWEEKLY("Quinzenal"),

    @SerialName("monthly")
    MONTHLY("Mensal");

    companion object {
        /**
         * Converte String para GameRecurrence. Retorna NONE se invalido.
         */
        fun fromString(value: String?): GameRecurrence {
            // Suporta tanto o serialName minusculo quanto o enum name maiusculo
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: NONE
        }
    }
}

/**
 * Template de jogo para reutilizar configuracoes.
 * Permite salvar configuracoes frequentes de jogos para criacao rapida.
 */
@Serializable
data class GameTemplate(
    @SerialName("id")
    val id: String = "",

    @SerialName("user_id")
    val userId: String = "", // O dono do template

    @SerialName("template_name")
    val templateName: String = "",

    // Dados do Jogo a serem replicados
    @SerialName("location_name")
    val locationName: String = "",

    @SerialName("location_address")
    val locationAddress: String = "",

    @SerialName("location_id")
    val locationId: String = "",

    @SerialName("field_name")
    val fieldName: String = "",

    @SerialName("field_id")
    val fieldId: String = "",

    @SerialName("game_time")
    val gameTime: String = DEFAULT_START_TIME,

    @SerialName("game_end_time")
    val gameEndTime: String = DEFAULT_END_TIME,

    @SerialName("max_players")
    val maxPlayers: Int = DEFAULT_MAX_PLAYERS,

    @SerialName("daily_price")
    val dailyPrice: Double = 0.0,

    @SerialName("recurrence")
    val recurrence: String = GameRecurrence.NONE.name.lowercase(),

    @SerialName("created_at")
    val createdAt: Long? = null
) {
    /**
     * Retorna o enum de recorrencia do template.
     */
    fun getRecurrenceEnum(): GameRecurrence = GameRecurrence.fromString(recurrence)

    /**
     * Verifica se o template tem local configurado.
     */
    fun hasLocation(): Boolean = locationId.isNotBlank()

    /**
     * Verifica se o template tem nome valido.
     */
    fun hasValidName(): Boolean = templateName.isNotBlank() && templateName.length >= MIN_NAME_LENGTH

    companion object {
        /** Colecao Firestore */
        const val COLLECTION = "game_templates"

        // Constantes de validacao
        const val MIN_NAME_LENGTH = 2
        const val MAX_NAME_LENGTH = 50
        const val DEFAULT_MAX_PLAYERS = 14
        const val DEFAULT_START_TIME = "19:00"
        const val DEFAULT_END_TIME = "20:00"
    }
}
