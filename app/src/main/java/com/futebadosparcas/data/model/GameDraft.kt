package com.futebadosparcas.data.model

/**
 * Rascunho de jogo para salvamento automatico.
 * Persiste o estado do formulario de criacao de jogo no DataStore.
 * Serializado usando Gson.
 */
data class GameDraft(
    val ownerName: String = "",
    val price: String = "",
    val maxPlayers: String = "14",

    // Data e horario
    val selectedDateYear: Int? = null,
    val selectedDateMonth: Int? = null,
    val selectedDateDay: Int? = null,
    val selectedTimeHour: Int? = null,
    val selectedTimeMinute: Int? = null,
    val selectedEndTimeHour: Int? = null,
    val selectedEndTimeMinute: Int? = null,

    // Local e quadra
    val locationId: String = "",
    val locationName: String = "",
    val locationAddress: String = "",
    val fieldId: String = "",
    val fieldName: String = "",
    val fieldType: String = "",

    // Grupo e visibilidade
    val groupId: String = "",
    val groupName: String = "",
    val visibility: String = GameVisibility.GROUP_ONLY.name,

    // Recorrencia
    val recurrenceEnabled: Boolean = false,
    val recurrenceType: String = "Semanal",

    // Timestamp para controle de validade
    val savedAt: Long = System.currentTimeMillis()
) {
    /**
     * Verifica se o rascunho tem dados suficientes para ser restaurado.
     */
    fun hasContent(): Boolean {
        return ownerName.isNotBlank() ||
                locationId.isNotBlank() ||
                selectedDateYear != null ||
                groupId.isNotBlank()
    }

    /**
     * Verifica se o rascunho ainda e valido (menos de 24 horas).
     */
    fun isValid(): Boolean {
        val twentyFourHoursAgo = System.currentTimeMillis() - (24 * 60 * 60 * 1000)
        return savedAt > twentyFourHoursAgo && hasContent()
    }
}
