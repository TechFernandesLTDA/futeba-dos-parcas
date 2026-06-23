package com.futebadosparcas.ui

/**
 * Strings de UI do composeApp centralizadas como constantes Kotlin.
 *
 * DECISÃO TÉCNICA (#2775/#2744): O composeApp usa composeResources
 * (compose.components.resources + pasta composeResources/values/strings.xml)
 * como caminho de i18n. Este objeto permanece apenas como área temporária
 * para content descriptions ainda compartilhadas por telas não migradas.
 *
 * TODO: Migrar as constantes restantes para composeResources/values/strings.xml
 * e substituir as referências por stringResource(Res.string.<chave>).
 */
internal object UiStrings {

    // ---- Detalhe do jogo / Hub do organizador (#2671) ----
    // Ponto de entrada que cabea as telas reais de ui/core/ no NavHost,
    // tornando-as alcançáveis pela navegação (sem telas órfãs).
    const val CD_BACK = "Voltar"
    const val CD_CLEAR_SEARCH = "Limpar busca"
    const val CD_EXPAND_RELEASE_VERSION = "Expandir versão"
    const val CD_COLLAPSE_RELEASE_VERSION = "Recolher versão"

    // ---- Hubs de navegação composeApp ----
    // Migrados para composeResources/values/strings.xml como lotes i18n incrementais (#2744).
}
