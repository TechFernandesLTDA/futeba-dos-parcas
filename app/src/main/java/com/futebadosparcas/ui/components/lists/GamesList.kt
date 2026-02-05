package com.futebadosparcas.ui.components.lists

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.runtime.remember
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import java.util.*

/**
 * Lista moderna de jogos com LazyColumn, pull-to-refresh, shimmer e paginação.
 *
 * Features:
 * - LazyColumn otimizada para performance
 * - Pull-to-refresh integrado (Material Design 3)
 * - Shimmer loading states
 * - Empty states personalizados
 * - Paginação automática
 * - Cards premium com visual gamificado
 *
 * @param games Lista de jogos a exibir
 * @param onGameClick Callback quando um jogo é clicado
 * @param modifier Modificador opcional
 * @param state Estado do LazyList para controle externo
 * @param isLoading Estado de carregamento inicial
 * @param isRefreshing Estado de refresh
 * @param onRefresh Callback para pull-to-refresh
 * @param hasMoreItems Indica se há mais itens para carregar
 * @param isLoadingMore Estado de paginação
 * @param onLoadMore Callback para carregar mais itens
 * @param emptyMessage Mensagem exibida quando não há jogos
 * @param emptyIcon Ícone do empty state
 * @param contentPadding Padding do conteúdo
 */
@Composable
fun GamesList(
    games: List<Game>,
    onGameClick: (Game) -> Unit,
    modifier: Modifier = Modifier,
    state: LazyListState = rememberLazyListState(),
    isLoading: Boolean = false,
    isRefreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
    hasMoreItems: Boolean = false,
    isLoadingMore: Boolean = false,
    onLoadMore: () -> Unit = {},
    emptyMessage: String = "Nenhum jogo encontrado",
    emptyIcon: @Composable () -> Unit = {
        Icon(
            imageVector = Icons.Default.SportsScore,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
        )
    },
    contentPadding: PaddingValues = PaddingValues(vertical = 8.dp)
) {
    when {
        // Estado de loading inicial
        isLoading -> {
            GamesListShimmer(
                modifier = modifier,
                itemCount = 5
            )
        }

        // Empty state
        games.isEmpty() && !isLoading && !isRefreshing -> {
            EmptyState(
                modifier = modifier,
                message = emptyMessage,
                icon = emptyIcon
            )
        }

        // Lista com dados
        else -> {
            PaginatedLazyColumn(
                modifier = modifier,
                state = state,
                isRefreshing = isRefreshing,
                onRefresh = onRefresh,
                hasMoreItems = hasMoreItems,
                isLoadingMore = isLoadingMore,
                onLoadMore = onLoadMore,
                contentPadding = contentPadding
            ) {
                items(
                    items = games,
                    key = { it.id }
                ) { game ->
                    GameCard(
                        game = game,
                        onClick = { onGameClick(game) },
                        modifier = Modifier.animateItem()
                    )
                }
            }
        }
    }
}

/**
 * Card de jogo com design premium e gamificado.
 * Otimizado para performance: consolidados Rows, remember para cálculos, extração de badges.
 */
@Composable
fun GameCard(
    game: Game,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Calcular cor de vagas apenas quando necessário
    val vacancyColor = remember(game.playersCount, game.maxPlayers) {
        when {
            game.playersCount >= game.maxPlayers -> MaterialTheme.colorScheme.error
            game.playersCount >= game.maxPlayers * 0.8 -> com.futebadosparcas.ui.theme.GameStatusColors.Warning
            else -> MaterialTheme.colorScheme.primary
        }
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Header: Data e Status (consolidado em uma Row)
            GameCardHeader(game)

            Spacer(modifier = Modifier.height(12.dp))

            // Local e Endereço (consolidado)
            GameCardLocation(game)

            Spacer(modifier = Modifier.height(12.dp))

            // Footer: Vagas e Preço (consolidado)
            GameCardFooter(game, vacancyColor)

            // Grupo (se houver)
            if (!game.groupName.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                GameCardGroupBadge(game.groupName.orEmpty())
            }
        }
    }
}

/**
 * Header do card: data/hora e status badge.
 * Consolidado em uma Row para menos composables aninhados.
 */
@Composable
private fun GameCardHeader(game: Game) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Data e horário (sem Row aninhado, direto)
        Icon(
            imageVector = Icons.Default.CalendarToday,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = "${game.date} - ${game.time}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f)
        )

        // Status badge
        GameStatusBadge(status = game.getStatusEnum())
    }
}

/**
 * Local e endereço do card.
 */
@Composable
private fun GameCardLocation(game: Game) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Default.Place,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = game.locationName.ifEmpty { "Local não definido" },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
        }

        // Endereço (indentado)
        if (game.locationAddress.isNotEmpty()) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = game.locationAddress,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(start = 24.dp)
            )
        }
    }
}

/**
 * Footer do card: vagas e preço (consolidado).
 */
@Composable
private fun GameCardFooter(game: Game, vacancyColor: Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Vagas (sem Row aninhado)
        Icon(
            imageVector = Icons.Default.People,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = "${game.playersCount}/${game.maxPlayers} jogadores",
            style = MaterialTheme.typography.bodySmall,
            color = vacancyColor,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f)
        )

        // Preço
        if (game.dailyPrice > 0) {
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.primaryContainer
            ) {
                Text(
                    text = "R$ %.2f".format(game.dailyPrice),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }
    }
}

/**
 * Badge do grupo (extras no footer).
 */
@Composable
private fun GameCardGroupBadge(groupName: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            imageVector = Icons.Default.Group,
            contentDescription = null,
            modifier = Modifier.size(14.dp),
            tint = MaterialTheme.colorScheme.tertiary
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = groupName,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.tertiary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

/**
 * Badge de status do jogo com cores e ícones apropriados.
 */
@Composable
private fun GameStatusBadge(
    status: GameStatus,
    modifier: Modifier = Modifier
) {
    val (backgroundColor, textColor, icon, text) = when (status) {
        GameStatus.SCHEDULED -> {
            Quadruple(
                MaterialTheme.colorScheme.secondary,
                MaterialTheme.colorScheme.onSecondary,
                Icons.Default.Schedule,
                "Agendado"
            )
        }
        GameStatus.CONFIRMED -> {
            Quadruple(
                MaterialTheme.colorScheme.primary,
                MaterialTheme.colorScheme.onPrimary,
                Icons.Default.CheckCircle,
                "Confirmado"
            )
        }
        GameStatus.LIVE -> {
            Quadruple(
                MaterialTheme.colorScheme.error,
                MaterialTheme.colorScheme.onError,
                Icons.Default.SportsScore,
                "Ao Vivo"
            )
        }
        GameStatus.FINISHED -> {
            Quadruple(
                MaterialTheme.colorScheme.surfaceVariant,
                MaterialTheme.colorScheme.onSurfaceVariant,
                Icons.Default.Flag,
                "Finalizado"
            )
        }
        GameStatus.CANCELLED -> {
            Quadruple(
                MaterialTheme.colorScheme.errorContainer,
                MaterialTheme.colorScheme.onErrorContainer,
                Icons.Default.Cancel,
                "Cancelado"
            )
        }
    }

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = backgroundColor
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = textColor
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = text,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = textColor
            )
        }
    }
}

/**
 * Estado de loading com shimmer para a lista de jogos.
 */
@Composable
fun GamesListShimmer(
    modifier: Modifier = Modifier,
    itemCount: Int = 5
) {
    Column(modifier = modifier.fillMaxSize()) {
        repeat(itemCount) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                GameCardShimmer()
            }
        }
    }
}

/**
 * Estado vazio para quando não há jogos.
 */
@Composable
fun EmptyState(
    message: String,
    modifier: Modifier = Modifier,
    icon: @Composable () -> Unit = {}
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            icon()

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
    }
}

/**
 * Helper class para retornar 4 valores (Kotlin não tem Quadruple nativo).
 */
private data class Quadruple<A, B, C, D>(
    val first: A,
    val second: B,
    val third: C,
    val fourth: D
)
