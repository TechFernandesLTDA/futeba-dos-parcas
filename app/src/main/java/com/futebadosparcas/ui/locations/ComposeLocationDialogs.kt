package com.futebadosparcas.ui.locations

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.FileProvider
import coil.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.ui.components.CachedFieldImage
import com.futebadosparcas.util.AppLogger
import java.io.File

private const val TAG = "ComposeLocationDialogs"

/**
 * Dialog para editar/criar uma quadra (Field).
 * Permite alterar nome, tipo, preço, dimensões, cobertura, status e foto.
 *
 * @param field Campo existente a ser editado (null para criar novo)
 * @param defaultType Tipo padrão se criando novo campo
 * @param onDismiss Callback quando o dialog é dismissido
 * @param onSave Callback com dados salvos: (name, type, price, isActive, photoUri, surface, isCovered, dimensions)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FieldEditDialog(
    field: Field? = null,
    defaultType: FieldType = FieldType.SOCIETY,
    onDismiss: () -> Unit,
    onSave: (String, FieldType, Double, Boolean, Uri?, String?, Boolean, String?) -> Unit
) {
    var name by remember { mutableStateOf(field?.name ?: "") }
    var selectedType by remember { mutableStateOf(field?.getTypeEnum() ?: defaultType) }
    var price by remember { mutableStateOf(field?.hourlyPrice?.toString() ?: "") }
    var surface by remember { mutableStateOf(field?.surface ?: "") }
    var dimensions by remember { mutableStateOf(field?.dimensions ?: "") }
    var isCovered by remember { mutableStateOf(field?.isCovered ?: false) }
    var isActive by remember { mutableStateOf(field?.isActive ?: true) }
    var selectedPhotoUri by remember { mutableStateOf<Uri?>(null) }
    var showNameError by remember { mutableStateOf(false) }
    var showPriceError by remember { mutableStateOf(false) }
    var showPhotoOptions by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val tempCameraUri = remember { mutableStateOf<Uri?>(null) }
    var expandedType by remember { mutableStateOf(false) }

    val pickImageLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        selectedPhotoUri = uri
    }

    val takePictureLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        if (success) {
            selectedPhotoUri = tempCameraUri.value
        }
    }

    // Photo options dialog
    if (showPhotoOptions) {
        AlertDialog(
            onDismissRequest = { showPhotoOptions = false },
            title = { Text("Foto da Quadra") },
            text = {
                Column {
                    ListItem(
                        headlineContent = { Text("Tirar Foto") },
                        leadingContent = { Icon(Icons.Default.CameraAlt, null) },
                        modifier = Modifier.clickable {
                            try {
                                val file = File.createTempFile("field_", ".jpg", context.cacheDir)
                                val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                                tempCameraUri.value = uri
                                takePictureLauncher.launch(uri)
                            } catch (e: Exception) {
                                AppLogger.e(TAG, "Erro ao abrir câmera para foto da quadra", e)
                                Toast.makeText(context, "Erro ao abrir câmera", Toast.LENGTH_SHORT).show()
                            }
                            showPhotoOptions = false
                        }
                    )
                    ListItem(
                        headlineContent = { Text("Escolher da Galeria") },
                        leadingContent = { Icon(Icons.Default.PhotoLibrary, null) },
                        modifier = Modifier.clickable {
                            pickImageLauncher.launch("image/*")
                            showPhotoOptions = false
                        }
                    )
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showPhotoOptions = false }) {
                    Text("Cancelar")
                }
            }
        )
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(0.95f),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp
        ) {
            LazyColumn(
                modifier = Modifier
                    .padding(24.dp)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    // Title
                    Text(
                        text = if (field != null) "Editar Quadra" else "Nova Quadra",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                }

                item {
                    // Photo
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(150.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                            .clickable { showPhotoOptions = true },
                        contentAlignment = Alignment.Center
                    ) {
                        if (selectedPhotoUri != null) {
                            CachedFieldImage(
                                imageUrl = selectedPhotoUri.toString(),
                                fieldName = "Quadra",
                                width = 150.dp,
                                height = 150.dp
                            )
                        } else if (!field?.photos.isNullOrEmpty()) {
                            CachedFieldImage(
                                imageUrl = field?.photos?.get(0),
                                fieldName = field?.name ?: "Quadra",
                                width = 150.dp,
                                height = 150.dp
                            )
                        } else {
                            Column(
                                modifier = Modifier.fillMaxSize(),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Icon(
                                    Icons.Default.PhotoLibrary,
                                    null,
                                    modifier = Modifier.size(40.dp),
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    "Toque para adicionar",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(top = 8.dp)
                                )
                            }
                        }
                    }

                    if (selectedPhotoUri != null || !field?.photos.isNullOrEmpty()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center
                        ) {
                            TextButton(
                                onClick = { showPhotoOptions = true }
                            ) {
                                Icon(Icons.Default.Edit, null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Alterar Foto")
                            }
                        }
                    }
                }

                item {
                    // Nome
                    OutlinedTextField(
                        value = name,
                        onValueChange = {
                            name = it
                            showNameError = false
                        },
                        label = { Text("Nome da Quadra") },
                        singleLine = true,
                        isError = showNameError,
                        modifier = Modifier.fillMaxWidth(),
                        supportingText = if (showNameError) {
                            { Text("Campo obrigatório", color = MaterialTheme.colorScheme.error) }
                        } else null
                    )
                }

                item {
                    // Type Dropdown
                    Box {
                        OutlinedTextField(
                            value = selectedType.displayName,
                            onValueChange = {},
                            label = { Text("Tipo de Quadra") },
                            readOnly = true,
                            trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { expandedType = true },
                            enabled = false,
                            colors = OutlinedTextFieldDefaults.colors(
                                disabledTextColor = MaterialTheme.colorScheme.onSurface,
                                disabledBorderColor = MaterialTheme.colorScheme.outline,
                                disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        )

                        DropdownMenu(
                            expanded = expandedType,
                            onDismissRequest = { expandedType = false }
                        ) {
                            FieldType.entries.forEach { type ->
                                DropdownMenuItem(
                                    text = { Text(type.displayName) },
                                    onClick = {
                                        selectedType = type
                                        expandedType = false
                                    }
                                )
                            }
                        }
                    }
                }

                item {
                    // Preço
                    OutlinedTextField(
                        value = price,
                        onValueChange = {
                            if (it.isEmpty() || it.toDoubleOrNull() != null) {
                                price = it
                                showPriceError = false
                            }
                        },
                        label = { Text("Preço por Hora (R$)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        isError = showPriceError,
                        modifier = Modifier.fillMaxWidth(),
                        supportingText = if (showPriceError) {
                            { Text("Valor inválido", color = MaterialTheme.colorScheme.error) }
                        } else null
                    )
                }

                item {
                    // Surface
                    OutlinedTextField(
                        value = surface,
                        onValueChange = { surface = it },
                        label = { Text("Superfície (opcional)") },
                        placeholder = { Text("Ex: Grama Sintética") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    // Dimensions
                    OutlinedTextField(
                        value = dimensions,
                        onValueChange = { dimensions = it },
                        label = { Text("Dimensões (opcional)") },
                        placeholder = { Text("Ex: 30x15m") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    // Switches
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Quadra Coberta")
                        Switch(
                            checked = isCovered,
                            onCheckedChange = { isCovered = it }
                        )
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Ativa")
                        Switch(
                            checked = isActive,
                            onCheckedChange = { isActive = it }
                        )
                    }
                }

                item {
                    Spacer(Modifier.height(16.dp))
                }

                item {
                    // Action Buttons
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(onClick = onDismiss) {
                            Text("Cancelar")
                        }
                        Spacer(Modifier.width(8.dp))
                        Button(
                            onClick = {
                                // Validação
                                showNameError = name.isBlank()

                                val priceValue = price.toDoubleOrNull() ?: 0.0
                                showPriceError = price.isNotBlank() && priceValue < 0

                                if (!showNameError && !showPriceError) {
                                    val surfaceValue = surface.takeIf { it.isNotBlank() }
                                    val dimensionsValue = dimensions.takeIf { it.isNotBlank() }

                                    onSave(
                                        name,
                                        selectedType,
                                        priceValue,
                                        isActive,
                                        selectedPhotoUri,
                                        surfaceValue,
                                        isCovered,
                                        dimensionsValue
                                    )
                                    onDismiss()
                                }
                            },
                            enabled = name.isNotBlank()
                        ) {
                            Text("Salvar")
                        }
                    }
                }

                item {
                    Spacer(Modifier.height(8.dp))
                }
            }
        }
    }
}
