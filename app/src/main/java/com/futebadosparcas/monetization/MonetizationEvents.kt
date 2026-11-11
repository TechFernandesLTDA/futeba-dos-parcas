package com.futebadosparcas.monetization

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Eventos de produto que a monetização escuta, sem acoplar ViewModels ao módulo de anúncios.
 *
 * "Primeira vitória" = primeira presença confirmada ou primeiro jogo criado. Só depois dela o
 * app inicializa o SDK de anúncios e mostra o formulário de consentimento (regra de produto
 * TECHFERNANDES: login, push e anúncio só depois da primeira vitória).
 */
object MonetizationEvents {
    private val _firstWin = MutableSharedFlow<Unit>(extraBufferCapacity = 8)
    val firstWinEvents: SharedFlow<Unit> = _firstWin.asSharedFlow()

    fun firstWin() {
        _firstWin.tryEmit(Unit)
    }
}
