package com.futebadosparcas.ui.components

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Loading Button Component
 *
 * Button with loading state indicator.
 * Automatically disables interaction while loading.
 *
 * Usage:
 * ```kotlin
 * LoadingButton(
 *     text = "Salvar",
 *     isLoading = uiState.isLoading,
 *     onClick = { viewModel.save() }
 * )
 * ```
 */
@Composable
fun LoadingButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    enabled: Boolean = true,
    loadingText: String? = null
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled && !isLoading,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary
        )
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = MaterialTheme.colorScheme.onPrimary,
                strokeWidth = 2.dp
            )
            if (loadingText != null) {
                Text(
                    text = loadingText,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }
        } else {
            Text(text = text)
        }
    }
}
