package com.futebadosparcas.monetization

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.domain.monetization.MonetizationConfig
import org.koin.compose.koinInject

private fun Context.findActivity(): Activity? {
    var current: Context? = this
    while (current is ContextWrapper) {
        if (current is Activity) return current
        current = current.baseContext
    }
    return null
}

private fun Context.openUrl(url: String) {
    runCatching {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}

/**
 * Tela "Sem anúncios" (assinatura anual). Textos de cobrança e renovação sempre visíveis, com
 * preço da loja, "Restaurar compra", "Gerenciar assinatura", Termos e Política de privacidade.
 * Nunca recebe banner (a rota não está na lista de permissão de [com.futebadosparcas.domain.monetization.AdsPolicy]).
 */
@Composable
fun RemoveAdsScreen(
    viewModel: RemoveAdsViewModel,
    adsController: AdsController = koinInject(),
) {
    val ui by viewModel.uiState.collectAsStateWithLifecycle()
    val adsUi by adsController.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = stringResource(R.string.remove_ads_headline),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = stringResource(R.string.remove_ads_body),
            style = MaterialTheme.typography.bodyLarge,
        )

        when {
            ui.adsFree -> Text(
                text = stringResource(R.string.remove_ads_active),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            ui.loading -> CircularProgressIndicator()
            ui.price == null -> Text(
                text = stringResource(R.string.remove_ads_msg_unavailable),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
            )
            else -> Button(
                onClick = { context.findActivity()?.let(viewModel::subscribe) },
                enabled = !ui.busy,
                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
            ) {
                Text(stringResource(R.string.remove_ads_subscribe, ui.price.orEmpty()))
            }
        }

        ui.messageResId?.let { resId ->
            Text(
                text = stringResource(resId),
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        // Termos exigidos na tela de compra de assinatura: preço, periodicidade, cobrança,
        // renovação automática e como cancelar.
        Text(
            text = stringResource(R.string.remove_ads_terms),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        OutlinedButton(
            onClick = viewModel::restore,
            enabled = !ui.busy,
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        ) { Text(stringResource(R.string.remove_ads_restore)) }

        OutlinedButton(
            onClick = {
                context.openUrl(
                    "${MonetizationConfig.PLAY_SUBSCRIPTIONS_URL}?sku=${MonetizationConfig.PRODUCT_ID_SEM_ANUNCIOS_ANUAL}&package=${context.packageName}"
                )
            },
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        ) { Text(stringResource(R.string.remove_ads_manage)) }

        if (adsUi.privacyOptionsRequired) {
            TextButton(
                onClick = { context.findActivity()?.let(adsController::showPrivacyOptions) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text(stringResource(R.string.remove_ads_privacy_options)) }
        }

        TextButton(
            onClick = { context.openUrl(MonetizationConfig.TERMS_OF_SERVICE_URL) },
            modifier = Modifier.fillMaxWidth(),
        ) { Text(stringResource(R.string.remove_ads_terms_link)) }
        TextButton(
            onClick = { context.openUrl(MonetizationConfig.PRIVACY_POLICY_URL) },
            modifier = Modifier.fillMaxWidth(),
        ) { Text(stringResource(R.string.remove_ads_privacy_link)) }
    }
}
