package com.futebadosparcas.ui.games.components

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.data.model.GameConfirmation
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlin.math.roundToInt
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Card que exibe o botão de check-in para jogadores confirmados.
 * Issue #36: Check-in por GPS
 *
 * @param game Dados do jogo (para verificar se requer check-in)
 * @param userConfirmation Confirmação do usuário atual
 * @param onCheckIn Callback quando o check-in for realizado com sucesso
 * @param onCheckInError Callback para erros
 */
@Composable
fun PlayerCheckInCard(
    game: Game,
    userConfirmation: GameConfirmation?,
    onCheckIn: (latitude: Double, longitude: Double) -> Unit,
    onCheckInError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    // Verificar se o jogo requer check-in
    if (!game.requireCheckin) return

    // Verificar se o usuário está confirmado
    if (userConfirmation == null || userConfirmation.status != "CONFIRMED") return

    // Verificar se já fez check-in
    val hasCheckedIn = userConfirmation.checkedIn

    val context = LocalContext.current
    var isLoading by remember { mutableStateOf(false) }

    // Launcher para solicitar permissão de localização
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            isLoading = true
            getCurrentLocation(context) { lat, lng ->
                isLoading = false
                if (lat != null && lng != null) {
                    onCheckIn(lat, lng)
                } else {
                    onCheckInError("Não foi possível obter sua localização")
                }
            }
        } else {
            onCheckInError("Permissão de localização necessária para check-in")
        }
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (hasCheckedIn)
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
            else
                MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.5f)
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = if (hasCheckedIn) Icons.Filled.CheckCircle else Icons.Outlined.LocationOn,
                    contentDescription = null,
                    tint = if (hasCheckedIn)
                        MaterialTheme.colorScheme.primary
                    else
                        MaterialTheme.colorScheme.tertiary,
                    modifier = Modifier.size(28.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (hasCheckedIn)
                        stringResource(R.string.status_checked_in)
                    else
                        stringResource(R.string.checkin_required),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (hasCheckedIn)
                        MaterialTheme.colorScheme.primary
                    else
                        MaterialTheme.colorScheme.tertiary
                )
            }

            if (!hasCheckedIn) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.checkin_radius_info, game.checkinRadiusMeters),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(12.dp))

                Button(
                    onClick = {
                        val hasPermission = ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.ACCESS_FINE_LOCATION
                        ) == PackageManager.PERMISSION_GRANTED

                        if (hasPermission) {
                            isLoading = true
                            getCurrentLocation(context) { lat, lng ->
                                isLoading = false
                                if (lat != null && lng != null) {
                                    onCheckIn(lat, lng)
                                } else {
                                    onCheckInError("Não foi possível obter sua localização")
                                }
                            }
                        } else {
                            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                        }
                    },
                    enabled = !isLoading,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.tertiary
                    )
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onTertiary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    } else {
                        Icon(
                            imageVector = Icons.Default.MyLocation,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(stringResource(R.string.checkin_button))
                }
            } else {
                Spacer(modifier = Modifier.height(4.dp))
                userConfirmation.checkedInAt?.let { date ->
                    val timeFormat = remember { java.text.SimpleDateFormat("HH:mm", java.util.Locale.forLanguageTag("pt-BR")) }
                    Text(
                        text = stringResource(R.string.checkin_done_at, timeFormat.format(date)),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

/**
 * Dialog para configurar check-in GPS (owner).
 * Issue #36: Configuração de check-in
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckInSettingsDialog(
    currentEnabled: Boolean,
    currentRadius: Int,
    onDismiss: () -> Unit,
    onSave: (enabled: Boolean, radiusMeters: Int) -> Unit
) {
    var enabled by remember { mutableStateOf(currentEnabled) }
    var radius by remember { mutableFloatStateOf(currentRadius.toFloat()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Outlined.LocationOn,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
        },
        title = {
            Text(stringResource(R.string.checkin_settings_title))
        },
        text = {
            Column {
                // Toggle para ativar/desativar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stringResource(R.string.checkin_require_label),
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = stringResource(R.string.checkin_require_description),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Switch(
                        checked = enabled,
                        onCheckedChange = { enabled = it }
                    )
                }

                // Slider de raio (apenas se ativado)
                AnimatedVisibility(visible = enabled) {
                    Column(modifier = Modifier.padding(top = 24.dp)) {
                        Text(
                            text = stringResource(R.string.checkin_radius_label),
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.Medium
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = stringResource(R.string.checkin_radius_value, radius.roundToInt()),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Slider(
                            value = radius,
                            onValueChange = { radius = it },
                            valueRange = 10f..500f,
                            steps = 9 // 10, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "10m",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "500m",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Info,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = stringResource(R.string.checkin_radius_tip),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(enabled, radius.roundToInt()) }
            ) {
                Text(stringResource(R.string.action_save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel))
            }
        }
    )
}

/**
 * Item para exibir na seção do owner para acessar configurações de check-in.
 */
@Composable
fun CheckInSettingsItem(
    enabled: Boolean,
    radius: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Outlined.LocationOn,
            contentDescription = null,
            tint = if (enabled) MaterialTheme.colorScheme.primary
                   else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = stringResource(R.string.checkin_settings_title),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = if (enabled)
                    stringResource(R.string.checkin_enabled_with_radius, radius)
                else
                    stringResource(R.string.checkin_disabled),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Switch(
            checked = enabled,
            onCheckedChange = { onClick() },
            modifier = Modifier.padding(start = 8.dp)
        )
    }
}

/**
 * Botão "A Caminho" para jogadores indicarem que estão a caminho.
 */
@Composable
fun OnTheWayButton(
    isOnTheWay: Boolean,
    eta: Int?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val containerColor by animateColorAsState(
        targetValue = if (isOnTheWay)
            MaterialTheme.colorScheme.secondaryContainer
        else
            MaterialTheme.colorScheme.surfaceVariant,
        label = "containerColor"
    )

    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = containerColor
        )
    ) {
        Icon(
            imageVector = if (isOnTheWay) Icons.Filled.DirectionsCar else Icons.Outlined.DirectionsCar,
            contentDescription = null,
            modifier = Modifier.size(18.dp),
            tint = if (isOnTheWay)
                MaterialTheme.colorScheme.secondary
            else
                MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = if (isOnTheWay && eta != null)
                stringResource(R.string.on_the_way_eta, eta)
            else if (isOnTheWay)
                stringResource(R.string.on_the_way)
            else
                stringResource(R.string.mark_on_the_way),
            color = if (isOnTheWay)
                MaterialTheme.colorScheme.secondary
            else
                MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Obtém a localização atual usando FusedLocationProvider.
 */
private fun getCurrentLocation(
    context: Context,
    callback: (latitude: Double?, longitude: Double?) -> Unit
) {
    try {
        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)

        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener { location ->
                if (location != null) {
                    callback(location.latitude, location.longitude)
                } else {
                    // Fallback: tentar última localização conhecida
                    fusedLocationClient.lastLocation
                        .addOnSuccessListener { lastLocation ->
                            callback(lastLocation?.latitude, lastLocation?.longitude)
                        }
                        .addOnFailureListener {
                            callback(null, null)
                        }
                }
            }
            .addOnFailureListener {
                callback(null, null)
            }
    } catch (e: SecurityException) {
        callback(null, null)
    }
}
