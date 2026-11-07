package com.futebadosparcas.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.ui.theme.AppDimensions
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await
import java.util.concurrent.TimeUnit

private const val GRACE_END_MILLIS = 1_785_715_200_000L // 2026-08-03T00:00:00Z

/**
 * Banner avisando users nao-verified sobre prazo do grace period.
 * Spec: SPEC_PHONE_CPF_FASE5_ENFORCEMENT.md (#448)
 *
 * Mostra apenas se user logado e !verified custom claim.
 * Botao "Verificar agora" navega pro onboarding.
 */
@Composable
fun VerificationBanner(
    onClickVerify: () -> Unit = {},
    auth: FirebaseAuth = org.koin.compose.koinInject(),
) {
    var verified by remember { mutableStateOf<Boolean?>(null) }

    LaunchedEffect(auth.currentUser?.uid) {
        val user = auth.currentUser
        if (user == null) {
            verified = null
            return@LaunchedEffect
        }
        try {
            val result = user.getIdToken(false).await()
            verified = result.claims["verified"] == true
        } catch (e: Exception) {
            verified = false
        }
    }

    if (verified != false) return

    val daysLeft = ((GRACE_END_MILLIS - System.currentTimeMillis())
        .coerceAtLeast(0L)
        .let { TimeUnit.MILLISECONDS.toDays(it) }).toInt()

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.tertiaryContainer)
            .padding(horizontal = AppDimensions.spacing_medium, vertical = AppDimensions.spacing_small),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.verification_banner_title),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                )
                Text(
                    text = when {
                        daysLeft == 1 -> stringResource(R.string.verification_banner_days_left_one)
                        daysLeft > 1 -> stringResource(R.string.verification_banner_days_left_many, daysLeft)
                        else -> stringResource(R.string.verification_banner_expired)
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                )
            }
            TextButton(onClick = onClickVerify) {
                Text(stringResource(R.string.verify))
            }
        }
    }
}
