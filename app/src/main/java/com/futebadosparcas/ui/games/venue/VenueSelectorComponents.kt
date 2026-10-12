package com.futebadosparcas.ui.games.venue

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.futebadosparcas.R
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

private const val LOCATION_TIMEOUT_MS = 8_000L

private val LOCATION_PERMISSIONS = arrayOf(
    Manifest.permission.ACCESS_FINE_LOCATION,
    Manifest.permission.ACCESS_COARSE_LOCATION
)

private fun hasLocationPermission(context: Context): Boolean =
    LOCATION_PERMISSIONS.any {
        ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
    }

@SuppressLint("MissingPermission")
private suspend fun fetchDevicePoint(context: Context): VenueGeoPoint? = withTimeoutOrNull(LOCATION_TIMEOUT_MS) {
    try {
        val client = LocationServices.getFusedLocationProviderClient(context)
        val location = client.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null).await()
            ?: client.lastLocation.await()
        location?.let { VenueGeoPoint(it.latitude, it.longitude) }
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        // Sem permissao efetiva, GPS desligado ou Play Services indisponivel: segue sem posicao.
        null
    }
}

private enum class GateStep { RATIONALE, ASKING, FETCHING }

/**
 * Descobre a posicao do aparelho para o seletor de quadras. Se ja ha permissao, le a posicao;
 * se nao, explica o motivo (rationale) antes de pedir. Sempre termina chamando [onResolved]
 * (com a posicao ou nulo), para o seletor cair no perfil / ultima cidade.
 */
@Composable
fun VenueDeviceLocationGate(onResolved: (VenueGeoPoint?) -> Unit) {
    val context = LocalContext.current
    var step by remember {
        mutableStateOf(if (hasLocationPermission(context)) GateStep.FETCHING else GateStep.RATIONALE)
    }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        if (grants.values.any { it }) step = GateStep.FETCHING else onResolved(null)
    }

    if (step == GateStep.FETCHING) {
        LaunchedEffect(Unit) { onResolved(fetchDevicePoint(context)) }
    }

    if (step == GateStep.RATIONALE) {
        AlertDialog(
            onDismissRequest = { onResolved(null) },
            title = { Text(stringResource(R.string.venue_location_rationale_title)) },
            text = { Text(stringResource(R.string.venue_location_rationale_message)) },
            confirmButton = {
                TextButton(onClick = {
                    step = GateStep.ASKING
                    launcher.launch(LOCATION_PERMISSIONS)
                }) { Text(stringResource(R.string.venue_location_allow)) }
            },
            dismissButton = {
                TextButton(onClick = { onResolved(null) }) { Text(stringResource(R.string.venue_location_not_now)) }
            }
        )
    }
}

/** Cidade atual + botao "Trocar cidade" (sempre visivel). */
@Composable
fun VenueCityBar(
    city: VenueCity?,
    onChangeCity: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = Icons.Default.LocationOn,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
            Text(
                text = if (city != null) {
                    stringResource(R.string.venue_city_current, city.label)
                } else {
                    stringResource(R.string.venue_no_city_hint)
                },
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
        }
        TextButton(onClick = onChangeCity) { Text(stringResource(R.string.venue_change_city)) }
    }
}

/** Selo "Não verificada" das quadras importadas em rascunho. */
@Composable
fun VenueUnverifiedBadge(modifier: Modifier = Modifier) {
    val description = stringResource(R.string.venue_unverified_description)
    Surface(
        modifier = modifier.semantics { contentDescription = description },
        shape = RoundedCornerShape(50),
        color = MaterialTheme.colorScheme.tertiaryContainer,
        contentColor = MaterialTheme.colorScheme.onTertiaryContainer
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(imageVector = Icons.Default.Info, contentDescription = null, modifier = Modifier.size(14.dp))
            Text(
                text = stringResource(R.string.venue_unverified_badge),
                style = MaterialTheme.typography.labelSmall
            )
        }
    }
}

/** Titulo da secao "Resultados em outras cidades". */
@Composable
fun VenueOtherCitiesHeader(modifier: Modifier = Modifier) {
    Text(
        text = stringResource(R.string.venue_other_cities_title),
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        fontWeight = FontWeight.Bold,
        modifier = modifier.padding(vertical = 8.dp)
    )
}

/** Dialogo "Trocar cidade": primeiro a UF, depois a cidade. */
@Composable
fun VenueChangeCityDialog(
    picker: CityPickerState,
    onPickState: (String) -> Unit,
    onPickCity: (VenueCity) -> Unit,
    onBackToStates: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (picker.uf != null) {
                    IconButton(onClick = onBackToStates) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.venue_picker_back)
                        )
                    }
                }
                Text(stringResource(R.string.venue_choose_state_title))
            }
        },
        text = {
            if (picker.uf == null) {
                StateList(onPickState)
            } else {
                CityList(picker, onPickCity)
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } }
    )
}

@Composable
private fun StateList(onPickState: (String) -> Unit) {
    Column {
        Text(
            text = stringResource(R.string.venue_choose_state_hint),
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        LazyColumn(modifier = Modifier.heightIn(max = 360.dp), contentPadding = PaddingValues(0.dp)) {
            items(BrazilianStates.all, key = { it.uf }) { state ->
                ListItem(
                    headlineContent = { Text("${state.name} (${state.uf})") },
                    modifier = Modifier.clickable { onPickState(state.uf) }
                )
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun CityList(picker: CityPickerState, onPickCity: (VenueCity) -> Unit) {
    val uf = picker.uf.orEmpty()
    Column {
        Text(
            text = stringResource(R.string.venue_choose_city_hint, BrazilianStates.nameOf(uf)),
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        when {
            picker.isLoading -> CircularProgressIndicator(modifier = Modifier.padding(16.dp))
            picker.failed -> Text(stringResource(R.string.venue_picker_load_failed))
            picker.cities.isEmpty() -> Text(
                stringResource(R.string.venue_no_cities_in_state, BrazilianStates.nameOf(uf))
            )
            else -> LazyColumn(modifier = Modifier.heightIn(max = 360.dp)) {
                items(picker.cities, key = { it }) { city ->
                    ListItem(
                        headlineContent = { Text(city) },
                        modifier = Modifier.clickable { onPickCity(VenueCity(city, uf)) }
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}
