package com.futebadosparcas.compose.monetization

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.flow.MutableStateFlow
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.cd_back
import com.futebadosparcas.compose.resources.remove_ads_active
import com.futebadosparcas.compose.resources.remove_ads_body
import com.futebadosparcas.compose.resources.remove_ads_headline
import com.futebadosparcas.compose.resources.remove_ads_manage
import com.futebadosparcas.compose.resources.remove_ads_msg_done
import com.futebadosparcas.compose.resources.remove_ads_msg_failed
import com.futebadosparcas.compose.resources.remove_ads_msg_nothing_to_restore
import com.futebadosparcas.compose.resources.remove_ads_msg_pending
import com.futebadosparcas.compose.resources.remove_ads_msg_restored
import com.futebadosparcas.compose.resources.remove_ads_msg_unavailable
import com.futebadosparcas.compose.resources.remove_ads_privacy_link
import com.futebadosparcas.compose.resources.remove_ads_privacy_options
import com.futebadosparcas.compose.resources.remove_ads_restore
import com.futebadosparcas.compose.resources.remove_ads_subscribe
import com.futebadosparcas.compose.resources.remove_ads_terms
import com.futebadosparcas.compose.resources.remove_ads_terms_link
import com.futebadosparcas.compose.resources.remove_ads_title
import com.futebadosparcas.domain.monetization.MonetizationConfig
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource

/** Estado da tela "Sem anúncios" e as ações, sem dependência de UI (testável). */
class RemoveAdsPresenter(
    private val controller: MonetizationController?,
    private val store: StoreBridge?,
) {
    var loading by mutableStateOf(store != null)
        private set
    var price by mutableStateOf<String?>(null)
        private set
    var busy by mutableStateOf(false)
        private set
    var message by mutableStateOf<RemoveAdsMessage?>(null)
        private set

    val storeAvailable: Boolean get() = store != null

    fun loadPrice() {
        val bridge = store ?: return
        bridge.loadPriceLabel { label ->
            price = label
            loading = false
        }
    }

    fun subscribe() {
        val bridge = store ?: return
        if (busy) return
        busy = true
        message = null
        bridge.purchase { outcome ->
            busy = false
            when (outcome) {
                StoreOutcome.ACTIVE -> {
                    controller?.applyEntitlement(outcome)
                    message = RemoveAdsMessage.DONE
                }
                StoreOutcome.PENDING -> message = RemoveAdsMessage.PENDING
                StoreOutcome.CANCELLED -> Unit
                else -> message = RemoveAdsMessage.FAILED
            }
        }
    }

    fun restore() {
        val bridge = store ?: return
        if (busy) return
        busy = true
        message = null
        bridge.restore { outcome ->
            busy = false
            controller?.applyEntitlement(outcome)
            message = when (outcome) {
                StoreOutcome.ACTIVE -> RemoveAdsMessage.RESTORED
                StoreOutcome.NONE -> RemoveAdsMessage.NOTHING_TO_RESTORE
                else -> RemoveAdsMessage.UNAVAILABLE
            }
        }
    }

    fun manage() {
        store?.manageSubscriptions()
    }
}

enum class RemoveAdsMessage { DONE, PENDING, FAILED, RESTORED, NOTHING_TO_RESTORE, UNAVAILABLE }

private fun RemoveAdsMessage.resource(): StringResource = when (this) {
    RemoveAdsMessage.DONE -> Res.string.remove_ads_msg_done
    RemoveAdsMessage.PENDING -> Res.string.remove_ads_msg_pending
    RemoveAdsMessage.FAILED -> Res.string.remove_ads_msg_failed
    RemoveAdsMessage.RESTORED -> Res.string.remove_ads_msg_restored
    RemoveAdsMessage.NOTHING_TO_RESTORE -> Res.string.remove_ads_msg_nothing_to_restore
    RemoveAdsMessage.UNAVAILABLE -> Res.string.remove_ads_msg_unavailable
}

/**
 * Tela "Sem anúncios" (iOS, diretriz 3.1.2 da Apple): nome e duração da assinatura, preço da
 * loja, renovação automática, cancelamento, "Restaurar compra", "Gerenciar assinatura" e os
 * links de Termos de uso (EULA padrão da Apple) e Política de privacidade. A rota não está na
 * lista de permissão de anúncios: nunca recebe banner.
 */
@Composable
fun RemoveAdsScreen(onNavigateBack: () -> Unit) {
    val controller = MonetizationHolder.controller
    val presenter = remember { RemoveAdsPresenter(controller, MonetizationHolder.store) }
    val uiFlow = controller?.ui ?: remember { MutableStateFlow(MonetizationUiState()) }
    val ui by uiFlow.collectAsStateWithLifecycle()
    val adsFree = ui.adsFree
    val uriHandler = LocalUriHandler.current

    LaunchedEffect(presenter) { presenter.loadPrice() }

    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = stringResource(Res.string.remove_ads_title),
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(Res.string.cd_back),
                        )
                    }
                },
            )
        },
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = stringResource(Res.string.remove_ads_headline),
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = stringResource(Res.string.remove_ads_body),
                style = MaterialTheme.typography.bodyLarge,
            )

            when {
                adsFree -> Text(
                    text = stringResource(Res.string.remove_ads_active),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
                presenter.loading -> CircularProgressIndicator()
                presenter.price == null -> Text(
                    text = stringResource(Res.string.remove_ads_msg_unavailable),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
                else -> Button(
                    onClick = presenter::subscribe,
                    enabled = !presenter.busy,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                ) {
                    Text(stringResource(Res.string.remove_ads_subscribe, presenter.price.orEmpty()))
                }
            }

            presenter.message?.let { msg ->
                Text(text = stringResource(msg.resource()), style = MaterialTheme.typography.bodyMedium)
            }

            Text(
                text = stringResource(Res.string.remove_ads_terms),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            OutlinedButton(
                onClick = presenter::restore,
                enabled = !presenter.busy && presenter.storeAvailable,
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            ) { Text(stringResource(Res.string.remove_ads_restore)) }

            OutlinedButton(
                onClick = presenter::manage,
                enabled = presenter.storeAvailable,
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            ) { Text(stringResource(Res.string.remove_ads_manage)) }

            if (ui.privacyOptionsRequired) {
                TextButton(
                    onClick = { controller?.showPrivacyOptions() },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(stringResource(Res.string.remove_ads_privacy_options)) }
            }

            TextButton(
                onClick = { uriHandler.openUri(MonetizationConfig.APPLE_STANDARD_EULA_URL) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text(stringResource(Res.string.remove_ads_terms_link)) }
            TextButton(
                onClick = { uriHandler.openUri(MonetizationConfig.PRIVACY_POLICY_URL) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text(stringResource(Res.string.remove_ads_privacy_link)) }
        }
    }
}
