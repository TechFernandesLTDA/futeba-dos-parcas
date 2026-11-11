package com.futebadosparcas.compose.monetization

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
actual fun PlatformAdBanner(modifier: Modifier, nonPersonalized: Boolean) {
    // O Android usa o banner de :app (AdBannerHost). Este alvo é só o harness do composeApp.
}
