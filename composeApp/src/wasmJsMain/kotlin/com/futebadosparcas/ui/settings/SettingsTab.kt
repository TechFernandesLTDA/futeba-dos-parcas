package com.futebadosparcas.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.domain.model.ThemeMode
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.launch

private sealed class SettingsUiState {
    object Loading : SettingsUiState()
    data class Success(val settings: UserSettings) : SettingsUiState()
    data class Error(val message: String) : SettingsUiState()
}

private data class UserSettings(
    val pushNotifications: Boolean = true,
    val emailNotifications: Boolean = true,
    val notifyGames: Boolean = true,
    val notifyInvites: Boolean = true,
    val notifyMVP: Boolean = true,
    val preferredFieldType: String = "SOCIETY",
    val preferredPosition: String = "MIDFIELDER",
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val language: String = "pt-BR",
    val profileVisibility: String = "PUBLIC"
)

@Composable
fun SettingsTab(
    onBackClick: () -> Unit = {},
    onEditProfileClick: () -> Unit = {},
    onChangePasswordClick: () -> Unit = {},
    onDeleteAccountClick: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var uiState by remember { mutableStateOf<SettingsUiState>(SettingsUiState.Loading) }
    var settings by remember { mutableStateOf(UserSettings()) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showThemeDialog by remember { mutableStateOf(false) }
    var showLanguageDialog by remember { mutableStateOf(false) }
    var showPositionDialog by remember { mutableStateOf(false) }
    var showVisibilityDialog by remember { mutableStateOf(false) }
    
    LaunchedEffect(Unit) {
        scope.launch {
            try {
                val profileData = FirebaseManager.getCurrentUserProfile()
                if (profileData != null) {
                    settings = UserSettings(
                        pushNotifications = profileData["pushNotifications"] as? Boolean ?: true,
                        emailNotifications = profileData["emailNotifications"] as? Boolean ?: true,
                        preferredFieldType = profileData["preferredFieldTypes"] as? String ?: "SOCIETY",
                        preferredPosition = profileData["preferredPosition"] as? String ?: "MIDFIELDER",
                        themeMode = when (profileData["themeMode"] as? String) {
                            "LIGHT" -> ThemeMode.LIGHT
                            "DARK" -> ThemeMode.DARK
                            else -> ThemeMode.SYSTEM
                        },
                        language = profileData["language"] as? String ?: "pt-BR",
                        profileVisibility = profileData["profileVisibility"] as? String ?: "PUBLIC"
                    )
                    uiState = SettingsUiState.Success(settings)
                } else {
                    uiState = SettingsUiState.Error("Não foi possível carregar configurações")
                }
            } catch (e: Exception) {
                uiState = SettingsUiState.Error(e.message ?: "Erro ao carregar configurações")
            }
        }
    }
    
    when (val state = uiState) {
        is SettingsUiState.Loading -> SettingsLoadingState()
        is SettingsUiState.Success -> {
            SettingsContent(
                settings = settings,
                onSettingsChange = { newSettings -> settings = newSettings },
                onEditProfileClick = onEditProfileClick,
                onChangePasswordClick = onChangePasswordClick,
                onDeleteAccountClick = { showDeleteDialog = true },
                onThemeClick = { showThemeDialog = true },
                onLanguageClick = { showLanguageDialog = true },
                onPositionClick = { showPositionDialog = true },
                onVisibilityClick = { showVisibilityDialog = true }
            )
        }
        is SettingsUiState.Error -> SettingsErrorState(
            message = state.message,
            onRetry = { uiState = SettingsUiState.Loading }
        )
    }
    
    if (showThemeDialog) {
        ThemeSelectionDialog(
            currentTheme = settings.themeMode,
            onDismiss = { showThemeDialog = false },
            onThemeSelected = { newTheme ->
                settings = settings.copy(themeMode = newTheme)
                showThemeDialog = false
            }
        )
    }
    
    if (showLanguageDialog) {
        LanguageSelectionDialog(
            currentLanguage = settings.language,
            onDismiss = { showLanguageDialog = false },
            onLanguageSelected = { newLanguage ->
                settings = settings.copy(language = newLanguage)
                showLanguageDialog = false
            }
        )
    }
    
    if (showPositionDialog) {
        PositionSelectionDialog(
            currentPosition = settings.preferredPosition,
            onDismiss = { showPositionDialog = false },
            onPositionSelected = { newPosition ->
                settings = settings.copy(preferredPosition = newPosition)
                showPositionDialog = false
            }
        )
    }
    
    if (showVisibilityDialog) {
        VisibilitySelectionDialog(
            currentVisibility = settings.profileVisibility,
            onDismiss = { showVisibilityDialog = false },
            onVisibilitySelected = { newVisibility ->
                settings = settings.copy(profileVisibility = newVisibility)
                showVisibilityDialog = false
            }
        )
    }
    
    if (showDeleteDialog) {
        DeleteAccountDialog(
            onDismiss = { showDeleteDialog = false },
            onConfirm = {
                scope.launch {
                    FirebaseManager.deleteAccount()
                    onDeleteAccountClick()
                }
                showDeleteDialog = false
            }
        )
    }
}

@Composable
private fun SettingsContent(
    settings: UserSettings,
    onSettingsChange: (UserSettings) -> Unit,
    onEditProfileClick: () -> Unit,
    onChangePasswordClick: () -> Unit,
    onDeleteAccountClick: () -> Unit,
    onThemeClick: () -> Unit,
    onLanguageClick: () -> Unit,
    onPositionClick: () -> Unit,
    onVisibilityClick: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            SettingsSection(title = "Perfil", emoji = "👤") {
                SettingsNavigationItem(
                    emoji = "✏️",
                    title = "Editar Perfil",
                    subtitle = "Nome, apelido, foto",
                    onClick = onEditProfileClick
                )
                SettingsNavigationDivider()
                SettingsNavigationItem(
                    emoji = "🔒",
                    title = "Privacidade",
                    subtitle = getVisibilityLabel(settings.profileVisibility),
                    onClick = onVisibilityClick
                )
            }
        }
        
        item {
            SettingsSection(title = "Notificações", emoji = "🔔") {
                SettingsToggle(
                    emoji = "📱",
                    title = "Push",
                    description = "Notificações no celular",
                    checked = settings.pushNotifications,
                    onCheckedChange = { onSettingsChange(settings.copy(pushNotifications = it)) }
                )
                SettingsToggleDivider()
                SettingsToggle(
                    emoji = "📧",
                    title = "Email",
                    description = "Alertas por email",
                    checked = settings.emailNotifications,
                    onCheckedChange = { onSettingsChange(settings.copy(emailNotifications = it)) }
                )
                SettingsToggleDivider()
                SettingsToggle(
                    emoji = "⚽",
                    title = "Jogos",
                    description = "Convites e lembretes",
                    checked = settings.notifyGames,
                    onCheckedChange = { onSettingsChange(settings.copy(notifyGames = it)) }
                )
                SettingsToggleDivider()
                SettingsToggle(
                    emoji = "🏆",
                    title = "MVP",
                    description = "Votações e resultados",
                    checked = settings.notifyMVP,
                    onCheckedChange = { onSettingsChange(settings.copy(notifyMVP = it)) }
                )
            }
        }
        
        item {
            SettingsSection(title = "Preferências de Jogo", emoji = "⚽") {
                SettingsNavigationItem(
                    emoji = "🏟️",
                    title = "Tipo de Campo",
                    subtitle = getFieldTypeLabel(settings.preferredFieldType),
                    onClick = { }
                )
                SettingsNavigationDivider()
                SettingsNavigationItem(
                    emoji = "🥅",
                    title = "Posição Preferida",
                    subtitle = getPositionLabel(settings.preferredPosition),
                    onClick = onPositionClick
                )
            }
        }
        
        item {
            SettingsSection(title = "Aparência", emoji = "🎨") {
                SettingsNavigationItem(
                    emoji = "🌓",
                    title = "Tema",
                    subtitle = getThemeLabel(settings.themeMode),
                    onClick = onThemeClick
                )
                SettingsNavigationDivider()
                SettingsNavigationItem(
                    emoji = "🌐",
                    title = "Idioma",
                    subtitle = getLanguageLabel(settings.language),
                    onClick = onLanguageClick
                )
            }
        }
        
        item {
            SettingsSection(title = "Conta", emoji = "⚙️") {
                SettingsNavigationItem(
                    emoji = "🔑",
                    title = "Alterar Senha",
                    onClick = onChangePasswordClick
                )
                SettingsNavigationDivider()
                SettingsNavigationItem(
                    emoji = "📤",
                    title = "Exportar Dados",
                    subtitle = "Baixar seus dados",
                    onClick = { }
                )
                SettingsNavigationDivider()
                SettingsNavigationItem(
                    emoji = "🗑️",
                    title = "Deletar Conta",
                    subtitle = "Remover conta permanentemente",
                    onClick = onDeleteAccountClick
                )
            }
        }
        
        item {
            Spacer(modifier = Modifier.height(16.dp))
            
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Futeba dos Parças",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Versão 1.10.7 (Web)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        TextButton(onClick = { }) {
                            Text("Termos de Uso")
                        }
                        TextButton(onClick = { }) {
                            Text("Privacidade")
                        }
                    }
                }
            }
        }
        
        item {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ThemeSelectionDialog(
    currentTheme: ThemeMode,
    onDismiss: () -> Unit,
    onThemeSelected: (ThemeMode) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("🎨 Tema") },
        text = {
            ThemeSelector(
                currentTheme = currentTheme,
                onThemeSelected = onThemeSelected
            )
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fechar")
            }
        }
    )
}

@Composable
private fun LanguageSelectionDialog(
    currentLanguage: String,
    onDismiss: () -> Unit,
    onLanguageSelected: (String) -> Unit
) {
    val languages = listOf(
        "pt-BR" to "🇧🇷 Português (Brasil)",
        "en-US" to "🇺🇸 English (US)",
        "es-ES" to "🇪🇸 Español"
    )
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("🌐 Idioma") },
        text = {
            Column {
                languages.forEach { (code, name) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = currentLanguage == code,
                            onClick = { onLanguageSelected(code) }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(name)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fechar")
            }
        }
    )
}

@Composable
private fun PositionSelectionDialog(
    currentPosition: String,
    onDismiss: () -> Unit,
    onPositionSelected: (String) -> Unit
) {
    val positions = listOf(
        "STRIKER" to "⚽ Atacante",
        "MIDFIELDER" to "🏃 Meio-Campo",
        "DEFENDER" to "🛡️ Zagueiro",
        "GOALKEEPER" to "🧤 Goleiro"
    )
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("🥅 Posição Preferida") },
        text = {
            Column {
                positions.forEach { (code, name) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = currentPosition == code,
                            onClick = { onPositionSelected(code) }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(name)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fechar")
            }
        }
    )
}

@Composable
private fun VisibilitySelectionDialog(
    currentVisibility: String,
    onDismiss: () -> Unit,
    onVisibilitySelected: (String) -> Unit
) {
    val visibilities = listOf(
        "PUBLIC" to "🌐 Público - Todos podem ver seu perfil",
        "FRIENDS" to "👥 Amigos - Apenas membros dos grupos",
        "PRIVATE" to "🔒 Privado - Apenas você"
    )
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("🔒 Privacidade") },
        text = {
            Column {
                visibilities.forEach { (code, name) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = currentVisibility == code,
                            onClick = { onVisibilitySelected(code) }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(name, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fechar")
            }
        }
    )
}

@Composable
private fun DeleteAccountDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("🗑️ Deletar Conta") },
        text = {
            Text(
                "Esta ação é irreversível. Todos os seus dados serão permanentemente removidos, incluindo:\n\n" +
                "• Perfil e estatísticas\n" +
                "• Histórico de jogos\n" +
                "• Badges e conquistas\n\n" +
                "Tem certeza que deseja continuar?"
            )
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Deletar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

@Composable
private fun SettingsLoadingState() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        items(5) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .width(120.dp)
                            .height(20.dp)
                            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(4.dp))
                    )
                    repeat(3) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp))
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsErrorState(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(text = "❌", style = MaterialTheme.typography.displayLarge)
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onRetry) {
            Text("🔄 Tentar novamente")
        }
    }
}

private fun getThemeLabel(mode: ThemeMode): String = when (mode) {
    ThemeMode.LIGHT -> "Claro ☀️"
    ThemeMode.DARK -> "Escuro 🌙"
    ThemeMode.SYSTEM -> "Sistema 💻"
}

private fun getLanguageLabel(code: String): String = when (code) {
    "pt-BR" -> "🇧🇷 Português"
    "en-US" -> "🇺🇸 English"
    "es-ES" -> "🇪🇸 Español"
    else -> "🇧🇷 Português"
}

private fun getPositionLabel(position: String): String = when (position) {
    "STRIKER" -> "⚽ Atacante"
    "MIDFIELDER" -> "🏃 Meio-Campo"
    "DEFENDER" -> "🛡️ Zagueiro"
    "GOALKEEPER" -> "🧤 Goleiro"
    else -> "⚽ Atacante"
}

private fun getFieldTypeLabel(type: String): String = when (type) {
    "SOCIETY" -> "⚽ Society"
    "FUTSAL" -> "🥅 Futsal"
    "CAMPO" -> "🌿 Campo"
    else -> "⚽ Society"
}

private fun getVisibilityLabel(visibility: String): String = when (visibility) {
    "PUBLIC" -> "🌐 Público"
    "FRIENDS" -> "👥 Amigos"
    "PRIVATE" -> "🔒 Privado"
    else -> "🌐 Público"
}
