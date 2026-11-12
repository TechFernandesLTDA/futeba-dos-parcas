package com.futebadosparcas.ui.core

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.GameWithConfirmations
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

/**
 * Estados semânticos para a UI de listagem de jogos
 */
sealed class GamesUiState {
    /** Carregando dados iniciais */
    object Loading : GamesUiState()

    /** Nenhum jogo encontrado */
    object Empty : GamesUiState()

    /** Jogos carregados com sucesso */
    data class Success(val games: List<GameWithConfirmations>) : GamesUiState()

    /** Erro ao carregar */
    data class Error(val message: String) : GamesUiState()
}

/**
 * ViewModel da tela de jogos
 *
 * - Carrega todos os jogos com contagem de confirmações via fluxo reativo
 * - Gerencia os estados: Loading, Empty, Success, Error
 * - Expõe uiState como StateFlow coletado pela tela
 * - Recebe a fonte de jogos por Koin (koinViewModel): no iOS vem do Firestore
 *   (módulo da plataforma); sem ela a tela mostra o estado "indisponível".
 */
class GamesViewModel(
    private val observeGames: () -> Flow<Result<List<GameWithConfirmations>>>
) : ViewModel() {

    private val _uiState = MutableStateFlow<GamesUiState>(GamesUiState.Loading)
    val uiState: StateFlow<GamesUiState> = _uiState

    init {
        loadGames()
    }

    /**
     * Inicia a coleta do fluxo de jogos com contagem de confirmações.
     * Atualiza o estado da UI conforme os resultados.
     */
    fun loadGames() {
        viewModelScope.launch {
            _uiState.value = GamesUiState.Loading
            observeGames()
                .catch { e ->
                    _uiState.value = GamesUiState.Error(e.message ?: "Erro inesperado")
                }
                .collect { result ->
                    result.fold(
                        onSuccess = { games ->
                            _uiState.value = if (games.isEmpty()) {
                                GamesUiState.Empty
                            } else {
                                GamesUiState.Success(games)
                            }
                        },
                        onFailure = { error ->
                            _uiState.value = GamesUiState.Error(
                                error.message ?: "Erro ao carregar jogos"
                            )
                        }
                    )
                }
        }
    }
}