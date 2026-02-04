package com.futebadosparcas.ui.games.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.domain.repository.AddressLookupResult
import kotlinx.coroutines.delay

/**
 * Campo de entrada de CEP com auto-complete de endereco.
 * Improvement #5 - CEP/Address Validation.
 */
@Composable
fun CepLookupField(
    cep: String,
    onCepChange: (String) -> Unit,
    onLookup: (String) -> Unit,
    addressResult: AddressLookupResult?,
    onAddressAccepted: (AddressLookupResult) -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false
) {
    var formattedCep by remember { mutableStateOf(cep) }

    // Formatar CEP automaticamente (XXXXX-XXX)
    fun formatCep(input: String): String {
        val digits = input.filter { it.isDigit() }.take(8)
        return if (digits.length > 5) {
            "${digits.substring(0, 5)}-${digits.substring(5)}"
        } else {
            digits
        }
    }

    // Debounce para busca automatica
    LaunchedEffect(formattedCep) {
        val cleanCep = formattedCep.filter { it.isDigit() }
        if (cleanCep.length == 8) {
            delay(500)
            onLookup(cleanCep)
        }
    }

    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = formattedCep,
            onValueChange = { newValue ->
                val formatted = formatCep(newValue)
                formattedCep = formatted
                onCepChange(formatted.filter { it.isDigit() })
            },
            label = { Text(stringResource(R.string.create_game_cep_label)) },
            placeholder = { Text("00000-000") },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null
                )
            },
            trailingIcon = {
                when {
                    isLoading -> CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                    addressResult != null -> Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    formattedCep.filter { it.isDigit() }.length == 8 -> IconButton(
                        onClick = { onLookup(formattedCep.filter { it.isDigit() }) }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = stringResource(R.string.search)
                        )
                    }
                }
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        // Card com resultado do endereco
        AnimatedVisibility(
            visible = addressResult != null,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            addressResult?.let { result ->
                Spacer(modifier = Modifier.height(8.dp))

                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.create_game_cep_found),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        Text(
                            text = result.street,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        Text(
                            text = "${result.neighborhood} - ${result.city}/${result.state}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End
                        ) {
                            TextButton(onClick = { onAddressAccepted(result) }) {
                                Text(stringResource(R.string.create_game_cep_use_address))
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Versao compacta do resultado de CEP para exibicao inline.
 */
@Composable
fun AddressPreviewBadge(
    addressResult: AddressLookupResult?,
    modifier: Modifier = Modifier
) {
    if (addressResult == null) return

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(
            imageVector = Icons.Default.LocationOn,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(16.dp)
        )
        Text(
            text = "${addressResult.neighborhood} - ${addressResult.city}",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}
