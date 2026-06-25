package com.futebadosparcas.domain.usecase.notification

import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.stateIn

/**
 * Use Case para observar a contagem de notificações não lidas em tempo real.
 *
 * Encapsula o acesso ao NotificationRepository para observação reativa
 * da contagem de notificações. Usado por GamesViewModel e ProfileViewModel.
 *
 * Diferente do GetUnreadCountUseCase (que faz uma busca pontual),
 * este use case retorna um Flow que emite atualizações em tempo real.
 */
class ObserveUnreadCountUseCase(
    private val notificationRepository: NotificationRepository
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val unreadCount: StateFlow<Int> = notificationRepository.getUnreadCountFlow()
        .distinctUntilChanged()
        .catch { e ->
            AppLogger.e(TAG, "Erro ao observar contagem compartilhada de notificacoes", e)
            emit(0)
        }
        .stateIn(
            scope = scope,
            started = SharingStarted.WhileSubscribed(stopTimeoutMillis = 5_000),
            initialValue = 0
        )

    /**
     * Retorna um Flow que emite a contagem de notificações não lidas.
     * O Flow é atualizado automaticamente quando há mudanças.
     */
    operator fun invoke(): StateFlow<Int> {
        return unreadCount
    }

    companion object {
        private const val TAG = "ObserveUnreadCountUseCase"
    }
}
