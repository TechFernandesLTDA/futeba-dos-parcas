package com.futebadosparcas.monetization

import com.futebadosparcas.BuildConfig

/**
 * Configuração dos anúncios. Debug usa as unidades de TESTE do Google; release lê da config de
 * build (`ADMOB_APP_ID`/`ADMOB_BANNER_UNIT_ID`, ver app/build.gradle.kts). Unidade vazia = sem
 * SDK e sem banner. IDs do AdMob não são segredo, mas ficam fora do código até o app existir no
 * AdMob (fase 2).
 */
object AdsConfig {
    val bannerUnitId: String get() = BuildConfig.ADMOB_BANNER_UNIT_ID.trim()
    val unitConfigured: Boolean get() = bannerUnitId.isNotEmpty()
}
