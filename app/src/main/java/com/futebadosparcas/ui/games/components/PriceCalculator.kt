package com.futebadosparcas.ui.games.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.text.NumberFormat
import java.util.Locale
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Componente que exibe o calculo automatico do preco por jogador.
 * Improvement #6 - Price Per Player Calculator.
 */
@Composable
fun PricePerPlayerCalculator(
    totalPrice: Double,
    maxPlayers: Int,
    modifier: Modifier = Modifier
) {
    val pricePerPlayer = if (maxPlayers > 0) totalPrice / maxPlayers else 0.0
    val currencyFormat = remember { NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")) }

    AnimatedVisibility(
        visible = totalPrice > 0 && maxPlayers > 0,
        enter = fadeIn(),
        exit = fadeOut(),
        modifier = modifier
    ) {
        Card(
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.tertiaryContainer
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Calculate,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onTertiaryContainer,
                        modifier = Modifier.size(20.dp)
                    )
                    Column {
                        Text(
                            text = stringResource(R.string.create_game_price_per_player_label),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onTertiaryContainer
                        )
                        Text(
                            text = currencyFormat.format(pricePerPlayer),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onTertiaryContainer
                        )
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.People,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f),
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = stringResource(R.string.create_game_price_per_player_count, maxPlayers),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f)
                    )
                }
            }
        }
    }
}

/**
 * Versao compacta do calculador para exibicao inline.
 */
@Composable
fun PricePerPlayerBadge(
    pricePerPlayer: Double?,
    modifier: Modifier = Modifier
) {
    if (pricePerPlayer == null || pricePerPlayer <= 0) return

    val currencyFormat = remember { NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")) }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.primaryContainer)
            .padding(horizontal = 12.dp, vertical = 4.dp)
    ) {
        Text(
            text = "${currencyFormat.format(pricePerPlayer)}/jogador",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onPrimaryContainer
        )
    }
}

/**
 * Componente avancado com opcao de override manual do preco por jogador.
 * Permite alternar entre calculo automatico e definicao manual.
 */
@Composable
fun PricePerPlayerCalculatorWithOverride(
    totalPrice: Double,
    maxPlayers: Int,
    calculatedPricePerPlayer: Double?,
    isManualEnabled: Boolean,
    onManualToggle: (Boolean) -> Unit,
    onManualPriceChange: (Double?) -> Unit,
    modifier: Modifier = Modifier
) {
    val currencyFormat = remember { NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")) }
    var manualPriceText by remember { mutableStateOf("") }

    // Calcular preco automatico para exibicao
    val autoPrice = if (maxPlayers > 0) totalPrice / maxPlayers else 0.0
    val displayPrice = calculatedPricePerPlayer ?: autoPrice

    AnimatedVisibility(
        visible = totalPrice > 0 || isManualEnabled,
        enter = fadeIn() + expandVertically(),
        exit = fadeOut() + shrinkVertically(),
        modifier = modifier
    ) {
        Card(
            colors = CardDefaults.cardColors(
                containerColor = if (isManualEnabled)
                    MaterialTheme.colorScheme.secondaryContainer
                else
                    MaterialTheme.colorScheme.tertiaryContainer
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp)
            ) {
                // Linha principal com toggle
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = if (isManualEnabled) Icons.Default.Edit else Icons.Default.Calculate,
                            contentDescription = null,
                            tint = if (isManualEnabled)
                                MaterialTheme.colorScheme.onSecondaryContainer
                            else
                                MaterialTheme.colorScheme.onTertiaryContainer,
                            modifier = Modifier.size(20.dp)
                        )
                        Column {
                            Text(
                                text = stringResource(R.string.create_game_price_per_player_label),
                                style = MaterialTheme.typography.labelSmall,
                                color = if (isManualEnabled)
                                    MaterialTheme.colorScheme.onSecondaryContainer
                                else
                                    MaterialTheme.colorScheme.onTertiaryContainer
                            )
                            if (!isManualEnabled && displayPrice > 0) {
                                Text(
                                    text = currencyFormat.format(displayPrice),
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isManualEnabled)
                                        MaterialTheme.colorScheme.onSecondaryContainer
                                    else
                                        MaterialTheme.colorScheme.onTertiaryContainer
                                )
                            }
                        }
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.create_game_manual_price),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isManualEnabled)
                                MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                            else
                                MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f)
                        )
                        Switch(
                            checked = isManualEnabled,
                            onCheckedChange = { enabled ->
                                onManualToggle(enabled)
                                if (!enabled) {
                                    manualPriceText = ""
                                }
                            }
                        )
                    }
                }

                // Campo de input manual
                AnimatedVisibility(
                    visible = isManualEnabled,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = manualPriceText,
                            onValueChange = { value ->
                                manualPriceText = value
                                val parsed = value.replace(",", ".").toDoubleOrNull()
                                onManualPriceChange(parsed)
                            },
                            label = { Text(stringResource(R.string.create_game_price_per_player_input)) },
                            leadingIcon = {
                                Text(
                                    text = "R$",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )

                        // Mostrar contagem de jogadores
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.People,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f),
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "$maxPlayers",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                            )
                        }
                    }
                }

                // Info de calculo automatico quando nao manual
                if (!isManualEnabled && maxPlayers > 0) {
                    Row(
                        modifier = Modifier.padding(top = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.People,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f),
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = stringResource(R.string.create_game_price_per_player_count, maxPlayers),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f)
                        )
                    }
                }
            }
        }
    }
}
