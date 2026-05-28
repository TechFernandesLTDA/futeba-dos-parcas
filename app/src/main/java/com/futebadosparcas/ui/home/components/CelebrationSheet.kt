package com.futebadosparcas.ui.home.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.ui.theme.AppDimensions

/**
 * BottomSheet de celebração exibido ao completar o checklist de primeiros passos.
 *
 * Informa ao usuário que ganhou o badge "Bem-vindo".
 *
 * Nota: O badge real é concedido por Cloud Function (TODO: Fase 2 — badge-helper.ts).
 * O cliente sinaliza via flag `rewardGranted=true` no Firestore e exibe esta sheet
 * para feedback imediato ao usuário.
 *
 * @param visible Controla exibição do sheet
 * @param onDismiss Callback quando o usuário fecha o sheet
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CelebrationSheet(
    visible: Boolean,
    onDismiss: () -> Unit
) {
    if (!visible) return

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = AppDimensions.spacing_huge, vertical = AppDimensions.spacing_extraLarge),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Emoji de troféu (Fase 2: substituir por Lottie confetti)
            Text(
                text = "🏆",
                style = MaterialTheme.typography.displayMedium
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_large))

            Text(
                text = stringResource(R.string.onboarding_celebration_title),
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_small))

            Text(
                text = stringResource(R.string.onboarding_celebration_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_extraLarge))

            Button(
                onClick = onDismiss,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(AppDimensions.height_input)
            ) {
                Text(
                    text = stringResource(R.string.onboarding_celebration_cta),
                    style = MaterialTheme.typography.titleMedium
                )
            }

            Spacer(modifier = Modifier.height(AppDimensions.spacing_large))
        }
    }
}
