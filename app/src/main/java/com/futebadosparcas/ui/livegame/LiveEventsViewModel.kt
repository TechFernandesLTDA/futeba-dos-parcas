package com.futebadosparcas.ui.livegame

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.GameEvent
import com.futebadosparcas.data.repository.LiveGameRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LiveEventsViewModel @Inject constructor(
    private val liveGameRepository: LiveGameRepository
) : ViewModel() {

    private val _events = MutableStateFlow<List<GameEvent>>(emptyList())
    val events: StateFlow<List<GameEvent>> = _events

    fun observeEvents(gameId: String) {
        viewModelScope.launch {
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
}
