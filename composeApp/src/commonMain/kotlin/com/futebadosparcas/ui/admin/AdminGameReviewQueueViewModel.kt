package com.futebadosparcas.ui.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.platform.firebase.CallableException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Filtro da fila de revisão de recompensas XP (paridade com
 * `QueueFilter` de `web/src/pages/admin/GameReviewQueueScreen.tsx`).
 */
enum class AdminReviewQueueFilter {
    /** `xp_reward_status == HELD_FOR_REVIEW` — única fila com ação de decisão. */
    HELD_FOR_REVIEW,

    /** `xp_reward_status == ELIGIBLE` — liberado (auto ou manual pós-APPROVE). */
    ELIGIBLE,

    /** `xp_reward_status == REJECTED_BY_ADMIN` — terminal. */
    REJECTED_BY_ADMIN,

    /** `auto_close_review_required == true` — fechamento automático em revisão. */
    AUTO_CLOSE_REVIEW
}

/** Contadores resumo exibidos no topo da fila (paridade web). */
data class AdminReviewQueueSummary(
    val held: Int = 0,
    val eligible: Int = 0,
    val rejected: Int = 0,
    val autoClose: Int = 0
)

/** Conteúdo carregado da fila: jogos + ids em revisão de auto-close. */
data class AdminReviewQueueContent(
    val games: List<Game> = emptyList(),
    val autoCloseGameIds: Set<String> = emptySet(),
    val summary: AdminReviewQueueSummary = AdminReviewQueueSummary()
)

/** Estados obrigatórios da tela (Loading/Error/Empty via lista vazia/Success). */
sealed interface AdminGameReviewQueueUiState {
    data object Loading : AdminGameReviewQueueUiState
    data object Error : AdminGameReviewQueueUiState
    data class Success(
        val content: AdminReviewQueueContent,
        /** Recarregando em cima de conteúdo já visível (pull/refresh pós-decisão). */
        val refreshing: Boolean = false
    ) : AdminGameReviewQueueUiState
}

/**
 * Feedback da decisão submetida. `failed-precondition` (jogo já revisado por
 * outra decisão, ex.: web + mobile simultâneos) vira [AlreadyReviewed] — a spec
 * manda tratar como refresco da lista, não como erro crítico.
 */
sealed interface AdminReviewFeedback {
    /** APPROVE/REJECT aceito; [approved] distingue as mensagens de sucesso. */
    data class Success(val approved: Boolean) : AdminReviewFeedback

    /** `failed-precondition`: estado do jogo mudou — lista é recarregada. */
    data object AlreadyReviewed : AdminReviewFeedback

    data class Error(
        val kind: AdminReviewErrorKind,
        /** Mensagem original da callable (já PT-BR no backend, pode trazer dados dinâmicos). */
        val serverMessage: String? = null
    ) : AdminReviewFeedback
}

/**
 * Códigos da callable `reviewHeldGameRewards` que a UI mapeia para mensagens
 * PT-BR (spec FEAT_2026-11-26 §2, tabela de erros).
 */
enum class AdminReviewErrorKind {
    UNAUTHENTICATED,
    PERMISSION_DENIED,
    RATE_LIMITED,
    INVALID_ARGUMENT,
    NOT_FOUND,
    NOT_HELD,
    UNAVAILABLE,
    GENERIC
}

/**
 * ViewModel da fila de revisão de recompensas XP para admin (spec FEAT_2026-11-26, §4.2).
 *
 * Comportamento:
 * - Carrega as duas queries da fila (recompensas + auto-close) em paralelo;
 *   se apenas a de auto-close falhar, a fila de recompensas continua valendo.
 * - Filtra por status/auto-close + busca por local, organizador e motivos.
 * - Submete decisões pela callable `reviewHeldGameRewards` com justificativa
 *   10–500 (trim); validação client-side antes da chamada.
 */
class AdminGameReviewQueueViewModel(
    private val loadQueue: suspend () -> Result<List<Game>>,
    private val loadAutoCloseIds: suspend () -> Result<Set<String>>,
    private val submitReview: suspend (gameId: String, action: String, reason: String) -> Result<Unit>
) : ViewModel() {

    companion object {
        const val ACTION_APPROVE = "APPROVE"
        const val ACTION_REJECT = "REJECT"

        /** Contrato da callable: justificativa com 10–500 caracteres após trim. */
        const val REASON_MIN_CHARS = 10
        const val REASON_MAX_CHARS = 500

        /** #4629 item 8: status terminal — nunca aparece na fila, muito menos com botões. */
        const val STATUS_INELIGIBLE_MIN_PLAYERS = "INELIGIBLE_MIN_PLAYERS"
        const val STATUS_HELD_FOR_REVIEW = "HELD_FOR_REVIEW"

        internal fun isValidReason(reason: String): Boolean {
            val trimmed = reason.trim()
            return trimmed.length in REASON_MIN_CHARS..REASON_MAX_CHARS
        }

        /** Mapeia [CallableException.code] (+ cause tolerante) no enum de erros da UI. */
        internal fun classifySubmitError(error: Throwable): AdminReviewErrorKind {
            val callable = error as? CallableException ?: error.cause as? CallableException
                ?: return AdminReviewErrorKind.GENERIC
            return when (callable.code) {
                CallableException.UNAUTHENTICATED -> AdminReviewErrorKind.UNAUTHENTICATED
                "permission-denied" -> AdminReviewErrorKind.PERMISSION_DENIED
                CallableException.RESOURCE_EXHAUSTED -> AdminReviewErrorKind.RATE_LIMITED
                "invalid-argument" -> AdminReviewErrorKind.INVALID_ARGUMENT
                CallableException.NOT_FOUND -> AdminReviewErrorKind.NOT_FOUND
                CallableException.FAILED_PRECONDITION -> AdminReviewErrorKind.NOT_HELD
                CallableException.UNAVAILABLE -> AdminReviewErrorKind.UNAVAILABLE
                else -> AdminReviewErrorKind.GENERIC
            }
        }
    }

    private val _uiState =
        MutableStateFlow<AdminGameReviewQueueUiState>(AdminGameReviewQueueUiState.Loading)
    val uiState: StateFlow<AdminGameReviewQueueUiState> = _uiState.asStateFlow()

    private val _filter = MutableStateFlow(AdminReviewQueueFilter.HELD_FOR_REVIEW)
    val filter: StateFlow<AdminReviewQueueFilter> = _filter.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    /** Jogo alvo do diálogo de decisão + ação escolhida (APPROVE/REJECT). */
    private val _reviewTarget = MutableStateFlow<Game?>(null)
    val reviewTarget: StateFlow<Game?> = _reviewTarget.asStateFlow()

    private val _reviewAction = MutableStateFlow(ACTION_APPROVE)
    val reviewAction: StateFlow<String> = _reviewAction.asStateFlow()

    private val _reviewReason = MutableStateFlow("")
    val reviewReason: StateFlow<String> = _reviewReason.asStateFlow()

    private val _submitting = MutableStateFlow(false)
    val submitting: StateFlow<Boolean> = _submitting.asStateFlow()

    private val _feedback = MutableStateFlow<AdminReviewFeedback?>(null)
    val feedback: StateFlow<AdminReviewFeedback?> = _feedback.asStateFlow()

    private var loadJob: Job? = null

    init {
        load()
    }

    fun load() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            val wasSuccess = _uiState.value is AdminGameReviewQueueUiState.Success
            if (!wasSuccess) {
                _uiState.value = AdminGameReviewQueueUiState.Loading
            } else {
                _uiState.value = (_uiState.value as AdminGameReviewQueueUiState.Success)
                    .copy(refreshing = true)
            }
            val queueResult = runCatchingSuspend { loadQueue() }
                .getOrElse { e -> Result.failure(e) }
            // Auto-close é complementar: falha isolada não derruba a fila de recompensas.
            val autoCloseIds = runCatchingSuspend { loadAutoCloseIds() }
                .getOrElse { e -> Result.failure(e) }
                .getOrNull()
                .orEmpty()

            queueResult.fold(
                onSuccess = { games ->
                    _feedback.value = null
                    _uiState.value = AdminGameReviewQueueUiState.Success(
                        AdminReviewQueueContent(
                            games = games,
                            autoCloseGameIds = autoCloseIds,
                            summary = AdminReviewQueueSummary(
                                held = games.count { it.xpRewardStatus == STATUS_HELD_FOR_REVIEW },
                                eligible = games.count { it.xpRewardStatus == "ELIGIBLE" },
                                rejected = games.count { it.xpRewardStatus == "REJECTED_BY_ADMIN" },
                                autoClose = autoCloseIds.size
                            )
                        )
                    )
                },
                onFailure = {
                    _uiState.value = AdminGameReviewQueueUiState.Error
                }
            )
        }
    }

    fun setFilter(filter: AdminReviewQueueFilter) {
        _filter.value = filter
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun openReviewDialog(game: Game, action: String) {
        _reviewTarget.value = game
        _reviewAction.value = action
        _reviewReason.value = ""
    }

    fun updateReviewReason(reason: String) {
        // Contrato backend: máx. 500 chars — corta aqui para o contador nunca mentir.
        _reviewReason.value = reason.take(REASON_MAX_CHARS)
    }

    fun dismissReviewDialog() {
        if (_submitting.value) return
        _reviewTarget.value = null
    }

    fun dismissFeedback() {
        _feedback.value = null
    }

    /**
     * Submete a decisão. `failed-precondition` (jogo já decidido em outra
     * sessão/plataforma) recarrega a fila como refresco, sem erro crítico.
     */
    fun submitReview() {
        val target = _reviewTarget.value ?: return
        val action = _reviewAction.value
        val reason = _reviewReason.value.trim()
        if (_submitting.value) return
        if (!isValidReason(reason)) {
            _feedback.value = AdminReviewFeedback.Error(AdminReviewErrorKind.INVALID_ARGUMENT)
            return
        }
        _submitting.value = true
        viewModelScope.launch {
            val result = runCatchingSuspend { submitReview(target.id, action, reason) }
                .getOrElse { e -> Result.failure(e) }
            _submitting.value = false
            result.fold(
                onSuccess = {
                    _reviewTarget.value = null
                    _reviewReason.value = ""
                    _feedback.value = AdminReviewFeedback.Success(approved = action == ACTION_APPROVE)
                    load()
                },
                onFailure = { error ->
                    when (val kind = classifySubmitError(error)) {
                        AdminReviewErrorKind.NOT_HELD -> {
                            // Já revisado (ex.: decisão simultânea na web) — refresca a lista.
                            _reviewTarget.value = null
                            _reviewReason.value = ""
                            _feedback.value = AdminReviewFeedback.AlreadyReviewed
                            load()
                        }
                        else -> {
                            _feedback.value = AdminReviewFeedback.Error(
                                kind = kind,
                                serverMessage = (error as? CallableException)?.message
                            )
                        }
                    }
                }
            )
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }
}

/** `runCatching` que respeita cancelamento de corotina (padrão ExportMyDataViewModel). */
private inline fun <T> runCatchingSuspend(block: () -> T): Result<T> = try {
    Result.success(block())
} catch (e: CancellationException) {
    throw e
} catch (e: Exception) {
    Result.failure(e)
}
