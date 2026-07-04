package com.futebadosparcas.ui.messages

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.repository.DirectChat
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.states.LoadingItemType
import com.futebadosparcas.ui.components.states.LoadingState
import org.koin.compose.viewmodel.koinViewModel
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DirectMessagesScreen(
    onNavigateBack: () -> Unit,
    onOpenChat: (String) -> Unit,
    onFindPlayers: () -> Unit,
    viewModel: DirectMessagesViewModel = koinViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val currentUserId = viewModel.currentUserId

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.direct_messages_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.back)
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        when (val uiState = state) {
            DirectMessagesUiState.Loading -> {
                LoadingState(
                    shimmerCount = 5,
                    itemType = LoadingItemType.CARD,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(paddingValues)
                        .padding(16.dp)
                )
            }
            is DirectMessagesUiState.Error -> {
                EmptyState(
                    type = EmptyStateType.Error(
                        title = stringResource(R.string.error),
                        description = uiState.message,
                        actionLabel = stringResource(R.string.retry),
                        onRetry = viewModel::observeChats
                    ),
                    modifier = Modifier.padding(paddingValues)
                )
            }
            is DirectMessagesUiState.Success -> {
                if (uiState.chats.isEmpty()) {
                    EmptyState(
                        type = EmptyStateType.NoData(
                            title = stringResource(R.string.direct_messages_empty_title),
                            description = stringResource(R.string.direct_messages_empty_desc),
                            icon = Icons.Default.Inbox,
                            actionLabel = stringResource(R.string.direct_messages_find_players),
                            onAction = onFindPlayers
                        ),
                        modifier = Modifier.padding(paddingValues)
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(
                            start = 16.dp,
                            top = paddingValues.calculateTopPadding() + 16.dp,
                            end = 16.dp,
                            bottom = 16.dp
                        ),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(uiState.chats, key = { it.id }) { chat ->
                            DirectChatRow(
                                chat = chat,
                                currentUserId = currentUserId,
                                onClick = { onOpenChat(chat.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DirectChatRow(
    chat: DirectChat,
    currentUserId: String?,
    onClick: () -> Unit
) {
    val peerId = chat.participants.firstOrNull { it != currentUserId } ?: chat.participants.firstOrNull().orEmpty()
    val peerName = chat.participantNames[peerId] ?: "Jogador"
    val unread = currentUserId?.let { chat.unreadCount[it] } ?: 0

    Card(modifier = Modifier.clickable(onClick = onClick)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            BadgedBox(
                badge = {
                    if (unread > 0) {
                        Badge { Text(unread.coerceAtMost(99).toString()) }
                    }
                }
            ) {
                Text(
                    text = peerName.take(1).uppercase(Locale.getDefault()),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = peerName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    chat.lastMessageAt?.toDate()?.let {
                        Text(
                            text = SimpleDateFormat("dd/MM HH:mm", Locale.getDefault()).format(it),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                Text(
                    text = chat.lastMessage ?: stringResource(R.string.direct_messages_no_messages),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}
