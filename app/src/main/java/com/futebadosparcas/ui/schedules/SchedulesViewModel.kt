package com.futebadosparcas.ui.schedules

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Schedule
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.ScheduleRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SchedulesViewModel @Inject constructor(
    private val scheduleRepository: ScheduleRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<SchedulesUiState>(SchedulesUiState.Loading)
    val uiState: StateFlow<SchedulesUiState> = _uiState.asStateFlow()

    init {
        loadSchedules()
    }

    private fun loadSchedules() {
        val userId = authRepository.getCurrentUserId() ?: return
        viewModelScope.launch {
            scheduleRepository.getSchedules(userId)
                .catch { e ->
                    // Tratamento de erro de fluxo: converter para estado de erro
                    _uiState.value = SchedulesUiState.Error(e.message ?: "Erro ao carregar recorrencias")
                }
                .collect { result ->
                    result.fold(
                        onSuccess = { schedules ->
                            _uiState.value = SchedulesUiState.Success(schedules)
                        },
                        onFailure = { error ->
                            _uiState.value = SchedulesUiState.Error(error.message ?: "Erro ao carregar recorrências")
                        }
                    )
                }
        }
    }

    fun deleteSchedule(scheduleId: String) {
        viewModelScope.launch {
            scheduleRepository.deleteSchedule(scheduleId).onFailure { error ->
                _uiState.value = SchedulesUiState.Error(error.message ?: "Erro ao excluir")
            }
        }
    }

    fun updateSchedule(schedule: Schedule) {
        viewModelScope.launch {
            scheduleRepository.updateSchedule(schedule).onFailure { error ->
                _uiState.value = SchedulesUiState.Error(error.message ?: "Erro ao atualizar")
            }
        }
    }
}

sealed class SchedulesUiState {
    object Loading : SchedulesUiState()
    data class Success(val schedules: List<Schedule>) : SchedulesUiState()
    data class Error(val message: String) : SchedulesUiState()
}
