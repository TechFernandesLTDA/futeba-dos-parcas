package com.futebadosparcas.ui.groups

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.data.model.*
import com.futebadosparcas.ui.components.CachedAsyncImage
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.dialogs.ConfirmationDialog
import com.futebadosparcas.ui.components.dialogs.ConfirmationDialogType
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.ui.components.states.LoadingState
import com.futebadosparcas.ui.components.states.LoadingItemType
import com.futebadosparcas.ui.theme.systemBarsPadding
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

/**
 * CashboxScreen - Gestão financeira do grupo
 *
 * Screen Compose para gerenciar receitas e despesas do grupo.
 * Inclui resumo financeiro, histórico de transações, filtros e relatórios.
 */
@Composable
fun CashboxScreen(
    viewModel: CashboxViewModel,
    groupId: String,
    onNavigateBack: () -> Unit = {}
) {
    val summaryState by viewModel.summaryState.collectAsStateWithLifecycle()
    val historyState by viewModel.historyState.collectAsStateWithLifecycle()
    val actionState by viewModel.actionState.collectAsStateWithLifecycle()
    val userRole by viewModel.userRole.collectAsStateWithLifecycle()
    val currentFilter by viewModel.currentFilter.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
    var showFilterMenu by remember { mutableStateOf(false) }
    var showRecalculateDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var selectedEntry by remember { mutableStateOf<CashboxEntry?>(null) }
    var showEntryDetails by remember { mutableStateOf(false) }
    var showReportMenu by remember { mutableStateOf(false) }
    var showTotalsDialog by remember { mutableStateOf(false) }
    var totalsDialogTitle by remember { mutableStateOf("") }
    var totalsDialogData by remember { mutableStateOf<Map<String, Double>>(emptyMap()) }
    var showAddEntryDialog by remember { mutableStateOf<CashboxEntryType?>(null) }

    val canManage = userRole == GroupMemberRole.ADMIN || userRole == GroupMemberRole.OWNER
    val canDelete = userRole == GroupMemberRole.OWNER

    LaunchedEffect(groupId) {
        viewModel.loadCashbox(groupId)
    }

    // Observa ações
    LaunchedEffect(actionState) {
        when (val state = actionState) {
            is CashboxActionState.Success -> {
                snackbarHostState.showSnackbar(state.message)
                viewModel.resetActionState()
            }
            is CashboxActionState.Error -> {
                snackbarHostState.showSnackbar(state.message)
                viewModel.resetActionState()
            }
            is CashboxActionState.TotalsByCategory -> {
                totalsDialogTitle = "Totais por Categoria"
                totalsDialogData = state.totals.mapKeys { it.key.displayName }
                showTotalsDialog = true
                viewModel.resetActionState()
            }
            is CashboxActionState.TotalsByPlayer -> {
                totalsDialogTitle = "Totais por Jogador"
                totalsDialogData = state.totals
                showTotalsDialog = true
                viewModel.resetActionState()
            }
            else -> {}
        }
    }

    // Dialog de Adicionar Entrada
    showAddEntryDialog?.let { type ->
        com.futebadosparcas.ui.groups.dialogs.AddCashboxEntryDialog(
            type = type,
            onDismiss = { showAddEntryDialog = null },
            onSave = { description, amount, category, receiptUri ->
                if (type == CashboxEntryType.INCOME) {
                    viewModel.addIncome(category, amount, description, receiptUri = receiptUri)
                } else {
                    viewModel.addExpense(category, amount, description, receiptUri = receiptUri)
                }
                showAddEntryDialog = null
            }
        )
    }

    // Dialog de confirmação de recálculo
    if (showRecalculateDialog) {
        ConfirmationDialog(
            visible = true,
            title = "Recalcular Saldo",
            message = "Isso irá recalcular o saldo com base em todas as entradas e saídas. Continuar?",
            confirmText = "Recalcular",
            type = ConfirmationDialogType.WARNING,
            icon = Icons.Default.Refresh,
            onConfirm = {
                viewModel.recalculateBalance()
                showRecalculateDialog = false
            },
            onDismiss = { showRecalculateDialog = false }
        )
    }

    // Dialog de confirmação de exclusão
    if (showDeleteDialog && selectedEntry != null) {
        ConfirmationDialog(
            visible = true,
            title = "Estornar Entrada",
            message = "Deseja realmente estornar esta entrada? Esta ação não pode ser desfeita.",
            confirmText = "Estornar",
            type = ConfirmationDialogType.DESTRUCTIVE,
            icon = Icons.Default.Delete,
            onConfirm = {
                viewModel.deleteEntry(selectedEntry!!.id)
                showDeleteDialog = false
                selectedEntry = null
            },
            onDismiss = {
                showDeleteDialog = false
                selectedEntry = null
            }
        )
    }

    // Dialog de detalhes da entrada
    if (showEntryDetails && selectedEntry != null) {
        EntryDetailsDialog(
            entry = selectedEntry!!,
            onDismiss = {
                showEntryDetails = false
                selectedEntry = null
            }
        )
    }

    // Dialog de totais
    if (showTotalsDialog) {
        TotalsDialog(
            title = totalsDialogTitle,
            totals = totalsDialogData,
            onDismiss = { showTotalsDialog = false }
        )
    }

    Scaffold(
        topBar = {
            CashboxTopBar(
                canManage = canManage,
                onNavigateBack = onNavigateBack,
                onFilterClick = { showFilterMenu = true },
                onRecalculateClick = { showRecalculateDialog = true },
                onReportClick = { showReportMenu = true }
            )
        },
        floatingActionButton = {
            if (canManage) {
                CashboxFABs(
                    onAddIncome = { showAddEntryDialog = CashboxEntryType.INCOME },
                    onAddExpense = { showAddEntryDialog = CashboxEntryType.EXPENSE }
                )
            }
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .systemBarsPadding()
        ) {
            // Card de resumo
            when (val summary = summaryState) {
                is CashboxSummaryState.Loading -> {
                    // Shimmer do resumo
                    Box(modifier = Modifier.padding(16.dp)) {
                        LoadingState(shimmerCount = 1, itemType = LoadingItemType.CARD)
                    }
                }
                is CashboxSummaryState.Success -> {
                    SummaryCard(summary = summary.summary)
                }
                is CashboxSummaryState.Error -> {
                    Text(
                        text = summary.message,
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            // Filtros
            FilterChips(
                currentFilter = currentFilter,
                onFilterAll = { viewModel.clearFilter() },
                onFilterIncome = { viewModel.filterByType(CashboxEntryType.INCOME) },
                onFilterExpense = { viewModel.filterByType(CashboxEntryType.EXPENSE) }
            )

            // Histórico
            when (val history = historyState) {
                is CashboxHistoryState.Loading -> {
                    LoadingState(shimmerCount = 6, itemType = LoadingItemType.LIST_ITEM)
                }
                is CashboxHistoryState.Empty -> {
                    EmptyState(
                        type = EmptyStateType.NoData(
                            title = "Nenhuma movimentação",
                            description = if (canManage) {
                                "Adicione sua primeira entrada ou saída para começar"
                            } else {
                                "Não há movimentações registradas no caixa"
                            },
                            icon = Icons.Default.Receipt
                        )
                    )
                }
                is CashboxHistoryState.Success -> {
                    HistoryList(
                        items = history.items,
                        canDelete = canDelete,
                        contentPadding = PaddingValues(bottom = if (canManage) 88.dp else 16.dp),
                        onEntryClick = { entry ->
                            selectedEntry = entry
                            showEntryDetails = true
                        },
                        onEntryLongClick = { entry ->
                            if (canDelete) {
                                selectedEntry = entry
                                showDeleteDialog = true
                            }
                        }
                    )
                }
                is CashboxHistoryState.Error -> {
                    ErrorState(
                        message = history.message,
                        onRetry = { viewModel.loadCashbox(groupId) }
                    )
                }
            }
        }

        // Menu de filtros
        DropdownMenu(
            expanded = showFilterMenu,
            onDismissRequest = { showFilterMenu = false }
        ) {
            DropdownMenuItem(
                text = { Text("Todos") },
                onClick = {
                    viewModel.clearFilter()
                    showFilterMenu = false
                },
                leadingIcon = { Icon(Icons.Default.FilterList, contentDescription = "Mostrar todos") }
            )
            DropdownMenuItem(
                text = { Text("Receitas") },
                onClick = {
                    viewModel.filterByType(CashboxEntryType.INCOME)
                    showFilterMenu = false
                },
                leadingIcon = { Icon(Icons.AutoMirrored.Filled.TrendingUp, contentDescription = "Receitas") }
            )
            DropdownMenuItem(
                text = { Text("Despesas") },
                onClick = {
                    viewModel.filterByType(CashboxEntryType.EXPENSE)
                    showFilterMenu = false
                },
                leadingIcon = { Icon(Icons.AutoMirrored.Filled.TrendingDown, contentDescription = "Despesas") }
            )
        }

        // Menu de relatórios
        DropdownMenu(
            expanded = showReportMenu,
            onDismissRequest = { showReportMenu = false }
        ) {
            DropdownMenuItem(
                text = { Text("Totais por Categoria") },
                onClick = {
                    viewModel.getTotalsByCategory()
                    showReportMenu = false
                },
                leadingIcon = { Icon(Icons.Default.Category, contentDescription = "Categoria") }
            )
            DropdownMenuItem(
                text = { Text("Totais por Jogador") },
                onClick = {
                    viewModel.getTotalsByPlayer()
                    showReportMenu = false
                },
                leadingIcon = { Icon(Icons.Default.Person, contentDescription = "Jogador") }
            )
        }
    }
}

// ... existing helper composables ...

/**
 * Representa os itens que podem aparecer na lista do caixa
 */
sealed class CashboxListItem {
    data class Header(val title: String) : CashboxListItem()
    data class Entry(val entry: CashboxEntry) : CashboxListItem()
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CashboxTopBar(
    canManage: Boolean,
    onNavigateBack: () -> Unit,
    onFilterClick: () -> Unit,
    onRecalculateClick: () -> Unit,
    onReportClick: () -> Unit
) {
    TopAppBar(
        title = { Text("Caixa do Grupo") },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
            }
        },
        actions = {
            IconButton(onClick = onFilterClick) {
                Icon(Icons.Default.FilterList, contentDescription = "Filtrar")
            }
            if (canManage) {
                IconButton(onClick = onRecalculateClick) {
                    Icon(Icons.Default.Refresh, contentDescription = "Recalcular")
                }
            }
            IconButton(onClick = onReportClick) {
                Icon(Icons.Default.BarChart, contentDescription = "Relatórios")
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    )
}

@Composable
private fun SummaryCard(summary: CashboxSummary) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Saldo Atual",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = summary.getFormattedBalance(),
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                // Receitas
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.TrendingUp,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = "Receitas",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                        )
                    }
                    Text(
                        text = "+ ${NumberFormat.getCurrencyInstance(Locale("pt", "BR")).format(summary.totalIncome)}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                // Despesas
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.TrendingDown,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                        Text(
                            text = "Despesas",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                        )
                    }
                    Text(
                        text = "- ${NumberFormat.getCurrencyInstance(Locale("pt", "BR")).format(summary.totalExpense)}",
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
    currentFilter: CashboxFilter?,
    onFilterAll: () -> Unit,
    onFilterIncome: () -> Unit,
    onFilterExpense: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        FilterChip(
            selected = currentFilter == null,
            onClick = onFilterAll,
            label = { Text("Todos") },
            leadingIcon = if (currentFilter == null) {
                { Icon(Icons.Default.Check, null, Modifier.size(18.dp)) }
            } else null
        )

        FilterChip(
            selected = currentFilter?.type == CashboxEntryType.INCOME,
            onClick = onFilterIncome,
            label = { Text("Receitas") },
            leadingIcon = if (currentFilter?.type == CashboxEntryType.INCOME) {
                { Icon(Icons.Default.Check, null, Modifier.size(18.dp)) }
            } else null
        )

        FilterChip(
            selected = currentFilter?.type == CashboxEntryType.EXPENSE,
            onClick = onFilterExpense,
            label = { Text("Despesas") },
            leadingIcon = if (currentFilter?.type == CashboxEntryType.EXPENSE) {
                { Icon(Icons.Default.Check, null, Modifier.size(18.dp)) }
            } else null
        )
    }
}

@Composable
private fun HistoryList(
    items: List<CashboxListItem>,
    canDelete: Boolean,
    contentPadding: PaddingValues,
    onEntryClick: (CashboxEntry) -> Unit,
    onEntryLongClick: (CashboxEntry) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = contentPadding
    ) {
        items(items, key = { item ->
            when (item) {
                is CashboxListItem.Header -> item.title
                is CashboxListItem.Entry -> item.entry.id
            }
        }) { item ->
            when (item) {
                is CashboxListItem.Header -> {
                    MonthHeader(title = item.title)
                }
                is CashboxListItem.Entry -> {
                    EntryCard(
                        entry = item.entry,
                        onClick = { onEntryClick(item.entry) },
                        onLongClick = if (canDelete) {
                            { onEntryLongClick(item.entry) }
                        } else null
                    )
                }
            }
        }
    }
}

@Composable
private fun MonthHeader(title: String) {
    Text(
        text = title,
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
private fun EntryCard(
    entry: CashboxEntry,
    onClick: () -> Unit,
    onLongClick: (() -> Unit)?
) {
    val isIncome = entry.getTypeEnum() == CashboxEntryType.INCOME
    val currencyFormat = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Ícone com cor
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(
                        if (isIncome) MaterialTheme.colorScheme.primaryContainer
                        else MaterialTheme.colorScheme.errorContainer
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isIncome) Icons.Default.Add else Icons.Default.Remove,
                    contentDescription = null,
                    tint = if (isIncome) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(20.dp)
                )
            }

            // Descrição e categoria
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = entry.description,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = entry.getCategoryEnum().displayName,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                    )

                    if (!entry.playerName.isNullOrEmpty()) {
                        Text(
                            text = "• ${entry.playerName}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                        )
                    }

                    if (entry.status == "VOIDED") {
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
            }

            // Valor
            Text(
                text = "${if (isIncome) "+" else "-"} ${currencyFormat.format(entry.amount)}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = if (isIncome) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
            )
        }
    }
}

@Composable
private fun CashboxFABs(
    onAddIncome: () -> Unit,
    onAddExpense: () -> Unit
) {
    val haptics = LocalHapticFeedback.current

    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.End
    ) {
        // FAB Adicionar Despesa
        SmallFloatingActionButton(
            onClick = {
                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                onAddExpense()
            },
            containerColor = MaterialTheme.colorScheme.errorContainer,
            contentColor = MaterialTheme.colorScheme.onErrorContainer
        ) {
            Icon(Icons.Default.Remove, contentDescription = "Adicionar Despesa")
        }

        // FAB Adicionar Receita
        FloatingActionButton(
            onClick = {
                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                onAddIncome()
            }
        ) {
            Icon(Icons.Default.Add, contentDescription = "Adicionar Receita")
        }
    }
}

@Composable
private fun EntryDetailsDialog(
    entry: CashboxEntry,
    onDismiss: () -> Unit
) {
    val currencyFormat = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(Icons.Default.Receipt, contentDescription = null)
        },
        title = { Text("Detalhes da Entrada") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                DetailRow("Descrição", entry.description)
                DetailRow("Categoria", entry.getCategoryEnum().displayName)
                DetailRow("Valor", currencyFormat.format(entry.amount))
                
                val playerName = entry.playerName
                if (!playerName.isNullOrEmpty()) {
                    DetailRow("Jogador", playerName)
                }
                
                if (entry.status == "VOIDED") {
                    DetailRow("Status", "ESTORNADO/CANCELADO")
                }

                if (!entry.receiptUrl.isNullOrEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Comprovante:",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    coil.compose.AsyncImage(
                        model = entry.receiptUrl,
                        contentDescription = "Comprovante",
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                            .clip(RoundedCornerShape(8.dp)),
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("OK")
            }
        }
    )
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = "$label:",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

@Composable
private fun TotalsDialog(
    title: String,
    totals: Map<String, Double>,
    onDismiss: () -> Unit
) {
    val currencyFormat = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(Icons.Default.BarChart, contentDescription = null)
        },
        title = { Text(title) },
        text = {
            if (totals.isEmpty()) {
                Text("Nenhum dado encontrado.")
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    totals.forEach { (name, amount) ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = name,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                text = currencyFormat.format(amount),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("OK")
            }
        }
    )
}

// NOTA: CashboxListItem está definido em CashboxEntriesAdapter.kt
