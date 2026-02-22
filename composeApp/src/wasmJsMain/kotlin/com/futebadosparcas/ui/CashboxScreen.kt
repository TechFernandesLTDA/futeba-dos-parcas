package com.futebadosparcas.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.ui.components.states.EmptyState
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.launch

private data class CashboxEntry(
    val id: String,
    val description: String,
    val amount: Double,
    val type: String,
    val category: String,
    val date: String,
    val playerName: String? = null,
    val isVoided: Boolean = false
)

private data class CashboxSummary(
    val totalIncome: Double,
    val totalExpense: Double,
    val balance: Double
)

private data class CategoryTotal(
    val category: String,
    val total: Double,
    val type: String
)

private sealed class CashboxUiState {
    object Loading : CashboxUiState()
    data class Success(
        val entries: List<CashboxEntry>,
        val summary: CashboxSummary,
        val categoryTotals: List<CategoryTotal>
    ) : CashboxUiState()
    data class Error(val message: String) : CashboxUiState()
}

private enum class FilterType {
    ALL, INCOME, EXPENSE
}

private enum class PeriodFilter {
    ALL_TIME, THIS_MONTH, LAST_MONTH, THIS_WEEK
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CashboxScreen(
    groupId: String,
    onBackClick: () -> Unit
) {
    var uiState by remember { mutableStateOf<CashboxUiState>(CashboxUiState.Loading) }
    var filterType by remember { mutableStateOf(FilterType.ALL) }
    var periodFilter by remember { mutableStateOf(PeriodFilter.ALL_TIME) }
    var showAddDialog by remember { mutableStateOf(false) }
    var showCategoryDialog by remember { mutableStateOf(false) }
    var showPeriodMenu by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    fun loadCashbox() {
        scope.launch {
            uiState = CashboxUiState.Loading
            try {
                val entries = getMockCashboxEntries()
                val filteredEntries = when (filterType) {
                    FilterType.ALL -> entries
                    FilterType.INCOME -> entries.filter { it.type == "INCOME" }
                    FilterType.EXPENSE -> entries.filter { it.type == "EXPENSE" }
                }

                val totalIncome = entries.filter { it.type == "INCOME" && !it.isVoided }.sumOf { it.amount }
                val totalExpense = entries.filter { it.type == "EXPENSE" && !it.isVoided }.sumOf { it.amount }

                val categoryTotals = entries
                    .filter { !it.isVoided }
                    .groupBy { it.category to it.type }
                    .map { (key, items) ->
                        CategoryTotal(
                            category = key.first,
                            total = items.sumOf { it.amount },
                            type = key.second
                        )
                    }
                    .sortedByDescending { it.total }

                uiState = CashboxUiState.Success(
                    entries = filteredEntries,
                    summary = CashboxSummary(totalIncome, totalExpense, totalIncome - totalExpense),
                    categoryTotals = categoryTotals
                )
            } catch (e: Exception) {
                uiState = CashboxUiState.Error(e.message ?: "Erro ao carregar caixa")
            }
        }
    }

    LaunchedEffect(groupId, filterType) {
        loadCashbox()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("💰 Caixa do Grupo") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Text("←", style = MaterialTheme.typography.titleLarge)
                    }
                },
                actions = {
                    Box {
                        IconButton(onClick = { showPeriodMenu = true }) {
                            Text("📅", style = MaterialTheme.typography.titleMedium)
                        }
                        DropdownMenu(
                            expanded = showPeriodMenu,
                            onDismissRequest = { showPeriodMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("📊 Todo o Período") },
                                onClick = {
                                    periodFilter = PeriodFilter.ALL_TIME
                                    showPeriodMenu = false
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("📆 Este Mês") },
                                onClick = {
                                    periodFilter = PeriodFilter.THIS_MONTH
                                    showPeriodMenu = false
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("📅 Mês Passado") },
                                onClick = {
                                    periodFilter = PeriodFilter.LAST_MONTH
                                    showPeriodMenu = false
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("🗓️ Esta Semana") },
                                onClick = {
                                    periodFilter = PeriodFilter.THIS_WEEK
                                    showPeriodMenu = false
                                }
                            )
                        }
                    }
                    IconButton(onClick = { showCategoryDialog = true }) {
                        Text("📊", style = MaterialTheme.typography.titleMedium)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showAddDialog = true },
                icon = { Text("➕") },
                text = { Text("Nova Transação") },
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer
            )
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is CashboxUiState.Loading -> CashboxLoadingContent(paddingValues)
            is CashboxUiState.Success -> CashboxContent(
                entries = state.entries,
                summary = state.summary,
                categoryTotals = state.categoryTotals,
                filterType = filterType,
                onFilterChange = { filterType = it },
                paddingValues = paddingValues
            )
            is CashboxUiState.Error -> ErrorState(
                message = state.message,
                onRetry = { loadCashbox() }
            )
        }
    }

    if (showAddDialog) {
        AddTransactionDialog(
            onDismiss = { showAddDialog = false },
            onSave = { type, description, amount, category ->
                scope.launch {
                    snackbarHostState.showSnackbar("Transação adicionada com sucesso!")
                }
                showAddDialog = false
                loadCashbox()
            }
        )
    }

    if (showCategoryDialog && uiState is CashboxUiState.Success) {
        val categoryTotals = (uiState as CashboxUiState.Success).categoryTotals
        CategorySummaryDialog(
            categoryTotals = categoryTotals,
            onDismiss = { showCategoryDialog = false }
        )
    }
}

@Composable
private fun CashboxLoadingContent(paddingValues: PaddingValues) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ShimmerCard()
        repeat(5) {
            ShimmerTransactionItem()
        }
    }
}

@Composable
private fun ShimmerCard() {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = androidx.compose.ui.geometry.Offset(translateAnim.value - 1000f, 0f),
        end = androidx.compose.ui.geometry.Offset(translateAnim.value, 0f)
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .width(120.dp)
                    .height(16.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(brush)
            )
            Spacer(modifier = Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .width(180.dp)
                    .height(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(brush)
            )
        }
    }
}

@Composable
private fun ShimmerTransactionItem() {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = androidx.compose.ui.geometry.Offset(translateAnim.value - 1000f, 0f),
        end = androidx.compose.ui.geometry.Offset(translateAnim.value, 0f)
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
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
                    .background(brush)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Box(
                    modifier = Modifier
                        .width(140.dp)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
                Spacer(modifier = Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .width(80.dp)
                        .height(12.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
            }
            Box(
                modifier = Modifier
                    .width(70.dp)
                    .height(20.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(brush)
            )
        }
    }
}

@Composable
private fun CashboxContent(
    entries: List<CashboxEntry>,
    summary: CashboxSummary,
    categoryTotals: List<CategoryTotal>,
    filterType: FilterType,
    onFilterChange: (FilterType) -> Unit,
    paddingValues: PaddingValues
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
    ) {
        BalanceCard(summary = summary)

        FilterChips(
            currentFilter = filterType,
            onFilterChange = onFilterChange
        )

        if (categoryTotals.isNotEmpty()) {
            CategoryChart(
                categoryTotals = categoryTotals.take(5),
                totalIncome = summary.totalIncome,
                totalExpense = summary.totalExpense
            )
        }

        if (entries.isEmpty()) {
            EmptyState(
                emoji = "💸",
                title = "Nenhuma transação",
                description = "Adicione receitas e despesas para controlar o caixa do grupo."
            )
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(entries, key = { it.id }) { entry ->
                    TransactionCard(entry = entry)
                }
                item {
                    Spacer(modifier = Modifier.height(80.dp))
                }
            }
        }
    }
}

@Composable
private fun BalanceCard(summary: CashboxSummary) {
    val isPositive = summary.balance >= 0

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isPositive) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.errorContainer
            }
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "💵 Saldo Atual",
                style = MaterialTheme.typography.titleSmall,
                color = if (isPositive) {
                    MaterialTheme.colorScheme.onPrimaryContainer
                } else {
                    MaterialTheme.colorScheme.onErrorContainer
                }
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = formatCurrency(summary.balance),
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = if (isPositive) {
                    MaterialTheme.colorScheme.onPrimaryContainer
                } else {
                    MaterialTheme.colorScheme.onErrorContainer
                }
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text("📈")
                        Text(
                            text = "Receitas",
                            style = MaterialTheme.typography.labelMedium,
                            color = if (isPositive) {
                                MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                            } else {
                                MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.7f)
                            }
                        )
                    }
                    Text(
                        text = "+ ${formatCurrency(summary.totalIncome)}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF4CAF50)
                    )
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text("📉")
                        Text(
                            text = "Despesas",
                            style = MaterialTheme.typography.labelMedium,
                            color = if (isPositive) {
                                MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                            } else {
                                MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.7f)
                            }
                        )
                    }
                    Text(
                        text = "- ${formatCurrency(summary.totalExpense)}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

@Composable
private fun FilterChips(
    currentFilter: FilterType,
    onFilterChange: (FilterType) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        FilterChip(
            selected = currentFilter == FilterType.ALL,
            onClick = { onFilterChange(FilterType.ALL) },
            label = { Text("📋 Todos") },
            leadingIcon = if (currentFilter == FilterType.ALL) {
                { Text("✓", fontSize = 14.sp) }
            } else null
        )

        FilterChip(
            selected = currentFilter == FilterType.INCOME,
            onClick = { onFilterChange(FilterType.INCOME) },
            label = { Text("📈 Receitas") },
            leadingIcon = if (currentFilter == FilterType.INCOME) {
                { Text("✓", fontSize = 14.sp) }
            } else null
        )

        FilterChip(
            selected = currentFilter == FilterType.EXPENSE,
            onClick = { onFilterChange(FilterType.EXPENSE) },
            label = { Text("📉 Despesas") },
            leadingIcon = if (currentFilter == FilterType.EXPENSE) {
                { Text("✓", fontSize = 14.sp) }
            } else null
        )
    }
}

@Composable
private fun CategoryChart(
    categoryTotals: List<CategoryTotal>,
    totalIncome: Double,
    totalExpense: Double
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "📊 Resumo por Categoria",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            categoryTotals.forEach { categoryTotal ->
                val maxTotal = maxOf(totalIncome, totalExpense)
                val percentage = if (maxTotal > 0) ((categoryTotal.total / maxTotal).toFloat()) else 0f
                val barColor = if (categoryTotal.type == "INCOME") {
                    Color(0xFF4CAF50)
                } else {
                    MaterialTheme.colorScheme.error
                }

                Column(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = getCategoryEmoji(categoryTotal.category) + " " + categoryTotal.category,
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = formatCurrency(categoryTotal.total),
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium,
                            color = barColor
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(percentage)
                                .fillMaxHeight()
                                .clip(RoundedCornerShape(4.dp))
                                .background(barColor)
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}

@Composable
private fun TransactionCard(entry: CashboxEntry) {
    val isIncome = entry.type == "INCOME"

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (entry.isVoided) {
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            } else {
                MaterialTheme.colorScheme.surface
            }
        )
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
                    .background(
                        if (isIncome) {
                            Color(0xFF4CAF50).copy(alpha = 0.15f)
                        } else {
                            MaterialTheme.colorScheme.errorContainer
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (isIncome) "📈" else "📉",
                    fontSize = 18.sp
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = entry.description,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (entry.isVoided) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = MaterialTheme.colorScheme.errorContainer
                        ) {
                            Text(
                                text = "ESTORNADO",
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onErrorContainer
                            )
                        }
                    }
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = getCategoryEmoji(entry.category) + " " + entry.category,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (!entry.playerName.isNullOrEmpty()) {
                        Text(
                            text = "• 👤 ${entry.playerName}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${if (isIncome) "+" else "-"} ${formatCurrency(entry.amount)}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (isIncome) Color(0xFF4CAF50) else MaterialTheme.colorScheme.error
                )
                Text(
                    text = entry.date,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddTransactionDialog(
    onDismiss: () -> Unit,
    onSave: (type: String, description: String, amount: Double, category: String) -> Unit
) {
    var selectedType by remember { mutableStateOf("INCOME") }
    var description by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("OUTROS") }

    val incomeCategories = listOf("MENSALIDADE", "JOGO", "DOACAO", "PATROCINIO", "OUTROS")
    val expenseCategories = listOf("ALUGUEL", "EQUIPAMENTOS", "AGUA_LUZ", "UNIFORME", "PREMIACAO", "OUTROS")

    val categories = if (selectedType == "INCOME") incomeCategories else expenseCategories

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Text("💰") },
        title = { Text("Nova Transação") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = selectedType == "INCOME",
                        onClick = { 
                            selectedType = "INCOME"
                            selectedCategory = incomeCategories.first()
                        },
                        label = { Text("📈 Receita") },
                        modifier = Modifier.weight(1f)
                    )
                    FilterChip(
                        selected = selectedType == "EXPENSE",
                        onClick = { 
                            selectedType = "EXPENSE"
                            selectedCategory = expenseCategories.first()
                        },
                        label = { Text("📉 Despesa") },
                        modifier = Modifier.weight(1f)
                    )
                }

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Descrição") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                OutlinedTextField(
                    value = amount,
                    onValueChange = { 
                        if (it.isEmpty() || it.matches(Regex("^\\d*\\.?\\d*$"))) {
                            amount = it
                        }
                    },
                    label = { Text("Valor (R$)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                Text(
                    text = "Categoria:",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )

                Column(
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    categories.forEach { category ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = selectedCategory == category,
                                onClick = { selectedCategory = category }
                            )
                            Text(
                                text = " ${getCategoryEmoji(category)} ${getCategoryDisplayName(category)}",
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amountValue = amount.toDoubleOrNull() ?: 0.0
                    if (description.isNotBlank() && amountValue > 0) {
                        onSave(selectedType, description, amountValue, selectedCategory)
                    }
                },
                enabled = description.isNotBlank() && amount.toDoubleOrNull() != null && amount.toDoubleOrNull()!! > 0
            ) {
                Text("Salvar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

@Composable
private fun CategorySummaryDialog(
    categoryTotals: List<CategoryTotal>,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Text("📊") },
        title = { Text("Resumo por Categoria") },
        text = {
            if (categoryTotals.isEmpty()) {
                Text("Nenhuma transação registrada.")
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(categoryTotals) { categoryTotal ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(getCategoryEmoji(categoryTotal.category))
                                Text(
                                    text = getCategoryDisplayName(categoryTotal.category),
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                            Text(
                                text = formatCurrency(categoryTotal.total),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = if (categoryTotal.type == "INCOME") {
                                    Color(0xFF4CAF50)
                                } else {
                                    MaterialTheme.colorScheme.error
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fechar")
            }
        }
    )
}

private fun formatCurrency(value: Double): String {
    val rounded = (value * 100).toInt() / 100.0
    val parts = rounded.toString().split(".")
    val intPart = parts[0]
    val decPart = if (parts.size > 1) parts[1].padEnd(2, '0').take(2) else "00"
    
    val formattedInt = StringBuilder()
    val chars = intPart.reversed()
    for (i in chars.indices) {
        if (i > 0 && i % 3 == 0) {
            formattedInt.append(".")
        }
        formattedInt.append(chars[i])
    }
    
    return "R$ ${formattedInt.reverse()},$decPart"
}

private fun getCategoryEmoji(category: String): String {
    return when (category.uppercase()) {
        "MENSALIDADE" -> "💳"
        "JOGO" -> "⚽"
        "DOACAO" -> "🎁"
        "PATROCINIO" -> "🤝"
        "ALUGUEL" -> "🏠"
        "EQUIPAMENTOS" -> "⚽"
        "AGUA_LUZ" -> "💡"
        "UNIFORME" -> "👕"
        "PREMIACAO" -> "🏆"
        "OUTROS" -> "📦"
        else -> "📦"
    }
}

private fun getCategoryDisplayName(category: String): String {
    return when (category.uppercase()) {
        "MENSALIDADE" -> "Mensalidade"
        "JOGO" -> "Jogo"
        "DOACAO" -> "Doação"
        "PATROCINIO" -> "Patrocínio"
        "ALUGUEL" -> "Aluguel"
        "EQUIPAMENTOS" -> "Equipamentos"
        "AGUA_LUZ" -> "Água/Luz"
        "UNIFORME" -> "Uniforme"
        "PREMIACAO" -> "Premiação"
        "OUTROS" -> "Outros"
        else -> category.lowercase().replaceFirstChar { it.uppercase() }
    }
}

private fun getMockCashboxEntries(): List<CashboxEntry> {
    return listOf(
        CashboxEntry(
            id = "1",
            description = "Mensalidade Janeiro",
            amount = 150.0,
            type = "INCOME",
            category = "MENSALIDADE",
            date = "15/01/2025",
            playerName = "João Silva"
        ),
        CashboxEntry(
            id = "2",
            description = "Mensalidade Fevereiro",
            amount = 150.0,
            type = "INCOME",
            category = "MENSALIDADE",
            date = "15/02/2025",
            playerName = "Pedro Santos"
        ),
        CashboxEntry(
            id = "3",
            description = "Aluguel da Quadra",
            amount = 200.0,
            type = "EXPENSE",
            category = "ALUGUEL",
            date = "20/01/2025"
        ),
        CashboxEntry(
            id = "4",
            description = "Conta de Luz",
            amount = 85.50,
            type = "EXPENSE",
            category = "AGUA_LUZ",
            date = "10/01/2025"
        ),
        CashboxEntry(
            id = "5",
            description = "Patrocínio Bar do Zé",
            amount = 300.0,
            type = "INCOME",
            category = "PATROCINIO",
            date = "01/02/2025"
        ),
        CashboxEntry(
            id = "6",
            description = "Compra de Bolas",
            amount = 120.0,
            type = "EXPENSE",
            category = "EQUIPAMENTOS",
            date = "05/02/2025"
        ),
        CashboxEntry(
            id = "7",
            description = "Mensalidade Marco",
            amount = 150.0,
            type = "INCOME",
            category = "MENSALIDADE",
            date = "15/03/2025",
            playerName = "Carlos Oliveira"
        ),
        CashboxEntry(
            id = "8",
            description = "Premiação Artilheiro",
            amount = 50.0,
            type = "EXPENSE",
            category = "PREMIACAO",
            date = "28/02/2025",
            playerName = "MVP Fevereiro"
        ),
        CashboxEntry(
            id = "9",
            description = "Doação Anônima",
            amount = 100.0,
            type = "INCOME",
            category = "DOACAO",
            date = "10/03/2025"
        ),
        CashboxEntry(
            id = "10",
            description = "Uniformes Novos",
            amount = 450.0,
            type = "EXPENSE",
            category = "UNIFORME",
            date = "12/03/2025"
        )
    )
}
