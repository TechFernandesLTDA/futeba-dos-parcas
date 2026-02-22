package com.futebadosparcas.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.home.LoadingState
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

@Composable
fun LoadingStateIndicator(
    loadingState: LoadingState,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
    ) {
        when (loadingState) {
            is LoadingState.Loading -> {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(modifier = Modifier.size(48.dp))
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = loadingState.message,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
            is LoadingState.LoadingProgress -> {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    // Using value directly for compatibility
                    LinearProgressIndicator(
                        progress = {
                            if (loadingState.total > 0) {
                                loadingState.current.toFloat() / loadingState.total.toFloat()
                            } else {
                                0f
                            }
                        },
                        modifier = Modifier.fillMaxWidth().height(8.dp),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(
                            R.string.ui_loading_state,
                            loadingState.message,
                            loadingState.current,
                            loadingState.total
                        ),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
            is LoadingState.Error -> {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = loadingState.message,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center
                    )
                    if (loadingState.retryable) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(onClick = onRetry) {
                            Text(stringResource(R.string.retry))
                        }
                    }
                }
            }
            else -> {
                // Idle or Success - show nothing
            }
        }
    }
}
