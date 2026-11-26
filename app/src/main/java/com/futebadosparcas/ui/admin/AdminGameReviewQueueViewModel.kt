package com.futebadosparcas.ui.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.domain.permission.PermissionManager
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * Item da fila de revisão de recompensas XP.
 *
 * [autoCloseReviewRequired] não faz parte do modelo [Game] — é lido do documento
 * bruto porque a Query 2 da fila usa esse campo como filtro (paridade web, spec
 * FEAT_2026-11-26_admin-revisao-xp-apps.md §2).
 */
data class AdminReviewGame(
    val game: Game,
    val autoCloseReviewRequired: Boolean
)

/**
 * Filtros da fila (paridade com a web: Todos/Pendentes/Liberados/Rejeitados/Auto-close).
 */
enum class AdminReviewFilter { ALL, PENDING, RELEASED, REJECTED, AUTO_CLOSE }

/**
 * Contadores resumo por filtro.
 */
data class AdminReviewCounts(
    val all: Int,
    val pending: Int,
    val released: Int,
    val rejected: Int,
    val autoClose: Int
)

/**
 * Erros mapeados da callable `reviewHeldGameRewards` (tabela §2 da spec).
 * A tela converte cada kind em mensagem PT-BR — nunca vaza stacktrace.
 */
enum class AdminReviewError { UNAUTHENTICATED, PERMISSION_DENIED, RATE_LIMITED, INVALID_ARGUMENT, NOT_FOUND, GENERIC }

/**
 * Eventos one-shot de decisão (snackbar).
 */
sealed class AdminReviewEvent {
    data object Approved : AdminReviewEvent()
    data object Rejected : AdminReviewEvent()
    /** failed-precondition: já revisado por outra pessoa/web — refresca a fila, não é erro crítico. */
    data class AlreadyReviewed(val serverMessage: String?) : AdminReviewEvent()
    data class Failed(
        val error: AdminReviewError,
        val serverMessage: String? = null
    ) : AdminReviewEvent()
}

sealed class AdminGameReviewUiState {
    data object Loading : AdminGameReviewUiState()
    /** Usuário sem role ADMIN — entrada só deveria existir para admin (gating duplo). */
    data object AccessDenied : AdminGameReviewUiState()
    data class Success(
        val games: List<AdminReviewGame>,
        val counts: AdminReviewCounts
    ) : AdminGameReviewUiState()
    data class Error(val message: String? = null) : AdminGameReviewUiState()
}

/**
 * ViewModel da fila de revisão de recompensas XP (admin).
 *
 * - Leitura: duas queries Firestore mergeadas (xp_reward_status IN [...] e
 *   auto_close_review_required == true), paridade total com a web.
 * - Escrita: callable `reviewHeldGameRewards` (região southamerica-east1, App Check
 *   ativo) — o cliente NUNCA escreve xp_reward_status diretamente (rules bloqueiam).
 * - Gating: [PermissionManager] lê users/{uid}.role com cache; a callable revalida
 *   o custom claim ADMIN no backend (fonte real de verdade).
 */
class AdminGameReviewQueueViewModel(
    private val firestore: FirebaseFirestore,
    private val functions: FirebaseFunctions,
    private val permissionManager: PermissionManager
) : ViewModel() {

    companion object {
        private const val TAG = "AdminGameReviewVM"
        private const val CALLABLE_REVIEW = "reviewHeldGameRewards"
        private const val QUEUE_LIMIT = 100L
        private const val REASON_MIN_CHARS = 10
        private const val REASON_MAX_CHARS = 500
        const val ACTION_APPROVE = "APPROVE"
        const val ACTION_REJECT = "REJECT"

        // INELIGIBLE_MIN_PLAYERS é terminal e NÃO entra na fila (spec §3).
        private val REWARD_QUEUE_STATUSES = listOf("HELD_FOR_REVIEW", "ELIGIBLE", "REJECTED_BY_ADMIN")
    }

    private val _uiState = MutableStateFlow<AdminGameReviewUiState>(AdminGameReviewUiState.Loading)
    val uiState: StateFlow<AdminGameReviewUiState> = _uiState

    private val _events = MutableSharedFlow<AdminReviewEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<AdminReviewEvent> = _events

    private val _submitting = MutableStateFlow(false)
    val submitting: StateFlow<Boolean> = _submitting

    private var currentFilter = AdminReviewFilter.ALL
    private var allGames: List<AdminReviewGame> = emptyList()

    private var loadJob: Job? = null
    private var submitJob: Job? = null

    init {
        loadQueue()
    }

    /**
     * Carrega a fila: valida admin, roda as duas queries em paralelo e mergeia.
     */
    fun loadQueue() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.value = AdminGameReviewUiState.Loading

            val isAdmin = try {
                permissionManager.isAdmin()
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao checar permissão de admin", e)
                false
            }
            if (!isAdmin) {
                _uiState.value = AdminGameReviewUiState.AccessDenied
                return@launch
            }

            try {
                allGames = fetchQueue()
                publishState()
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao carregar fila de revisão", e)
                _uiState.value = AdminGameReviewUiState.Error()
            }
        }
    }

    /**
     * Troca o filtro da fila sem reconsultar o Firestore.
     */
    fun setFilter(filter: AdminReviewFilter) {
        currentFilter = filter
        publishState()
    }

    /**
     * Validação client-side pré-chamada: trim com 10–500 caracteres (spec §2).
     */
    fun isReasonValid(reason: String): Boolean {
        val length = reason.trim().length
        return length in REASON_MIN_CHARS..REASON_MAX_CHARS
    }

    /**
     * Envia a decisão (APPROVE/REJECT) para a callable `reviewHeldGameRewards`.
     * Mapeia FirebaseFunctionsException.code para eventos com mensagens PT-BR
     * resolvidas na tela — nenhum stacktrace chega ao usuário.
     */
    fun submitReview(gameId: String, action: String, reason: String) {
        if (!isReasonValid(reason)) {
            _events.tryEmit(AdminReviewEvent.Failed(AdminReviewError.INVALID_ARGUMENT))
            return
        }

        submitJob?.cancel()
        submitJob = viewModelScope.launch {
            _submitting.value = true
            try {
                functions.getHttpsCallable(CALLABLE_REVIEW)
                    .call(
                        mapOf(
                            "gameId" to gameId,
                            "action" to action,
                            "reason" to reason.trim()
                        )
                    )
                    .await()

                _events.tryEmit(
                    if (action == ACTION_APPROVE) {
                        AdminReviewEvent.Approved
                    } else {
                        AdminReviewEvent.Rejected
                    }
                )
                // Refresca a fila: o jogo sai de "Pendentes" após a decisão.
                allGames = fetchQueue()
                publishState()
            } catch (e: FirebaseFunctionsException) {
                AppLogger.e(TAG, "Callable reviewHeldGameRewards falhou (code=${e.code})", e)
                when (e.code) {
                    FirebaseFunctionsException.Code.UNAUTHENTICATED ->
                        _events.tryEmit(AdminReviewEvent.Failed(AdminReviewError.UNAUTHENTICATED))
                    FirebaseFunctionsException.Code.PERMISSION_DENIED -> {
                        // Role/claim pode estar desatualizado (spec §5): invalida o cache.
                        permissionManager.invalidateCache()
                        _events.tryEmit(AdminReviewEvent.Failed(AdminReviewError.PERMISSION_DENIED))
                    }
                    FirebaseFunctionsException.Code.RESOURCE_EXHAUSTED ->
                        _events.tryEmit(AdminReviewEvent.Failed(AdminReviewError.RATE_LIMITED, e.message))
                    FirebaseFunctionsException.Code.INVALID_ARGUMENT ->
                        _events.tryEmit(AdminReviewEvent.Failed(AdminReviewError.INVALID_ARGUMENT, e.message))
                    FirebaseFunctionsException.Code.NOT_FOUND ->
                        _events.tryEmit(AdminReviewEvent.Failed(AdminReviewError.NOT_FOUND))
                    // Jogo já revisado (web + mobile simultâneos): refresca, não é erro crítico.
                    FirebaseFunctionsException.Code.FAILED_PRECONDITION -> {
                        _events.tryEmit(AdminReviewEvent.AlreadyReviewed(e.message))
                        allGames = fetchQueue()
                        publishState()
                    }
                    else ->
                        _events.tryEmit(AdminReviewEvent.Failed(AdminReviewError.GENERIC))
                }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro inesperado ao enviar revisão", e)
                _events.tryEmit(AdminReviewEvent.Failed(AdminReviewError.GENERIC))
            } finally {
                _submitting.value = false
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
        submitJob?.cancel()
    }

    /**
     * Duas queries mergeadas (paridade web):
     * 1. xp_reward_status IN [HELD_FOR_REVIEW, ELIGIBLE, REJECTED_BY_ADMIN] (limit 100)
     * 2. auto_close_review_required == true (limit 100)
     * Merge por id, descarta status fora de FINISHED/CANCELLED, ordena por
     * xp_reward_held_at ?? validation_updated_at ?? date_time (desc).
     */
    private suspend fun fetchQueue(): List<AdminReviewGame> = coroutineScope {
        val statusQuery = async {
            firestore.collection("games")
                .whereIn("xp_reward_status", REWARD_QUEUE_STATUSES)
                .limit(QUEUE_LIMIT)
                .get()
                .await()
        }
        val autoCloseQuery = async {
            firestore.collection("games")
                .whereEqualTo("auto_close_review_required", true)
                .limit(QUEUE_LIMIT)
                .get()
                .await()
        }

        (statusQuery.await().documents + autoCloseQuery.await().documents)
            .mapNotNull { it.toAdminReviewGameOrNull() }
            .filter { item ->
                item.game.status == "FINISHED" || item.game.status == "CANCELLED"
            }
            .distinctBy { it.game.id }
            .sortedByDescending { sortTimestamp(it.game) }
    }

    private fun sortTimestamp(game: Game): Long {
        val date = game.xpRewardHeldAt ?: game.validationUpdatedAt ?: game.dateTime
        return date?.time ?: 0L
    }

    private fun publishState() {
        val counts = AdminReviewCounts(
            all = allGames.size,
            pending = allGames.count { it.game.xpRewardStatus == "HELD_FOR_REVIEW" },
            released = allGames.count { it.game.xpRewardStatus == "ELIGIBLE" },
            rejected = allGames.count { it.game.xpRewardStatus == "REJECTED_BY_ADMIN" },
            autoClose = allGames.count { it.autoCloseReviewRequired }
        )

        val filtered = when (currentFilter) {
            AdminReviewFilter.ALL -> allGames
            AdminReviewFilter.PENDING -> allGames.filter { it.game.xpRewardStatus == "HELD_FOR_REVIEW" }
            AdminReviewFilter.RELEASED -> allGames.filter { it.game.xpRewardStatus == "ELIGIBLE" }
            AdminReviewFilter.REJECTED -> allGames.filter { it.game.xpRewardStatus == "REJECTED_BY_ADMIN" }
            AdminReviewFilter.AUTO_CLOSE -> allGames.filter { it.autoCloseReviewRequired }
        }

        _uiState.value = if (filtered.isEmpty()) {
            AdminGameReviewUiState.Success(games = emptyList(), counts = counts)
        } else {
            AdminGameReviewUiState.Success(games = filtered, counts = counts)
        }
    }

    /**
     * Deserializa o documento copiando o ID do snapshot (o modelo Game não usa
     * @DocumentId — padrão do repo, ver GameQueryRepositoryImpl) e lendo o flag
     * de auto-close direto do documento bruto.
     */
    private fun DocumentSnapshot.toAdminReviewGameOrNull(): AdminReviewGame? = try {
        toObject(Game::class.java)?.let { game ->
            game.id = id
            AdminReviewGame(
                game = game,
                autoCloseReviewRequired = getBoolean("auto_close_review_required") ?: false
            )
        }
    } catch (e: Exception) {
        AppLogger.e(TAG, "Documento ilegível na fila de revisão: $id", e)
        null
    }
}
