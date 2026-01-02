package com.futebadosparcas.ui.groups

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.CashboxCategory
import com.futebadosparcas.data.model.CashboxEntry
import com.futebadosparcas.data.model.CashboxEntryType
import com.futebadosparcas.data.model.CashboxFilter
import com.futebadosparcas.data.model.CashboxSummary
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.repository.CashboxRepository
import com.futebadosparcas.data.repository.GroupRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

@HiltViewModel
class CashboxViewModel @Inject constructor(
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

    fun loadCashbox(groupId: String) {
        currentGroupId = groupId
        loadUserRole(groupId)
        observeSummary(groupId)
        observeHistory(groupId)
    }

    private fun loadUserRole(groupId: String) {
        viewModelScope.launch {
            val role = groupRepository.getMyRoleInGroup(groupId).getOrNull()
            _userRole.value = role
        }
    }

    private fun observeSummary(groupId: String) {
        cashboxRepository.getSummaryFlow(groupId)
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

    private val monthFormat = SimpleDateFormat("MMMM yyyy", Locale("pt", "BR"))

    private fun observeHistory(groupId: String) {
        cashboxRepository.getHistoryFlow(groupId)
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
            val date = entry.createdAt ?: entry.referenceDate
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

            val entry = CashboxEntry(
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

            val result = cashboxRepository.addEntry(groupId, entry, receiptUri)

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

            val result = cashboxRepository.getHistoryFiltered(groupId, filter)

            result.fold(
                onSuccess = { entries ->
                    _historyState.value = if (entries.isEmpty()) {
                        CashboxHistoryState.Empty
                    } else {
                        val groupedItems = groupEntriesByMonth(entries)
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
                    _historyState.value = if (entries.isEmpty()) {
                        CashboxHistoryState.Empty
                    } else {
                        val groupedItems = groupEntriesByMonth(entries)
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
                    _actionState.value = CashboxActionState.Success(
                        "Saldo recalculado: ${summary.getFormattedBalance()}"
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
            val result = cashboxRepository.getTotalsByCategory(groupId)

            result.fold(
                onSuccess = { totals ->
                    _actionState.value = CashboxActionState.TotalsByCategory(totals)
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
            val result = cashboxRepository.getTotalsByPlayer(groupId)

            result.fold(
                onSuccess = { totals ->
                    _actionState.value = CashboxActionState.TotalsByPlayer(totals)
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
}

sealed class CashboxSummaryState {
    object Loading : CashboxSummaryState()
    data class Success(val summary: CashboxSummary) : CashboxSummaryState()
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
