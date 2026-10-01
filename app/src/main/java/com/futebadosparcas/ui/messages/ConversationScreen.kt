package com.futebadosparcas.ui.messages

import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.repository.DirectMessage
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.states.LoadingItemType
import com.futebadosparcas.ui.components.states.LoadingState
import org.koin.compose.viewmodel.koinViewModel
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConversationScreen(
    chatId: String,
    onNavigateBack: () -> Unit,
    viewModel: ConversationViewModel = koinViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var text by remember { mutableStateOf("") }
    val currentUserId = viewModel.currentUserId
    val peerId = state.chat?.participants?.firstOrNull { it != currentUserId }
    val peerName = peerId?.let { state.chat?.participantNames?.get(it) }
        ?: stringResource(R.string.direct_messages_title)

    LaunchedEffect(chatId) {
        viewModel.observe(chatId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = peerName,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.back)
                        )
                    }
                }
            )
        },
        bottomBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .imePadding()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
            // FIX #4137: teclado com capitalização para campos de texto livre.
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    value = text,
                    onValueChange = { text = it.take(1000) },
                    placeholder = { Text(stringResource(R.string.direct_messages_placeholder)) },
                    supportingText = {
                        Text(stringResource(R.string.direct_messages_counter, text.length, 1000))
                    },
                    maxLines = 4,
                    modifier = Modifier.weight(1f)
                )
                IconButton(
                    enabled = text.isNotBlank() && !state.sending,
                    onClick = {
                        viewModel.send(text)
                        text = ""
                    }
                ) {
                    if (state.sending) {
                        CircularProgressIndicator(strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Default.Send, contentDescription = stringResource(R.string.direct_messages_send))
                    }
                }
            }
        }
    ) { paddingValues ->
        when {
            state.loading -> {
                LoadingState(
                    shimmerCount = 5,
                    itemType = LoadingItemType.CARD,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(paddingValues)
                        .padding(16.dp)
                )
            }
            state.error != null -> {
                EmptyState(
                    type = EmptyStateType.Error(
                        title = stringResource(R.string.error),
                        description = state.error.orEmpty(),
                        actionLabel = stringResource(R.string.retry),
                        onRetry = { viewModel.retry(chatId) }
                    ),
                    modifier = Modifier.padding(paddingValues)
                )
            }
            state.messages.isEmpty() -> {
                EmptyState(
                    type = EmptyStateType.NoData(
                        title = stringResource(R.string.direct_messages_empty_conversation_title),
                        description = stringResource(R.string.direct_messages_empty_conversation_desc),
                        icon = Icons.Default.ChatBubbleOutline
                    ),
                    modifier = Modifier.padding(paddingValues)
                )
            }
            else -> {
                LazyColumn(
                    contentPadding = PaddingValues(
                        start = 12.dp,
                        top = paddingValues.calculateTopPadding() + 12.dp,
                        end = 12.dp,
                        bottom = paddingValues.calculateBottomPadding() + 12.dp
                    ),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(state.messages, key = { it.id }) { message ->
                        MessageBubble(
                            message = message,
                            isOwn = message.senderId == currentUserId,
                            onDelete = { viewModel.delete(message.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(
    message: DirectMessage,
    isOwn: Boolean,
    onDelete: () -> Unit
) {
    val deleted = message.deletedAt != null
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isOwn) Arrangement.End else Arrangement.Start
    ) {
        Surface(
            color = if (isOwn) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
            contentColor = if (isOwn) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
            shape = MaterialTheme.shapes.medium,
            tonalElevation = 1.dp,
            modifier = Modifier.fillMaxWidth(0.82f)
        ) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = if (deleted) stringResource(R.string.direct_messages_deleted) else message.text,
                    style = MaterialTheme.typography.bodyMedium,
                    fontStyle = if (deleted) FontStyle.Italic else FontStyle.Normal
                )
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = message.createdAt?.toDate()?.let {
                            SimpleDateFormat("dd/MM HH:mm", Locale.getDefault()).format(it)
                        }.orEmpty(),
                        style = MaterialTheme.typography.labelSmall
                    )
                    if (isOwn && !deleted) {
                        IconButton(onClick = onDelete) {
                            Icon(Icons.Default.Delete, contentDescription = stringResource(R.string.delete))
                        }
                    }
                }
            }
        }
    }
}
