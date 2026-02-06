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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.components.CachedAsyncImage
import com.futebadosparcas.data.model.CashboxEntryType
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import androidx.compose.ui.res.stringResource
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
    ) { uri: Uri? ->
        uri?.let {
            selectedPhotoUri = it
        }
    }

    val takePictureLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        if (success) {
            selectedPhotoUri = tempCameraUri.value
        }
    }

    // Validação de nome
    val nameValidationError = remember(name) {
        when {
            name.trim().isEmpty() -> context.getString(R.string.validation_name_required)
            name.trim().length < 3 -> context.getString(R.string.validation_name_min_chars)
            name.trim().length > 50 -> context.getString(R.string.validation_name_max_chars)
            !name.trim().matches(Regex("^[\\p{L}\\p{N}\\s\\-_']+$")) -> context.getString(R.string.validation_name_invalid)
            else -> null
        }
    }

    // Validação de descrição
    val descriptionValidationError = remember(description) {
        when {
            description.trim().length > 200 -> context.getString(R.string.validation_description_max_chars)
            else -> null
        }
    }

    // Habilitar botão apenas se houve mudança e os dados são válidos
    val hasChanges = name.trim() != group.name ||
        description.trim() != group.description ||
        selectedPhotoUri != null
    val isValid = nameValidationError == null && descriptionValidationError == null
    val canSave = hasChanges && isValid

    if (showPhotoOptions) {
        AlertDialog(
            onDismissRequest = { showPhotoOptions = false },
            title = { Text(stringResource(R.string.create_group_photo_dialog_title)) },
            text = {
                Column {
                    ListItem(
                        headlineContent = { Text(stringResource(R.string.create_group_photo_dialog_camera)) },
                        leadingContent = { Icon(Icons.Default.CameraAlt, contentDescription = stringResource(R.string.cd_take_photo)) },
                        modifier = Modifier.clickable {
                            try {
                                val file = File.createTempFile("group_photo_edit_", ".jpg", context.cacheDir)
                                val uri = FileProvider.getUriForFile(
                                    context,
                                    "${context.packageName}.fileprovider",
                                    file
                                )
                                tempCameraUri.value = uri
                                takePictureLauncher.launch(uri)
                            } catch (e: Exception) {
                                AppLogger.e(TAG, "Erro ao abrir câmera para foto do grupo", e)
                                Toast.makeText(context, context.getString(R.string.dialog_error_camera), Toast.LENGTH_SHORT).show()
                            }
                            showPhotoOptions = false
                        }
                    )
                    ListItem(
                        headlineContent = { Text(stringResource(R.string.create_group_photo_dialog_gallery)) },
                        leadingContent = { Icon(Icons.Default.PhotoLibrary, contentDescription = stringResource(R.string.cd_photo_gallery)) },
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
                    Text(stringResource(R.string.action_cancel))
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
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = stringResource(R.string.dialog_edit_group),
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
                    CachedProfileImage(
                        photoUrl = selectedPhotoUri?.toString() ?: group.photoUrl,
                        userName = group.name,
                        size = 100.dp
                    )
                }
                TextButton(onClick = { showPhotoOptions = true }) {
                    Icon(
                        if (selectedPhotoUri != null) Icons.Default.Edit else Icons.Default.Add,
                        contentDescription = stringResource(R.string.cd_edit),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(if (selectedPhotoUri != null) stringResource(R.string.create_group_change_photo) else stringResource(R.string.create_group_add_photo))
                }

                Spacer(Modifier.height(16.dp))

                OutlinedTextField(
                    value = name,
                    onValueChange = { if (it.length <= 50) name = it },
                    label = { Text(stringResource(R.string.dialog_group_name)) },
                    singleLine = true,
                    isError = nameValidationError != null,
                    supportingText = {
                        nameValidationError?.let { error ->
                            Text(
                                text = error,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(Modifier.height(12.dp))

                OutlinedTextField(
                    value = description,
                    onValueChange = { if (it.length <= 200) description = it },
                    label = { Text(stringResource(R.string.label_description)) },
                    minLines = 3,
                    maxLines = 5,
                    isError = descriptionValidationError != null,
                    supportingText = {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            descriptionValidationError?.let { error ->
                                Text(
                                    text = error,
                                    color = MaterialTheme.colorScheme.error
                                )
                            }
                            Text(
                                text = "${description.length}/200",
                                color = if (description.length > 200) {
                                    MaterialTheme.colorScheme.error
                                } else {
                                    MaterialTheme.colorScheme.onSurfaceVariant
                                }
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(Modifier.height(24.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_cancel),
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(R.string.action_cancel))
                    }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = {
                            onSave(name.trim(), description.trim(), selectedPhotoUri)
                        },
                        enabled = canSave
                    ) {
                        Icon(
                            Icons.Default.Save,
                            contentDescription = stringResource(R.string.cd_save),
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(R.string.action_save))
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

    var showConfirmation by remember { mutableStateOf(false) }
    var selectedMember by remember { mutableStateOf<GroupMember?>(null) }

    if (showConfirmation && selectedMember != null) {
        AlertDialog(
            onDismissRequest = { showConfirmation = false },
            title = { Text(stringResource(R.string.dialog_transfer_ownership)) },
            text = {
                Text(stringResource(R.string.dialog_transfer_message, selectedMember?.getDisplayName() ?: ""))
            },
            confirmButton = {
                Button(onClick = {
                    selectedMember?.let { onMemberSelected(it) }
                    showConfirmation = false
                }) {
                    Icon(Icons.Default.SwapHoriz, contentDescription = stringResource(R.string.cd_transfer_ownership), modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(stringResource(R.string.dialog_transfer))
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmation = false }) {
                    Icon(Icons.Default.Close, contentDescription = stringResource(R.string.cd_close), modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(stringResource(R.string.action_cancel))
                }
            }
        )
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().heightIn(max = 500.dp),
            shape = RoundedCornerShape(24.dp)
        ) {
            Column(Modifier.padding(16.dp)) {
                Text(
                    text = stringResource(R.string.dialog_transfer_ownership),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 16.dp)
                )

                if (candidates.isEmpty()) {
                    Text(
                        stringResource(R.string.dialog_no_members),
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
                                    CachedProfileImage(
                                        photoUrl = member.userPhoto,
                                        userName = member.getDisplayName(),
                                        size = 40.dp
                                    )
                                },
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .clickable {
                                        selectedMember = member
                                        showConfirmation = true
                                    }
                            )
                            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant, thickness = 0.5.dp)
                        }
                    }
                }

                Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = stringResource(R.string.cd_close), modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(R.string.cancel))
                    }
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
            title = { Text(stringResource(R.string.cashbox_receipt)) },
            text = {
                Column {
                    ListItem(
                        headlineContent = { Text(stringResource(R.string.create_group_photo_dialog_camera)) },
                        leadingContent = { Icon(Icons.Default.CameraAlt, contentDescription = stringResource(R.string.cd_take_photo)) },
                        modifier = Modifier.clickable {
                            try {
                                val file = File.createTempFile("receipt_", ".jpg", context.cacheDir)
                                val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                                tempCameraUri.value = uri
                                takePictureLauncher.launch(uri)
                            } catch (e: Exception) {
                                AppLogger.e(TAG, "Erro ao abrir câmera para comprovante", e)
                                Toast.makeText(context, context.getString(R.string.dialog_error_camera), Toast.LENGTH_SHORT).show()
                            }
                            showPhotoOptions = false
                        }
                    )
                    ListItem(
                        headlineContent = { Text(stringResource(R.string.create_group_photo_dialog_gallery)) },
                        leadingContent = { Icon(Icons.Default.PhotoLibrary, contentDescription = stringResource(R.string.cd_choose_photo)) },
                        modifier = Modifier.clickable {
                            pickImageLauncher.launch("image/*")
                            showPhotoOptions = false
                        }
                    )
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { showPhotoOptions = false }) { Text(stringResource(R.string.action_cancel)) } }
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(if (type == CashboxEntryType.INCOME) R.string.cashbox_add_income_type else R.string.cashbox_add_expense_type)) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Category Dropdown
                Box {
                    OutlinedTextField(
                        value = selectedCategory?.displayName ?: stringResource(R.string.cashbox_select_category),
                        onValueChange = {},
                        label = { Text(stringResource(R.string.label_category)) },
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
                    label = { Text(stringResource(R.string.cashbox_value_hint)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth()
                )

                // Description
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text(stringResource(R.string.label_description)) },
                    modifier = Modifier.fillMaxWidth()
                )

                // Receipt
                if (selectedReceiptUri != null) {
                    Box(Modifier.fillMaxWidth().height(150.dp)) {
                        AsyncImage(
                            model = selectedReceiptUri,
                            contentDescription = stringResource(R.string.cashbox_receipt),
                            modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(8.dp)),
                            contentScale = ContentScale.Crop
                        )
                        IconButton(
                            onClick = { selectedReceiptUri = null },
                            modifier = Modifier.align(Alignment.TopEnd).padding(4.dp)
                                .background(MaterialTheme.colorScheme.surface.copy(alpha=0.7f), CircleShape)
                        ) {
                            Icon(Icons.Default.Delete, contentDescription = stringResource(R.string.cd_delete_receipt), tint = MaterialTheme.colorScheme.error)
                        }
                    }
                } else {
                    OutlinedButton(
                        onClick = { showPhotoOptions = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Image, contentDescription = stringResource(R.string.cd_add_receipt_image))
                        Spacer(Modifier.width(8.dp))
                        Text(stringResource(R.string.cashbox_add_receipt))
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amountVal = amount.replace(",", ".").toDoubleOrNull()
                    val category = selectedCategory

                    // Validação: categoria e valor são obrigatórios
                    if (amountVal != null && amountVal > 0 && category != null) {
                        // Validação: se categoria é "OTHER", descrição é obrigatória
                        if (category == CashboxCategory.OTHER && description.isBlank()) {
                            // Usuário será notificado visualmente no campo de descrição
                            // Por enquanto, não salvamos
                        } else {
                            onSave(description, amountVal, category, selectedReceiptUri)
                            onDismiss()
                        }
                    }
                },
                enabled = amount.isNotBlank() && selectedCategory != null &&
                    amount.replace(",", ".").toDoubleOrNull()?.let { it > 0 } ?: false
            ) {
                Icon(Icons.Default.Save, contentDescription = stringResource(R.string.cd_save), modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.action_save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Icon(Icons.Default.Close, contentDescription = stringResource(R.string.cd_close), modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.action_cancel))
            }
        }
    )
}
