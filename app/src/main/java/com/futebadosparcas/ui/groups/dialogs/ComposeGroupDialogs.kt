package com.futebadosparcas.ui.groups.dialogs

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import com.futebadosparcas.data.model.CashboxCategory
import com.futebadosparcas.data.model.CashboxEntryType
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.util.AppLogger
import java.io.File

private const val TAG = "ComposeGroupDialogs"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditGroupDialog(
    group: Group,
    onDismiss: () -> Unit,
    onSave: (name: String, description: String, photoUri: Uri?) -> Unit
) {
    var name by remember { mutableStateOf(group.name) }
    var description by remember { mutableStateOf(group.description) }
    var selectedPhotoUri by remember { mutableStateOf<Uri?>(null) }
    var showPhotoOptions by remember { mutableStateOf(false) }

    val context = LocalContext.current
    
    // Photo Logic
    val tempCameraUri = remember { mutableStateOf<Uri?>(null) }
    
    val pickImageLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? -> selectedPhotoUri = uri }

    val takePictureLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success -> if (success) selectedPhotoUri = tempCameraUri.value }

    if (showPhotoOptions) {
        AlertDialog(
            onDismissRequest = { showPhotoOptions = false },
            title = { Text("Foto do Grupo") },
            text = {
                Column {
                    ListItem(
                        headlineContent = { Text("Tirar Foto") },
                        leadingContent = { Icon(Icons.Default.CameraAlt, null) },
                        modifier = Modifier.clickable {
                            try {
                                val file = File.createTempFile("group_edit_", ".jpg", context.cacheDir)
                                val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                                tempCameraUri.value = uri
                                takePictureLauncher.launch(uri)
                            } catch (e: Exception) {
                                AppLogger.e(TAG, "Erro ao abrir câmera para foto do grupo", e)
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
            dismissButton = { TextButton(onClick = { showPhotoOptions = false }) { Text("Cancelar") } }
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
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Editar Grupo",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 24.dp)
                )

                // Photo
                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .clip(CircleShape)
                        .border(2.dp, MaterialTheme.colorScheme.primary, CircleShape)
                        .clickable { showPhotoOptions = true },
                    contentAlignment = Alignment.Center
                ) {
                    AsyncImage(
                        model = selectedPhotoUri ?: group.photoUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                        placeholder = painterResource(R.drawable.ic_groups),
                        error = painterResource(R.drawable.ic_groups)
                    )
                }
                TextButton(onClick = { showPhotoOptions = true }) {
                    Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Alterar Foto")
                }

                Spacer(Modifier.height(16.dp))

                OutlinedTextField(
                    value = name,
                    onValueChange = { if (it.length <= 50) name = it },
                    label = { Text("Nome do Grupo") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(Modifier.height(12.dp))

                OutlinedTextField(
                    value = description,
                    onValueChange = { if (it.length <= 200) description = it },
                    label = { Text("Descrição") },
                    minLines = 3,
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(Modifier.height(24.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) { Text("Cancelar") }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = { onSave(name, description, selectedPhotoUri) },
                        enabled = name.isNotBlank() && name.length >= 3
                    ) {
                        Text("Salvar")
                    }
                }
            }
        }
    }
}

@Composable
fun TransferOwnershipDialog(
    members: List<GroupMember>,
    onDismiss: () -> Unit,
    onMemberSelected: (GroupMember) -> Unit
) {
    // Filter out owners, just in case
    val candidates = remember(members) { members.filter { it.getRoleEnum() != GroupMemberRole.OWNER } }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().heightIn(max = 500.dp),
            shape = RoundedCornerShape(24.dp)
        ) {
            Column(Modifier.padding(16.dp)) {
                Text(
                    text = "Transferir Propriedade",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 16.dp)
                )

                if (candidates.isEmpty()) {
                    Text(
                        "Não há outros membros para transferir a propriedade.",
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(candidates) { member ->
                            ListItem(
                                headlineContent = { Text(member.getDisplayName()) },
                                leadingContent = {
                                    AsyncImage(
                                        model = member.userPhoto,
                                        contentDescription = null,
                                        modifier = Modifier.size(40.dp).clip(CircleShape),
                                        placeholder = painterResource(R.drawable.ic_player_placeholder),
                                        error = painterResource(R.drawable.ic_player_placeholder)
                                    )
                                },
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .clickable { onMemberSelected(member) }
                            )
                            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant, thickness = 0.5.dp)
                        }
                    }
                }
                
                Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancelar") }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddCashboxEntryDialog(
    type: CashboxEntryType,
    onDismiss: () -> Unit,
    onSave: (description: String, amount: Double, category: CashboxCategory, receiptUri: Uri?) -> Unit
) {
    var description by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf<CashboxCategory?>(null) }
    var selectedReceiptUri by remember { mutableStateOf<Uri?>(null) }
    var expanded by remember { mutableStateOf(false) }

    val categories = remember(type) {
        if (type == CashboxEntryType.INCOME) CashboxCategory.getIncomeCategories()
        else CashboxCategory.getExpenseCategories()
    }

    // Receipt Pickers
    val context = LocalContext.current
    val tempCameraUri = remember { mutableStateOf<Uri?>(null) }
    var showPhotoOptions by remember { mutableStateOf(false) }

    val pickImageLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? -> selectedReceiptUri = uri }

    val takePictureLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success -> if (success) selectedReceiptUri = tempCameraUri.value }

    if (showPhotoOptions) {
        AlertDialog(
            onDismissRequest = { showPhotoOptions = false },
            title = { Text("Comprovante") },
            text = {
                Column {
                    ListItem(
                        headlineContent = { Text("Tirar Foto") },
                        leadingContent = { Icon(Icons.Default.CameraAlt, null) },
                        modifier = Modifier.clickable {
                            try {
                                val file = File.createTempFile("receipt_", ".jpg", context.cacheDir)
                                val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                                tempCameraUri.value = uri
                                takePictureLauncher.launch(uri)
                            } catch (e: Exception) {
                                AppLogger.e(TAG, "Erro ao abrir câmera para comprovante", e)
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
            dismissButton = { TextButton(onClick = { showPhotoOptions = false }) { Text("Cancelar") } }
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Adicionar ${type.displayName}") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Category Dropdown
                Box {
                    OutlinedTextField(
                        value = selectedCategory?.displayName ?: "Selecione a categoria",
                        onValueChange = {},
                        label = { Text("Categoria") },
                        readOnly = true,
                        trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
                        modifier = Modifier.fillMaxWidth().clickable { expanded = true },
                        enabled = false,
                        colors = OutlinedTextFieldDefaults.colors(
                            disabledTextColor = MaterialTheme.colorScheme.onSurface,
                            disabledBorderColor = MaterialTheme.colorScheme.outline,
                            disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )
                    // Invisible internal clickable layer
                    Box(Modifier.matchParentSize().clickable { expanded = true })

                    DropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }
                    ) {
                        categories.forEach { category ->
                            DropdownMenuItem(
                                text = { Text(category.displayName) },
                                onClick = {
                                    selectedCategory = category
                                    expanded = false
                                }
                            )
                        }
                    }
                }

                // Amount
                OutlinedTextField(
                    value = amount,
                    onValueChange = { input ->
                         if (input.all { it.isDigit() || it == '.' || it == ',' }) {
                             amount = input
                         }
                    },
                    label = { Text("Valor (R$)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth()
                )

                // Description
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Descrição") },
                    modifier = Modifier.fillMaxWidth()
                )

                // Receipt
                if (selectedReceiptUri != null) {
                    Box(Modifier.fillMaxWidth().height(150.dp)) {
                        AsyncImage(
                            model = selectedReceiptUri,
                            contentDescription = "Receipt",
                            modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(8.dp)),
                            contentScale = ContentScale.Crop
                        )
                        IconButton(
                            onClick = { selectedReceiptUri = null },
                            modifier = Modifier.align(Alignment.TopEnd).padding(4.dp)
                                .background(MaterialTheme.colorScheme.surface.copy(alpha=0.7f), CircleShape)
                        ) {
                            Icon(Icons.Default.Delete, null, tint = MaterialTheme.colorScheme.error)
                        }
                    }
                } else {
                    OutlinedButton(
                        onClick = { showPhotoOptions = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Image, null)
                        Spacer(Modifier.width(8.dp))
                        Text("Adicionar Comprovante")
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amountVal = amount.replace(",", ".").toDoubleOrNull()
                    val category = selectedCategory
                    if (amountVal != null && amountVal > 0 && category != null) {
                         if (category == CashboxCategory.OTHER && description.isBlank()) {
                              // error
                         } else {
                             onSave(description, amountVal, category, selectedReceiptUri)
                         }
                    }
                },
                enabled = amount.isNotBlank() && selectedCategory != null
            ) {
                Text("Salvar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar") }
        }
    )
}
