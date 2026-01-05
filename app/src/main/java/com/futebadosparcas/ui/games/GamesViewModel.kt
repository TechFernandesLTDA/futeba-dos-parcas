package com.futebadosparcas.ui.games

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.GameFilterType
import com.futebadosparcas.util.AppLogger
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import javax.inject.Inject

data class GameWithConfirmations(
    val game: Game,
    val confirmedCount: Int,
    val isUserConfirmed: Boolean = false
)

@HiltViewModel
class GamesViewModel @Inject constructor(
    private val gameRepository: GameRepository,
    private val notificationRepository: com.futebadosparcas.data.repository.NotificationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<GamesUiState>(GamesUiState.Loading)
    val uiState: StateFlow<GamesUiState> = _uiState

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount

    // Mantem referencia do job de coleta atual para cancelar ao trocar filtro
    private var currentJob: kotlinx.coroutines.Job? = null

    init {
        loadGames(GameFilterType.ALL)
        observeUnreadCount()
    }

    private fun observeUnreadCount() {
        viewModelScope.launch {
            notificationRepository.getUnreadCountFlow()
                .catch { e ->
                    // Tratamento de erro: zerar contador em caso de falha
                    AppLogger.e(TAG, "Erro ao observar notificacoes", e)
                    _unreadCount.value = 0
                }
                .collect { count ->
                    _unreadCount.value = count
                }
        }
    }

    fun loadGames(filterType: GameFilterType = GameFilterType.ALL) {
        currentJob?.cancel()
        
        currentJob = viewModelScope.launch {
            _uiState.value = GamesUiState.Loading

            when (filterType) {
                GameFilterType.MY_GAMES -> {
                    // Carregamento único (Suspend) para Meus Jogos (otimização de leitura)
                    gameRepository.getGamesByFilter(GameFilterType.MY_GAMES)
                        .onSuccess { games ->
                             if (games.isEmpty()) _uiState.value = GamesUiState.Empty
                             else _uiState.value = GamesUiState.Success(games)
                        }
                        .onFailure { error ->
                            _uiState.value = GamesUiState.Error(error.message ?: "Erro ao carregar meus jogos")
                        }
                }
                else -> { // ALL (Live + Upcoming) ou OPEN (filtro em memória depois)
                    // Flow Realtime para jogos principais
                    gameRepository.getLiveAndUpcomingGamesFlow()
                        .catch { e ->
                            // Tratamento de erro de fluxo
                            AppLogger.e(TAG, "Erro no fluxo de jogos", e)
                            _uiState.value = GamesUiState.Error(e.message ?: "Erro ao carregar jogos")
                        }
                        .collect { result ->
                            result.fold(
                                onSuccess = { games ->
                                    val filtered = if (filterType == GameFilterType.OPEN) {
                                        games.filter { it.game.status == "SCHEDULED" } // Filtro simples de string
                                    } else {
                                        games
                                    }

                                    _uiState.value = if (filtered.isEmpty()) {
                                        // Se vazio, tenta carregar histórico recente? Por enquanto mostra vazio.
                                        GamesUiState.Empty
                                    } else {
                                        GamesUiState.Success(filtered)
                                    }
                                },
                                onFailure = { error ->
                                    AppLogger.e(TAG, "Erro ao carregar jogos", error)
                                    _uiState.value = GamesUiState.Error(error.message ?: "Erro ao carregar jogos")
                                }
                            )
                        }
                }
            }
        }
    }

    /**
     * Confirma presença rapidamente na lista de jogos.
     * Usa posição FIELD como padrão.
     */
    fun quickConfirmPresence(gameId: String) {
        viewModelScope.launch {
            val result = gameRepository.confirmPresence(gameId, "FIELD", false)
            result.fold(
                onSuccess = {
                    AppLogger.d(TAG) { "Presença confirmada com sucesso no jogo $gameId" }
                },
                onFailure = { error ->
                    AppLogger.e(TAG, "Erro ao confirmar presença", error)
                }
            )
        }
    }

    companion object {
        private const val TAG = "GamesViewModel"
    }
}

sealed class GamesUiState {
    object Loading : GamesUiState()
    object Empty : GamesUiState()
    data class Success(val games: List<GameWithConfirmations>) : GamesUiState()
    data class Error(val message: String) : GamesUiState()
}
