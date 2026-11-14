package com.futebadosparcas.ui.core

import com.futebadosparcas.compose.di.koinInjectOrNull
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.domain.model.BadgeDefinition
import com.futebadosparcas.domain.model.CashboxEntry
import com.futebadosparcas.domain.model.CashboxSummary
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.domain.model.PlayerRankingItem
import com.futebadosparcas.domain.model.RankingCategory
import com.futebadosparcas.domain.repository.CashboxRepository
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.RankingRepository
import com.futebadosparcas.ui.adaptive.AdaptiveTopBar
import com.futebadosparcas.compose.resources.Res
import com.futebadosparcas.compose.resources.back
import com.futebadosparcas.compose.resources.report_action_player_cd
import androidx.compose.material3.OutlinedButton
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import com.futebadosparcas.compose.resources.badges_route_count
import com.futebadosparcas.compose.resources.badges_route_earned_section
import com.futebadosparcas.compose.resources.badges_route_empty_body
import com.futebadosparcas.compose.resources.badges_route_empty_title
import com.futebadosparcas.compose.resources.badges_route_intro_body
import com.futebadosparcas.compose.resources.badges_route_load_error
import com.futebadosparcas.compose.resources.badges_route_locked_cd
import com.futebadosparcas.compose.resources.badges_route_locked_section
import com.futebadosparcas.compose.resources.badges_route_progress
import com.futebadosparcas.compose.resources.badges_route_title
import com.futebadosparcas.compose.resources.badges_route_unavailable
import com.futebadosparcas.compose.resources.route_unavailable_retry
import androidx.compose.material.icons.filled.QueryStats
import androidx.compose.ui.text.style.TextAlign
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.compose.resources.player_stats_assists
import com.futebadosparcas.compose.resources.player_stats_cards
import com.futebadosparcas.compose.resources.player_stats_cards_value
import com.futebadosparcas.compose.resources.player_stats_draws
import com.futebadosparcas.compose.resources.player_stats_empty_body_mine
import com.futebadosparcas.compose.resources.player_stats_empty_body_other
import com.futebadosparcas.compose.resources.player_stats_empty_title
import com.futebadosparcas.compose.resources.player_stats_games
import com.futebadosparcas.compose.resources.player_stats_goals
import com.futebadosparcas.compose.resources.player_stats_goals_per_game
import com.futebadosparcas.compose.resources.player_stats_load_error
import com.futebadosparcas.compose.resources.player_stats_losses
import com.futebadosparcas.compose.resources.player_stats_missing
import com.futebadosparcas.compose.resources.player_stats_mvps
import com.futebadosparcas.compose.resources.player_stats_saves
import com.futebadosparcas.compose.resources.player_stats_section_attack
import com.futebadosparcas.compose.resources.player_stats_section_more
import com.futebadosparcas.compose.resources.player_stats_section_results
import com.futebadosparcas.compose.resources.player_stats_title_mine
import com.futebadosparcas.compose.resources.player_stats_win_rate
import com.futebadosparcas.compose.resources.player_stats_wins
import com.futebadosparcas.compose.resources.route_owner_stats_title
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.koinInject

private sealed interface RouteLoadState<out T> {
    data object Loading : RouteLoadState<Nothing>
    data class Success<T>(val data: T) : RouteLoadState<T>
    data class Error(val message: String) : RouteLoadState<Nothing>
}

@Composable
fun RankingRouteScreen(
    onNavigateBack: () -> Unit,
    currentUserId: String? = null,
    onSubmitReport: (suspend (targetId: String, targetName: String, reasonCode: String, details: String) -> ReportOutcome)? = null,
    onBlockReported: (suspend (targetId: String, targetName: String) -> Boolean)? = null,
) {
    var reportTarget by remember { mutableStateOf<PlayerRankingItem?>(null) }
    val repository: RankingRepository? = koinInjectOrNull<RankingRepository>()
    var state by remember(repository) {
        mutableStateOf<RouteLoadState<List<PlayerRankingItem>>>(RouteLoadState.Loading)
    }

    LaunchedEffect(repository) {
        state = if (repository == null) {
            RouteLoadState.Error("Ranking indisponível neste ambiente.")
        } else {
            repository.getRanking(RankingCategory.GOALS, limit = 10).fold(
                onSuccess = { RouteLoadState.Success(it) },
                onFailure = { RouteLoadState.Error(it.message ?: "Não foi possível carregar o ranking.") }
            )
        }
    }

    OverviewScaffold(
        title = "Ranking",
        onNavigateBack = onNavigateBack
    ) { paddingValues ->
        OverviewBody(
            paddingValues = paddingValues,
            state = state
        ) { ranking ->
            LazyColumn(
                modifier = Modifier.fillMaxSize().widthIn(max = 880.dp),
                contentPadding = PaddingValues(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    OverviewIntro(
                        icon = Icons.Default.EmojiEvents,
                        title = "Artilheiros",
                        body = "Top 10 jogadores por gols no histórico."
                    )
                }
                items(ranking, key = { it.userId }) { item ->
                    OverviewCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "#${item.rank}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(16.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.nickname ?: item.playerName,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = "${item.gamesPlayed} jogos",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text(
                                text = item.value.toString(),
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold
                            )
                            if (onSubmitReport != null && item.userId != currentUserId) {
                                val playerName = item.nickname ?: item.playerName
                                IconButton(onClick = { reportTarget = item }) {
                                    Icon(
                                        imageVector = Icons.Default.Flag,
                                        contentDescription = stringResource(
                                            Res.string.report_action_player_cd,
                                            playerName
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    val target = reportTarget
    if (target != null && onSubmitReport != null) {
        val targetName = target.nickname ?: target.playerName
        ReportDialog(
            targetType = ReportTargetType.PLAYER,
            targetName = targetName,
            onDismiss = { reportTarget = null },
            onSubmit = { reason, details -> onSubmitReport(target.userId, targetName, reason, details) },
            onBlock = onBlockReported?.let { block -> { block(target.userId, targetName) } },
        )
    }
}

@Composable
fun BadgesRouteScreen(
    currentUserId: String?,
    onNavigateBack: () -> Unit
) {
    val repository: GamificationRepository? = koinInjectOrNull<GamificationRepository>()
    var retryKey by remember { mutableStateOf(0) }
    var state by remember(repository, currentUserId, retryKey) {
        mutableStateOf<RouteLoadState<BadgeCollection>>(RouteLoadState.Loading)
    }
    val unavailableMessage = stringResource(Res.string.badges_route_unavailable)
    val loadErrorMessage = stringResource(Res.string.badges_route_load_error)

    // As conquistas do jogador ficam em `user_badges` (gravadas pelas Cloud Functions).
    // A coleção raiz `badges` está vazia em produção, por isso a tela antiga ficava sem itens.
    LaunchedEffect(repository, currentUserId, retryKey) {
        state = when {
            repository == null || currentUserId.isNullOrBlank() -> RouteLoadState.Error(unavailableMessage)
            else -> repository.getUserBadges(currentUserId).fold(
                onSuccess = { RouteLoadState.Success(buildBadgeCollection(it)) },
                onFailure = { RouteLoadState.Error(loadErrorMessage) }
            )
        }
    }

    OverviewScaffold(
        title = stringResource(Res.string.badges_route_title),
        onNavigateBack = onNavigateBack
    ) { paddingValues ->
        OverviewBody(
            paddingValues = paddingValues,
            state = state,
            onRetry = { retryKey += 1 }
        ) { collection ->
            LazyColumn(
                modifier = Modifier.fillMaxSize().widthIn(max = 880.dp),
                contentPadding = PaddingValues(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    OverviewIntro(
                        icon = Icons.Default.MilitaryTech,
                        title = stringResource(
                            Res.string.badges_route_progress,
                            collection.earned.size,
                            collection.earned.size + collection.locked.size
                        ),
                        body = stringResource(Res.string.badges_route_intro_body)
                    )
                }
                item {
                    BadgeSectionTitle(stringResource(Res.string.badges_route_earned_section))
                }
                if (collection.earned.isEmpty()) {
                    item {
                        OverviewCard {
                            Text(
                                text = stringResource(Res.string.badges_route_empty_title),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = stringResource(Res.string.badges_route_empty_body),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    items(collection.earned, key = { "earned_${it.definition.id}" }) { earned ->
                        BadgeRow(
                            badge = earned.definition,
                            trailing = if (earned.count > 1) {
                                stringResource(Res.string.badges_route_count, earned.count)
                            } else {
                                earned.definition.rarity.displayName
                            },
                            unlocked = true
                        )
                    }
                }
                if (collection.locked.isNotEmpty()) {
                    item {
                        BadgeSectionTitle(stringResource(Res.string.badges_route_locked_section))
                    }
                    items(collection.locked, key = { "locked_${it.id}" }) { badge ->
                        BadgeRow(
                            badge = badge,
                            trailing = badge.rarity.displayName,
                            unlocked = false
                        )
                    }
                }
            }
        }
    }
}

/**
 * Estatísticas de um jogador no iOS, lidas de `statistics/{uid}` (gravado pelas Cloud Functions).
 * Antes esta rota mostrava só um aviso fixo de "ainda não disponível no iPhone".
 */
@Composable
fun PlayerStatsRouteScreen(
    userId: String?,
    isCurrentUser: Boolean,
    onNavigateBack: () -> Unit
) {
    val repository: StatisticsRepository? = koinInjectOrNull<StatisticsRepository>()
    var retryKey by remember { mutableStateOf(0) }
    var state by remember(repository, userId, retryKey) {
        mutableStateOf<RouteLoadState<PlayerStatsSummary>>(RouteLoadState.Loading)
    }
    val missingMessage = stringResource(Res.string.player_stats_missing)
    val loadErrorMessage = stringResource(Res.string.player_stats_load_error)

    LaunchedEffect(repository, userId, retryKey) {
        state = when {
            repository == null || userId.isNullOrBlank() -> RouteLoadState.Error(missingMessage)
            else -> repository.getUserStatistics(userId).fold(
                onSuccess = { RouteLoadState.Success(buildPlayerStatsSummary(it)) },
                onFailure = { RouteLoadState.Error(loadErrorMessage) }
            )
        }
    }

    OverviewScaffold(
        title = stringResource(
            if (isCurrentUser) Res.string.player_stats_title_mine else Res.string.route_owner_stats_title
        ),
        onNavigateBack = onNavigateBack
    ) { paddingValues ->
        OverviewBody(
            paddingValues = paddingValues,
            state = state,
            onRetry = { retryKey += 1 }
        ) { summary ->
            LazyColumn(
                modifier = Modifier.fillMaxSize().widthIn(max = 880.dp),
                contentPadding = PaddingValues(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (summary.isEmpty) {
                    item {
                        OverviewIntro(
                            icon = Icons.Default.QueryStats,
                            title = stringResource(Res.string.player_stats_empty_title),
                            body = stringResource(
                                if (isCurrentUser) Res.string.player_stats_empty_body_mine
                                else Res.string.player_stats_empty_body_other
                            )
                        )
                    }
                } else {
                    item {
                        OverviewIntro(
                            icon = Icons.Default.QueryStats,
                            title = stringResource(Res.string.player_stats_games, summary.games),
                            body = stringResource(Res.string.player_stats_win_rate, summary.winRatePercent)
                        )
                    }
                    item {
                        StatTilesCard(
                            title = stringResource(Res.string.player_stats_section_results),
                            tiles = listOf(
                                stringResource(Res.string.player_stats_wins) to summary.wins.toString(),
                                stringResource(Res.string.player_stats_draws) to summary.draws.toString(),
                                stringResource(Res.string.player_stats_losses) to summary.losses.toString()
                            )
                        )
                    }
                    item {
                        StatTilesCard(
                            title = stringResource(Res.string.player_stats_section_attack),
                            tiles = listOf(
                                stringResource(Res.string.player_stats_goals) to summary.goals.toString(),
                                stringResource(Res.string.player_stats_assists) to summary.assists.toString(),
                                stringResource(Res.string.player_stats_goals_per_game) to formatOneDecimal(summary.goalsPerGame)
                            )
                        )
                    }
                    item {
                        StatTilesCard(
                            title = stringResource(Res.string.player_stats_section_more),
                            tiles = listOf(
                                stringResource(Res.string.player_stats_saves) to summary.saves.toString(),
                                stringResource(Res.string.player_stats_mvps) to summary.mvps.toString(),
                                stringResource(Res.string.player_stats_cards) to
                                    stringResource(Res.string.player_stats_cards_value, summary.yellowCards, summary.redCards)
                            )
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StatTilesCard(
    title: String,
    tiles: List<Pair<String, String>>
) {
    OverviewCard {
        BadgeSectionTitle(title)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            tiles.forEach { (label, value) ->
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .semantics(mergeDescendants = true) {},
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = value,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        maxLines = 1
                    )
                    Text(
                        text = label,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
private fun BadgeSectionTitle(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.onSurface,
        modifier = Modifier
            .padding(top = 4.dp)
            .semantics { heading() }
    )
}

@Composable
private fun BadgeRow(
    badge: BadgeDefinition,
    trailing: String,
    unlocked: Boolean
) {
    val lockedLabel = stringResource(Res.string.badges_route_locked_cd)
    OverviewCard(
        modifier = Modifier
            .alpha(if (unlocked) 1f else 0.6f)
            .semantics(mergeDescendants = true) {
                if (!unlocked) stateDescription = lockedLabel
            }
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = badge.emoji,
                style = MaterialTheme.typography.headlineSmall
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = badge.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                if (badge.description.isNotBlank()) {
                    Text(
                        text = badge.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = trailing,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
fun LocationsRouteScreen(onNavigateBack: () -> Unit) {
    val repository: LocationRepository? = koinInjectOrNull<LocationRepository>()
    var state by remember(repository) {
        mutableStateOf<RouteLoadState<List<Location>>>(RouteLoadState.Loading)
    }

    LaunchedEffect(repository) {
        state = if (repository == null) {
            RouteLoadState.Error("Locais indisponíveis neste ambiente.")
        } else {
            repository.getAllLocations().fold(
                onSuccess = { RouteLoadState.Success(it.take(20)) },
                onFailure = { RouteLoadState.Error(it.message ?: "Não foi possível carregar os locais.") }
            )
        }
    }

    OverviewScaffold(
        title = "Locais",
        onNavigateBack = onNavigateBack
    ) { paddingValues ->
        OverviewBody(
            paddingValues = paddingValues,
            state = state
        ) { locations ->
            LazyColumn(
                modifier = Modifier.fillMaxSize().widthIn(max = 880.dp),
                contentPadding = PaddingValues(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    OverviewIntro(
                        icon = Icons.Default.LocationOn,
                        title = "Descoberta",
                        body = "Locais ativos cadastrados para partidas e reservas."
                    )
                }
                items(locations, key = { it.id }) { location ->
                    OverviewCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Place,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(16.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = location.name,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = location.getFullAddress(),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
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
fun CashboxRouteScreen(
    groupId: String?,
    onNavigateBack: () -> Unit
) {
    val repository: CashboxRepository? = koinInjectOrNull<CashboxRepository>()
    var state by remember(repository, groupId) {
        mutableStateOf<RouteLoadState<Pair<CashboxSummary, List<CashboxEntry>>>>(RouteLoadState.Loading)
    }

    LaunchedEffect(repository, groupId) {
        state = when {
            groupId.isNullOrBlank() -> RouteLoadState.Error("Selecione um grupo antes de abrir o caixa.")
            repository == null -> RouteLoadState.Error("Caixa indisponível neste ambiente.")
            else -> {
                val summary = repository.getSummary(groupId)
                val history = repository.getHistory(groupId, limit = 10)
                if (summary.isSuccess && history.isSuccess) {
                    RouteLoadState.Success(summary.getOrThrow() to history.getOrThrow())
                } else {
                    val error = summary.exceptionOrNull() ?: history.exceptionOrNull()
                    RouteLoadState.Error(error?.message ?: "Não foi possível carregar o caixa.")
                }
            }
        }
    }

    OverviewScaffold(
        title = "Caixa",
        onNavigateBack = onNavigateBack
    ) { paddingValues ->
        OverviewBody(
            paddingValues = paddingValues,
            state = state
        ) { (summary, history) ->
            LazyColumn(
                modifier = Modifier.fillMaxSize().widthIn(max = 880.dp),
                contentPadding = PaddingValues(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    OverviewIntro(
                        icon = Icons.Default.AttachMoney,
                        title = "Resumo financeiro",
                        body = "Saldo, receitas e últimas movimentações do grupo."
                    )
                }
                item {
                    OverviewCard {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            CashboxMetric("Saldo", formatCurrency(summary.balance))
                            CashboxMetric("Receitas", formatCurrency(summary.totalIncome))
                            CashboxMetric("Despesas", formatCurrency(summary.totalExpense))
                            CashboxMetric("Entradas", summary.entryCount.toString())
                        }
                    }
                }
                items(history, key = { it.id }) { entry ->
                    OverviewCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = entry.getCategoryDisplayName(),
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = entry.description.ifBlank { "Sem descrição" },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text(
                                text = formatCurrency(entry.getSignedAmount()),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (entry.isIncome()) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.error
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OverviewScaffold(
    title: String,
    onNavigateBack: () -> Unit,
    content: @Composable (PaddingValues) -> Unit
) {
    Scaffold(
        topBar = {
            AdaptiveTopBar(
                title = title,
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(Res.string.back)
                        )
                    }
                }
            )
        },
        content = content
    )
}

@Composable
private fun <T> OverviewBody(
    paddingValues: PaddingValues,
    state: RouteLoadState<T>,
    onRetry: (() -> Unit)? = null,
    success: @Composable (T) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(horizontal = 20.dp, vertical = 16.dp),
        contentAlignment = Alignment.TopCenter
    ) {
        when (state) {
            RouteLoadState.Loading -> CircularProgressIndicator(modifier = Modifier.padding(top = 32.dp))
            is RouteLoadState.Error -> OverviewCard(modifier = Modifier.widthIn(max = 880.dp)) {
                Text(
                    text = state.message,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.error
                )
                if (onRetry != null) {
                    OutlinedButton(onClick = onRetry) {
                        Text(stringResource(Res.string.route_unavailable_retry))
                    }
                }
            }
            is RouteLoadState.Success -> success(state.data)
        }
    }
}

@Composable
private fun OverviewIntro(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    body: String
) {
    OverviewCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = body,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun OverviewCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            content = content
        )
    }
}

@Composable
private fun CashboxMetric(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
    }
}

private fun formatCurrency(amount: Double): String {
    val signal = if (amount < 0) "-" else ""
    val normalized = kotlin.math.abs(amount)
    val whole = normalized.toLong()
    val cents = ((normalized - whole) * 100).toInt().coerceIn(0, 99)
    return "$signal R$ $whole,${cents.toString().padStart(2, '0')}"
}
