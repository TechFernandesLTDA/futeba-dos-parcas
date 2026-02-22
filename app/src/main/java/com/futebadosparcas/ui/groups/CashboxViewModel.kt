package com.futebadosparcas.ui.groups

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.CashboxCategory
import com.futebadosparcas.domain.model.CashboxEntry
import com.futebadosparcas.domain.model.CashboxEntryType
import com.futebadosparcas.domain.model.CashboxFilter
import com.futebadosparcas.domain.model.CashboxSummary
import com.futebadosparcas.domain.model.GroupMemberRole
import com.futebadosparcas.domain.repository.CashboxRepository
import com.futebadosparcas.data.repository.GroupRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class CashboxViewModel(
    private val cashboxRepository: CashboxRepository,
    private val groupRepository: GroupRepository
) : ViewModel() {

    private val _userRole = MutableStateFlow<GroupMemberRole?>(null)
    val userRole: StateFlow<GroupMemberRole?> = _userRole

    private val _summaryState = MutableStateFlow<CashboxSummaryState>(CashboxSummaryState.Loading)
    val summaryState: StateFlow<CashboxSummaryState> = _summaryState

    private val _historyState = MutableStateFlow<CashboxHistoryState>(CashboxHistoryState.Loading)
    val historyState: StateFlow<CashboxHistoryState> = _historyState

    private val _actionState = MutableStateFlow<CashboxActionState>(CashboxActionState.Idle)
    val actionState: StateFlow<CashboxActionState> = _actionState

    private val _currentFilter = MutableStateFlow<CashboxFilter?>(null)
    val currentFilter: StateFlow<CashboxFilter?> = _currentFilter

    private var currentGroupId: String? = null
    private var summaryJob: Job? = null
    private var historyJob: Job? = null

    fun loadCashbox(groupId: String) {
        currentGroupId = groupId
        loadUserRole(groupId)
        observeSummary(groupId)
        observeHistory(groupId)
    }

    private fun loadUserRole(groupId: String) {
        viewModelScope.launch {
            val role = groupRepository.getMyRoleInGroup(groupId).getOrNull()
            _userRole.value = role?.let { GroupMemberRole.valueOf(it.name) }
        }
    }

    private fun observeSummary(groupId: String) {
        summaryJob?.cancel()
        summaryJob = cashboxRepository.getSummaryFlow(groupId)
            .onEach { summary ->
                _summaryState.value = CashboxSummaryState.Success(summary)
            }
            .catch { e ->
                _summaryState.value = CashboxSummaryState.Error(
                    e.message ?: "Erro ao carregar saldo"
                )
            }
            .launchIn(viewModelScope)
    }

    private val monthFormat = SimpleDateFormat("MMMM yyyy", Locale.forLanguageTag("pt-BR"))

    private fun observeHistory(groupId: String) {
        historyJob?.cancel()
        historyJob = cashboxRepository.getHistoryFlow(groupId)
            .onEach { entries ->
                _historyState.value = if (entries.isEmpty()) {
                    CashboxHistoryState.Empty
                } else {
                    val groupedItems = groupEntriesByMonth(entries)
                    CashboxHistoryState.Success(groupedItems)
                }
            }
            .catch { e ->
                _historyState.value = CashboxHistoryState.Error(
                    e.message ?: "Erro ao carregar histórico"
                )
            }
            .launchIn(viewModelScope)
    }

    private fun groupEntriesByMonth(entries: List<CashboxEntry>): List<CashboxListItem> {
        val result = mutableListOf<CashboxListItem>()
        val grouped = entries.groupBy { entry ->
            val date = entry.createdAt ?: entry.referenceDate ?: Date()
            val cal = java.util.Calendar.getInstance()
            cal.time = date
            cal.set(java.util.Calendar.DAY_OF_MONTH, 1)
            cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
            cal.set(java.util.Calendar.MINUTE, 0)
            cal.set(java.util.Calendar.SECOND, 0)
            cal.set(java.util.Calendar.MILLISECOND, 0)
            cal.time
        }

        // Sort months descending
        val sortedMonths = grouped.keys.sortedDescending()

        for (month in sortedMonths) {
            val monthTitle = monthFormat.format(month).replaceFirstChar { it.uppercase() }
            result.add(CashboxListItem.Header(monthTitle))
            
            val monthEntries = grouped[month] ?: emptyList()
            // Entries are already sorted descending by repository typically, but let's ensure
            result.addAll(monthEntries.map { CashboxListItem.Entry(it) })
        }

        return result
    }

    fun addEntry(
        type: CashboxEntryType,
        category: CashboxCategory,
        amount: Double,
        description: String,
        customCategory: String? = null,
        playerId: String? = null,
        playerName: String? = null,
        gameId: String? = null,
        referenceDate: Date = Date(),
        receiptUri: Uri? = null
    ) {
        val groupId = currentGroupId ?: return

        viewModelScope.launch {
            _actionState.value = CashboxActionState.Loading

            val androidEntry = AndroidCashboxEntry(
                type = type.name,
                category = category.name,
                customCategory = customCategory,
                amount = amount,
                description = description,
                playerId = playerId,
                playerName = playerName,
                gameId = gameId,
                referenceDate = referenceDate
            )

            val kmpEntry = androidEntry.toKmpCashboxEntry()
            val receiptFilePath = receiptUri?.toString()

            val result = cashboxRepository.addEntry(groupId, kmpEntry, receiptFilePath)

            result.fold(
                onSuccess = {
                    _actionState.value = CashboxActionState.Success(
                        if (type == CashboxEntryType.INCOME) "Entrada registrada" else "Saída registrada"
                    )
                },
                onFailure = { error ->
                    _actionState.value = CashboxActionState.Error(
                        error.message ?: "Erro ao registrar entrada"
                    )
                }
            )
        }
    }

    fun addIncome(
        category: CashboxCategory,
        amount: Double,
        description: String,
        playerId: String? = null,
        playerName: String? = null,
        receiptUri: Uri? = null // Added receiptUri parameter
    ) {
        addEntry(
            type = CashboxEntryType.INCOME,
            category = category,
            amount = amount,
            description = description,
            playerId = playerId,
            playerName = playerName,
            receiptUri = receiptUri // Pass receiptUri
        )
    }

    fun addExpense(
        category: CashboxCategory,
        amount: Double,
        description: String,
        gameId: String? = null,
        receiptUri: Uri? = null // Added receiptUri parameter
    ) {
        addEntry(
            type = CashboxEntryType.EXPENSE,
            category = category,
            amount = amount,
            description = description,
            gameId = gameId,
            receiptUri = receiptUri // Pass receiptUri
        )
    }

    fun deleteEntry(entryId: String) {
        val groupId = currentGroupId ?: return

        viewModelScope.launch {
            _actionState.value = CashboxActionState.Loading

            val result = cashboxRepository.deleteEntry(groupId, entryId)

            result.fold(
                onSuccess = {
                    _actionState.value = CashboxActionState.Success("Entrada removida")
                },
                onFailure = { error ->
                    _actionState.value = CashboxActionState.Error(
                        error.message ?: "Erro ao remover entrada"
                    )
                }
            )
        }
    }

    fun applyFilter(filter: CashboxFilter) {
        val groupId = currentGroupId ?: return

        viewModelScope.launch {
            _currentFilter.value = filter
            _historyState.value = CashboxHistoryState.Loading

            val kmpFilter = filter.toKmpCashboxFilter()
            val result = cashboxRepository.getHistoryFiltered(groupId, kmpFilter)

            result.fold(
                onSuccess = { entries ->
                    val androidEntries = entries.toAndroidCashboxEntries()
                    _historyState.value = if (androidEntries.isEmpty()) {
                        CashboxHistoryState.Empty
                    } else {
                        val groupedItems = groupEntriesByMonth(androidEntries)
                        CashboxHistoryState.Success(groupedItems)
                    }
                },
                onFailure = { error ->
                    _historyState.value = CashboxHistoryState.Error(
                        error.message ?: "Erro ao filtrar histórico"
                    )
                }
            )
        }
    }

    fun clearFilter() {
        val groupId = currentGroupId ?: return
        _currentFilter.value = null
        observeHistory(groupId)
    }

    fun filterByType(type: CashboxEntryType) {
        applyFilter(CashboxFilter(type = type))
    }

    fun filterByCategory(category: CashboxCategory) {
        applyFilter(CashboxFilter(category = category))
    }

    fun filterByDateRange(startDate: Date, endDate: Date) {
        applyFilter(CashboxFilter(startDate = startDate, endDate = endDate))
    }

    fun filterByPlayer(playerId: String) {
        applyFilter(CashboxFilter(playerId = playerId))
    }

    fun loadEntriesByMonth(year: Int, month: Int) {
        val groupId = currentGroupId ?: return

        viewModelScope.launch {
            _historyState.value = CashboxHistoryState.Loading

            val result = cashboxRepository.getEntriesByMonth(groupId, year, month)

            result.fold(
                onSuccess = { entries ->
                    val androidEntries = entries.toAndroidCashboxEntries()
                    _historyState.value = if (androidEntries.isEmpty()) {
                        CashboxHistoryState.Empty
                    } else {
                        val groupedItems = groupEntriesByMonth(androidEntries)
                        CashboxHistoryState.Success(groupedItems)
                    }
                },
                onFailure = { error ->
                    _historyState.value = CashboxHistoryState.Error(
                        error.message ?: "Erro ao carregar mês"
                    )
                }
            )
        }
    }

    fun recalculateBalance() {
        val groupId = currentGroupId ?: return

        viewModelScope.launch {
            _actionState.value = CashboxActionState.Loading

            val result = cashboxRepository.recalculateBalance(groupId)

            result.fold(
                onSuccess = { summary ->
                    val sign = if (summary.balance >= 0) "" else "-"
                    val formattedBalance = "$sign R$ ${String.format(Locale.getDefault(), "%.2f", kotlin.math.abs(summary.balance))}"
                    _actionState.value = CashboxActionState.Success(
                        "Saldo recalculado: $formattedBalance"
                    )
                },
                onFailure = { error ->
                    _actionState.value = CashboxActionState.Error(
                        error.message ?: "Erro ao recalcular saldo"
                    )
                }
            )
        }
    }

    fun getTotalsByCategory() {
        val groupId = currentGroupId ?: return

        viewModelScope.launch {
            val result = cashboxRepository.getHistory(groupId, limit = 1000)

            result.fold(
                onSuccess = { entries ->
                    // Calcular totais por categoria localmente
                    val totalsByCategory = mutableMapOf<CashboxCategory, Double>()
                    for (entry in entries) {
                        val category = try {
                            CashboxCategory.valueOf(entry.category)
                        } catch (e: Exception) {
                            CashboxCategory.OTHER
                        }
                        val currentAmount = totalsByCategory[category] ?: 0.0
                        totalsByCategory[category] = currentAmount + entry.amount
                    }
                    _actionState.value = CashboxActionState.TotalsByCategory(totalsByCategory)
                },
                onFailure = { error ->
                    _actionState.value = CashboxActionState.Error(
                        error.message ?: "Erro ao calcular totais"
                    )
                }
            )
        }
    }

    fun getTotalsByPlayer() {
        val groupId = currentGroupId ?: return

        viewModelScope.launch {
            val result = cashboxRepository.getHistory(groupId, limit = 1000)

            result.fold(
                onSuccess = { entries ->
                    // Calcular totais por jogador localmente
                    val totalsByPlayer = mutableMapOf<String, Double>()
                    for (entry in entries) {
                        val playerName = entry.playerName ?: "Desconhecido"
                        val currentAmount = totalsByPlayer[playerName] ?: 0.0
                        totalsByPlayer[playerName] = currentAmount + entry.amount
                    }
                    _actionState.value = CashboxActionState.TotalsByPlayer(totalsByPlayer)
                },
                onFailure = { error ->
                    _actionState.value = CashboxActionState.Error(
                        error.message ?: "Erro ao calcular totais por jogador"
                    )
                }
            )
        }
    }

    fun resetActionState() {
        _actionState.value = CashboxActionState.Idle
    }

    override fun onCleared() {
        super.onCleared()
        summaryJob?.cancel()
        historyJob?.cancel()
    }
}

sealed class CashboxSummaryState {
    object Loading : CashboxSummaryState()
    data class Success(val summary: AndroidCashboxSummary) : CashboxSummaryState()
    data class Error(val message: String) : CashboxSummaryState()
}

sealed class CashboxHistoryState {
    object Loading : CashboxHistoryState()
    object Empty : CashboxHistoryState()
    data class Success(val items: List<CashboxListItem>) : CashboxHistoryState()
    data class Error(val message: String) : CashboxHistoryState()
}

sealed class CashboxActionState {
    object Idle : CashboxActionState()
    object Loading : CashboxActionState()
    data class Success(val message: String) : CashboxActionState()
    data class TotalsByCategory(val totals: Map<CashboxCategory, Double>) : CashboxActionState()
    data class TotalsByPlayer(val totals: Map<String, Double>) : CashboxActionState()
    data class Error(val message: String) : CashboxActionState()
}
