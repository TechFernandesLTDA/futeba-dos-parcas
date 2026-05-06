package com.futebadosparcas.ui.groups

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.repository.GroupRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

/**
 * Estados da tela de descoberta de grupos publicos (issue #517 Phase 1.b).
 */
sealed class DiscoverGroupsUiState {
    data object Loading : DiscoverGroupsUiState()
    data object Empty : DiscoverGroupsUiState()
    data class Success(val groups: List<Group>) : DiscoverGroupsUiState()
    data class Error(val message: String) : DiscoverGroupsUiState()
}

/**
 * ViewModel da tela de descoberta de grupos publicos.
 *
 * Lista grupos com is_public=true (excluindo soft-deleted), com filtro
 * client-side por nome ou descricao. Phase 1.b e read-only — Phase 2
 * adiciona "Pedir entrada" + aprovacao do owner.
 *
 * Espelha PR #521 (web) para paridade Android/Web.
 */
class DiscoverGroupsViewModel(
    private val groupRepository: GroupRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<DiscoverGroupsUiState>(DiscoverGroupsUiState.Loading)
    val uiState: StateFlow<DiscoverGroupsUiState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private var allGroups: List<Group> = emptyList()
    private var loadJob: Job? = null

    init {
        load()
    }

    fun load() {
        loadJob?.cancel()
        _uiState.value = DiscoverGroupsUiState.Loading
        loadJob = groupRepository.getPublicGroupsFlow()
            .onEach { result ->
                result.fold(
                    onSuccess = { groups ->
                        allGroups = groups
                        updateFiltered()
                    },
                    onFailure = { e ->
                        _uiState.value = DiscoverGroupsUiState.Error(
                            e.message ?: "Erro ao carregar grupos"
                        )
                    }
                )
            }
            .catch { e ->
                _uiState.value = DiscoverGroupsUiState.Error(
                    e.message ?: "Erro ao carregar grupos"
                )
            }
            .launchIn(viewModelScope)
    }

    fun onSearchQueryChange(query: String) {
        _searchQuery.value = query
        updateFiltered()
    }

    private fun updateFiltered() {
        val query = _searchQuery.value.trim().lowercase()
        val filtered = if (query.isBlank()) {
            allGroups
        } else {
            allGroups.filter { group ->
                group.name.lowercase().contains(query) ||
                    group.description.lowercase().contains(query)
            }
        }
        _uiState.value = if (filtered.isEmpty()) {
            DiscoverGroupsUiState.Empty
        } else {
            DiscoverGroupsUiState.Success(filtered)
        }
    }

    override fun onCleared() {
        loadJob?.cancel()
        super.onCleared()
    }
}
