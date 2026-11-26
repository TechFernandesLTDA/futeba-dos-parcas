package com.futebadosparcas.ui.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.lazy.items as listItems
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.GppMaybe
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.admin_review_queue_action_approve
import com.futebadosparcas.compose.resources.admin_review_queue_action_approve_cd
import com.futebadosparcas.compose.resources.admin_review_queue_action_reject
import com.futebadosparcas.compose.resources.admin_review_queue_action_reject_cd
import com.futebadosparcas.compose.resources.admin_review_queue_already_reviewed
import com.futebadosparcas.compose.resources.admin_review_queue_approve_note
import com.futebadosparcas.compose.resources.admin_review_queue_auto_close_alert_body
import com.futebadosparcas.compose.resources.admin_review_queue_auto_close_alert_title
import com.futebadosparcas.compose.resources.admin_review_queue_chip_auto_close
import com.futebadosparcas.compose.resources.admin_review_queue_counter_auto_close
import com.futebadosparcas.compose.resources.admin_review_queue_counter_eligible
import com.futebadosparcas.compose.resources.admin_review_queue_counter_held
import com.futebadosparcas.compose.resources.admin_review_queue_counter_rejected
import com.futebadosparcas.compose.resources.admin_review_queue_decision_approved
import com.futebadosparcas.compose.resources.admin_review_queue_decision_rejected
import com.futebadosparcas.compose.resources.admin_review_queue_dialog_approve_title
import com.futebadosparcas.compose.resources.admin_review_queue_dialog_confirm_approve
import com.futebadosparcas.compose.resources.admin_review_queue_dialog_confirm_reject
import com.futebadosparcas.compose.resources.admin_review_queue_dialog_counter
import com.futebadosparcas.compose.resources.admin_review_queue_dialog_field_label
import com.futebadosparcas.compose.resources.admin_review_queue_dialog_field_placeholder
import com.futebadosparcas.compose.resources.admin_review_queue_dialog_min
import com.futebadosparcas.compose.resources.admin_review_queue_dialog_reject_title
import com.futebadosparcas.compose.resources.admin_review_queue_empty_body
import com.futebadosparcas.compose.resources.admin_review_queue_empty_title
import com.futebadosparcas.compose.resources.admin_review_queue_error_generic
import com.futebadosparcas.compose.resources.admin_review_queue_error_invalid
import com.futebadosparcas.compose.resources.admin_review_queue_error_not_found
import com.futebadosparcas.compose.resources.admin_review_queue_error_not_held
import com.futebadosparcas.compose.resources.admin_review_queue_error_permission
import com.futebadosparcas.compose.resources.admin_review_queue_error_rate_limit
import com.futebadosparcas.compose.resources.admin_review_queue_error_unauthenticated
import com.futebadosparcas.compose.resources.admin_review_queue_error_unavailable
import com.futebadosparcas.compose.resources.admin_review_queue_filter_auto_close
import com.futebadosparcas.compose.resources.admin_review_queue_filter_eligible
import com.futebadosparcas.compose.resources.admin_review_queue_filter_held
import com.futebadosparcas.compose.resources.admin_review_queue_filter_rejected
import com.futebadosparcas.compose.resources.admin_review_queue_game_without_location
import com.futebadosparcas.compose.resources.admin_review_queue_info
import com.futebadosparcas.compose.resources.admin_review_queue_last_decision
import com.futebadosparcas.compose.resources.admin_review_queue_load_error
import com.futebadosparcas.compose.resources.admin_review_queue_no_date
import com.futebadosparcas.compose.resources.admin_review_queue_no_reasons
import com.futebadosparcas.compose.resources.admin_review_queue_organizer
import com.futebadosparcas.compose.resources.admin_review_queue_reasons_title
import com.futebadosparcas.compose.resources.admin_review_queue_score
import com.futebadosparcas.compose.resources.admin_review_queue_search_label
import com.futebadosparcas.compose.resources.admin_review_queue_status_eligible
import com.futebadosparcas.compose.resources.admin_review_queue_status_held
import com.futebadosparcas.compose.resources.admin_review_queue_status_none
import com.futebadosparcas.compose.resources.admin_review_queue_status_processed
import com.futebadosparcas.compose.resources.admin_review_queue_status_rejected
import com.futebadosparcas.compose.resources.admin_review_queue_subtitle
import com.futebadosparcas.compose.resources.admin_review_queue_success_approve
import com.futebadosparcas.compose.resources.admin_review_queue_success_reject
import com.futebadosparcas.compose.resources.admin_review_queue_title
import com.futebadosparcas.compose.resources.admin_review_queue_validation_low
import com.futebadosparcas.compose.resources.admin_review_queue_validation_none
import com.futebadosparcas.compose.resources.admin_review_queue_validation_review
import com.futebadosparcas.compose.resources.admin_review_queue_validation_validated
import com.futebadosparcas.compose.resources.cancel
import com.futebadosparcas.compose.resources.cd_back
import com.futebadosparcas.compose.resources.ok
import com.futebadosparcas.compose.resources.retry
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import org.jetbrains.compose.resources.stringResource

private val EXPANDED_BREAKPOINT = 840.dp

/**
 * Fila de revisão de recompensas XP para administradores (spec FEAT_2026-11-26, §4.2).
 *
 * Paridade com `web/src/pages/admin/GameReviewQueueScreen.tsx`:
 * - duas queries mergeadas (recompensas + auto-close) vindas do ViewModel;
 * - contadores (Pendentes/Liberados/Rejeitados/Auto-close), filtros e busca;
 * - decisão (APPROVE/REJECT) apenas para `HELD_FOR_REVIEW`, com justificativa
 *   obrigatória de 10–500 caracteres e erros PT-BR mapeados por código.
 *
 * Estados obrigatórios: Loading / Error com retry / Empty / Success.
 * Layout adaptativo: 1 coluna em compact/medium; grid de 2 colunas em expanded (≥840dp).
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AdminGameReviewQueueScreen(
    viewModel: AdminGameReviewQueueViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()
    val reviewTarget by viewModel.reviewTarget.collectAsStateWithLifecycle()
    val reviewAction by viewModel.reviewAction.collectAsStateWithLifecycle()
    val reviewReason by viewModel.reviewReason.collectAsStateWithLifecycle()
    val submitting by viewModel.submitting.collectAsStateWithLifecycle()
    val feedback by viewModel.feedback.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = stringResource(Res.string.admin_review_queue_title),
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(Res.string.cd_back)
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            val expanded = maxWidth >= EXPANDED_BREAKPOINT
            when (val current = state) {
                AdminGameReviewQueueUiState.Loading -> AdminReviewLoadingState()
                AdminGameReviewQueueUiState.Error -> AdminReviewErrorState(
                    onRetry = viewModel::load
                )
                is AdminGameReviewQueueUiState.Success -> {
                    val content = current.content
                    val summary = content.summary
                    val filtered = filteredGames(content, filter, searchQuery)

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = if (expanded) 28.dp else 20.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        AdminReviewHeader(
                            summary = summary,
                            filter = filter,
                            searchQuery = searchQuery,
                            refreshing = current.refreshing,
                            onFilter = viewModel::setFilter,
                            onSearch = viewModel::setSearchQuery
                        )
                        feedback?.let {
                            AdminReviewFeedbackBanner(
                                feedback = it,
                                onDismiss = viewModel::dismissFeedback
                            )
                        }
                        when {
                            filtered.isEmpty() -> AdminReviewEmptyState(
                                hasSearchOrFilter = searchQuery.isNotBlank(),
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxWidth()
                            )
                            expanded -> LazyVerticalGrid(
                                columns = GridCells.Fixed(2),
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                gridItems(filtered, key = { it.id }) { game ->
                                    AdminReviewGameCard(
                                        game = game,
                                        autoCloseReviewRequired = game.id in content.autoCloseGameIds,
                                        onApprove = {
                                            viewModel.openReviewDialog(
                                                game,
                                                AdminGameReviewQueueViewModel.ACTION_APPROVE
                                            )
                                        },
                                        onReject = {
                                            viewModel.openReviewDialog(
                                                game,
                                                AdminGameReviewQueueViewModel.ACTION_REJECT
                                            )
                                        }
                                    )
                                }
                            }
                            else -> LazyColumn(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                listItems(filtered, key = { it.id }) { game ->
                                    AdminReviewGameCard(
                                        game = game,
                                        autoCloseReviewRequired = game.id in content.autoCloseGameIds,
                                        onApprove = {
                                            viewModel.openReviewDialog(
                                                game,
                                                AdminGameReviewQueueViewModel.ACTION_APPROVE
                                            )
                                        },
                                        onReject = {
                                            viewModel.openReviewDialog(
                                                game,
                                                AdminGameReviewQueueViewModel.ACTION_REJECT
                                            )
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (reviewTarget != null) {
        AdminReviewJustificationDialog(
            game = reviewTarget,
            action = reviewAction,
            reason = reviewReason,
            submitting = submitting,
            onReasonChange = viewModel::updateReviewReason,
            onDismiss = viewModel::dismissReviewDialog,
            onSubmit = viewModel::submitReview
        )
    }
}

// ========== HEADER: info + contadores + filtros + busca ==========

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AdminReviewHeader(
    summary: AdminReviewQueueSummary,
    filter: AdminReviewQueueFilter,
    searchQuery: String,
    refreshing: Boolean,
    onFilter: (AdminReviewQueueFilter) -> Unit,
    onSearch: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = stringResource(Res.string.admin_review_queue_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (refreshing) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(14.dp),
                        strokeWidth = 2.dp
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = stringResource(Res.string.admin_review_queue_subtitle),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        Card(
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer
            )
        ) {
            Text(
                text = stringResource(Res.string.admin_review_queue_info),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(16.dp)
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            AdminReviewCounterCard(
                label = stringResource(Res.string.admin_review_queue_counter_held),
                value = summary.held,
                modifier = Modifier.weight(1f)
            )
            AdminReviewCounterCard(
                label = stringResource(Res.string.admin_review_queue_counter_eligible),
                value = summary.eligible,
                modifier = Modifier.weight(1f)
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            AdminReviewCounterCard(
                label = stringResource(Res.string.admin_review_queue_counter_rejected),
                value = summary.rejected,
                modifier = Modifier.weight(1f)
            )
            AdminReviewCounterCard(
                label = stringResource(Res.string.admin_review_queue_counter_auto_close),
                value = summary.autoClose,
                modifier = Modifier.weight(1f)
            )
        }

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = filter == AdminReviewQueueFilter.HELD_FOR_REVIEW,
                onClick = { onFilter(AdminReviewQueueFilter.HELD_FOR_REVIEW) },
                label = {
                    Text(stringResource(Res.string.admin_review_queue_filter_held, summary.held))
                }
            )
            FilterChip(
                selected = filter == AdminReviewQueueFilter.ELIGIBLE,
                onClick = { onFilter(AdminReviewQueueFilter.ELIGIBLE) },
                label = {
                    Text(
                        stringResource(Res.string.admin_review_queue_filter_eligible, summary.eligible)
                    )
                }
            )
            FilterChip(
                selected = filter == AdminReviewQueueFilter.REJECTED_BY_ADMIN,
                onClick = { onFilter(AdminReviewQueueFilter.REJECTED_BY_ADMIN) },
                label = {
                    Text(
                        stringResource(Res.string.admin_review_queue_filter_rejected, summary.rejected)
                    )
                }
            )
            FilterChip(
                selected = filter == AdminReviewQueueFilter.AUTO_CLOSE_REVIEW,
                onClick = { onFilter(AdminReviewQueueFilter.AUTO_CLOSE_REVIEW) },
                label = {
                    Text(
                        stringResource(
                            Res.string.admin_review_queue_filter_auto_close,
                            summary.autoClose
                        )
                    )
                }
            )
        }

        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearch,
            label = { Text(stringResource(Res.string.admin_review_queue_search_label)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun AdminReviewCounterCard(
    label: String,
    value: Int,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value.toString(),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

// ========== CARD DO JOGO ==========

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AdminReviewGameCard(
    game: Game,
    autoCloseReviewRequired: Boolean,
    onApprove: () -> Unit,
    onReject: () -> Unit
) {
    val isHeld = game.xpRewardStatus == AdminGameReviewQueueViewModel.STATUS_HELD_FOR_REVIEW
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = game.locationName.ifBlank {
                        stringResource(Res.string.admin_review_queue_game_without_location)
                    },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.semantics { heading() }
                )
                Text(
                    text = listOf(
                        formatGameDateTime(game),
                        stringResource(
                            Res.string.admin_review_queue_organizer,
                            game.ownerName.ifBlank { game.ownerId }
                        )
                    ).filter { it.isNotBlank() }.joinToString(" • "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (autoCloseReviewRequired) {
                    StatusChip(
                        label = stringResource(Res.string.admin_review_queue_chip_auto_close),
                        containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                        contentColor = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                }
                val rewardMeta = rewardStatusMeta(game)
                StatusChip(
                    label = rewardMeta.label,
                    containerColor = rewardMeta.containerColor,
                    contentColor = rewardMeta.contentColor
                )
                val validationMeta = validationStatusMeta(game)
                StatusChip(
                    label = validationMeta.label,
                    containerColor = validationMeta.containerColor,
                    contentColor = validationMeta.contentColor
                )
                game.validationScore?.let {
                    SuggestionChip(
                        onClick = {},
                        label = { Text(stringResource(Res.string.admin_review_queue_score, it)) }
                    )
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = stringResource(Res.string.admin_review_queue_reasons_title),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold
                )
                val reasons = game.xpRewardHoldReasons.ifEmpty { game.validationReasons }
                if (reasons.isEmpty()) {
                    SuggestionChip(
                        onClick = {},
                        label = { Text(stringResource(Res.string.admin_review_queue_no_reasons)) }
                    )
                } else {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        reasons.forEach { reason ->
                            SuggestionChip(onClick = {}, label = { Text(reason) })
                        }
                    }
                }
            }

            if (autoCloseReviewRequired) {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                        contentColor = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = stringResource(Res.string.admin_review_queue_auto_close_alert_title),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = stringResource(Res.string.admin_review_queue_auto_close_alert_body),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            if (game.xpRewardReviewDecision != null || game.xpRewardReviewedAt != null) {
                val decisionRejected = game.xpRewardReviewDecision == "REJECTED" ||
                    game.xpRewardStatus == "REJECTED_BY_ADMIN"
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = if (decisionRejected) {
                            MaterialTheme.colorScheme.errorContainer
                        } else {
                            MaterialTheme.colorScheme.secondaryContainer
                        },
                        contentColor = if (decisionRejected) {
                            MaterialTheme.colorScheme.onErrorContainer
                        } else {
                            MaterialTheme.colorScheme.onSecondaryContainer
                        }
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = stringResource(Res.string.admin_review_queue_last_decision),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = listOf(
                                if (game.xpRewardReviewDecision == "REJECTED") {
                                    stringResource(Res.string.admin_review_queue_decision_rejected)
                                } else {
                                    stringResource(Res.string.admin_review_queue_decision_approved)
                                },
                                game.xpRewardReviewedAt?.let { formatEpochMillis(it) }
                            ).filterNotNull().filter { it.isNotBlank() }.joinToString(" • "),
                            style = MaterialTheme.typography.bodySmall
                        )
                        game.xpRewardReviewReason?.let {
                            Text(text = it, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }

            // Decisão apenas para HELD_FOR_REVIEW (única transição permitida pela spec §3).
            // INELIGIBLE_MIN_PLAYERS é terminal e nunca chega aqui com botões.
            if (isHeld) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = stringResource(Res.string.admin_review_queue_approve_note),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        val approveDescription = stringResource(
                            Res.string.admin_review_queue_action_approve_cd,
                            game.locationName.ifBlank { game.id }
                        )
                        Button(
                            onClick = onApprove,
                            modifier = Modifier
                                .weight(1f)
                                .heightIn(min = 48.dp)
                                .semantics { contentDescription = approveDescription }
                        ) {
                            Icon(
                                imageVector = Icons.Filled.CheckCircle,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(stringResource(Res.string.admin_review_queue_action_approve))
                        }
                        val rejectDescription = stringResource(
                            Res.string.admin_review_queue_action_reject_cd,
                            game.locationName.ifBlank { game.id }
                        )
                        OutlinedButton(
                            onClick = onReject,
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = MaterialTheme.colorScheme.error
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .heightIn(min = 48.dp)
                                .semantics { contentDescription = rejectDescription }
                        ) {
                            Icon(
                                imageVector = Icons.Filled.GppMaybe,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(stringResource(Res.string.admin_review_queue_action_reject))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusChip(label: String, containerColor: Color, contentColor: Color) {
    Surface(
        shape = MaterialTheme.shapes.small,
        color = containerColor,
        contentColor = contentColor
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        )
    }
}

private data class StatusMeta(
    val label: String,
    val containerColor: Color,
    val contentColor: Color
)

/** Labels/cores dos chips de `xp_reward_status` (paridade `getRewardStatusMeta` da web). */
@Composable
private fun rewardStatusMeta(game: Game): StatusMeta {
    val colors = MaterialTheme.colorScheme
    return when (game.xpRewardStatus) {
        AdminGameReviewQueueViewModel.STATUS_HELD_FOR_REVIEW -> StatusMeta(
            label = stringResource(Res.string.admin_review_queue_status_held),
            containerColor = colors.tertiaryContainer,
            contentColor = colors.onTertiaryContainer
        )
        "ELIGIBLE" -> StatusMeta(
            label = stringResource(Res.string.admin_review_queue_status_eligible),
            containerColor = colors.secondaryContainer,
            contentColor = colors.onSecondaryContainer
        )
        "REJECTED_BY_ADMIN" -> StatusMeta(
            label = stringResource(Res.string.admin_review_queue_status_rejected),
            containerColor = colors.errorContainer,
            contentColor = colors.onErrorContainer
        )
        "PROCESSED" -> StatusMeta(
            label = stringResource(Res.string.admin_review_queue_status_processed),
            containerColor = colors.primaryContainer,
            contentColor = colors.onPrimaryContainer
        )
        else -> StatusMeta(
            label = stringResource(Res.string.admin_review_queue_status_none),
            containerColor = colors.surfaceContainerHighest,
            contentColor = colors.onSurfaceVariant
        )
    }
}

/** Labels/cores dos chips de `validation_status` (paridade `getValidationStatusMeta`). */
@Composable
private fun validationStatusMeta(game: Game): StatusMeta {
    val colors = MaterialTheme.colorScheme
    return when (game.validationStatus) {
        "VALIDATED" -> StatusMeta(
            label = stringResource(Res.string.admin_review_queue_validation_validated),
            containerColor = colors.primaryContainer,
            contentColor = colors.onPrimaryContainer
        )
        "LOW_CONFIDENCE" -> StatusMeta(
            label = stringResource(Res.string.admin_review_queue_validation_low),
            containerColor = colors.tertiaryContainer,
            contentColor = colors.onTertiaryContainer
        )
        "REVIEW_REQUIRED" -> StatusMeta(
            label = stringResource(Res.string.admin_review_queue_validation_review),
            containerColor = colors.errorContainer,
            contentColor = colors.onErrorContainer
        )
        else -> StatusMeta(
            label = stringResource(Res.string.admin_review_queue_validation_none),
            containerColor = colors.surfaceContainerHighest,
            contentColor = colors.onSurfaceVariant
        )
    }
}

// ========== DIÁLOGO DE JUSTIFICATIVA (10–500) ==========

@Composable
private fun AdminReviewJustificationDialog(
    game: Game?,
    action: String,
    reason: String,
    submitting: Boolean,
    onReasonChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onSubmit: () -> Unit
) {
    val trimmedLength = reason.trim().length
    val valid = AdminGameReviewQueueViewModel.isValidReason(reason)
    val isApprove = action == AdminGameReviewQueueViewModel.ACTION_APPROVE
    AlertDialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        title = {
            Text(
                stringResource(
                    if (isApprove) {
                        Res.string.admin_review_queue_dialog_approve_title
                    } else {
                        Res.string.admin_review_queue_dialog_reject_title
                    }
                )
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = listOf(
                        game?.locationName?.ifBlank { game.id }.orEmpty(),
                        game?.let { formatGameDateTime(it) }.orEmpty()
                    ).filter { it.isNotBlank() }.joinToString(" • "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (isApprove) {
                    // Risco da spec §6: APPROVE paga XP irreversível — aviso explícito no diálogo.
                    Text(
                        text = stringResource(Res.string.admin_review_queue_approve_note),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                OutlinedTextField(
                    value = reason,
                    onValueChange = onReasonChange,
                    label = { Text(stringResource(Res.string.admin_review_queue_dialog_field_label)) },
                    placeholder = {
                        Text(stringResource(Res.string.admin_review_queue_dialog_field_placeholder))
                    },
                    minLines = 3,
                    isError = !valid && reason.isNotBlank(),
                    supportingText = {
                        Text(
                            text = if (!valid && reason.isNotBlank()) {
                                stringResource(Res.string.admin_review_queue_dialog_min)
                            } else {
                                stringResource(
                                    Res.string.admin_review_queue_dialog_counter,
                                    trimmedLength,
                                    AdminGameReviewQueueViewModel.REASON_MAX_CHARS
                                )
                            }
                        )
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = onSubmit,
                enabled = valid && !submitting,
                colors = ButtonDefaults.textButtonColors(
                    contentColor = if (isApprove) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.error
                    }
                )
            ) {
                if (submitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp
                    )
                    Spacer(Modifier.width(8.dp))
                }
                Text(
                    stringResource(
                        if (isApprove) {
                            Res.string.admin_review_queue_dialog_confirm_approve
                        } else {
                            Res.string.admin_review_queue_dialog_confirm_reject
                        }
                    )
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !submitting) {
                Text(stringResource(Res.string.cancel))
            }
        }
    )
}

// ========== BANNER DE FEEDBACK / ESTADOS ==========

@Composable
private fun AdminReviewFeedbackBanner(
    feedback: AdminReviewFeedback,
    onDismiss: () -> Unit
) {
    val (container, content, message) = when (feedback) {
        is AdminReviewFeedback.Success -> Triple(
            MaterialTheme.colorScheme.primaryContainer,
            MaterialTheme.colorScheme.onPrimaryContainer,
            stringResource(
                if (feedback.approved) {
                    Res.string.admin_review_queue_success_approve
                } else {
                    Res.string.admin_review_queue_success_reject
                }
            )
        )
        AdminReviewFeedback.AlreadyReviewed -> Triple(
            MaterialTheme.colorScheme.secondaryContainer,
            MaterialTheme.colorScheme.onSecondaryContainer,
            stringResource(Res.string.admin_review_queue_already_reviewed)
        )
        is AdminReviewFeedback.Error -> Triple(
            MaterialTheme.colorScheme.errorContainer,
            MaterialTheme.colorScheme.onErrorContainer,
            // serverMessage do backend é PT-BR e pode trazer dados dinâmicos (ex.: "N segundos"
            // do rate limit); o padrão client-side cobre SDK sem details.
            feedback.serverMessage?.takeIf { it.isNotBlank() }
                ?: stringResource(feedback.kind.errorMessageRes())
        )
    }
    Card(
        colors = CardDefaults.cardColors(
            containerColor = container,
            contentColor = content
        ),
        // Anuncia o resultado ao VoiceOver assim que aparece.
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, top = 12.dp, bottom = 12.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = onDismiss) {
                Text(stringResource(Res.string.ok))
            }
        }
    }
}

private fun AdminReviewErrorKind.errorMessageRes() = when (this) {
    AdminReviewErrorKind.UNAUTHENTICATED -> Res.string.admin_review_queue_error_unauthenticated
    AdminReviewErrorKind.PERMISSION_DENIED -> Res.string.admin_review_queue_error_permission
    AdminReviewErrorKind.RATE_LIMITED -> Res.string.admin_review_queue_error_rate_limit
    AdminReviewErrorKind.INVALID_ARGUMENT -> Res.string.admin_review_queue_error_invalid
    AdminReviewErrorKind.NOT_FOUND -> Res.string.admin_review_queue_error_not_found
    AdminReviewErrorKind.NOT_HELD -> Res.string.admin_review_queue_error_not_held
    AdminReviewErrorKind.UNAVAILABLE -> Res.string.admin_review_queue_error_unavailable
    AdminReviewErrorKind.GENERIC -> Res.string.admin_review_queue_error_generic
}

@Composable
private fun AdminReviewLoadingState() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            CircularProgressIndicator()
            Text(
                text = stringResource(Res.string.admin_review_queue_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun AdminReviewErrorState(onRetry: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = Icons.Filled.ErrorOutline,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(32.dp)
            )
            Text(
                text = stringResource(Res.string.admin_review_queue_load_error),
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }
            )
            Button(onClick = onRetry, modifier = Modifier.heightIn(min = 48.dp)) {
                Text(stringResource(Res.string.retry))
            }
        }
    }
}

@Composable
private fun AdminReviewEmptyState(hasSearchOrFilter: Boolean, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = if (hasSearchOrFilter) {
                    Icons.Filled.SearchOff
                } else {
                    Icons.Filled.GppMaybe
                },
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(40.dp)
            )
            Text(
                text = stringResource(Res.string.admin_review_queue_empty_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = stringResource(Res.string.admin_review_queue_empty_body),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

// ========== HELPERS ==========

/** Filtro + busca aplicados (paridade `filteredGames` da web). */
internal fun filteredGames(
    content: AdminReviewQueueContent,
    filter: AdminReviewQueueFilter,
    searchQuery: String
): List<Game> {
    val normalizedSearch = searchQuery.trim().lowercase()
    return content.games.filter { game ->
        val matchesFilter = when (filter) {
            AdminReviewQueueFilter.AUTO_CLOSE_REVIEW -> game.id in content.autoCloseGameIds
            AdminReviewQueueFilter.HELD_FOR_REVIEW ->
                game.xpRewardStatus == AdminGameReviewQueueViewModel.STATUS_HELD_FOR_REVIEW
            AdminReviewQueueFilter.ELIGIBLE -> game.xpRewardStatus == "ELIGIBLE"
            AdminReviewQueueFilter.REJECTED_BY_ADMIN -> game.xpRewardStatus == "REJECTED_BY_ADMIN"
        }
        if (!matchesFilter) return@filter false
        if (normalizedSearch.isEmpty()) return@filter true
        val haystack = listOf(
            game.locationName,
            game.ownerName,
            game.id,
            game.validationReasons.joinToString(" "),
            game.xpRewardHoldReasons.joinToString(" ")
        ).joinToString(" ").lowercase()
        normalizedSearch in haystack
    }
}

/** Data/hora do jogo ("26/11/2026 14:30" já formatadas no doc); "Sem data" quando ausentes. */
@Composable
private fun formatGameDateTime(game: Game): String {
    if (game.date.isBlank() && game.time.isBlank()) {
        return stringResource(Res.string.admin_review_queue_no_date)
    }
    return listOf(game.date, game.time).filter { it.isNotBlank() }.joinToString(" ")
}

/** Epoch millis → "dd/MM/yyyy HH:mm" no fuso local (paridade formatDateTime da web). */
private fun formatEpochMillis(millis: Long): String {
    val local = Instant.fromEpochMilliseconds(millis)
        .toLocalDateTime(TimeZone.currentSystemDefault())
    fun pad(value: Int) = value.toString().padStart(2, '0')
    return "${pad(local.dayOfMonth)}/${pad(local.monthNumber)}/${local.year} " +
        "${pad(local.hour)}:${pad(local.minute)}"
}
