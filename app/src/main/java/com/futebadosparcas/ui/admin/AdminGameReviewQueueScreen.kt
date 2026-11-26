package com.futebadosparcas.ui.admin

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PendingActions
import androidx.compose.material.icons.filled.Timelapse
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.ui.adaptive.adaptiveContentWidth
import com.futebadosparcas.ui.components.design.AppTopBar
import com.futebadosparcas.ui.components.modern.EmptyState
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.ui.components.states.LoadingState
import com.futebadosparcas.ui.components.states.LoadingItemType

/** Estado do diálogo de decisão em edição. */
private data class PendingReview(
    val item: AdminReviewGame,
    val action: String
)

/**
 * AdminGameReviewQueueScreen — Fila de revisão de recompensas XP (admin).
 *
 * Espelha a web (GameReviewQueueScreen): lista jogos com recompensas
 * HELD_FOR_REVIEW/ELIGIBLE/REJECTED_BY_ADMIN + auto-close em revisão, e
 * permite APPROVE/REJECT via callable `reviewHeldGameRewards` com
 * justificativa obrigatória de 10–500 caracteres (spec
 * FEAT_2026-11-26_admin-revisao-xp-apps.md §4.1).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminGameReviewQueueScreen(
    viewModel: AdminGameReviewQueueViewModel,
    onNavigateBack: () -> Unit = {},
    onOpenGameDetail: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val submitting by viewModel.submitting.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var pendingReview by remember { mutableStateOf<PendingReview?>(null) }
    var selectedFilter by remember { mutableStateOf(AdminReviewFilter.ALL) }

    // Eventos one-shot → snackbar (mensagens PT-BR, sem stacktrace).
    // Sucesso/already-reviewed fecha o diálogo de decisão; falha o mantém aberto.
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            val message = when (event) {
                is AdminReviewEvent.Approved -> context.getString(R.string.admin_review_success_approve)
                is AdminReviewEvent.Rejected -> context.getString(R.string.admin_review_success_reject)
                is AdminReviewEvent.AlreadyReviewed ->
                    event.serverMessage?.takeIf { it.isNotBlank() }
                        ?: context.getString(R.string.admin_review_already_reviewed)
                is AdminReviewEvent.Failed -> resolveFailureMessage(context, event)
            }
            if (event !is AdminReviewEvent.Failed) {
                pendingReview = null
            }
            snackbarHostState.showSnackbar(message)
        }
    }

    Scaffold(
        topBar = {
            AppTopBar.Secondary(
                titleResId = R.string.admin_review_queue_title,
                onNavigateBack = onNavigateBack
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is AdminGameReviewUiState.Loading -> {
                    LoadingState(
                        shimmerCount = 6,
                        itemType = LoadingItemType.CARD
                    )
                }
                is AdminGameReviewUiState.AccessDenied -> {
                    EmptyState(
                        icon = Icons.Default.Lock,
                        title = stringResource(R.string.admin_review_access_denied_title),
                        message = stringResource(R.string.admin_review_access_denied_message),
                        modifier = Modifier.fillMaxSize()
                    )
                }
                is AdminGameReviewUiState.Error -> {
                    ErrorState(
                        message = state.message
                            ?: stringResource(R.string.admin_review_load_error),
                        onRetry = { viewModel.loadQueue() }
                    )
                }
                is AdminGameReviewUiState.Success -> {
                    QueueContent(
                        state = state,
                        selectedFilter = selectedFilter,
                        onFilterSelected = { filter ->
                            selectedFilter = filter
                            viewModel.setFilter(filter)
                        },
                        onReviewRequested = { item, action ->
                            pendingReview = PendingReview(item, action)
                        },
                        onOpenGameDetail = onOpenGameDetail
                    )
                }
            }
        }
    }

    // Diálogo de confirmação com justificativa (10–500 chars, spec §2).
    // Fica aberto enquanto o submit roda (loading no botão) e fecha no sucesso.
    pendingReview?.let { pending ->
        ReviewConfirmationDialog(
            pending = pending,
            submitting = submitting,
            isReasonValid = viewModel::isReasonValid,
            onConfirm = { reason ->
                viewModel.submitReview(pending.item.game.id, pending.action, reason)
            },
            onDismiss = { pendingReview = null }
        )
    }
}

private fun resolveFailureMessage(
    context: Context,
    event: AdminReviewEvent.Failed
): String {
    // Mensagens do backend já vêm em PT-BR (rate limit e invalid-argument).
    val serverMessage = event.serverMessage?.takeIf { it.isNotBlank() }
    return when (event.error) {
        AdminReviewError.UNAUTHENTICATED -> context.getString(R.string.admin_review_error_unauthenticated)
        AdminReviewError.PERMISSION_DENIED -> context.getString(R.string.admin_review_error_permission)
        AdminReviewError.RATE_LIMITED -> serverMessage
            ?: context.getString(R.string.admin_review_error_rate_limit)
        AdminReviewError.INVALID_ARGUMENT -> serverMessage
            ?: context.getString(R.string.admin_review_error_invalid_argument)
        AdminReviewError.NOT_FOUND -> context.getString(R.string.admin_review_error_not_found)
        AdminReviewError.GENERIC -> serverMessage
            ?: context.getString(R.string.admin_review_error_generic)
    }
}

@Composable
private fun QueueContent(
    state: AdminGameReviewUiState.Success,
    selectedFilter: AdminReviewFilter,
    onFilterSelected: (AdminReviewFilter) -> Unit,
    onReviewRequested: (AdminReviewGame, String) -> Unit,
    onOpenGameDetail: (String) -> Unit
) {
    // Filtros com contadores (paridade web: Pendentes/Liberados/Rejeitados/Auto-close).
    FilterRow(
        counts = state.counts,
        selectedFilter = selectedFilter,
        onFilterSelected = onFilterSelected
    )

    if (state.games.isEmpty()) {
        EmptyState(
            icon = Icons.Default.PendingActions,
            title = stringResource(R.string.admin_review_empty_title),
            message = stringResource(R.string.admin_review_empty_message),
            modifier = Modifier.fillMaxSize()
        )
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .adaptiveContentWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(state.games, key = { it.game.id }) { item ->
                AdminReviewGameCard(
                    item = item,
                    onReviewRequested = onReviewRequested,
                    onOpenGameDetail = onOpenGameDetail
                )
            }
        }
    }
}

@Composable
private fun FilterRow(
    counts: AdminReviewCounts,
    selectedFilter: AdminReviewFilter,
    onFilterSelected: (AdminReviewFilter) -> Unit
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            QueueFilterChip(
                label = stringResource(R.string.admin_review_filter_all, counts.all),
                selected = selectedFilter == AdminReviewFilter.ALL,
                onClick = { onFilterSelected(AdminReviewFilter.ALL) }
            )
        }
        item {
            QueueFilterChip(
                label = stringResource(R.string.admin_review_filter_pending, counts.pending),
                selected = selectedFilter == AdminReviewFilter.PENDING,
                onClick = { onFilterSelected(AdminReviewFilter.PENDING) }
            )
        }
        item {
            QueueFilterChip(
                label = stringResource(R.string.admin_review_filter_released, counts.released),
                selected = selectedFilter == AdminReviewFilter.RELEASED,
                onClick = { onFilterSelected(AdminReviewFilter.RELEASED) }
            )
        }
        item {
            QueueFilterChip(
                label = stringResource(R.string.admin_review_filter_rejected, counts.rejected),
                selected = selectedFilter == AdminReviewFilter.REJECTED,
                onClick = { onFilterSelected(AdminReviewFilter.REJECTED) }
            )
        }
        item {
            QueueFilterChip(
                label = stringResource(R.string.admin_review_filter_autoclose, counts.autoClose),
                selected = selectedFilter == AdminReviewFilter.AUTO_CLOSE,
                onClick = { onFilterSelected(AdminReviewFilter.AUTO_CLOSE) }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QueueFilterChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) }
    )
}

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
private fun AdminReviewGameCard(
    item: AdminReviewGame,
    onReviewRequested: (AdminReviewGame, String) -> Unit,
    onOpenGameDetail: (String) -> Unit
) {
    val game = item.game
    val rewardStatus = game.xpRewardStatus
    val heldForReview = rewardStatus == "HELD_FOR_REVIEW"
    val (statusIcon, statusColor, statusLabel) = rewardStatusMeta(rewardStatus)
    val reasons = remember(game.xpRewardHoldReasons, game.validationReasons) {
        (game.xpRewardHoldReasons.ifEmpty { game.validationReasons })
            .filter { it.isNotBlank() }
            .distinct()
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = { onOpenGameDetail(game.id) },
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Cabeçalho: status de recompensa + data/hora do jogo
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = statusIcon,
                    contentDescription = null,
                    tint = statusColor,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = statusLabel,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = statusColor
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = "${game.date} • ${game.time}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Text(
                text = game.locationName.ifBlank { game.fieldName },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = stringResource(R.string.admin_review_organizer, game.ownerName),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Chips de contexto: validação, score e auto-close
            if (game.validationStatus != null || game.validationScore != null || item.autoCloseReviewRequired) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    game.validationStatus?.let { InfoChip(it) }
                    game.validationScore?.let {
                        InfoChip(stringResource(R.string.validation_score_chip, it))
                    }
                    if (item.autoCloseReviewRequired) {
                        InfoChip(stringResource(R.string.admin_review_autoclose_chip))
                    }
                }
            }

            // Motivos da retenção (fallback validationReasons, paridade web)
            if (reasons.isNotEmpty()) {
                Text(
                    text = stringResource(R.string.validation_reasons_label),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    reasons.forEach { reason -> InfoChip(reason) }
                }
            }

            // Última decisão manual (APPROVED/REJECTED com justificativa auditável)
            if (!heldForReview && game.xpRewardReviewDecision != null) {
                val decision = if (game.xpRewardReviewDecision == "APPROVED") {
                    stringResource(R.string.admin_review_status_eligible)
                } else {
                    stringResource(R.string.admin_review_status_rejected)
                }
                game.xpRewardReviewReason?.takeIf { it.isNotBlank() }?.let { reviewReason ->
                    Text(
                        text = stringResource(R.string.admin_review_last_decision, decision, reviewReason),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // ELIGIBLE sem PROCESSSED: liberado, mas XP ainda não pago (spec §6).
            if (rewardStatus == "ELIGIBLE" && !game.xpProcessed) {
                Text(
                    text = stringResource(R.string.admin_review_pending_processing),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.tertiary
                )
            }

            // Ações de decisão — SOMENTE para HELD_FOR_REVIEW (única transição por UI).
            if (heldForReview) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilledTonalButton(
                        onClick = {
                            onReviewRequested(item, AdminGameReviewQueueViewModel.ACTION_APPROVE)
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(stringResource(R.string.admin_review_action_approve))
                    }
                    OutlinedButton(
                        onClick = {
                            onReviewRequested(item, AdminGameReviewQueueViewModel.ACTION_REJECT)
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            Icons.Default.Cancel,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(stringResource(R.string.admin_review_action_reject))
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InfoChip(label: String) {
    AssistChip(
        onClick = {},
        enabled = false,
        label = { Text(label, style = MaterialTheme.typography.labelSmall) }
    )
}

/**
 * Metadados de status de recompensa (paridade getRewardStatusMeta da web).
 */
@Composable
private fun rewardStatusMeta(status: String?): Triple<ImageVector, Color, String> {
    return when (status) {
        "HELD_FOR_REVIEW" -> Triple(
            Icons.Default.Warning,
            MaterialTheme.colorScheme.error,
            stringResource(R.string.admin_review_status_held)
        )
        "ELIGIBLE" -> Triple(
            Icons.Default.CheckCircle,
            MaterialTheme.colorScheme.primary,
            stringResource(R.string.admin_review_status_eligible)
        )
        "REJECTED_BY_ADMIN" -> Triple(
            Icons.Default.Block,
            MaterialTheme.colorScheme.error,
            stringResource(R.string.admin_review_status_rejected)
        )
        // Jogos apenas na fila de auto-close (sem status de recompensa ainda).
        else -> Triple(
            Icons.Default.Timelapse,
            MaterialTheme.colorScheme.onSurfaceVariant,
            stringResource(R.string.admin_review_autoclose_chip)
        )
    }
}

/**
 * Diálogo de confirmação: resumo do jogo + justificativa obrigatória (10–500).
 * APPROVE paga XP imediatamente e é irreversível — o body avisa o admin.
 */
@Composable
private fun ReviewConfirmationDialog(
    pending: PendingReview,
    submitting: Boolean,
    isReasonValid: (String) -> Boolean,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val isApprove = pending.action == AdminGameReviewQueueViewModel.ACTION_APPROVE
    var reason by remember(pending) { mutableStateOf("") }
    val valid = isReasonValid(reason)

    AlertDialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        title = {
            Text(
                text = stringResource(
                    if (isApprove) {
                        R.string.admin_review_dialog_title_approve
                    } else {
                        R.string.admin_review_dialog_title_reject
                    }
                )
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = stringResource(
                        if (isApprove) {
                            R.string.admin_review_dialog_body_approve
                        } else {
                            R.string.admin_review_dialog_body_reject
                        }
                    ),
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    text = pending.item.game.locationName.ifBlank { pending.item.game.fieldName } +
                        " — ${pending.item.game.date}",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold
                )
                OutlinedTextField(
                    value = reason,
                    onValueChange = { input ->
                        if (input.length <= 500) reason = input
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.admin_review_dialog_reason_label)) },
                    supportingText = {
                        Text(
                            text = if (reason.isBlank()) {
                                stringResource(R.string.admin_review_dialog_reason_support)
                            } else {
                                stringResource(R.string.admin_review_dialog_counter, reason.trim().length)
                            }
                        )
                    },
                    isError = reason.isNotBlank() && !valid,
                    minLines = 3,
                    enabled = !submitting,
                    shape = MaterialTheme.shapes.medium
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(reason) },
                enabled = valid && !submitting
            ) {
                if (submitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        stringResource(
                            if (isApprove) {
                                R.string.admin_review_action_approve
                            } else {
                                R.string.admin_review_action_reject
                            }
                        ),
                        color = if (isApprove) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.error
                        }
                    )
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !submitting
            ) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}
