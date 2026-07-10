package com.futebadosparcas.ui.livegame

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.LivePlayerStats
import com.futebadosparcas.domain.repository.LiveGameRepository
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

class LiveStatsViewModel(
    private val liveGameRepository: LiveGameRepository
) : ViewModel() {

    companion object {
        private const val TAG = "LiveStatsViewModel"
    }

    private val _stats = MutableStateFlow<List<LivePlayerStats>>(emptyList())
    val stats: StateFlow<List<LivePlayerStats>> = _stats

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    // Job tracking para cancelamento em onCleared (fix memory leak)
    private var statsJob: kotlinx.coroutines.Job? = null

    fun observeStats(gameId: String) {
        // Cancelar job anterior para evitar listeners duplicados
        statsJob?.cancel()
        statsJob = viewModelScope.launch {
            liveGameRepository.observeLivePlayerStats(gameId)
                .catch { e ->
                    AppLogger.e(TAG, "Erro ao observar estatísticas ao vivo", e)
                    _error.value = e.message ?: "Erro ao carregar estatísticas"
                }
                .collect { statsList ->
                    _error.value = null
                    // Ordenar por gols (maior primeiro)
                    _stats.value = statsList.sortedByDescending { it.goals }
                }
        }
    }

    override fun onCleared() {
        super.onCleared()
        // Cancelar job de observacao para evitar memory leaks
        statsJob?.cancel()
        statsJob = null
    }
}
