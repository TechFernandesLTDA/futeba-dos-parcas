package com.futebadosparcas.ui.statistics

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.core.tween
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.asImage
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import com.futebadosparcas.domain.model.PlayerRankingItem
import com.futebadosparcas.domain.model.RankingCategory
import com.futebadosparcas.domain.model.RankingPeriod
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.lists.RankingItemShimmer
import com.futebadosparcas.ui.components.lists.ShimmerBox
import com.futebadosparcas.ui.components.team.TeamBadgeById
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.ui.theme.AppDimensions
import com.futebadosparcas.ui.theme.MotionDuration
import com.futebadosparcas.ui.theme.MotionEasing
import com.futebadosparcas.ui.theme.rememberReduceMotion
import com.futebadosparcas.util.ContrastHelper
import com.futebadosparcas.ui.adaptive.rememberWindowSizeClass
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RankingScreen(
    viewModel: RankingViewModel,
    onPlayerClick: (String) -> Unit = {}
) {
    val state by viewModel.rankingState.collectAsStateWithLifecycle()
    val reduceMotion = rememberReduceMotion()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Header com filtros
        RankingHeader(
            selectedCategory = state.selectedCategory,
            selectedPeriod = state.selectedPeriod,
            onCategorySelected = { viewModel.selectCategory(it) },
            onPeriodSelected = { viewModel.selectPeriod(it) }
        )

        // Content
        Box(modifier = Modifier.fillMaxSize()) {
            when {
                state.isLoading -> {
                    RankingLoadingState(modifier = Modifier.align(Alignment.Center))
                }
                state.error != null -> {
                    EmptyState(
                        type = EmptyStateType.Error(
                            title = stringResource(R.string.error),
                            description = state.error ?: stringResource(R.string.error_loading_data),
                            actionLabel = stringResource(R.string.retry),
                            onRetry = { viewModel.loadRanking() }
                        ),
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                state.rankings.isEmpty() -> {
                    EmptyState(
                        type = EmptyStateType.NoData(
                            title = stringResource(R.string.empty_state_no_ranking_title),
                            description = stringResource(R.string.empty_state_no_ranking_desc),
                            icon = Icons.Default.Leaderboard
                        ),
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                else -> {
                    AnimatedContent(
                        targetState = state.rankings,
                        transitionSpec = {
                            fadeIn(
                                animationSpec = tween(
                                    durationMillis = MotionDuration.getMedium(reduceMotion),
                                    easing = MotionEasing.Decelerate
                                )
                            ) togetherWith fadeOut(
                                animationSpec = tween(
                                    durationMillis = MotionDuration.getShort(reduceMotion),
                                    easing = MotionEasing.Accelerate
                                )
                            )
                        },
                        label = "rankingContent"
                    ) { currentRankings ->
                        RankingList(
                            rankings = currentRankings,
                            myPosition = state.myPosition,
                            category = state.selectedCategory,
                            onPlayerClick = onPlayerClick
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RankingHeader(
    selectedCategory: RankingCategory,
    selectedPeriod: RankingPeriod,
    onCategorySelected: (RankingCategory) -> Unit,
    onPeriodSelected: (RankingPeriod) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.primary)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = stringResource(R.string.statistics_rankings_general),
                    fontSize = MaterialTheme.typography.headlineSmall.fontSize,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimary
                )
                Text(
                    text = stringResource(R.string.league_ranking_title),
                    fontSize = MaterialTheme.typography.bodySmall.fontSize,
                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f)
                )
            }

            Icon(
                imageVector = Icons.Default.EmojiEvents,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.3f),
                modifier = Modifier.size(32.dp)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Category Pills (Row 1)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            RankingCategory.entries.take(4).forEach { category ->
                FilterChip(
                    selected = category == selectedCategory,
                    onClick = { onCategorySelected(category) },
                    label = { Text(getCategoryLabel(category), fontSize = MaterialTheme.typography.bodyMedium.fontSize, maxLines = 2) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.onPrimary,
                        selectedLabelColor = MaterialTheme.colorScheme.primary,
                        containerColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.2f),
                        labelColor = MaterialTheme.colorScheme.onPrimary
                    ),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Period Pills (Row 2)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            RankingPeriod.entries.forEach { period ->
                SuggestionChip(
                    onClick = { onPeriodSelected(period) },
                    label = {
                        Text(
                            getPeriodLabel(period),
                            fontSize = MaterialTheme.typography.labelSmall.fontSize,
                            fontWeight = if (period == selectedPeriod) FontWeight.Bold else FontWeight.Normal
                        )
                    },
                    colors = SuggestionChipDefaults.suggestionChipColors(
                        containerColor = if (period == selectedPeriod)
                            MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.9f)
                        else
                            MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.2f),
                        labelColor = if (period == selectedPeriod)
                            MaterialTheme.colorScheme.onSecondaryContainer
                        else
                            MaterialTheme.colorScheme.onPrimary
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun RankingList(
    rankings: List<PlayerRankingItem>,
    myPosition: Int,
    category: RankingCategory,
    onPlayerClick: (String) -> Unit
) {
    val windowSizeClass = rememberWindowSizeClass()
    val currentUserId = rememberCurrentUserId()

    // Em tablets, centraliza o conteúdo com largura máxima para legibilidade
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxHeight()
                .then(
                    if (!windowSizeClass.isCompact) {
                        Modifier.widthIn(max = windowSizeClass.contentMaxWidth)
                    } else {
                        Modifier.fillMaxWidth()
                    }
                ),
            contentPadding = PaddingValues(
                horizontal = windowSizeClass.horizontalPadding,
                vertical = 16.dp
            ),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Card com a posição do usuário (se não estiver no top 3)
            if (myPosition > 3 && myPosition > 0) {
                item {
                    MyPositionCard(
                        position = myPosition,
                        category = category,
                        rankings = rankings
                    )
                }
            }

            // Pódio dos top 3
            item {
                PodiumSection(rankings.take(3), category)
            }

            // Restante da lista
            itemsIndexed(
                items = rankings.drop(3),
                key = { _, item -> item.userId }
            ) { index, player ->
                RankingItem(
                    rank = index + 4,
                    player = player,
                    category = category,
                    isCurrentUser = player.userId == currentUserId,
                    onClick = { onPlayerClick(player.userId) }
                )
            }
        }
    }
}

@Composable
private fun PodiumSection(topPlayers: List<PlayerRankingItem>, category: RankingCategory) {
    if (topPlayers.isEmpty()) return

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .heightIn(min = 180.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.Bottom
            ) {
                // 2nd place
                if (topPlayers.size > 1) {
                    PodiumPlayer(
                        player = topPlayers[1],
                        rank = 2,
                        badgeColor = GamificationColors.Silver,
                        category = category,
                        scale = 0.85f
                    )
                }

                // 1st place
                if (topPlayers.isNotEmpty()) {
                    PodiumPlayer(
                        player = topPlayers[0],
                        rank = 1,
                        badgeColor = GamificationColors.Gold,
                        category = category,
                        scale = 1f
                    )
                }

                // 3rd place
                if (topPlayers.size > 2) {
                    PodiumPlayer(
                        player = topPlayers[2],
                        rank = 3,
                        badgeColor = GamificationColors.Bronze,
                        category = category,
                        scale = 0.75f
                    )
                }
            }
        }
    }
}

@Composable
private fun PodiumPlayer(
    player: PlayerRankingItem,
    rank: Int,
    badgeColor: Color,
    category: RankingCategory,
    scale: Float
) {
    val baseSize = 70.dp * scale
    val badgeSize = 24.dp * scale
    val fontSize = MaterialTheme.typography.bodyMedium.fontSize * scale

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(90.dp)
    ) {
        // Medal badge
        Box(
            modifier = Modifier
                .size(badgeSize)
                .clip(CircleShape)
                .background(badgeColor),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = when (rank) {
                    1 -> "1"
                    2 -> "2"
                    3 -> "3"
                    else -> "$rank"
                },
                fontSize = fontSize,
                fontWeight = FontWeight.Bold,
                color = ContrastHelper.getContrastingTextColor(badgeColor)
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Avatar
        PlayerAvatar(
            photoUrl = player.photoUrl,
            playerName = player.playerName,
            size = baseSize
        )

        Spacer(modifier = Modifier.height(4.dp))

        // Name
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = player.playerName,
                fontSize = MaterialTheme.typography.bodySmall.fontSize,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.width(4.dp))
            TeamBadgeById(
                teamId = null,
                iconSize = 18
            )
        }

        // Level badge
        if (player.level > 0) {
            LevelBadge(level = player.level)
        }

        // Value
        Text(
            text = "${player.value} ${getCategoryUnit(category)}",
            fontSize = MaterialTheme.typography.bodyMedium.fontSize,
            fontWeight = FontWeight.Bold,
            color = badgeColor
        )
    }
}

@Composable
private fun RankingItem(
    rank: Int,
    player: PlayerRankingItem,
    category: RankingCategory,
    isCurrentUser: Boolean,
    onClick: () -> Unit
) {
    val backgroundColor = when {
        isCurrentUser -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        rank <= 3 -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        else -> MaterialTheme.colorScheme.surface
    }

    val borderColor = when {
        isCurrentUser -> MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
        rank <= 3 -> getRankColor(rank).copy(alpha = 0.5f)
        else -> MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(16.dp),
        color = backgroundColor,
        tonalElevation = if (isCurrentUser) 4.dp else 1.dp,
        border = BorderStroke(1.dp, borderColor),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Rank badge
            RankBadge(rank = rank)

            Spacer(modifier = Modifier.width(12.dp))

            // Avatar
            PlayerAvatar(
                photoUrl = player.photoUrl,
                playerName = player.playerName,
                size = 48.dp
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Name e info
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = player.playerName,
                        fontSize = MaterialTheme.typography.bodyLarge.fontSize,
                        fontWeight = if (isCurrentUser) FontWeight.Bold else FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    TeamBadgeById(
                        teamId = null,
                        iconSize = 18
                    )

                    if (player.level > 0) {
                        LevelBadge(level = player.level, size = "small")
                    }
                }

                // Full name se diferente do apelido
                if (!player.nickname.isNullOrEmpty() && player.playerName != player.nickname) {
                    Text(
                        text = player.playerName,
                        fontSize = MaterialTheme.typography.labelSmall.fontSize,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Stats row
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 2.dp)
                ) {
                    Text(
                        text = stringResource(R.string.league_games_played_lower, player.gamesPlayed),
                        fontSize = MaterialTheme.typography.labelSmall.fontSize,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    if (player.average > 0) {
                        Text(
                            text = stringResource(R.string.ranking_average, String.format("%.2f", player.average)),
                            fontSize = MaterialTheme.typography.labelSmall.fontSize,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Value
            Column(
                horizontalAlignment = Alignment.End,
                modifier = Modifier.padding(start = 4.dp)
            ) {
                Text(
                    text = "${player.value}",
                    fontSize = MaterialTheme.typography.titleMedium.fontSize,
                    fontWeight = FontWeight.Bold,
                    color = when (rank) {
                        1 -> GamificationColors.Gold
                        2 -> GamificationColors.Silver
                        3 -> GamificationColors.Bronze
                        else -> MaterialTheme.colorScheme.primary
                    }
                )
                Text(
                    text = getCategoryUnit(category),
                    fontSize = MaterialTheme.typography.labelSmall.fontSize,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun RankBadge(rank: Int) {
    val backgroundColor = when (rank) {
        1 -> GamificationColors.Gold
        2 -> GamificationColors.Silver
        3 -> GamificationColors.Bronze
        else -> MaterialTheme.colorScheme.surfaceVariant
    }

    val contentColor = when (rank) {
        1, 2, 3 -> ContrastHelper.getContrastingTextColor(backgroundColor)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Box(
        modifier = Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(backgroundColor),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "$rank",
            fontSize = MaterialTheme.typography.bodyMedium.fontSize,
            fontWeight = FontWeight.Bold,
            color = contentColor
        )
    }
}

@Composable
private fun PlayerAvatar(
    photoUrl: String?,
    playerName: String,
    size: androidx.compose.ui.unit.Dp
) {
    val context = LocalContext.current
    val resources = androidx.compose.ui.platform.LocalResources.current

    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center
    ) {
        if (!photoUrl.isNullOrBlank()) {
            val placeholderImage = androidx.core.content.res.ResourcesCompat.getDrawable(
                resources,
                R.drawable.ic_person,
                context.theme
            )?.asImage()
            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(photoUrl)
                    .error(placeholderImage)
                    .placeholder(placeholderImage)
                    .build(),
                contentDescription = stringResource(R.string.player_avatar_cd, playerName),
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        } else {
            Text(
                text = playerName.take(1).uppercase(),
                fontSize = (size.value * 0.4).sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
private fun LevelBadge(level: Int, size: String = "normal") {
    val padding = if (size == "small") 2.dp else 4.dp
    val fontSize = if (size == "small") MaterialTheme.typography.labelSmall.fontSize else MaterialTheme.typography.bodySmall.fontSize
    val iconSize = if (size == "small") AppDimensions.spacing_small else 12.dp

    Surface(
        color = MaterialTheme.colorScheme.tertiaryContainer,
        contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier.height(if (size == "small") 18.dp else 20.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = padding, vertical = 1.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Star,
                contentDescription = null,
                modifier = Modifier.size(iconSize),
                tint = MaterialTheme.colorScheme.tertiary
            )
            Text(
                text = "$level",
                fontSize = fontSize,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun MyPositionCard(
    position: Int,
    category: RankingCategory,
    rankings: List<PlayerRankingItem>
) {
    // Find the current user's data
    val currentUserId = rememberCurrentUserId()
    val userData = rankings.firstOrNull { it.userId == currentUserId }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f)
        ),
        border = BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.secondary.copy(alpha = 0.3f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = stringResource(R.string.your_position),
                    tint = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = stringResource(R.string.your_position),
                    fontSize = MaterialTheme.typography.bodyMedium.fontSize,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "#$position",
                    fontSize = MaterialTheme.typography.titleLarge.fontSize,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.secondary
                )

                if (userData != null) {
                    Text(
                        text = "${userData.value} ${getCategoryUnit(category)}",
                        fontSize = MaterialTheme.typography.bodySmall.fontSize,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun RankingLoadingState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Header shimmer
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            repeat(4) {
                ShimmerBox(
                    modifier = Modifier
                        .weight(1f)
                        .height(32.dp)
                )
            }
        }

        HorizontalDivider(
            modifier = Modifier.padding(vertical = 8.dp),
            color = MaterialTheme.colorScheme.outlineVariant
        )

        // Items shimmer
        repeat(5) {
            RankingItemShimmer(
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun getCategoryLabel(category: RankingCategory): String {
    return when (category) {
        RankingCategory.GOALS -> stringResource(R.string.goals)
        RankingCategory.ASSISTS -> stringResource(R.string.assists)
        RankingCategory.SAVES -> stringResource(R.string.saves)
        RankingCategory.MVP -> stringResource(R.string.stat_mvp)
        RankingCategory.XP -> stringResource(R.string.stat_xp)
        RankingCategory.GAMES -> stringResource(R.string.games)
        RankingCategory.WINS -> stringResource(R.string.wins)
    }
}

@Composable
private fun getPeriodLabel(period: RankingPeriod): String {
    return when (period) {
        RankingPeriod.WEEK -> stringResource(R.string.week)
        RankingPeriod.MONTH -> stringResource(R.string.month)
        RankingPeriod.YEAR -> stringResource(R.string.year)
        RankingPeriod.ALL_TIME -> stringResource(R.string.all_time)
    }
}

@Composable
private fun getCategoryUnit(category: RankingCategory): String {
    return when (category) {
        RankingCategory.GOALS -> stringResource(R.string.goals).lowercase()
        RankingCategory.ASSISTS -> stringResource(R.string.assists).lowercase()
        RankingCategory.SAVES -> stringResource(R.string.saves).lowercase()
        RankingCategory.MVP -> stringResource(R.string.stat_mvp_times)
        RankingCategory.XP -> stringResource(R.string.stat_xp)
        RankingCategory.GAMES -> stringResource(R.string.games).lowercase()
        RankingCategory.WINS -> stringResource(R.string.wins).lowercase()
    }
}

@Composable
private fun getRankColor(position: Int): Color {
    return when (position) {
        1 -> GamificationColors.Gold
        2 -> GamificationColors.Silver
        3 -> GamificationColors.Bronze
        else -> MaterialTheme.colorScheme.surfaceVariant
    }
}

/**
 * Retorna o ID do usuario atual via Koin (DI), em vez de
 * FirebaseAuth.getInstance() direto no Composable (#2285).
 */
@Composable
private fun rememberCurrentUserId(): String? {
    val auth: com.google.firebase.auth.FirebaseAuth = org.koin.compose.koinInject()
    return remember(auth.currentUser?.uid) {
        runCatching { auth.currentUser?.uid }.getOrNull()
    }
}
