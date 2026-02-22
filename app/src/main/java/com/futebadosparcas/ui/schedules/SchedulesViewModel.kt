package com.futebadosparcas.ui.schedules

import com.futebadosparcas.util.AppLogger
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.Schedule
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.ScheduleRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

/**
 * ViewModel para gerenciamento de horarios recorrentes.
 *
 * CMD-08: Debug de filtro vazio com logs detalhados
 * CMD-09: Suporte para criar novos horarios
 */
class SchedulesViewModel(
    private val scheduleRepository: ScheduleRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    companion object {
        private const val TAG = "SchedulesViewModel"
    }

    private val _uiState = MutableStateFlow<SchedulesUiState>(SchedulesUiState.Loading)
    val uiState: StateFlow<SchedulesUiState> = _uiState.asStateFlow()

    private var loadJob: kotlinx.coroutines.Job? = null

    /** Retorna o ID do usuario atual */
    fun getCurrentUserId(): String? = authRepository.getCurrentUserId()

    /** Retorna o nome de exibicao do usuario atual */
    suspend fun getCurrentUserName(): String {
        return authRepository.getCurrentUser().getOrNull()?.name ?: ""
    }

    init {
        loadSchedules()
    }

    /**
     * Carrega os horarios do usuario atual.
     * CMD-08: Logs adicionados para debug de filtro vazio.
     */
    private fun loadSchedules() {
        // Cancelar job anterior para evitar duplicacao (CMD-08)
        loadJob?.cancel()

        val userId = authRepository.getCurrentUserId()
        if (userId == null) {
            AppLogger.e(TAG, "loadSchedules: userId e null, usuario nao autenticado")
            _uiState.value = SchedulesUiState.Error("Usuario nao autenticado")
            return
        }

        AppLogger.d(TAG) { "loadSchedules: Carregando schedules para userId=$userId" }

        loadJob = viewModelScope.launch {
            scheduleRepository.getSchedules(userId)
                .catch { e ->
                    // Tratamento de erro de fluxo: converter para estado de erro
                    AppLogger.e(TAG, "loadSchedules: Erro no flow - ${e.message}", e)
                    _uiState.value = SchedulesUiState.Error(e.message ?: "Erro ao carregar recorrencias")
                }
                .collect { result ->
                    result.fold(
                        onSuccess = { schedules ->
                            AppLogger.d(TAG) { "loadSchedules: Sucesso - ${schedules.size} schedules carregadas" }
                            // CMD-08: Log detalhado para debug
                            schedules.forEach { schedule ->
                                AppLogger.d(TAG) { "  - Schedule: ${schedule.name} (${schedule.id}) ownerId=${schedule.ownerId}" }
                            }
                            _uiState.value = SchedulesUiState.Success(schedules)
                        },
                        onFailure = { error ->
                            AppLogger.e(TAG, "loadSchedules: Falha - ${error.message}", error)
                            _uiState.value = SchedulesUiState.Error(error.message ?: "Erro ao carregar recorrencias")
                        }
                    )
                }
        }
    }

    /**
     * Recarrega os horarios (para botao de refresh).
     * CMD-08: Adicionado para debug de problemas de carga.
     */
    fun refresh() {
        AppLogger.d(TAG) { "refresh: Recarregando schedules..." }
        _uiState.value = SchedulesUiState.Loading
        loadSchedules()
    }

    /**
     * Cria um novo horario recorrente.
     * CMD-09: Adicionado para suportar criacao via FAB.
     */
    fun createSchedule(schedule: Schedule) {
        AppLogger.d(TAG) { "createSchedule: Criando schedule ${schedule.name}" }
        viewModelScope.launch {
            scheduleRepository.createSchedule(schedule)
                .onSuccess { scheduleId ->
                    AppLogger.d(TAG) { "createSchedule: Sucesso - ID=$scheduleId" }
                    // Nao mudamos o estado aqui pois o listener real-time vai atualizar
                }
                .onFailure { error ->
                    AppLogger.e(TAG, "createSchedule: Erro - ${error.message}", error)
                    _uiState.value = SchedulesUiState.Error(error.message ?: "Erro ao criar horario")
                }
        }
    }

    fun deleteSchedule(scheduleId: String) {
        AppLogger.d(TAG) { "deleteSchedule: Excluindo schedule $scheduleId" }
        viewModelScope.launch {
            scheduleRepository.deleteSchedule(scheduleId).onFailure { error ->
                AppLogger.e(TAG, "deleteSchedule: Erro - ${error.message}", error)
                _uiState.value = SchedulesUiState.Error(error.message ?: "Erro ao excluir")
            }
        }
    }

    fun updateSchedule(schedule: Schedule) {
        AppLogger.d(TAG) { "updateSchedule: Atualizando schedule ${schedule.id}" }
        viewModelScope.launch {
            scheduleRepository.updateSchedule(schedule).onFailure { error ->
                AppLogger.e(TAG, "updateSchedule: Erro - ${error.message}", error)
                _uiState.value = SchedulesUiState.Error(error.message ?: "Erro ao atualizar")
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }
}

sealed class SchedulesUiState {
    object Loading : SchedulesUiState()
    data class Success(val schedules: List<Schedule>) : SchedulesUiState()
    data class Error(val message: String) : SchedulesUiState()
}
