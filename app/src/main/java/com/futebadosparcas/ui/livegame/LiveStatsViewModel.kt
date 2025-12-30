package com.futebadosparcas.ui.livegame

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.LivePlayerStats
import com.futebadosparcas.data.repository.LiveGameRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LiveStatsViewModel @Inject constructor(
    private val liveGameRepository: LiveGameRepository
) : ViewModel() {

    private val _stats = MutableStateFlow<List<LivePlayerStats>>(emptyList())
    val stats: StateFlow<List<LivePlayerStats>> = _stats

    fun observeStats(gameId: String) {
        viewModelScope.launch {
            liveGameRepository.observeLivePlayerStats(gameId).collect { statsList ->
                // Ordenar por gols (maior primeiro)
                _stats.value = statsList.sortedByDescending { it.goals }
            }
        }
    }
}
