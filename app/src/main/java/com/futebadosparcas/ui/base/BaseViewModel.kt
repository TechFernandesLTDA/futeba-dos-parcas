package com.futebadosparcas.ui.base

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Base ViewModel
 *
 * Provides common ViewModel functionality with state management, event handling, and error handling.
 *
 * Usage:
 * ```kotlin
 * @HiltViewModel
 * class HomeViewModel @Inject constructor(
 *     private val getUserUseCase: GetUserUseCase
 * ) : BaseViewModel<HomeUiState, HomeUiEvent>() {
 *
 *     override fun createInitialState(): HomeUiState = HomeUiState.Loading
 *
 *     fun loadUser(userId: String) {
 *         launchWithErrorHandling {
 *             getUserUseCase(userId).collect { result ->
 *                 result.fold(
 *                     onSuccess = { user -> setState { HomeUiState.Success(user) } },
 *                     onFailure = { error -> setState { HomeUiState.Error(error.message) } }
 *                 )
 *             }
 *         }
 *     }
 * }
 * ```
 */
abstract class BaseViewModel<S : UiState, E : UiEvent> : ViewModel() {

    private val _uiState = MutableStateFlow(createInitialState())
    val uiState: StateFlow<S> = _uiState.asStateFlow()

    private val _uiEvent = MutableSharedFlow<E>()
    val uiEvent: SharedFlow<E> = _uiEvent.asSharedFlow()

    private val _errorChannel = Channel<String>(Channel.BUFFERED)
    val errorFlow: Flow<String> = _errorChannel.receiveAsFlow()

    private val jobs = mutableMapOf<String, Job>()

    // Firestore listeners tracking para cleanup
    private val firestoreListeners = mutableListOf<com.google.firebase.firestore.ListenerRegistration>()

    private val exceptionHandler = CoroutineExceptionHandler { _, throwable ->
        handleError(throwable)
    }

    /**
     * Create initial UI state
     */
    protected abstract fun createInitialState(): S

    /**
     * Registra um Firestore listener para cleanup automático
     */
    protected fun registerFirestoreListener(listener: com.google.firebase.firestore.ListenerRegistration) {
        firestoreListeners.add(listener)
    }

    /**
     * Remove todos os listeners do Firestore
     */
    protected fun removeAllFirestoreListeners() {
        firestoreListeners.forEach { it.remove() }
        firestoreListeners.clear()
    }

    /**
     * Update UI state
     */
    protected fun setState(reduce: S.() -> S) {
        _uiState.update { currentState -> currentState.reduce() }
    }

    /**
     * Send UI event
     */
    protected fun sendEvent(event: E) {
        viewModelScope.launch {
            _uiEvent.emit(event)
        }
    }

    /**
     * Launch coroutine with error handling
     */
    protected fun launchWithErrorHandling(
        key: String? = null,
        block: suspend () -> Unit
    ): Job {
        // Cancel previous job with same key
        key?.let { jobs[it]?.cancel() }

        val job = viewModelScope.launch(exceptionHandler) {
            block()
        }

        key?.let { jobs[it] = job }

        return job
    }

    /**
     * Launch coroutine without error handling
     */
    protected fun launch(
        key: String? = null,
        block: suspend () -> Unit
    ): Job {
        key?.let { jobs[it]?.cancel() }

        val job = viewModelScope.launch {
            block()
        }

        key?.let { jobs[it] = job }

        return job
    }

    /**
     * Handle error
     */
    protected open fun handleError(throwable: Throwable) {
        val message = throwable.message ?: "Erro desconhecido"
        android.util.Log.e("ViewModel", "Error in ${this::class.simpleName}", throwable)
        viewModelScope.launch {
            _errorChannel.send(message)
        }
    }

    /**
     * Cancel job by key
     */
    protected fun cancelJob(key: String) {
        jobs[key]?.cancel()
        jobs.remove(key)
    }

    /**
     * Cancel all jobs
     */
    protected fun cancelAllJobs() {
        jobs.values.forEach { it.cancel() }
        jobs.clear()
    }

    override fun onCleared() {
        super.onCleared()
        cancelAllJobs()
        removeAllFirestoreListeners()
        _errorChannel.close()
    }
}

/**
 * Base UI State marker interface
 */
interface UiState

/**
 * Base UI Event marker interface
 */
interface UiEvent

/**
 * Common loading state
 */
data class LoadingState(val isLoading: Boolean = false) : UiState

/**
 * Common error state
 */
data class ErrorState(val message: String? = null) : UiState

/**
 * Generic data state
 */
sealed class DataState<out T> : UiState {
    object Idle : DataState<Nothing>()
    object Loading : DataState<Nothing>()
    data class Success<T>(val data: T) : DataState<T>()
    data class Error(val message: String) : DataState<Nothing>()
}

/**
 * Pagination state
 */
data class PaginationState<T>(
    val items: List<T> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val hasMore: Boolean = true,
    val error: String? = null,
    val page: Int = 0
) : UiState

/**
 * Common UI events
 */
sealed class CommonUiEvent : UiEvent {
    data class ShowToast(val message: String) : CommonUiEvent()
    data class ShowError(val message: String) : CommonUiEvent()
    data class Navigate(val route: String) : CommonUiEvent()
    object NavigateBack : CommonUiEvent()
}
