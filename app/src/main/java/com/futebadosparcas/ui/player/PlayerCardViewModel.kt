package com.futebadosparcas.ui.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.FollowRepository
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.repository.UserRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

class PlayerCardViewModel(
    private val userRepository: UserRepository,
    private val statisticsRepository: StatisticsRepository,
    private val followRepository: FollowRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<PlayerCardUiState>(PlayerCardUiState.Loading)
    val uiState: StateFlow<PlayerCardUiState> = _uiState.asStateFlow()
    private var followObservationJob: Job? = null

    fun loadPlayerData(userId: String) {
        viewModelScope.launch {
            _uiState.value = PlayerCardUiState.Loading
            followObservationJob?.cancel()

            try {
                // Buscar dados do usuário
                val userResult = userRepository.getUserById(userId)
                
                if (userResult.isFailure) {
                    _uiState.value = PlayerCardUiState.Error("Usuário não encontrado")
                    return@launch
                }
                
                val user = userResult.getOrNull()
                if (user == null) {
                    _uiState.value = PlayerCardUiState.Error("Usuário não encontrado")
                    return@launch
                }

                // Buscar estatísticas
                val statsResult = statisticsRepository.getUserStatistics(userId)
                val statistics = statsResult.getOrNull() // Já é domain.model.Statistics (KMP)

                _uiState.value = PlayerCardUiState.Success(
                    user = user,
                    statistics = statistics,
                    followState = FollowUiState(
                        canFollow = followRepository.canFollow(userId)
                    )
                )
                observeFollowState(userId)

            } catch (e: Exception) {
                _uiState.value = PlayerCardUiState.Error(e.message ?: "Erro ao carregar dados")
            }
        }
    }

    fun toggleFollow() {
        val currentState = _uiState.value as? PlayerCardUiState.Success ?: return
        val followState = currentState.followState
        if (!followState.canFollow || followState.isUpdating) return

        val nextFollowing = !followState.isFollowing
        _uiState.value = currentState.copy(
            user = currentState.user.withAdjustedFollowCounts(nextFollowing, followState.isFollowing),
            followState = followState.copy(
                isFollowing = nextFollowing,
                isUpdating = true,
                errorMessage = null
            )
        )

        viewModelScope.launch {
            followRepository.toggleFollow(currentState.user.id, nextFollowing)
                .onSuccess { confirmedFollowing ->
                    updateFollowState {
                        it.copy(
                            isFollowing = confirmedFollowing,
                            isUpdating = false,
                            errorMessage = null
                        )
                    }
                }
                .onFailure { error ->
                    val revertedUser = (_uiState.value as? PlayerCardUiState.Success)?.user
                        ?.withAdjustedFollowCounts(followState.isFollowing, nextFollowing)
                        ?: currentState.user
                    updateSuccessState {
                        it.copy(
                            user = revertedUser,
                            followState = it.followState.copy(
                                isFollowing = followState.isFollowing,
                                isUpdating = false,
                                errorMessage = error.message ?: "Erro ao atualizar follow"
                            )
                        )
                    }
                }
        }
    }

    private fun observeFollowState(userId: String) {
        if (!followRepository.canFollow(userId)) return

        followObservationJob = viewModelScope.launch {
            followRepository.observeFollowing(userId)
                .catch { error ->
                    updateFollowState { it.copy(errorMessage = error.message) }
                }
                .collect { isFollowing ->
                    updateFollowState {
                        it.copy(isFollowing = isFollowing, errorMessage = null)
                    }
                }
        }
    }

    private fun updateFollowState(transform: (FollowUiState) -> FollowUiState) {
        updateSuccessState { state ->
            state.copy(followState = transform(state.followState))
        }
    }

    private fun updateSuccessState(transform: (PlayerCardUiState.Success) -> PlayerCardUiState.Success) {
        val current = _uiState.value as? PlayerCardUiState.Success ?: return
        _uiState.value = transform(current)
    }

    private fun User.withAdjustedFollowCounts(isFollowingNow: Boolean, wasFollowing: Boolean): User {
        if (isFollowingNow == wasFollowing) return this
        val delta = if (isFollowingNow) 1 else -1
        return copy(followersCount = (followersCount + delta).coerceAtLeast(0))
    }
}

sealed class PlayerCardUiState {
    object Loading : PlayerCardUiState()
    data class Success(
        val user: User,
        val statistics: Statistics?,
        val followState: FollowUiState = FollowUiState()
    ) : PlayerCardUiState()
    data class Error(val message: String) : PlayerCardUiState()
}

data class FollowUiState(
    val canFollow: Boolean = false,
    val isFollowing: Boolean = false,
    val isUpdating: Boolean = false,
    val errorMessage: String? = null
)
