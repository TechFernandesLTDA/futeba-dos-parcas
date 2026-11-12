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
fun BadgesRouteScreen(onNavigateBack: () -> Unit) {
    val repository: GamificationRepository? = koinInjectOrNull<GamificationRepository>()
    var state by remember(repository) {
        mutableStateOf<RouteLoadState<List<BadgeDefinition>>>(RouteLoadState.Loading)
    }

    LaunchedEffect(repository) {
        state = if (repository == null) {
            RouteLoadState.Error("Badges indisponíveis neste ambiente.")
        } else {
            repository.getAvailableBadges().fold(
                onSuccess = { RouteLoadState.Success(it) },
                onFailure = { RouteLoadState.Error(it.message ?: "Não foi possível carregar os badges.") }
            )
        }
    }

    OverviewScaffold(
        title = "Badges",
        onNavigateBack = onNavigateBack
    ) { paddingValues ->
        OverviewBody(
            paddingValues = paddingValues,
            state = state
        ) { badges ->
            LazyColumn(
                modifier = Modifier.fillMaxSize().widthIn(max = 880.dp),
                contentPadding = PaddingValues(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    OverviewIntro(
                        icon = Icons.Default.MilitaryTech,
                        title = "Coleção de conquistas",
                        body = "Badges disponíveis para progressão e reconhecimento."
                    )
                }
                items(badges, key = { it.id }) { badge ->
                    OverviewCard {
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
                                Text(
                                    text = badge.description,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text(
                                text = badge.rarity.displayName,
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }
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
