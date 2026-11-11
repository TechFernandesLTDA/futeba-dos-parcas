package com.futebadosparcas.monetization

import android.os.Bundle
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.domain.monetization.AdsGate
import com.google.ads.mediation.admob.AdMobAdapter
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.LoadAdError
import org.koin.compose.koinInject

/**
 * Banner adaptativo ancorado no rodapé, só nas telas da lista de permissão ([com.futebadosparcas.domain.monetization.AdsPolicy]).
 * Não ocupa espaço enquanto não houver anúncio carregado. Assinante, sem primeira vitória, sem
 * consentimento ou sem unidade configurada: não compõe nada (e o AdView nem é criado).
 */
@Composable
fun AdBannerHost(
    route: String?,
    modifier: Modifier = Modifier,
    controller: AdsController = koinInject(),
) {
    val ui by controller.uiState.collectAsStateWithLifecycle()
    val show = AdsGate.shouldShowBanner(
        adsFree = ui.adsFree,
        firstWinReached = ui.firstWinReached,
        unitConfigured = AdsConfig.unitConfigured,
        canRequestAds = ui.canRequestAds,
        route = route,
    )
    if (show) AdBanner(modifier)
}

/** Todo pedido é não personalizado enquanto ALLOW_PERSONALIZED_ADS for falso (contas de 13 a 17 anos). */
private fun buildAdRequest(): AdRequest {
    val builder = AdRequest.Builder()
    if (AdsGate.requestNonPersonalized(attAuthorized = null)) {
        builder.addNetworkExtrasBundle(AdMobAdapter::class.java, Bundle().apply { putString("npa", "1") })
    }
    return builder.build()
}

@Composable
private fun AdBanner(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var loaded by remember { mutableStateOf(false) }

    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val widthDp = maxWidth.value.toInt().coerceAtLeast(320)
        val adView = remember(widthDp) {
            AdView(context).apply {
                setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(context, widthDp))
                adUnitId = AdsConfig.bannerUnitId
                adListener = object : AdListener() {
                    override fun onAdLoaded() { loaded = true }
                    override fun onAdFailedToLoad(error: LoadAdError) { loaded = false }
                }
                loadAd(buildAdRequest())
            }
        }
        DisposableEffect(adView, lifecycle) {
            val observer = LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_PAUSE -> adView.pause()
                    Lifecycle.Event.ON_RESUME -> adView.resume()
                    else -> Unit
                }
            }
            lifecycle.addObserver(observer)
            onDispose {
                lifecycle.removeObserver(observer)
                adView.destroy()
            }
        }
        AndroidView(
            factory = { adView },
            modifier = Modifier
                .fillMaxWidth()
                .then(if (loaded) Modifier else Modifier.height(0.dp)),
        )
    }
}
