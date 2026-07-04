package com.futebadosparcas.ui.games.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GameComment
import com.futebadosparcas.ui.components.reactions.SocialReactionBar
import com.futebadosparcas.ui.games.GameCommentsActionState
import com.futebadosparcas.ui.games.GameCommentsUiState
import com.futebadosparcas.ui.games.GameCommentsViewModel
import org.koin.compose.viewmodel.koinViewModel
import java.text.SimpleDateFormat
import java.util.Locale

private const val MAX_COMMENT_LENGTH = 500

@Composable
fun GameCommentsSection(
    gameId: String,
    canWrite: Boolean,
    currentUserId: String?,
    canManage: Boolean,
    context: String = "game",
    modifier: Modifier = Modifier,
    viewModel: GameCommentsViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val actionState by viewModel.actionState.collectAsState()
    var replyTo by remember { mutableStateOf<GameComment?>(null) }

    LaunchedEffect(gameId) {
        viewModel.observeComments(gameId, context)
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
                    imageVector = Icons.Filled.ChatBubbleOutline,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.game_comments_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = stringResource(R.string.game_comments_description),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            when (val state = uiState) {
                is GameCommentsUiState.Loading -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(120.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(28.dp))
                    }
                }

                is GameCommentsUiState.Empty -> {
                    EmptyComments()
                }

                is GameCommentsUiState.Error -> {
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
                        TextButton(onClick = { viewModel.observeComments(gameId, context) }) {
                            Text(stringResource(R.string.game_comments_retry))
                        }
                    }
                }

                is GameCommentsUiState.Success -> {
                    CommentsList(
                        gameId = gameId,
                        comments = state.comments,
                        currentUserId = currentUserId,
                        canManage = canManage,
                        canWrite = canWrite,
                        actionState = actionState,
                        onReply = { replyTo = it },
                        onEdit = { comment, text -> viewModel.editComment(gameId, comment.id, text) },
                        onDelete = { comment -> viewModel.deleteComment(gameId, comment.id) },
                        onToggleReaction = { comment, emoji -> viewModel.toggleReaction(gameId, comment, emoji) }
                    )
                }
            }

            if (replyTo != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.game_comments_replying_to, replyTo?.authorName.orEmpty()),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
                TextButton(onClick = { replyTo = null }) {
                    Text(stringResource(R.string.game_comments_cancel_reply))
                }
            }

            if (canWrite) {
                Spacer(modifier = Modifier.height(8.dp))
                CommentComposer(
                    actionState = actionState,
                    placeholder = if (replyTo == null) {
                        stringResource(R.string.game_comments_input_hint)
                    } else {
                        stringResource(R.string.game_comments_reply_hint)
                    },
                    onSend = { text ->
                        viewModel.addComment(gameId, text, replyTo?.id, context)
                        replyTo = null
                    }
                )
            } else {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.game_comments_must_confirm),
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
private fun EmptyComments() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Filled.ChatBubbleOutline,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.size(40.dp)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.game_comments_empty_title),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = stringResource(R.string.game_comments_empty_desc),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun CommentsList(
    gameId: String,
    comments: List<GameComment>,
    currentUserId: String?,
    canManage: Boolean,
    canWrite: Boolean,
    actionState: GameCommentsActionState,
    onReply: (GameComment) -> Unit,
    onEdit: (GameComment, String) -> Unit,
    onDelete: (GameComment) -> Unit,
    onToggleReaction: (GameComment, String) -> Unit
) {
    val rootComments = remember(comments) { comments.filter { it.parentId == null } }
    val repliesByParent = remember(comments) {
        comments.filter { it.parentId != null }.groupBy { it.parentId.orEmpty() }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 360.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(items = rootComments, key = { it.id }) { comment ->
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                CommentCard(
                    gameId = gameId,
                    comment = comment,
                    currentUserId = currentUserId,
                    canManage = canManage,
                    canWrite = canWrite,
                    actionState = actionState,
                    onReply = { onReply(comment) },
                    onEdit = { text -> onEdit(comment, text) },
                    onDelete = { onDelete(comment) },
                    onToggleReaction = { emoji -> onToggleReaction(comment, emoji) }
                )
                repliesByParent[comment.id].orEmpty().forEach { reply ->
                    Row(modifier = Modifier.padding(start = 32.dp)) {
                        CommentCard(
                            gameId = gameId,
                            comment = reply,
                            currentUserId = currentUserId,
                            canManage = canManage,
                            canWrite = false,
                            actionState = actionState,
                            onReply = { },
                            onEdit = { text -> onEdit(reply, text) },
                            onDelete = { onDelete(reply) },
                            onToggleReaction = { emoji -> onToggleReaction(reply, emoji) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CommentCard(
    gameId: String,
    comment: GameComment,
    currentUserId: String?,
    canManage: Boolean,
    canWrite: Boolean,
    actionState: GameCommentsActionState,
    onReply: () -> Unit,
    onEdit: (String) -> Unit,
    onDelete: () -> Unit,
    onToggleReaction: (String) -> Unit
) {
    var editing by remember(comment.id) { mutableStateOf(false) }
    var draft by remember(comment.id, comment.text) { mutableStateOf(comment.text) }
    val isOwn = comment.authorId == currentUserId
    val saving = actionState is GameCommentsActionState.Saving
    val deleting = actionState is GameCommentsActionState.Deleting
    val reacting = actionState is GameCommentsActionState.Reacting
    val timeFormat = remember { SimpleDateFormat("dd/MM HH:mm", Locale.getDefault()) }
    val time = comment.createdAt?.let { timeFormat.format(it) }.orEmpty()

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp
    ) {
        Row(
            modifier = Modifier.padding(10.dp),
            verticalAlignment = Alignment.Top
        ) {
            if (comment.authorPhotoUrl != null) {
                AsyncImage(
                    model = comment.authorPhotoUrl,
                    contentDescription = null,
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(50))
                )
            } else {
                Surface(
                    modifier = Modifier.size(32.dp),
                    shape = RoundedCornerShape(50),
                    color = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = comment.authorName.firstOrNull()?.uppercaseChar()?.toString() ?: "?",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = comment.authorName,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (time.isNotEmpty()) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = time,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (comment.editedAt != null) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = stringResource(R.string.game_comments_edited),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                if (editing) {
                    OutlinedTextField(
                        value = draft,
                        onValueChange = { if (it.length <= MAX_COMMENT_LENGTH) draft = it },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !saving,
                        maxLines = 4,
                        supportingText = {
                            Text("${draft.length}/$MAX_COMMENT_LENGTH")
                        }
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                onEdit(draft)
                                editing = false
                            },
                            enabled = !saving && draft.isNotBlank()
                        ) {
                            Text(stringResource(R.string.save))
                        }
                        TextButton(onClick = { editing = false }, enabled = !saving) {
                            Text(stringResource(R.string.cancel))
                        }
                    }
                } else {
                    Text(
                        text = comment.text,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(top = 4.dp)
                    )

                    Spacer(modifier = Modifier.height(6.dp))
                    SocialReactionBar(
                        reactions = comment.reactions,
                        currentUserId = currentUserId,
                        onToggleReaction = onToggleReaction,
                        enabled = !reacting
                    )

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (canWrite) {
                            IconButton(
                                onClick = onReply,
                                modifier = Modifier
                                    .size(36.dp)
                                    .semantics { contentDescription = "Responder comentário" }
                            ) {
                                Icon(Icons.AutoMirrored.Filled.Reply, contentDescription = null)
                            }
                        }
                        if (isOwn) {
                            IconButton(
                                onClick = { editing = true },
                                modifier = Modifier
                                    .size(36.dp)
                                    .semantics { contentDescription = "Editar comentário" }
                            ) {
                                Icon(Icons.Filled.Edit, contentDescription = null)
                            }
                        }
                        if (isOwn || canManage) {
                            IconButton(
                                onClick = onDelete,
                                enabled = !deleting,
                                modifier = Modifier
                                    .size(36.dp)
                                    .semantics { contentDescription = "Apagar comentário" }
                            ) {
                                if (deleting) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(14.dp),
                                        strokeWidth = 1.dp
                                    )
                                } else {
                                    Icon(Icons.Filled.DeleteOutline, contentDescription = null)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CommentComposer(
    actionState: GameCommentsActionState,
    placeholder: String,
    onSend: (String) -> Unit
) {
    var draft by remember { mutableStateOf("") }
    val saving = actionState is GameCommentsActionState.Saving
    val error = (actionState as? GameCommentsActionState.Error)?.message

    Column {
        OutlinedTextField(
            value = draft,
            onValueChange = { if (it.length <= MAX_COMMENT_LENGTH) draft = it },
            placeholder = { Text(placeholder) },
            modifier = Modifier.fillMaxWidth(),
            enabled = !saving,
            maxLines = 4,
            supportingText = {
                Text(
                    text = "${draft.length}/$MAX_COMMENT_LENGTH",
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
                    enabled = !saving && draft.isNotBlank(),
                    modifier = Modifier.semantics {
                        contentDescription = "Enviar comentário"
                    }
                ) {
                    if (saving) {
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
