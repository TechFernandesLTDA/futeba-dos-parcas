package com.futebadosparcas.compose.monetization

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Banner do AdMob. No iOS hospeda a view nativa do Google Mobile Ads (UIKitView). No Android o
 * banner é do módulo `:app` (AdBannerHost), então aqui não faz nada. Só é composto quando as
 * regras do [MonetizationController] permitem.
 */
@Composable
expect fun PlatformAdBanner(modifier: Modifier, nonPersonalized: Boolean)
