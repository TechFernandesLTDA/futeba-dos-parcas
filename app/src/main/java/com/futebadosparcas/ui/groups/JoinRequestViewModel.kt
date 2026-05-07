package com.futebadosparcas.ui.groups

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.JoinRequest
import com.futebadosparcas.data.repository.JoinRequestRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.google.firebase.auth.FirebaseAuth
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
    data class Pending(val request: JoinRequest) : MyJoinRequestState()
    data class Approved(val request: JoinRequest) : MyJoinRequestState()
    data class Rejected(val request: JoinRequest) : MyJoinRequestState()
    data class Error(val message: String) : MyJoinRequestState()
}

/**
 * ViewModel para join_requests (issue #517 Phase 2).
 *
 * Carrega o request do usuario atual + lista de pending (se owner/admin).
 * Tela usa apenas as partes que precisa.
 */
class JoinRequestViewModel(
    private val joinRequestRepository: JoinRequestRepository,
    private val userRepository: UserRepository,
    private val auth: FirebaseAuth,
) : ViewModel() {

    private val _myRequestState =
        MutableStateFlow<MyJoinRequestState>(MyJoinRequestState.Loading)
    val myRequestState: StateFlow<MyJoinRequestState> = _myRequestState.asStateFlow()

    private val _pendingRequests = MutableStateFlow<List<JoinRequest>>(emptyList())
    val pendingRequests: StateFlow<List<JoinRequest>> = _pendingRequests.asStateFlow()

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
        myRequestJob = joinRequestRepository.observeMyRequest(groupId)
            .onEach { req ->
                _myRequestState.value = when (req?.status) {
                    null -> MyJoinRequestState.NotRequested
                    com.futebadosparcas.data.repository.JoinRequestStatus.PENDING ->
                        MyJoinRequestState.Pending(req)
                    com.futebadosparcas.data.repository.JoinRequestStatus.APPROVED ->
                        MyJoinRequestState.Approved(req)
                    com.futebadosparcas.data.repository.JoinRequestStatus.REJECTED ->
                        MyJoinRequestState.Rejected(req)
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
        pendingJob = joinRequestRepository.observePendingRequests(groupId)
            .onEach { items -> _pendingRequests.value = items }
            .catch { _pendingRequests.value = emptyList() }
            .launchIn(viewModelScope)
    }

    fun requestJoin(groupId: String) {
        viewModelScope.launch {
            _isSubmitting.value = true
            try {
                val userId = auth.currentUser?.uid ?: return@launch
                val user = userRepository.getUserById(userId).getOrNull()
                val name = user?.name ?: auth.currentUser?.displayName ?: "Anonimo"
                val photo = user?.photoUrl ?: auth.currentUser?.photoUrl?.toString()
                val result = joinRequestRepository.createRequest(groupId, name, photo)
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
                val result = joinRequestRepository.cancelRequest(groupId)
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
                joinRequestRepository.approveRequest(groupId, requesterId)
            } finally {
                _actioningRequesterId.value = null
            }
        }
    }

    fun reject(groupId: String, requesterId: String) {
        viewModelScope.launch {
            _actioningRequesterId.value = requesterId
            try {
                joinRequestRepository.rejectRequest(groupId, requesterId)
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
}
