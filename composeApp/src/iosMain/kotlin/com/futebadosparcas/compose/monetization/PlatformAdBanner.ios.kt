@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.futebadosparcas.compose.monetization

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.UIKitView
import platform.UIKit.UIView

/**
 * Parte do [AdsBridge] que só existe no iOS: fabrica a view do banner (Google Mobile Ads,
 * Swift). Implementada por `iosApp/iosApp/Services/AdsService.swift`.
 */
interface IosAdsBridge : AdsBridge {
    /** Altura (pt) do banner adaptativo ancorado para a largura dada. */
    fun bannerHeight(widthPoints: Double): Double

    /**
     * Cria a view do banner e já pede o anúncio. [onLoadChanged] avisa quando carregou ou falhou,
     * para a tela não reservar espaço vazio.
     */
    fun createBannerView(
        widthPoints: Double,
        nonPersonalized: Boolean,
        onLoadChanged: (Boolean) -> Unit,
    ): UIView
}

@Composable
actual fun PlatformAdBanner(modifier: Modifier, nonPersonalized: Boolean) {
    val bridge = MonetizationHolder.ads as? IosAdsBridge ?: return
    var loaded by remember { mutableStateOf(false) }
    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val width = maxWidth.value.toDouble()
        val height = remember(width) { bridge.bannerHeight(width) }
        UIKitView(
            factory = {
                bridge.createBannerView(width, nonPersonalized) { ok -> loaded = ok }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(if (loaded) height.dp else 0.dp),
        )
    }
}
