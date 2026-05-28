package com.futebadosparcas.ui.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.ui.theme.AppDimensions
/**
 * Tela de configuração inicial do perfil.
 * Coleta informações básicas do jogador.
 */
@Composable
fun ProfileSetupScreen(
    onContinue: (ProfileSetupData) -> Unit,
    onSkip: () -> Unit
) {
    val scrollState = rememberScrollState()

    var name by remember { mutableStateOf("") }
    var nickname by remember { mutableStateOf("") }
    var selectedPosition by remember { mutableStateOf<String?>(null) }
    var societySelected by remember { mutableStateOf(false) }
    var futsalSelected by remember { mutableStateOf(false) }
    var campoSelected by remember { mutableStateOf(false) }

    val goalkeeperLabel = stringResource(R.string.profile_position_goalkeeper)
    val defenderLabel = stringResource(R.string.profile_position_defender)
    val midfielderLabel = stringResource(R.string.profile_position_midfielder)
    val attackerLabel = stringResource(R.string.profile_position_attacker)
    val positions = listOf(
        goalkeeperLabel to "goalkeeper",
        defenderLabel to "defender",
        midfielderLabel to "midfielder",
        attackerLabel to "striker"
    )

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(AppDimensions.spacing_extraLarge),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(AppDimensions.spacing_huge))

            // Título
            Text(
                text = stringResource(R.string.profile_setup_title),
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onBackground
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_small))

            Text(
                text = stringResource(R.string.profile_setup_subtitle),
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_huge))

            // Campo Nome
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text(stringResource(R.string.profile_setup_name)) },
                placeholder = { Text(stringResource(R.string.profile_setup_name_hint)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(AppDimensions.radius_medium)
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_large))

            // Campo Apelido
            OutlinedTextField(
                value = nickname,
                onValueChange = { nickname = it },
                label = { Text(stringResource(R.string.profile_setup_nickname)) },
                placeholder = { Text(stringResource(R.string.profile_setup_nickname_hint)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(AppDimensions.radius_medium)
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_extraLarge))

            // Posição Preferida
            Text(
                text = stringResource(R.string.profile_setup_position),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_small))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small)
            ) {
                positions.take(2).forEach { (label, value) ->
                    FilterChip(
                        selected = selectedPosition == value,
                        onClick = { selectedPosition = if (selectedPosition == value) null else value },
                        label = { Text(label) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(AppDimensions.spacing_small))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small)
            ) {
                positions.drop(2).forEach { (label, value) ->
                    FilterChip(
                        selected = selectedPosition == value,
                        onClick = { selectedPosition = if (selectedPosition == value) null else value },
                        label = { Text(label) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(AppDimensions.spacing_extraLarge))

            // Tipo de Campo Preferido
            Text(
                text = stringResource(R.string.profile_setup_field_type),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_small))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small)
            ) {
                FilterChip(
                    selected = societySelected,
                    onClick = { societySelected = !societySelected },
                    label = { Text(stringResource(R.string.field_type_society)) },
                    modifier = Modifier.weight(1f)
                )
                FilterChip(
                    selected = futsalSelected,
                    onClick = { futsalSelected = !futsalSelected },
                    label = { Text(stringResource(R.string.field_type_futsal)) },
                    modifier = Modifier.weight(1f)
                )
                FilterChip(
                    selected = campoSelected,
                    onClick = { campoSelected = !campoSelected },
                    label = { Text(stringResource(R.string.field_type_campo)) },
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.weight(1f))
            Spacer(modifier = Modifier.height(AppDimensions.spacing_huge))

            // Botão Continuar
            Button(
                onClick = {
                    val fieldTypes = mutableListOf<String>()
                    if (societySelected) fieldTypes.add("SOCIETY")
                    if (futsalSelected) fieldTypes.add("FUTSAL")
                    if (campoSelected) fieldTypes.add("CAMPO")

                    onContinue(
                        ProfileSetupData(
                            name = name.ifBlank { "" },
                            nickname = nickname.ifBlank { null },
                            preferredPosition = selectedPosition,
                            preferredFieldTypes = fieldTypes
                        )
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(AppDimensions.height_input),
                shape = RoundedCornerShape(AppDimensions.radius_large)
            ) {
                Text(
                    text = stringResource(R.string.continue_button),
                    style = MaterialTheme.typography.titleMedium
                )
            }

            Spacer(modifier = Modifier.height(AppDimensions.spacing_small))

            // Botão Pular
            TextButton(onClick = onSkip) {
                Text(
                    text = stringResource(R.string.profile_setup_skip),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(AppDimensions.spacing_large))
        }
    }
}
