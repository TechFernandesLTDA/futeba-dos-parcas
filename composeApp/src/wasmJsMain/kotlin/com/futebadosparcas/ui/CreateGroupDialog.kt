package com.futebadosparcas.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateGroupDialog(
    onDismiss: () -> Unit,
    onGroupCreated: (String) -> Unit
) {
    var groupName by remember { mutableStateOf("") }
    var groupDescription by remember { mutableStateOf("") }
    var isPublic by remember { mutableStateOf(false) }
    var nameError by remember { mutableStateOf<String?>(null) }
    var isCreating by remember { mutableStateOf(false) }
    var createError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(groupName) {
        nameError = when {
            groupName.isEmpty() -> null
            groupName.length < 3 -> "Nome deve ter pelo menos 3 caracteres"
            groupName.length > 50 -> "Nome deve ter no máximo 50 caracteres"
            else -> null
        }
    }

    val isCreateEnabled = groupName.length >= 3 &&
        groupName.length <= 50 &&
        nameError == null &&
        !isCreating

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight(),
            shape = RoundedCornerShape(24.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = "➕ Criar Novo Grupo",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "📛 Nome do Grupo",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = groupName,
                    onValueChange = { groupName = it },
                    placeholder = { Text("Ex: Pelada do Sábado") },
                    isError = nameError != null,
                    supportingText = nameError?.let { { Text(it) } },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline
                    )
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    Text(
                        text = "${groupName.length}/50",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "📝 Descrição (opcional)",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = groupDescription,
                    onValueChange = { if (it.length <= 200) groupDescription = it },
                    placeholder = { Text("Sobre o grupo...") },
                    minLines = 3,
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline
                    )
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    Text(
                        text = "${groupDescription.length}/200",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "🔒 Tipo de Grupo",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = !isPublic,
                        onClick = { isPublic = false },
                        label = { Text("🔒 Privado") },
                        modifier = Modifier.weight(1f)
                    )
                    FilterChip(
                        selected = isPublic,
                        onClick = { isPublic = true },
                        label = { Text("🌐 Público") },
                        modifier = Modifier.weight(1f)
                    )
                }

                Text(
                    text = if (isPublic) {
                        "Grupos públicos podem ser encontrados por qualquer pessoa"
                    } else {
                        "Apenas membros convidados podem participar"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp)
                )

                AnimatedVisibility(
                    visible = createError != null,
                    enter = fadeIn(),
                    exit = fadeOut()
                ) {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 16.dp)
                    ) {
                        Text(
                            text = createError ?: "",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }

                AnimatedVisibility(
                    visible = isCreating,
                    enter = fadeIn(),
                    exit = fadeOut()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 16.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Criando grupo...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        enabled = !isCreating
                    ) {
                        Text("Cancelar")
                    }
                    Button(
                        onClick = {
                            scope.launch {
                                isCreating = true
                                createError = null
                                try {
                                    val groupId = FirebaseManager.createGroup(
                                        name = groupName.trim(),
                                        description = groupDescription.trim(),
                                        isPublic = isPublic
                                    )
                                    if (groupId != null) {
                                        onGroupCreated(groupId)
                                    } else {
                                        createError = "Erro ao criar grupo. Tente novamente."
                                    }
                                } catch (e: Exception) {
                                    createError = e.message ?: "Erro ao criar grupo"
                                } finally {
                                    isCreating = false
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = isCreateEnabled
                    ) {
                        Text("Criar")
                    }
                }
            }
        }
    }
}
