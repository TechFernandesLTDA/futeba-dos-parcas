package com.futebadosparcas.ui.livegame

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.data.repository.LiveGameRepository
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

class LiveEventsViewModel(
    private val liveGameRepository: LiveGameRepository
) : ViewModel() {

    companion object {
        private const val TAG = "LiveEventsViewModel"
    }

    private val _events = MutableStateFlow<List<GameEvent>>(emptyList())
    val events: StateFlow<List<GameEvent>> = _events

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    // Job tracking para cancelamento em onCleared (fix memory leak)
    private var eventsJob: kotlinx.coroutines.Job? = null

    fun observeEvents(gameId: String) {
        // Cancelar job anterior para evitar listeners duplicados
        eventsJob?.cancel()
        eventsJob = viewModelScope.launch {
            liveGameRepository.observeGameEvents(gameId)
                .catch { e ->
                    AppLogger.e(TAG, "Erro ao observar eventos do jogo: ${e.message}", e)
                    _error.value = e.message ?: "Erro ao carregar eventos"
                }
                .collect { eventsList ->
                    _error.value = null
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
