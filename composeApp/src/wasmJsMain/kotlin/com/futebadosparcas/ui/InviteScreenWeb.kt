package com.futebadosparcas.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.launch

private sealed class InviteUiState {
    object Loading : InviteUiState()
    data class Success(val group: Map<String, Any?>, val inviterName: String) : InviteUiState()
    data class Accepted(val groupName: String) : InviteUiState()
    data class Error(val message: String) : InviteUiState()
    object InvalidCode : InviteUiState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InviteScreenWeb(
    code: String,
    onBackClick: () -> Unit
) {
    var uiState by remember { mutableStateOf<InviteUiState>(InviteUiState.Loading) }
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    fun loadInvite() {
        scope.launch {
            uiState = InviteUiState.Loading
            try {
                val invite = FirebaseManager.getInviteByCode(code)
                if (invite == null) {
                    uiState = InviteUiState.InvalidCode
                    return@launch
                }

                val groupId = invite["groupId"] as? String
                val inviterId = invite["inviterId"] as? String

                if (groupId == null) {
                    uiState = InviteUiState.Error("Convite inválido")
                    return@launch
                }

                val group = FirebaseManager.getGroupById(groupId)
                if (group == null) {
                    uiState = InviteUiState.Error("Grupo não encontrado")
                    return@launch
                }

                val inviterName = if (inviterId != null) {
                    val inviter = FirebaseManager.getDocument("users", inviterId)
                    inviter?.get("name") as? String ?: "Alguém"
                } else {
                    "Alguém"
                }

                uiState = InviteUiState.Success(group, inviterName)
            } catch (e: Exception) {
                uiState = InviteUiState.Error(e.message ?: "Erro ao carregar convite")
            }
        }
    }

    fun acceptInvite(groupId: String) {
        scope.launch {
            try {
                val success = FirebaseManager.acceptGroupInvite(code, groupId)
                if (success) {
                    val groupName = (uiState as? InviteUiState.Success)?.group?.get("groupName") as? String ?: "Grupo"
                    uiState = InviteUiState.Accepted(groupName)
                    snackbarHostState.showSnackbar("Você entrou no grupo!")
                } else {
                    snackbarHostState.showSnackbar("Erro ao aceitar convite")
                }
            } catch (e: Exception) {
                snackbarHostState.showSnackbar(e.message ?: "Erro ao aceitar convite")
            }
        }
    }

    LaunchedEffect(code) {
        loadInvite()
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            when (val state = uiState) {
                is InviteUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.size(48.dp))
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Carregando convite...", style = MaterialTheme.typography.bodyLarge)
                }

                is InviteUiState.InvalidCode -> {
                    Text("❌", style = MaterialTheme.typography.displayLarge)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Convite Inválido", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Este link de convite não é válido ou expirou.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    OutlinedButton(onClick = onBackClick) {
                        Text("← Voltar")
                    }
                }

                is InviteUiState.Error -> {
                    Text("❌", style = MaterialTheme.typography.displayLarge)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Erro", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        state.message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { loadInvite() }) {
                        Text("🔄 Tentar novamente")
                    }
                }

                is InviteUiState.Success -> {
                    val group = state.group
                    val groupName = group["groupName"] as? String ?: "Grupo"
                    val description = group["description"] as? String ?: ""
                    val memberCount = (group["memberCount"] as? Number)?.toInt() ?: 0

                    Text("📩", style = MaterialTheme.typography.displayLarge)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Você foi convidado!", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "${state.inviterName} te convidou para participar de:",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                        )
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            GroupPhoto(
                                groupName = groupName,
                                modifier = Modifier.size(72.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                groupName,
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold
                            )
                            if (description.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    description,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    textAlign = TextAlign.Center
                                )
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = MaterialTheme.colorScheme.surfaceContainerHigh
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text("👥")
                                    Text(
                                        "$memberCount ${if (memberCount == 1) "membro" else "membros"}",
                                        style = MaterialTheme.typography.labelLarge
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(32.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedButton(
                            onClick = onBackClick,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Recusar")
                        }
                        Button(
                            onClick = { acceptInvite(group["id"] as? String ?: "") },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("✓ Aceitar")
                        }
                    }
                }

                is InviteUiState.Accepted -> {
                    Text("🎉", style = MaterialTheme.typography.displayLarge)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Bem-vindo!", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Você agora faz parte de \"${state.groupName}\"",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(onClick = onBackClick) {
                        Text("← Voltar aos Grupos")
                    }
                }
            }
        }
    }
}
