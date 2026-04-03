package com.futebadosparcas.domain.usecase.notification

import com.futebadosparcas.domain.repository.NotificationRepository
import kotlinx.coroutines.flow.Flow

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

    /**
     * Retorna um Flow que emite a contagem de notificações não lidas.
     * O Flow é atualizado automaticamente quando há mudanças.
     */
    operator fun invoke(): Flow<Int> {
        return notificationRepository.getUnreadCountFlow()
    }
}
