package com.futebadosparcas.ui.groups

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.GameSummon
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.data.model.UpcomingGame
import com.futebadosparcas.data.repository.GameSummonRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch

class GameSummonViewModel(
    private val gameSummonRepository: GameSummonRepository
) : ViewModel() {

    private val _pendingSummonsState = MutableStateFlow<PendingSummonsState>(PendingSummonsState.Loading)
    val pendingSummonsState: StateFlow<PendingSummonsState> = _pendingSummonsState

    private val _upcomingGamesState = MutableStateFlow<UpcomingGamesState>(UpcomingGamesState.Loading)
    val upcomingGamesState: StateFlow<UpcomingGamesState> = _upcomingGamesState

    private val _gameSummonsState = MutableStateFlow<GameSummonsState>(GameSummonsState.Loading)
    val gameSummonsState: StateFlow<GameSummonsState> = _gameSummonsState

    private val _actionState = MutableStateFlow<SummonActionState>(SummonActionState.Idle)
    val actionState: StateFlow<SummonActionState> = _actionState

    private val _pendingCount = MutableStateFlow(0)
    val pendingCount: StateFlow<Int> = _pendingCount

    init {
        observePendingSummons()
        observeUpcomingGames()
    }

    private fun observePendingSummons() {
        gameSummonRepository.getMyPendingSummonsFlow()
            .onEach { summons ->
                _pendingCount.value = summons.size
                _pendingSummonsState.value = if (summons.isEmpty()) {
                    PendingSummonsState.Empty
                } else {
                    PendingSummonsState.Success(summons)
                }
            }
            .catch { e ->
                _pendingSummonsState.value = PendingSummonsState.Error(
                    e.message ?: "Erro ao carregar convocações"
                )
            }
            .launchIn(viewModelScope)
    }

    private fun observeUpcomingGames() {
        gameSummonRepository.getMyUpcomingGamesFlow(limit = 10)
            .onEach { games ->
                _upcomingGamesState.value = if (games.isEmpty()) {
                    UpcomingGamesState.Empty
                } else {
                    UpcomingGamesState.Success(games)
                }
            }
            .catch { e ->
                _upcomingGamesState.value = UpcomingGamesState.Error(
                    e.message ?: "Erro ao carregar agenda"
                )
            }
            .launchIn(viewModelScope)
    }

    fun loadPendingSummons() {
        viewModelScope.launch {
            _pendingSummonsState.value = PendingSummonsState.Loading

            val result = gameSummonRepository.getMyPendingSummons()

            result.fold(
                onSuccess = { summons ->
                    _pendingCount.value = summons.size
                    _pendingSummonsState.value = if (summons.isEmpty()) {
                        PendingSummonsState.Empty
                    } else {
                        PendingSummonsState.Success(summons)
                    }
                },
                onFailure = { error ->
                    _pendingSummonsState.value = PendingSummonsState.Error(
                        error.message ?: "Erro ao carregar convocações"
                    )
                }
            )
        }
    }

    fun loadUpcomingGames() {
        viewModelScope.launch {
            _upcomingGamesState.value = UpcomingGamesState.Loading

            val result = gameSummonRepository.getMyUpcomingGames(limit = 10)

            result.fold(
                onSuccess = { games ->
                    _upcomingGamesState.value = if (games.isEmpty()) {
                        UpcomingGamesState.Empty
                    } else {
                        UpcomingGamesState.Success(games)
                    }
                },
                onFailure = { error ->
                    _upcomingGamesState.value = UpcomingGamesState.Error(
                        error.message ?: "Erro ao carregar agenda"
                    )
                }
            )
        }
    }

    fun loadGameSummons(gameId: String) {
        viewModelScope.launch {
            _gameSummonsState.value = GameSummonsState.Loading

            val result = gameSummonRepository.getGameSummons(gameId)

            result.fold(
                onSuccess = { summons ->
                    _gameSummonsState.value = if (summons.isEmpty()) {
                        GameSummonsState.Empty
                    } else {
                        GameSummonsState.Success(summons)
                    }
                },
                onFailure = { error ->
                    _gameSummonsState.value = GameSummonsState.Error(
                        error.message ?: "Erro ao carregar convocações do jogo"
                    )
                }
            )
        }
    }

    fun observeGameSummons(gameId: String) {
        gameSummonRepository.getGameSummonsFlow(gameId)
            .onEach { summons ->
                _gameSummonsState.value = if (summons.isEmpty()) {
                    GameSummonsState.Empty
                } else {
                    GameSummonsState.Success(summons)
                }
            }
            .catch { e ->
                _gameSummonsState.value = GameSummonsState.Error(
                    e.message ?: "Erro ao observar convocações"
                )
            }
            .launchIn(viewModelScope)
    }

    fun acceptSummon(gameId: String, position: PlayerPosition) {
        viewModelScope.launch {
            _actionState.value = SummonActionState.Loading

            val result = gameSummonRepository.acceptSummon(gameId, position)

            result.fold(
                onSuccess = {
                    _actionState.value = SummonActionState.Accepted(
                        "Presença confirmada como ${position.name}!"
                    )
                },
                onFailure = { error ->
                    _actionState.value = SummonActionState.Error(
                        error.message ?: "Erro ao confirmar presença"
                    )
                }
            )
        }
    }

    fun declineSummon(gameId: String) {
        viewModelScope.launch {
            _actionState.value = SummonActionState.Loading

            val result = gameSummonRepository.declineSummon(gameId)

            result.fold(
                onSuccess = {
                    _actionState.value = SummonActionState.Declined("Convocação recusada")
                },
                onFailure = { error ->
                    _actionState.value = SummonActionState.Error(
                        error.message ?: "Erro ao recusar convocação"
                    )
                }
            )
        }
    }

    fun cancelPresence(gameId: String) {
        viewModelScope.launch {
            _actionState.value = SummonActionState.Loading

            val result = gameSummonRepository.cancelPresence(gameId)

            result.fold(
                onSuccess = {
                    _actionState.value = SummonActionState.Cancelled("Presença cancelada")
                },
                onFailure = { error ->
                    _actionState.value = SummonActionState.Error(
                        error.message ?: "Erro ao cancelar presença"
                    )
                }
            )
        }
    }

    fun createSummonsForGame(
        gameId: String,
        groupId: String,
        gameDate: String,
        locationName: String
    ) {
        viewModelScope.launch {
            _actionState.value = SummonActionState.Loading

            val result = gameSummonRepository.createSummonsForGame(
                gameId = gameId,
                groupId = groupId,
                gameDate = gameDate,
                locationName = locationName
            )

            result.fold(
                onSuccess = { count ->
                    _actionState.value = SummonActionState.SummonsSent(
                        "$count jogadores convocados"
                    )
                },
                onFailure = { error ->
                    _actionState.value = SummonActionState.Error(
                        error.message ?: "Erro ao convocar jogadores"
                    )
                }
            )
        }
    }

    suspend fun getMySummonForGame(gameId: String): GameSummon? {
        return gameSummonRepository.getMySummonForGame(gameId).getOrNull()
    }

    suspend fun isSummonedForGame(gameId: String): Boolean {
        return gameSummonRepository.isSummonedForGame(gameId).getOrDefault(false)
    }

    fun resetActionState() {
        _actionState.value = SummonActionState.Idle
    }
}

sealed class PendingSummonsState {
    object Loading : PendingSummonsState()
    object Empty : PendingSummonsState()
    data class Success(val summons: List<GameSummon>) : PendingSummonsState()
    data class Error(val message: String) : PendingSummonsState()
}

sealed class UpcomingGamesState {
    object Loading : UpcomingGamesState()
    object Empty : UpcomingGamesState()
    data class Success(val games: List<UpcomingGame>) : UpcomingGamesState()
    data class Error(val message: String) : UpcomingGamesState()
}

sealed class GameSummonsState {
    object Loading : GameSummonsState()
    object Empty : GameSummonsState()
    data class Success(val summons: List<GameSummon>) : GameSummonsState()
    data class Error(val message: String) : GameSummonsState()
}

sealed class SummonActionState {
    object Idle : SummonActionState()
    object Loading : SummonActionState()
    data class Accepted(val message: String) : SummonActionState()
    data class Declined(val message: String) : SummonActionState()
    data class Cancelled(val message: String) : SummonActionState()
    data class SummonsSent(val message: String) : SummonActionState()
    data class Error(val message: String) : SummonActionState()
}
