package com.futebadosparcas.ui.games.owner

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.BlockedPlayer
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.GroupRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface BlockedPlayersUiState {
    data object Loading : BlockedPlayersUiState
    data class Success(
        val gameId: String,
        val groupId: String,
        val blockedPlayers: List<BlockedPlayer>,
        val availablePlayers: List<GameConfirmation>,
        val isActionLoading: Boolean = false,
        val userMessage: String? = null
    ) : BlockedPlayersUiState
    data class Error(val message: String) : BlockedPlayersUiState
}

/**
 * Issue #64 / Modernizacao D15 (Onda C7):
 * ViewModel responsavel por gerenciar jogadores bloqueados de um grupo a partir de um jogo.
 */
class BlockedPlayersViewModel(
    private val gameRepository: GameRepository,
    private val groupRepository: GroupRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<BlockedPlayersUiState>(BlockedPlayersUiState.Loading)
    val uiState: StateFlow<BlockedPlayersUiState> = _uiState.asStateFlow()

    private var currentGameId: String? = null

    fun load(gameId: String) {
        currentGameId = gameId
        _uiState.value = BlockedPlayersUiState.Loading

        viewModelScope.launch {
            val gameResult = gameRepository.getGameDetails(gameId)
            val game = gameResult.getOrElse { error ->
                _uiState.value = BlockedPlayersUiState.Error(
                    error.message ?: "Erro ao carregar detalhes do jogo"
                )
                return@launch
            }

            val groupId = game.groupId
            if (groupId.isNullOrBlank()) {
                _uiState.value = BlockedPlayersUiState.Error("Jogo não está vinculado a nenhum grupo")
                return@launch
            }

            val blockedResult = groupRepository.getBlockedPlayers(groupId)
            val blockedPlayers = blockedResult.getOrElse { error ->
                _uiState.value = BlockedPlayersUiState.Error(
                    error.message ?: "Erro ao carregar jogadores bloqueados"
                )
                return@launch
            }

            val confirmationsResult = gameRepository.getGameConfirmations(gameId)
            val confirmations = confirmationsResult.getOrDefault(emptyList())

            val blockedIds = blockedPlayers.map { it.userId }.toSet()
            val availablePlayers = confirmations.filterNot { it.userId in blockedIds }

            _uiState.value = BlockedPlayersUiState.Success(
                gameId = gameId,
                groupId = groupId,
                blockedPlayers = blockedPlayers,
                availablePlayers = availablePlayers
            )
        }
    }

    fun retry() {
        currentGameId?.let { load(it) }
    }

    fun blockPlayer(userId: String, userName: String, reason: String) {
        val currentState = _uiState.value as? BlockedPlayersUiState.Success ?: return
        val currentUserId = authRepository.getCurrentUserId() ?: ""

        _uiState.value = currentState.copy(isActionLoading = true, userMessage = null)

        viewModelScope.launch {
            val result = groupRepository.blockPlayer(
                groupId = currentState.groupId,
                userId = userId,
                userName = userName,
                reason = reason,
                blockedBy = currentUserId
            )

            if (result.isSuccess) {
                load(currentState.gameId)
            } else {
                _uiState.value = currentState.copy(
                    isActionLoading = false,
                    userMessage = result.exceptionOrNull()?.message ?: "Erro ao bloquear jogador"
                )
            }
        }
    }

    fun unblockPlayer(userId: String) {
        val currentState = _uiState.value as? BlockedPlayersUiState.Success ?: return

        _uiState.value = currentState.copy(isActionLoading = true, userMessage = null)

        viewModelScope.launch {
            val result = groupRepository.unblockPlayer(
                groupId = currentState.groupId,
                userId = userId
            )

            if (result.isSuccess) {
                load(currentState.gameId)
            } else {
                _uiState.value = currentState.copy(
                    isActionLoading = false,
                    userMessage = result.exceptionOrNull()?.message ?: "Erro ao desbloquear jogador"
                )
            }
        }
    }

    fun clearUserMessage() {
        val currentState = _uiState.value as? BlockedPlayersUiState.Success ?: return
        _uiState.value = currentState.copy(userMessage = null)
    }
}
