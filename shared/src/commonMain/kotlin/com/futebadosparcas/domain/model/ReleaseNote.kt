package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Tipo de release — alinhado ao versionamento semântico.
 *
 * Os [SerialName] são maiúsculos por convenção do projeto; a conversão a partir
 * dos dados (Firestore/JSON usam minúsculas: "minor") passa por [fromString],
 * que é case-insensitive.
 */
@Serializable
enum class ReleaseType {
    @SerialName("MAJOR")
    MAJOR,

    @SerialName("MINOR")
    MINOR,

    @SerialName("PATCH")
    PATCH;

    companion object {
        /** Converte uma string (qualquer caixa) em [ReleaseType]; fallback [MINOR]. */
        fun fromString(value: String?): ReleaseType =
            entries.find { it.name.equals(value?.trim(), ignoreCase = true) } ?: MINOR
    }
}

/**
 * Card de destaque de um release — ícone + título + descrição curta.
 * Exibido no topo da nota ("o que mais importa").
 */
@Serializable
data class ReleaseHighlight(
    val icon: String = "",
    val title: String = "",
    val description: String = "",
)

/**
 * Nota de versão ("Novidades") já achatada para consumo da UI.
 *
 * Modelo de domínio único — tanto o Firestore (documento aninhado por locale)
 * quanto o JSON de fallback embarcado (achatado) são mapeados para esta classe
 * na camada de dados. A UI nunca vê as duas formas de origem.
 *
 * Conteúdo técnico (`technicalSummary`, refs de PR) NÃO entra aqui — fica só no
 * `CHANGELOG.md`. [issueRefs] é mantido para rastreabilidade, não para exibição.
 */
@Serializable
data class ReleaseNote(
    val platform: String = "",
    val version: String = "",
    val buildNumber: Int = 0,
    /** Data do release em epoch millis (UTC). */
    val releaseDate: Long = 0L,
    val type: ReleaseType = ReleaseType.MINOR,
    val headline: String = "",
    val highlights: List<ReleaseHighlight> = emptyList(),
    val added: List<String> = emptyList(),
    val improved: List<String> = emptyList(),
    val fixed: List<String> = emptyList(),
    val issueRefs: List<Int> = emptyList(),
    /** Se `true`, esta nota dispara o pop-up automático pós-atualização. */
    val showPopup: Boolean = false,
)
