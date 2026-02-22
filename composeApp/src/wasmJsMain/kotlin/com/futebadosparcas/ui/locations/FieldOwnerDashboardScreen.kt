package com.futebadosparcas.ui.locations

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.ui.components.ShimmerCard
import kotlin.math.roundToInt

private data class FieldOwnerMetrics(
    val gamesThisMonth: Int = 0,
    val totalRevenue: Double = 0.0,
    val averageOccupancy: Int = 0,
    val pendingReservations: Int = 0,
    val confirmedGames: Int = 0,
    val averageRating: Double = 0.0,
    val totalReviews: Int = 0
)

private data class HourlyOccupancy(
    val hour: String,
    val occupancyPercent: Int,
    val gamesCount: Int
)

private data class Reservation(
    val id: String,
    val groupName: String,
    val date: String,
    val time: String,
    val status: ReservationStatus,
    val price: Double
)

private data class Review(
    val id: String,
    val userName: String,
    val rating: Int,
    val comment: String,
    val date: String
)

private data class RevenueData(
    val period: String,
    val amount: Double,
    val gamesCount: Int
)

private enum class ReservationStatus {
    PENDING, CONFIRMED, CANCELLED
}

private sealed class FieldOwnerUiState {
    object Loading : FieldOwnerUiState()
    data class Success(
        val metrics: FieldOwnerMetrics,
        val hourlyOccupancy: List<HourlyOccupancy>,
        val pendingReservations: List<Reservation>,
        val confirmedGames: List<Reservation>,
        val recentReviews: List<Review>,
        val revenueByPeriod: List<RevenueData>
    ) : FieldOwnerUiState()
    data class Error(val message: String) : FieldOwnerUiState()
}

private fun formatCurrency(value: Double): String {
    val rounded = value.roundToInt()
    return "R$ $rounded"
}

private fun formatCurrencyPrecise(value: Double): String {
    val rounded = (value * 100).roundToInt() / 100.0
    return "R$ $rounded"
}

private fun formatRating(value: Double): String {
    return ((value * 10).roundToInt() / 10.0).toString()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FieldOwnerDashboardScreen(
    fieldId: String = "",
    onNavigateBack: () -> Unit = {},
    onNavigateToSchedule: () -> Unit = {},
    onNavigateToAddTimeSlot: () -> Unit = {}
) {
    var uiState by remember { mutableStateOf<FieldOwnerUiState>(FieldOwnerUiState.Loading) }
    var selectedPeriod by remember { mutableStateOf("week") }

    LaunchedEffect(fieldId) {
        uiState = FieldOwnerUiState.Success(
            metrics = FieldOwnerMetrics(
                gamesThisMonth = 47,
                totalRevenue = 4250.00,
                averageOccupancy = 78,
                pendingReservations = 5,
                confirmedGames = 12,
                averageRating = 4.7,
                totalReviews = 89
            ),
            hourlyOccupancy = listOf(
                HourlyOccupancy("06:00", 45, 3),
                HourlyOccupancy("08:00", 72, 5),
                HourlyOccupancy("10:00", 85, 6),
                HourlyOccupancy("12:00", 90, 7),
                HourlyOccupancy("14:00", 95, 8),
                HourlyOccupancy("16:00", 88, 7),
                HourlyOccupancy("18:00", 100, 8),
                HourlyOccupancy("20:00", 92, 7),
                HourlyOccupancy("22:00", 65, 4)
            ),
            pendingReservations = listOf(
                Reservation("1", "Pelada dos Amigos", "25/02", "18:00", ReservationStatus.PENDING, 150.00),
                Reservation("2", "Time do João", "26/02", "20:00", ReservationStatus.PENDING, 120.00),
                Reservation("3", "Futebol Clube", "27/02", "16:00", ReservationStatus.PENDING, 150.00),
                Reservation("4", "Galera da Firma", "28/02", "12:00", ReservationStatus.PENDING, 180.00),
                Reservation("5", "Amigos do Bairro", "01/03", "14:00", ReservationStatus.PENDING, 150.00)
            ),
            confirmedGames = listOf(
                Reservation("6", "Pelada do Sábado", "23/02", "10:00", ReservationStatus.CONFIRMED, 150.00),
                Reservation("7", "Time da Esquina", "23/02", "14:00", ReservationStatus.CONFIRMED, 120.00),
                Reservation("8", "Futebol Feminino", "24/02", "09:00", ReservationStatus.CONFIRMED, 100.00),
                Reservation("9", "Veteranos FC", "24/02", "16:00", ReservationStatus.CONFIRMED, 150.00)
            ),
            recentReviews = listOf(
                Review("1", "Carlos Silva", 5, "Quadra excelente! Bem cuidada e iluminação perfeita.", "22/02"),
                Review("2", "André Santos", 4, "Muito boa, só achei o vestiário um pouco pequeno.", "21/02"),
                Review("3", "Pedro Lima", 5, "Melhor quadra da região! Recomendo muito.", "20/02"),
                Review("4", "Lucas Ferreira", 5, "Gramado impecável. Vontade de voltar sempre!", "19/02")
            ),
            revenueByPeriod = listOf(
                RevenueData("Semana 1", 1200.00, 15),
                RevenueData("Semana 2", 1450.00, 18),
                RevenueData("Semana 3", 1600.00, 14),
                RevenueData("Semana 4", 1100.00, 10)
            )
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "🏟️ Dashboard do Campo",
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Text("←", style = MaterialTheme.typography.titleLarge)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is FieldOwnerUiState.Loading -> FieldOwnerLoadingShimmer()
                is FieldOwnerUiState.Success -> FieldOwnerDashboardContent(
                    metrics = state.metrics,
                    hourlyOccupancy = state.hourlyOccupancy,
                    pendingReservations = state.pendingReservations,
                    confirmedGames = state.confirmedGames,
                    recentReviews = state.recentReviews,
                    revenueByPeriod = state.revenueByPeriod,
                    selectedPeriod = selectedPeriod,
                    onPeriodChange = { selectedPeriod = it },
                    onNavigateToSchedule = onNavigateToSchedule,
                    onNavigateToAddTimeSlot = onNavigateToAddTimeSlot
                )
                is FieldOwnerUiState.Error -> ErrorState(
                    message = state.message,
                    onRetry = { uiState = FieldOwnerUiState.Loading },
                    emoji = "❌"
                )
            }
        }
    }
}

@Composable
private fun FieldOwnerDashboardContent(
    metrics: FieldOwnerMetrics,
    hourlyOccupancy: List<HourlyOccupancy>,
    pendingReservations: List<Reservation>,
    confirmedGames: List<Reservation>,
    recentReviews: List<Review>,
    revenueByPeriod: List<RevenueData>,
    selectedPeriod: String,
    onPeriodChange: (String) -> Unit,
    onNavigateToSchedule: () -> Unit,
    onNavigateToAddTimeSlot: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item(key = "metrics_row1") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                MetricCard(
                    modifier = Modifier.weight(1f),
                    emoji = "⚽",
                    title = "Jogos no Mês",
                    value = metrics.gamesThisMonth.toString(),
                    subtitle = "${metrics.confirmedGames} confirmados",
                    color = Color(0xFF4CAF50)
                )
                MetricCard(
                    modifier = Modifier.weight(1f),
                    emoji = "💰",
                    title = "Receita",
                    value = formatCurrency(metrics.totalRevenue),
                    subtitle = "Este mês",
                    color = Color(0xFF2196F3)
                )
            }
        }

        item(key = "metrics_row2") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                MetricCard(
                    modifier = Modifier.weight(1f),
                    emoji = "📊",
                    title = "Ocupação Média",
                    value = "${metrics.averageOccupancy}%",
                    subtitle = "Este mês",
                    color = Color(0xFFFF9800)
                )
                MetricCard(
                    modifier = Modifier.weight(1f),
                    emoji = "⭐",
                    title = "Avaliação",
                    value = formatRating(metrics.averageRating),
                    subtitle = "${metrics.totalReviews} avaliações",
                    color = Color(0xFFFFC107)
                )
            }
        }

        item(key = "hourly_chart") {
            HourlyOccupancyCard(hourlyOccupancy = hourlyOccupancy)
        }

        item(key = "revenue_chart") {
            RevenueByPeriodCard(
                revenueByPeriod = revenueByPeriod,
                selectedPeriod = selectedPeriod,
                onPeriodChange = onPeriodChange
            )
        }

        item(key = "quick_actions") {
            QuickActionsCard(
                pendingReservations = metrics.pendingReservations,
                onNavigateToSchedule = onNavigateToSchedule,
                onNavigateToAddTimeSlot = onNavigateToAddTimeSlot
            )
        }

        item(key = "pending_reservations") {
            PendingReservationsCard(
                reservations = pendingReservations,
                onApprove = { },
                onReject = { }
            )
        }

        item(key = "confirmed_games") {
            ConfirmedGamesCard(
                games = confirmedGames,
                onGameClick = { }
            )
        }

        item(key = "recent_reviews") {
            RecentReviewsCard(reviews = recentReviews)
        }

        item(key = "spacer") {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun MetricCard(
    modifier: Modifier = Modifier,
    emoji: String,
    title: String,
    value: String,
    subtitle: String,
    color: Color
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = emoji,
                style = MaterialTheme.typography.headlineMedium
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = color
            )
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun HourlyOccupancyCard(
    hourlyOccupancy: List<HourlyOccupancy>
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "📈 Ocupação por Horário",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Hoje",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(hourlyOccupancy) { data ->
                    HourlyBar(
                        hour = data.hour,
                        occupancy = data.occupancyPercent,
                        gamesCount = data.gamesCount
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                LegendItem(color = Color(0xFF4CAF50), label = "Alta (80%+)")
                LegendItem(color = Color(0xFFFF9800), label = "Média (50-79%)")
                LegendItem(color = Color(0xFFF44336), label = "Baixa (<50%)")
            }
        }
    }
}

@Composable
private fun HourlyBar(
    hour: String,
    occupancy: Int,
    gamesCount: Int
) {
    val barHeight = 100
    val fillHeight = (occupancy / 100f) * barHeight
    val color = when {
        occupancy >= 80 -> Color(0xFF4CAF50)
        occupancy >= 50 -> Color(0xFFFF9800)
        else -> Color(0xFFF44336)
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = gamesCount.toString(),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = color
        )
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .width(32.dp)
                .height(barHeight.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.BottomCenter
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(fillHeight.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(color)
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = hour,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(color)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun RevenueByPeriodCard(
    revenueByPeriod: List<RevenueData>,
    selectedPeriod: String,
    onPeriodChange: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "💵 Receita por Período",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    listOf("week" to "Semana", "month" to "Mês").forEach { (key, label) ->
                        FilterChip(
                            selected = selectedPeriod == key,
                            onClick = { onPeriodChange(key) },
                            label = { Text(label, fontSize = 12.sp) }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            val maxRevenue = revenueByPeriod.maxOfOrNull { it.amount } ?: 1.0

            revenueByPeriod.forEach { data ->
                RevenueBar(
                    period = data.period,
                    amount = data.amount,
                    gamesCount = data.gamesCount,
                    maxAmount = maxRevenue
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            Spacer(modifier = Modifier.height(8.dp))

            val totalRevenue = revenueByPeriod.sumOf { it.amount }
            val totalGames = revenueByPeriod.sumOf { it.gamesCount }

            HorizontalDivider()
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "Total",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = formatCurrencyPrecise(totalRevenue),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF4CAF50)
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "Jogos",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = totalGames.toString(),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun RevenueBar(
    period: String,
    amount: Double,
    gamesCount: Int,
    maxAmount: Double
) {
    val fillPercent = (amount / maxAmount).toFloat().coerceIn(0f, 1f)

    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = period,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "${formatCurrency(amount)} ($gamesCount jogos)",
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Medium
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fillPercent)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(4.dp))
                    .background(MaterialTheme.colorScheme.primary)
            )
        }
    }
}

@Composable
private fun QuickActionsCard(
    pendingReservations: Int,
    onNavigateToSchedule: () -> Unit,
    onNavigateToAddTimeSlot: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "⚡ Ações Rápidas",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                QuickActionButton(
                    modifier = Modifier.weight(1f),
                    emoji = "🕐",
                    title = "Adicionar Horário",
                    onClick = onNavigateToAddTimeSlot
                )
                QuickActionButton(
                    modifier = Modifier.weight(1f),
                    emoji = "📅",
                    title = "Ver Agenda",
                    onClick = onNavigateToSchedule
                )
                QuickActionButton(
                    modifier = Modifier.weight(1f),
                    emoji = "📋",
                    title = "Reservas",
                    badge = if (pendingReservations > 0) pendingReservations.toString() else null,
                    onClick = { }
                )
                QuickActionButton(
                    modifier = Modifier.weight(1f),
                    emoji = "⚙️",
                    title = "Configurar",
                    onClick = { }
                )
            }
        }
    }
}

@Composable
private fun QuickActionButton(
    modifier: Modifier = Modifier,
    emoji: String,
    title: String,
    badge: String? = null,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp, horizontal = 8.dp)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                Box {
                    Text(
                        text = emoji,
                        style = MaterialTheme.typography.headlineSmall
                    )
                    if (badge != null) {
                        Surface(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .offset(x = 8.dp, y = (-4).dp),
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.error
                        ) {
                            Text(
                                text = badge,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onError,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun PendingReservationsCard(
    reservations: List<Reservation>,
    onApprove: (String) -> Unit,
    onReject: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "⏳ Reservas Pendentes",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                if (reservations.isNotEmpty()) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.errorContainer
                    ) {
                        Text(
                            text = "${reservations.size}",
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (reservations.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("✅", style = MaterialTheme.typography.headlineMedium)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Nenhuma reserva pendente",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                reservations.forEach { reservation ->
                    ReservationItem(
                        reservation = reservation,
                        onApprove = { onApprove(reservation.id) },
                        onReject = { onReject(reservation.id) }
                    )
                    if (reservation != reservations.last()) {
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun ReservationItem(
    reservation: Reservation,
    onApprove: () -> Unit,
    onReject: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = reservation.groupName,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "📅 ${reservation.date}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "⏰ ${reservation.time}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Text(
            text = formatCurrency(reservation.price),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF4CAF50)
        )

        Spacer(modifier = Modifier.width(8.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            IconButton(
                onClick = onApprove,
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF4CAF50).copy(alpha = 0.1f))
            ) {
                Text("✓", color = Color(0xFF4CAF50), fontSize = 16.sp)
            }
            IconButton(
                onClick = onReject,
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.error.copy(alpha = 0.1f))
            ) {
                Text("✗", color = MaterialTheme.colorScheme.error, fontSize = 16.sp)
            }
        }
    }
}

@Composable
private fun ConfirmedGamesCard(
    games: List<Reservation>,
    onGameClick: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "✅ Jogos Confirmados",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                TextButton(onClick = { }) {
                    Text("Ver todos →")
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (games.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("📭", style = MaterialTheme.typography.headlineMedium)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Nenhum jogo confirmado",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                games.take(4).forEach { game ->
                    ConfirmedGameItem(
                        game = game,
                        onClick = { onGameClick(game.id) }
                    )
                    if (game != games.take(4).last()) {
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun ConfirmedGameItem(
    game: Reservation,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Text("⚽", fontSize = 20.sp)
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = game.groupName,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "📅 ${game.date}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "⏰ ${game.time}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Text(
                text = formatCurrency(game.price),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF4CAF50)
            )
        }
    }
}

@Composable
private fun RecentReviewsCard(
    reviews: List<Review>
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "💬 Reviews Recentes",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                TextButton(onClick = { }) {
                    Text("Ver todos →")
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (reviews.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("📝", style = MaterialTheme.typography.headlineMedium)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Nenhum review ainda",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                reviews.forEach { review ->
                    ReviewItem(review = review)
                    if (review != reviews.last()) {
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun ReviewItem(
    review: Review
) {
    Column(
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = review.userName.firstOrNull()?.uppercase() ?: "?",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = review.userName,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                repeat(5) { index ->
                    Text(
                        text = if (index < review.rating) "⭐" else "☆",
                        fontSize = 14.sp
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = review.date,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = review.comment,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun FieldOwnerLoadingShimmer() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        items(2) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                repeat(2) {
                    ShimmerCard(
                        modifier = Modifier.weight(1f),
                        height = 120
                    )
                }
            }
        }

        items(4) {
            ShimmerCard(
                modifier = Modifier.fillMaxWidth(),
                height = 150
            )
        }
    }
}
