package com.futebadosparcas.ui.preferences

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PreferencesViewModel @Inject constructor(
    private val userRepository: UserRepository
) : ViewModel() {

    private val _isSearchable = MutableStateFlow(true)
    val isSearchable: StateFlow<Boolean> = _isSearchable.asStateFlow()

    init {
        loadProfileVisibility()
    }

    private fun loadProfileVisibility() {
        viewModelScope.launch {
            userRepository.getCurrentUser().onSuccess {
                _isSearchable.value = it.isSearchable
            }
        }
    }

    fun setProfileVisibility(isSearchable: Boolean) {
        viewModelScope.launch {
            val userId = userRepository.getCurrentUserId()
            if (userId != null) {
                userRepository.updateProfileVisibility(userId, isSearchable)
                _isSearchable.value = isSearchable
            }
        }
    }
}