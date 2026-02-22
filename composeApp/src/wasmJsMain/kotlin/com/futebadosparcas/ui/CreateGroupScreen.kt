package com.futebadosparcas.ui

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.launch

private sealed class CreateGroupUiState {
    object Idle : CreateGroupUiState()
    object Loading : CreateGroupUiState()
    object Success : CreateGroupUiState()
    data class Error(val message: String) : CreateGroupUiState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateGroupScreen(
    onBackClick: () -> Unit,
    onGroupCreated: (String) -> Unit
) {
    var groupName by remember { mutableStateOf("") }
    var groupDescription by remember { mutableStateOf("") }
    var isPublic by remember { mutableStateOf(false) }
    var groupRules by remember { mutableStateOf("") }
    
    var defaultGameType by remember { mutableStateOf("Society") }
    var defaultMaxPlayers by remember { mutableStateOf("14") }
    var defaultDuration by remember { mutableStateOf("120") }
    var defaultPrice by remember { mutableStateOf("") }
    
    var nameError by remember { mutableStateOf<String?>(null) }
    var maxPlayersError by remember { mutableStateOf<String?>(null) }
    var durationError by remember { mutableStateOf<String?>(null) }
    
    var uiState by remember { mutableStateOf<CreateGroupUiState>(CreateGroupUiState.Idle) }
    var showGameTypeDropdown by remember { mutableStateOf(false) }
    
    val scope = rememberCoroutineScope()
    
    val gameTypes = listOf("Society", "Futsal", "Campo", "Grama", "Areia")
    
    LaunchedEffect(groupName) {
        nameError = when {
            groupName.isEmpty() -> null
            groupName.length < 3 -> "Nome deve ter pelo menos 3 caracteres"
            groupName.length > 50 -> "Nome deve ter no máximo 50 caracteres"
            !groupName.matches(Regex("^[\\p{L}\\p{N}\\s\\-_']+$")) -> "Nome contém caracteres inválidos"
            else -> null
        }
    }
    
    LaunchedEffect(defaultMaxPlayers) {
        maxPlayersError = when {
            defaultMaxPlayers.isEmpty() -> null
            defaultMaxPlayers.toIntOrNull() == null -> "Digite um número válido"
            defaultMaxPlayers.toInt() < 4 -> "Mínimo 4 jogadores"
            defaultMaxPlayers.toInt() > 100 -> "Máximo 100 jogadores"
            else -> null
        }
    }
    
    LaunchedEffect(defaultDuration) {
        durationError = when {
            defaultDuration.isEmpty() -> null
            defaultDuration.toIntOrNull() == null -> "Digite um número válido"
            defaultDuration.toInt() < 30 -> "Mínimo 30 minutos"
            defaultDuration.toInt() > 300 -> "Máximo 300 minutos"
            else -> null
        }
    }
    
    fun validate(): Boolean {
        var isValid = true
        
        if (groupName.trim().length < 3) {
            nameError = "Nome deve ter pelo menos 3 caracteres"
            isValid = false
        }
        
        if (defaultMaxPlayers.isNotEmpty()) {
            val players = defaultMaxPlayers.toIntOrNull()
            if (players == null || players < 4 || players > 100) {
                maxPlayersError = "Mínimo 4, máximo 100 jogadores"
                isValid = false
            }
        }
        
        if (defaultDuration.isNotEmpty()) {
            val duration = defaultDuration.toIntOrNull()
            if (duration == null || duration < 30 || duration > 300) {
                durationError = "Mínimo 30, máximo 300 minutos"
                isValid = false
            }
        }
        
        return isValid
    }
    
    fun handleCreate() {
        if (!validate()) return
        
        scope.launch {
            uiState = CreateGroupUiState.Loading
            try {
                val groupId = FirebaseManager.createGroup(
                    name = groupName.trim(),
                    description = groupDescription.trim(),
                    isPublic = isPublic
                )
                
                if (groupId != null) {
                    uiState = CreateGroupUiState.Success
                    onGroupCreated(groupId)
                } else {
                    uiState = CreateGroupUiState.Error("Erro ao criar grupo. Tente novamente.")
                }
            } catch (e: Exception) {
                uiState = CreateGroupUiState.Error(e.message ?: "Erro ao criar grupo")
            }
        }
    }
    
    val isLoading = uiState is CreateGroupUiState.Loading
    val isCreateEnabled = groupName.length >= 3 &&
        groupName.length <= 50 &&
        nameError == null &&
        (defaultMaxPlayers.isEmpty() || maxPlayersError == null) &&
        (defaultDuration.isEmpty() || durationError == null) &&
        !isLoading
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Criar Grupo", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    TextButton(onClick = onBackClick) {
                        Text("← Voltar", style = MaterialTheme.typography.bodyLarge)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                AnimatedVisibility(
                    visible = uiState is CreateGroupUiState.Error,
                    enter = slideInVertically() + fadeIn(),
                    exit = slideOutVertically() + fadeOut()
                ) {
                    (uiState as? CreateGroupUiState.Error)?.message?.let { error ->
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("⚠️", style = MaterialTheme.typography.titleMedium)
                                Text(
                                    text = error,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onErrorContainer
                                )
                            }
                        }
                    }
                }
                
                GroupPhotoSection(
                    hasImage = false,
                    onPhotoClick = { },
                    modifier = Modifier.fillMaxWidth()
                )
                
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                
                SectionTitle("📝 Informações Básicas")
                
                OutlinedTextField(
                    value = groupName,
                    onValueChange = { groupName = it },
                    label = { Text("Nome do grupo *") },
                    placeholder = { Text("Ex: Pelada do Sábado") },
                    isError = nameError != null,
                    supportingText = nameError?.let { { Text(it) } },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    Text(
                        text = "${groupName.length}/50",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (groupName.length > 50) 
                            MaterialTheme.colorScheme.error 
                        else 
                            MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                
                OutlinedTextField(
                    value = groupDescription,
                    onValueChange = { if (it.length <= 200) groupDescription = it },
                    label = { Text("Descrição (opcional)") },
                    placeholder = { Text("Conte um pouco sobre o grupo...") },
                    minLines = 3,
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth()
                )
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    Text(
                        text = "${groupDescription.length}/200",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (groupDescription.length > 200) 
                            MaterialTheme.colorScheme.error 
                        else 
                            MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                
                SectionTitle("🔒 Tipo de Grupo")
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    FilterChip(
                        selected = !isPublic,
                        onClick = { isPublic = false },
                        label = { 
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("🔐")
                                Text("Privado")
                            }
                        },
                        modifier = Modifier.weight(1f)
                    )
                    FilterChip(
                        selected = isPublic,
                        onClick = { isPublic = true },
                        label = { 
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("🌐")
                                Text("Público")
                            }
                        },
                        modifier = Modifier.weight(1f)
                    )
                }
                
                GroupTypeInfoCard(isPublic)
                
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                
                SectionTitle("📋 Regras do Grupo")
                
                OutlinedTextField(
                    value = groupRules,
                    onValueChange = { if (it.length <= 500) groupRules = it },
                    label = { Text("Regras (opcional)") },
                    placeholder = { Text("Ex: Sem chute alto, chegar 15min antes, levar água...") },
                    minLines = 4,
                    maxLines = 8,
                    modifier = Modifier.fillMaxWidth()
                )
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    Text(
                        text = "${groupRules.length}/500",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                
                RuleSuggestionsChips(
                    onRuleClick = { rule ->
                        if (groupRules.isEmpty()) {
                            groupRules = "• $rule"
                        } else if (!groupRules.contains(rule)) {
                            groupRules = "$groupRules\n• $rule"
                        }
                    }
                )
                
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                
                SectionTitle("⚙️ Configurações Padrão de Jogo")
                
                Text(
                    text = "Estas configurações serão usadas como padrão ao criar novos jogos",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                
                ExposedDropdownMenuBox(
                    expanded = showGameTypeDropdown,
                    onExpandedChange = { showGameTypeDropdown = it }
                ) {
                    OutlinedTextField(
                        value = defaultGameType,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Tipo de campo padrão") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = showGameTypeDropdown) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    
                    ExposedDropdownMenu(
                        expanded = showGameTypeDropdown,
                        onDismissRequest = { showGameTypeDropdown = false }
                    ) {
                        gameTypes.forEach { type ->
                            DropdownMenuItem(
                                text = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Surface(
                                            shape = RoundedCornerShape(4.dp),
                                            color = gameTypeColor(type),
                                            modifier = Modifier.size(16.dp)
                                        ) {}
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(type)
                                    }
                                },
                                onClick = { defaultGameType = type; showGameTypeDropdown = false }
                            )
                        }
                    }
                }
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = defaultMaxPlayers,
                        onValueChange = { defaultMaxPlayers = it },
                        label = { Text("Max. jogadores") },
                        isError = maxPlayersError != null,
                        supportingText = maxPlayersError?.let { { Text(it, style = MaterialTheme.typography.bodySmall) } },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                    
                    OutlinedTextField(
                        value = defaultDuration,
                        onValueChange = { defaultDuration = it },
                        label = { Text("Duração (min)") },
                        isError = durationError != null,
                        supportingText = durationError?.let { { Text(it, style = MaterialTheme.typography.bodySmall) } },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                }
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = defaultPrice,
                        onValueChange = { defaultPrice = it },
                        label = { Text("Valor padrão/pessoa") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        prefix = { Text("R$") }
                    )
                    
                    Spacer(modifier = Modifier.weight(1f))
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f)
                    )
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Text("💡", style = MaterialTheme.typography.titleMedium)
                        Column {
                            Text(
                                text = "Dica",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Você será o administrador do grupo e poderá convidar jogadores através do link de convite ou código após a criação.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onBackClick,
                        modifier = Modifier.weight(1f),
                        enabled = !isLoading
                    ) {
                        Text("❌ Cancelar")
                    }
                    
                    Button(
                        onClick = { handleCreate() },
                        modifier = Modifier.weight(1f),
                        enabled = isCreateEnabled
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("✨ Criar Grupo")
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(32.dp))
            }
            
            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.7f)),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(vertical = 4.dp)
    )
}

@Composable
private fun GroupPhotoSection(
    hasImage: Boolean,
    onPhotoClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(120.dp)
                .clip(CircleShape)
                .border(
                    width = if (hasImage) 3.dp else 1.dp,
                    color = if (hasImage) 
                        MaterialTheme.colorScheme.primary 
                    else 
                        MaterialTheme.colorScheme.outlineVariant,
                    shape = CircleShape
                )
                .clickable(onClick = onPhotoClick),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = CircleShape
            ) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "📷",
                        style = MaterialTheme.typography.displaySmall
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Adicionar foto",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
        
        TextButton(
            onClick = onPhotoClick,
            modifier = Modifier.padding(top = 8.dp)
        ) {
            Text(
                text = if (hasImage) "🖼️ Alterar foto" else "➕ Adicionar foto",
                style = MaterialTheme.typography.labelMedium
            )
        }
    }
}

@Composable
private fun GroupTypeInfoCard(isPublic: Boolean) {
    val (icon, title, description, warning) = if (isPublic) {
        Tuple4(
            "🌐",
            "Grupo Público",
            "Qualquer pessoa pode encontrar e entrar no grupo pelo nome ou código.",
            "Ideal para atrair novos jogadores e formar times maiores."
        )
    } else {
        Tuple4(
            "🔐",
            "Grupo Privado",
            "Apenas pessoas convidadas podem entrar no grupo.",
            "Ideal para grupos de amigos ou times fechados."
        )
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isPublic) 
                MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.5f)
            else 
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(icon, style = MaterialTheme.typography.titleMedium)
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
            }
            
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.5f)
            ) {
                Row(
                    modifier = Modifier.padding(8.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("💡", style = MaterialTheme.typography.bodySmall)
                    Text(
                        text = warning,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun RuleSuggestionsChips(
    onRuleClick: (String) -> Unit
) {
    val suggestions = listOf(
        "🚫 Sem chute alto",
        "⏰ Chegar 15min antes",
        "💧 Levar água",
        "👕 Uniforme obrigatório",
        "🚿 Levar toalha",
        "💰 Pagamento antecipado"
    )
    
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = "Sugestões:",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        
        androidx.compose.foundation.layout.FlowRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            suggestions.forEach { suggestion ->
                SuggestionChip(
                    onClick = { onRuleClick(suggestion) },
                    label = { 
                        Text(
                            text = suggestion,
                            style = MaterialTheme.typography.labelSmall
                        ) 
                    }
                )
            }
        }
    }
}

@Composable
private fun gameTypeColor(type: String): Color {
    return when (type) {
        "Society" -> Color(0xFF4CAF50)
        "Futsal" -> Color(0xFF2196F3)
        "Campo" -> Color(0xFF8BC34A)
        "Grama" -> Color(0xFF4CAF50)
        "Areia" -> Color(0xFFFFC107)
        else -> Color.Gray
    }
}

private data class Tuple4<A, B, C, D>(
    val first: A,
    val second: B,
    val third: C,
    val fourth: D
)
