package com.futebadosparcas.ui.livegame

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.data.repository.LiveGameRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

class LiveEventsViewModel(
    private val liveGameRepository: LiveGameRepository
) : ViewModel() {

    private val _events = MutableStateFlow<List<GameEvent>>(emptyList())
    val events: StateFlow<List<GameEvent>> = _events

    // Job tracking para cancelamento em onCleared (fix memory leak)
    private var eventsJob: kotlinx.coroutines.Job? = null

    fun observeEvents(gameId: String) {
        // Cancelar job anterior para evitar listeners duplicados
        eventsJob?.cancel()
        eventsJob = viewModelScope.launch {
            liveGameRepository.observeGameEvents(gameId)
                .catch { e ->
                    // Tratamento de erro: em caso de falha, manter lista vazia
                    _events.value = emptyList()
                }
                .collect { eventsList ->
                    _events.value = eventsList
                }
        }
    }

    override fun onCleared() {
        super.onCleared()
        // Cancelar job de observacao para evitar memory leaks
        eventsJob?.cancel()
        eventsJob = null
    }
}
