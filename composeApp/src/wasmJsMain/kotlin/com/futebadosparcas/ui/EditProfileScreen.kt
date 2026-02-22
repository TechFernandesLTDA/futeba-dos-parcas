package com.futebadosparcas.ui

import androidx.compose.foundation.background
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.clickable
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.layout.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.rememberScrollState
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.shape.CircleShape
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.shape.RoundedCornerShape
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.verticalScroll
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.material3.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.runtime.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.Alignment
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.Modifier
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.draw.clip
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.font.FontWeight
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.input.KeyboardType
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.style.TextAlign
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.ui.components.states.ErrorState
import kotlinx.coroutines.launch
import com.futebadosparcas.ui.components.states.ErrorState

private data class EditProfileData(
    val name: String = "",
    val nickname: String = "",
    val email: String = "",
    val phone: String = "",
    val bio: String = "",
    val primaryPosition: String = "",
    val dominantFoot: String = "",
    val societyChecked: Boolean = false,
    val futsalChecked: Boolean = false,
    val campoChecked: Boolean = false
)

private sealed class EditProfileUiState {
    object Loading : EditProfileUiState()
    data class Success(val profile: EditProfileData) : EditProfileUiState()
    data class Error(val message: String) : EditProfileUiState()
    object Saving : EditProfileUiState()
    object Saved : EditProfileUiState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfileScreen(
    onBackClick: () -> Unit = {},
    onProfileUpdated: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var uiState by remember { mutableStateOf<EditProfileUiState>(EditProfileUiState.Loading) }
    var showSaveSuccess by remember { mutableStateOf(false) }

    var name by remember { mutableStateOf("") }
    var nickname by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var bio by remember { mutableStateOf("") }
    var primaryPosition by remember { mutableStateOf("") }
    var dominantFoot by remember { mutableStateOf("") }
    var societyChecked by remember { mutableStateOf(false) }
    var futsalChecked by remember { mutableStateOf(false) }
    var campoChecked by remember { mutableStateOf(false) }

    var nameError by remember { mutableStateOf<String?>(null) }
    var phoneError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                val profileData = FirebaseManager.getCurrentUserProfile()
                if (profileData != null) {
                    name = profileData["name"] as? String ?: ""
                    nickname = profileData["nickname"] as? String ?: ""
                    email = profileData["email"] as? String ?: ""
                    phone = profileData["phone"] as? String ?: ""
                    bio = profileData["bio"] as? String ?: ""
                    primaryPosition = profileData["primaryPosition"] as? String ?: ""
                    dominantFoot = profileData["dominantFoot"] as? String ?: ""
                    
                    val fieldTypes = (profileData["preferredFieldTypes"] as? List<*>)?.filterIsInstance<String>() ?: emptyList()
                    societyChecked = fieldTypes.contains("SOCIETY")
                    futsalChecked = fieldTypes.contains("FUTSAL")
                    campoChecked = fieldTypes.contains("CAMPO")
                    
                    uiState = EditProfileUiState.Success(
                        EditProfileData(name, nickname, email, phone, bio, primaryPosition, dominantFoot, societyChecked, futsalChecked, campoChecked)
                    )
                } else {
                    uiState = EditProfileUiState.Error("Não foi possível carregar o perfil")
                }
            } catch (e: Exception) {
                uiState = EditProfileUiState.Error(e.message ?: "Erro ao carregar perfil")
            }
        }
    }

    LaunchedEffect(uiState) {
        if (uiState is EditProfileUiState.Saved) {
            showSaveSuccess = true
            kotlinx.coroutines.delay(1500)
            onProfileUpdated()
        }
    }

    val validateFields: () -> Boolean = {
        var isValid = true
        nameError = null
        phoneError = null

        if (name.isBlank()) {
            nameError = "Nome é obrigatório"
            isValid = false
        } else if (name.length < 3) {
            nameError = "Nome deve ter pelo menos 3 caracteres"
            isValid = false
        }

        if (phone.isNotBlank() && phone.length < 10) {
            phoneError = "Telefone inválido"
            isValid = false
        }

        isValid
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "Editar Perfil",
                        fontWeight = FontWeight.SemiBold
                    ) 
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Text("◀️", style = MaterialTheme.typography.titleMedium)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is EditProfileUiState.Loading -> EditProfileLoadingShimmer(paddingValues)
            is EditProfileUiState.Error -> EditProfileErrorState(
                message = state.message,
                onRetry = { uiState = EditProfileUiState.Loading },
                modifier = Modifier.padding(paddingValues)
            )
            is EditProfileUiState.Saving -> EditProfileSavingContent(
                profile = EditProfileData(name, nickname, email, phone, bio, primaryPosition, dominantFoot, societyChecked, futsalChecked, campoChecked),
                isSaving = true,
                modifier = Modifier.padding(paddingValues)
            )
            else -> EditProfileContent(
                name = name,
                onNameChange = { 
                    name = it
                    nameError = null
                },
                nameError = nameError,
                nickname = nickname,
                onNicknameChange = { nickname = it },
                email = email,
                phone = phone,
                onPhoneChange = { 
                    phone = it
                    phoneError = null
                },
                phoneError = phoneError,
                bio = bio,
                onBioChange = { bio = it },
                primaryPosition = primaryPosition,
                onPrimaryPositionChange = { primaryPosition = it },
                dominantFoot = dominantFoot,
                onDominantFootChange = { dominantFoot = it },
                societyChecked = societyChecked,
                onSocietyChange = { societyChecked = it },
                futsalChecked = futsalChecked,
                onFutsalChange = { futsalChecked = it },
                campoChecked = campoChecked,
                onCampoChange = { campoChecked = it },
                isSaving = uiState is EditProfileUiState.Saving,
                onSaveClick = {
                    if (validateFields()) {
                        uiState = EditProfileUiState.Saving
                        scope.launch {
                            kotlinx.coroutines.delay(1000)
                            uiState = EditProfileUiState.Saved
                        }
                    }
                },
                onCancelClick = onBackClick,
                showSaveSuccess = showSaveSuccess,
                modifier = Modifier.padding(paddingValues)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditProfileContent(
    name: String,
    onNameChange: (String) -> Unit,
    nameError: String?,
    nickname: String,
    onNicknameChange: (String) -> Unit,
    email: String,
    phone: String,
    onPhoneChange: (String) -> Unit,
    phoneError: String?,
    bio: String,
    onBioChange: (String) -> Unit,
    primaryPosition: String,
    onPrimaryPositionChange: (String) -> Unit,
    dominantFoot: String,
    onDominantFootChange: (String) -> Unit,
    societyChecked: Boolean,
    onSocietyChange: (Boolean) -> Unit,
    futsalChecked: Boolean,
    onFutsalChange: (Boolean) -> Unit,
    campoChecked: Boolean,
    onCampoChange: (Boolean) -> Unit,
    isSaving: Boolean,
    onSaveClick: () -> Unit,
    onCancelClick: () -> Unit,
    showSaveSuccess: Boolean,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()
    var positionExpanded by remember { mutableStateOf(false) }
    var footExpanded by remember { mutableStateOf(false) }

    val positionOptions = listOf(
        "Atacante" to "ATAQUE",
        "Meia" to "MEIA",
        "Volante" to "VOLANTE",
        "Zagueiro" to "ZAGUEIRO",
        "Lateral" to "LATERAL",
        "Goleiro" to "GOLEIRO"
    )

    val footOptions = listOf(
        "Direito" to "DIREITO",
        "Esquerdo" to "ESQUERDO",
        "Ambidestro" to "AMBIDESTRO"
    )

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (showSaveSuccess) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color(0xFF4CAF50).copy(alpha = 0.1f)
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("✅", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        "Perfil atualizado com sucesso!",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF4CAF50),
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        AvatarSection(
            name = name,
            onAvatarClick = { }
        )

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "👤 Informações Pessoais",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                OutlinedTextField(
                    value = name,
                    onValueChange = onNameChange,
                    label = { Text("Nome completo *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    isError = nameError != null,
                    supportingText = nameError?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                    leadingIcon = { Text("👤", style = MaterialTheme.typography.bodyLarge) },
                    shape = RoundedCornerShape(12.dp),
                    enabled = !isSaving
                )

                OutlinedTextField(
                    value = nickname,
                    onValueChange = onNicknameChange,
                    label = { Text("Apelido") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    leadingIcon = { Text("🏷️", style = MaterialTheme.typography.bodyLarge) },
                    shape = RoundedCornerShape(12.dp),
                    enabled = !isSaving
                )

                OutlinedTextField(
                    value = email,
                    onValueChange = {},
                    label = { Text("E-mail") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    readOnly = true,
                    leadingIcon = { Text("📧", style = MaterialTheme.typography.bodyLarge) },
                    trailingIcon = { 
                        Text(
                            "🔒",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    },
                    shape = RoundedCornerShape(12.dp),
                    enabled = false,
                    colors = OutlinedTextFieldDefaults.colors(
                        disabledBorderColor = MaterialTheme.colorScheme.outlineVariant,
                        disabledTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                )

                OutlinedTextField(
                    value = phone,
                    onValueChange = { 
                        if (it.all { c -> c.isDigit() || c == ' ' || c == '(' || c == ')' || c == '-' || c == '+' }) {
                            onPhoneChange(it)
                        }
                    },
                    label = { Text("Telefone") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    isError = phoneError != null,
                    supportingText = phoneError?.let { { Text(it, color = MaterialTheme.colorScheme.error) } },
                    leadingIcon = { Text("📱", style = MaterialTheme.typography.bodyLarge) },
                    placeholder = { Text("(11) 99999-9999") },
                    shape = RoundedCornerShape(12.dp),
                    enabled = !isSaving
                )
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "📝 Sobre você",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                OutlinedTextField(
                    value = bio,
                    onValueChange = onBioChange,
                    label = { Text("Bio / Descrição") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 100.dp),
                    maxLines = 4,
                    leadingIcon = { 
                        Text("💬", style = MaterialTheme.typography.bodyLarge)
                    },
                    placeholder = { Text("Conte um pouco sobre você...") },
                    shape = RoundedCornerShape(12.dp),
                    enabled = !isSaving
                )
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "⚽ Posição e Estilo",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                ExposedDropdownMenuBox(
                    expanded = positionExpanded,
                    onExpandedChange = { positionExpanded = it && !isSaving }
                ) {
                    OutlinedTextField(
                        value = positionOptions.find { it.second == primaryPosition }?.first ?: "",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Posição preferida") },
                        leadingIcon = { Text("🏃", style = MaterialTheme.typography.bodyLarge) },
                        trailingIcon = { 
                            ExposedDropdownMenuDefaults.TrailingIcon(expanded = positionExpanded) 
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        shape = RoundedCornerShape(12.dp),
                        enabled = !isSaving
                    )

                    ExposedDropdownMenu(
                        expanded = positionExpanded,
                        onDismissRequest = { positionExpanded = false }
                    ) {
                        positionOptions.forEach { (label, value) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    onPrimaryPositionChange(value)
                                    positionExpanded = false
                                }
                            )
                        }
                    }
                }

                ExposedDropdownMenuBox(
                    expanded = footExpanded,
                    onExpandedChange = { footExpanded = it && !isSaving }
                ) {
                    OutlinedTextField(
                        value = footOptions.find { it.second == dominantFoot }?.first ?: "",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Pé dominante") },
                        leadingIcon = { Text("🦶", style = MaterialTheme.typography.bodyLarge) },
                        trailingIcon = { 
                            ExposedDropdownMenuDefaults.TrailingIcon(expanded = footExpanded) 
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        shape = RoundedCornerShape(12.dp),
                        enabled = !isSaving
                    )

                    ExposedDropdownMenu(
                        expanded = footExpanded,
                        onDismissRequest = { footExpanded = false }
                    ) {
                        footOptions.forEach { (label, value) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    onDominantFootChange(value)
                                    footExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "🏟️ Preferências de Campo",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                FieldPreferenceItem(
                    emoji = "⚽",
                    label = "Society",
                    checked = societyChecked,
                    onCheckedChange = onSocietyChange,
                    enabled = !isSaving
                )

                FieldPreferenceItem(
                    emoji = "🥅",
                    label = "Futsal",
                    checked = futsalChecked,
                    onCheckedChange = onFutsalChange,
                    enabled = !isSaving
                )

                FieldPreferenceItem(
                    emoji = "🌿",
                    label = "Campo",
                    checked = campoChecked,
                    onCheckedChange = onCampoChange,
                    enabled = !isSaving
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = onCancelClick,
                modifier = Modifier
                    .weight(1f)
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                enabled = !isSaving
            ) {
                Text("❌", style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Cancelar")
            }

            Button(
                onClick = onSaveClick,
                modifier = Modifier
                    .weight(1f)
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                enabled = !isSaving
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("💾", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Salvar")
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun AvatarSection(
    name: String,
    onAvatarClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary)
                    .clickable(onClick = onAvatarClick),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = getInitials(name),
                    style = MaterialTheme.typography.headlineLarge,
                    color = MaterialTheme.colorScheme.onPrimary,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.clickable(onClick = onAvatarClick)
            ) {
                Text("📷", style = MaterialTheme.typography.bodyMedium)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Alterar foto",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun FieldPreferenceItem(
    emoji: String,
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled) { onCheckedChange(!checked) }
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = if (enabled) onCheckedChange else null
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(emoji, style = MaterialTheme.typography.titleMedium)
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge
        )
    }
}

@Composable
private fun EditProfileLoadingShimmer(paddingValues: PaddingValues) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                )
                Spacer(modifier = Modifier.height(12.dp))
                Box(
                    modifier = Modifier
                        .width(100.dp)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                )
            }
        }

        repeat(3) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .width(150.dp)
                            .height(20.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                    repeat(2) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EditProfileErrorState(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "❌",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onRetry) {
            Text("🔄")
            Spacer(modifier = Modifier.width(8.dp))
            Text("Tentar novamente")
        }
    }
}

@Composable
private fun EditProfileSavingContent(
    profile: EditProfileData,
    isSaving: Boolean,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(48.dp),
                strokeWidth = 4.dp
            )
            Text(
                text = "Salvando alterações...",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

private fun getInitials(name: String): String {
    val parts = name.trim().split(" ")
    return when {
        parts.size >= 2 -> "${parts.first().first()}${parts.last().first()}".uppercase()
        parts.isNotEmpty() -> parts.first().take(2).uppercase()
        else -> "??"
    }
}
