package com.futebadosparcas.ui.games.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.koin.compose.viewmodel.koinViewModel
import coil3.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GameChatMessage
import com.futebadosparcas.ui.games.GameChatActionState
import com.futebadosparcas.ui.games.GameChatUiState
import com.futebadosparcas.ui.games.GameChatViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private const val MAX_TEXT_LENGTH = 500

/**
 * Seção de chat em tempo real por jogo (issue #3230, épico #3240).
 *
 * Exibe mensagens em tempo real + composer. Estados L/E/E/S.
 * Só renderiza o composer se [canWrite] for true (confirmado/owner/admin
 * e não arquivado).
 */
@Composable
fun GameChatSection(
    gameId: String,
    canWrite: Boolean,
    isArchived: Boolean,
    currentUserId: String?,
    canManage: Boolean,
    modifier: Modifier = Modifier,
    viewModel: GameChatViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val actionState by viewModel.actionState.collectAsState()

    LaunchedEffect(gameId) {
        viewModel.observeMessages(gameId)
    }

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
        tonalElevation = 0.dp
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.Chat,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.game_chat_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = stringResource(R.string.game_chat_description),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (isArchived) {
                    AssistChip(
                        onClick = {},
                        label = { Text(stringResource(R.string.game_chat_archived)) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            when (val state = uiState) {
                is GameChatUiState.Loading -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(120.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(28.dp))
                    }
                }
                is GameChatUiState.Empty -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Chat,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                            modifier = Modifier.size(40.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = stringResource(R.string.game_chat_empty_title),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = stringResource(R.string.game_chat_empty_desc),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                is GameChatUiState.Error -> {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = state.message,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        TextButton(onClick = { viewModel.observeMessages(gameId) }) {
                            Text(stringResource(R.string.game_chat_retry))
                        }
                    }
                }
                is GameChatUiState.Success -> {
                    MessagesList(
                        messages = state.messages,
                        currentUserId = currentUserId,
                        canManage = canManage,
                        onDelete = { messageId -> viewModel.deleteMessage(gameId, messageId) },
                        deleting = actionState is GameChatActionState.Deleting
                    )
                }
            }

            if (canWrite && !isArchived) {
                Spacer(modifier = Modifier.height(8.dp))
                ChatComposer(
                    actionState = actionState,
                    onSend = { text -> viewModel.sendMessage(gameId, text) }
                )
            } else if (!canWrite && !isArchived) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.game_chat_must_confirm),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp)
                )
            }
        }
    }
}

@Composable
private fun MessagesList(
    messages: List<GameChatMessage>,
    currentUserId: String?,
    canManage: Boolean,
    onDelete: (String) -> Unit,
    deleting: Boolean
) {
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.lastIndex)
        }
    }

    LazyColumn(
        state = listState,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 320.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        items(items = messages, key = { it.id }) { message ->
            val isOwn = message.senderId == currentUserId
            val canDelete = canManage || isOwn
            ChatBubble(
                message = message,
                isOwn = isOwn,
                canDelete = canDelete,
                onDelete = { onDelete(message.id) },
                deleting = deleting
            )
        }
    }
}

@Composable
private fun ChatBubble(
    message: GameChatMessage,
    isOwn: Boolean,
    canDelete: Boolean,
    onDelete: () -> Unit,
    deleting: Boolean
) {
    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
    val time = message.createdAt?.let { timeFormat.format(it) } ?: ""

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isOwn) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.Top
    ) {
        if (!isOwn && message.senderPhotoUrl != null) {
            AsyncImage(
                model = message.senderPhotoUrl,
                contentDescription = null,
                modifier = Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(50))
            )
            Spacer(modifier = Modifier.width(6.dp))
        }
        Surface(
            shape = RoundedCornerShape(
                topStart = 12.dp,
                topEnd = 12.dp,
                bottomStart = if (isOwn) 12.dp else 4.dp,
                bottomEnd = if (isOwn) 4.dp else 12.dp
            ),
            color = if (isOwn) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.surfaceVariant,
            tonalElevation = 1.dp
        ) {
            Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)) {
                if (!isOwn) {
                    Text(
                        text = message.senderName,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Text(
                    text = message.text,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isOwn) MaterialTheme.colorScheme.onPrimary
                            else MaterialTheme.colorScheme.onSurface
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.End,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (time.isNotEmpty()) {
                        Text(
                            text = time,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isOwn) MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f)
                                    else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                    }
                    if (canDelete) {
                        IconButton(
                            onClick = onDelete,
                            enabled = !deleting,
                            modifier = Modifier
                                .size(20.dp)
                                .semantics { contentDescription = "Apagar mensagem" }
                        ) {
                            if (deleting) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(12.dp),
                                    strokeWidth = 1.dp
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Filled.DeleteOutline,
                                    contentDescription = null,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatComposer(
    actionState: GameChatActionState,
    onSend: (String) -> Unit
) {
    var draft by remember { mutableStateOf("") }
    val sending = actionState is GameChatActionState.Sending
    val error = (actionState as? GameChatActionState.Error)?.message

    Column {
        OutlinedTextField(
            value = draft,
            onValueChange = { if (it.length <= MAX_TEXT_LENGTH) draft = it },
            placeholder = { Text(stringResource(R.string.game_chat_input_hint)) },
            modifier = Modifier.fillMaxWidth(),
            enabled = !sending,
            maxLines = 4,
            supportingText = {
                Text(
                    text = "${draft.length}/$MAX_TEXT_LENGTH",
                    style = MaterialTheme.typography.labelSmall
                )
            },
            trailingIcon = {
                IconButton(
                    onClick = {
                        if (draft.isNotBlank()) {
                            onSend(draft.trim())
                            draft = ""
                        }
                    },
                    enabled = !sending && draft.isNotBlank(),
                    modifier = Modifier.semantics {
                        contentDescription = "Enviar mensagem"
                    }
                ) {
                    if (sending) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Send,
                            contentDescription = null
                        )
                    }
                }
            }
        )
        if (error != null) {
            Text(
                text = error,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}
