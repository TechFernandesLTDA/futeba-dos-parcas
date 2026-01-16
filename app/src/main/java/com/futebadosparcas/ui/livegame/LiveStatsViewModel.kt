package com.futebadosparcas.ui.livegame

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.LivePlayerStats
import com.futebadosparcas.data.repository.LiveGameRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LiveStatsViewModel @Inject constructor(
    private val liveGameRepository: LiveGameRepository
) : ViewModel() {

    private val _stats = MutableStateFlow<List<LivePlayerStats>>(emptyList())
    val stats: StateFlow<List<LivePlayerStats>> = _stats

    // Job tracking para cancelamento em onCleared (fix memory leak)
    private var statsJob: kotlinx.coroutines.Job? = null

    fun observeStats(gameId: String) {
        // Cancelar job anterior para evitar listeners duplicados
        statsJob?.cancel()
        statsJob = viewModelScope.launch {
            liveGameRepository.observeLivePlayerStats(gameId)
                .catch { e ->
                    // Tratamento de erro: em caso de falha, manter lista vazia
                    // Log pode ser adicionado aqui se necessario
                    _stats.value = emptyList()
                }
                .collect { statsList ->
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
