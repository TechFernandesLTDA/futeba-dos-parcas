package com.futebadosparcas.ui.groups

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.GroupJoinRequest
import com.futebadosparcas.domain.model.GroupJoinRequestStatus
import com.futebadosparcas.domain.repository.GroupRepository
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch

/**
 * Estado do request do USUARIO ATUAL em um grupo (issue #517 Phase 2).
 */
sealed class MyJoinRequestState {
    data object Loading : MyJoinRequestState()
    data object NotRequested : MyJoinRequestState()
    data class Pending(val request: GroupJoinRequest) : MyJoinRequestState()
    data class Approved(val request: GroupJoinRequest) : MyJoinRequestState()
    data class Rejected(val request: GroupJoinRequest) : MyJoinRequestState()
    data class Error(val message: String) : MyJoinRequestState()
}

/**
 * ViewModel para join_requests (issue #517 Phase 2).
 *
 * Carrega o request do usuario atual + lista de pending (se owner/admin).
 * Tela usa apenas as partes que precisa.
 *
 * Migrado em 2026-05-07: agora usa `GroupRepository` (shared, cross-platform)
 * em vez de `JoinRequestRepository` (Android-only). iOS e Android compartilham
 * a mesma logica via `nativeAndAndroidMain`.
 */
class JoinRequestViewModel(
    private val groupRepository: GroupRepository,
) : ViewModel() {

    private val _myRequestState =
        MutableStateFlow<MyJoinRequestState>(MyJoinRequestState.Loading)
    val myRequestState: StateFlow<MyJoinRequestState> = _myRequestState.asStateFlow()

    private val _pendingRequests = MutableStateFlow<List<GroupJoinRequest>>(emptyList())
    val pendingRequests: StateFlow<List<GroupJoinRequest>> = _pendingRequests.asStateFlow()

    private val _pendingRequestsError = MutableStateFlow<Throwable?>(null)
    val pendingRequestsError: StateFlow<Throwable?> = _pendingRequestsError.asStateFlow()

    private val _isSubmitting = MutableStateFlow(false)
    val isSubmitting: StateFlow<Boolean> = _isSubmitting.asStateFlow()

    private val _actioningRequesterId = MutableStateFlow<String?>(null)
    val actioningRequesterId: StateFlow<String?> = _actioningRequesterId.asStateFlow()

    private var myRequestJob: Job? = null
    private var pendingJob: Job? = null

    /**
     * Inicia listener do request do usuario atual neste grupo.
     */
    fun observeMyRequest(groupId: String) {
        myRequestJob?.cancel()
        _myRequestState.value = MyJoinRequestState.Loading
        myRequestJob = groupRepository.observeMyJoinRequest(groupId)
            .onEach { req ->
                _myRequestState.value = when (req?.status) {
                    null -> MyJoinRequestState.NotRequested
                    GroupJoinRequestStatus.PENDING -> MyJoinRequestState.Pending(req)
                    GroupJoinRequestStatus.APPROVED -> MyJoinRequestState.Approved(req)
                    GroupJoinRequestStatus.REJECTED -> MyJoinRequestState.Rejected(req)
                }
            }
            .catch { e ->
                _myRequestState.value =
                    MyJoinRequestState.Error(e.message ?: "Erro ao carregar pedido")
            }
            .launchIn(viewModelScope)
    }

    /**
     * Inicia listener de pending requests (apenas owner/admin tem rule de read).
     */
    fun observePendingRequests(groupId: String) {
        pendingJob?.cancel()
        pendingJob = groupRepository.observePendingJoinRequests(groupId)
            .onEach { items ->
                _pendingRequestsError.value = null
                _pendingRequests.value = items
            }
            .catch { error ->
                AppLogger.e(TAG, "Erro ao observar pedidos pendentes", error)
                _pendingRequestsError.value = error
            }
            .launchIn(viewModelScope)
    }

    fun requestJoin(groupId: String) {
        viewModelScope.launch {
            _isSubmitting.value = true
            try {
                val result = groupRepository.createJoinRequest(groupId)
                if (result.isFailure) {
                    _myRequestState.value = MyJoinRequestState.Error(
                        result.exceptionOrNull()?.message ?: "Erro ao enviar pedido"
                    )
                }
            } finally {
                _isSubmitting.value = false
            }
        }
    }

    fun cancelRequest(groupId: String) {
        viewModelScope.launch {
            _isSubmitting.value = true
            try {
                val result = groupRepository.cancelMyJoinRequest(groupId)
                if (result.isFailure) {
                    _myRequestState.value = MyJoinRequestState.Error(
                        result.exceptionOrNull()?.message ?: "Erro ao cancelar pedido"
                    )
                }
            } finally {
                _isSubmitting.value = false
            }
        }
    }

    fun approve(groupId: String, requesterId: String) {
        viewModelScope.launch {
            _actioningRequesterId.value = requesterId
            try {
                val result = groupRepository.approveJoinRequest(groupId, requesterId)
                if (result.isFailure) {
                    _myRequestState.value = MyJoinRequestState.Error(
                        result.exceptionOrNull()?.message ?: "Erro ao aprovar pedido"
                    )
                }
            } finally {
                _actioningRequesterId.value = null
            }
        }
    }

    fun reject(groupId: String, requesterId: String) {
        viewModelScope.launch {
            _actioningRequesterId.value = requesterId
            try {
                val result = groupRepository.rejectJoinRequest(groupId, requesterId)
                if (result.isFailure) {
                    _myRequestState.value = MyJoinRequestState.Error(
                        result.exceptionOrNull()?.message ?: "Erro ao rejeitar pedido"
                    )
                }
            } finally {
                _actioningRequesterId.value = null
            }
        }
    }

    override fun onCleared() {
        myRequestJob?.cancel()
        pendingJob?.cancel()
        super.onCleared()
    }

    companion object {
        private const val TAG = "JoinRequestViewModel"
    }
}
