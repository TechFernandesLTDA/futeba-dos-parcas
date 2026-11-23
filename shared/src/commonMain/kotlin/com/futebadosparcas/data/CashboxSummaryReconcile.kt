package com.futebadosparcas.data

/**
 * #4629: o primeiro lançamento de um caixa novo era recusado no Android e no iOS.
 *
 * O `createCashboxEntry` recusa o lançamento com "Resumo do caixa precisa ser
 * reconciliado" quando `cashbox_summary/current` ainda não existe (ou está com
 * valor inválido). O web reconcilia sozinho ao abrir a tela; os apps mostravam
 * o erro e paravam. Aqui o app reconcilia e tenta o lançamento mais uma vez,
 * com o mesmo requestId, então o servidor não grava duas vezes.
 */
internal const val CASHBOX_NEEDS_RECONCILE_MESSAGE = "precisa ser reconciliado"

/** Verdadeiro se o erro (ou uma causa dele) é o pedido de reconciliação do servidor. */
internal fun Throwable.isCashboxReconcileRequired(): Boolean =
    generateSequence(this) { it.cause }
        .take(MAX_CAUSE_DEPTH)
        .any { it.message?.contains(CASHBOX_NEEDS_RECONCILE_MESSAGE) == true }

private const val MAX_CAUSE_DEPTH = 8

/**
 * Roda [attempt]. Se o servidor pedir reconciliação, chama [reconcile] e roda
 * [attempt] mais uma vez. Se a reconciliação falhar, devolve o erro original.
 */
internal suspend fun <T> withCashboxReconcileRetry(
    attempt: suspend () -> Result<T>,
    reconcile: suspend () -> Result<*>
): Result<T> {
    val first = attempt()
    val error = first.exceptionOrNull() ?: return first
    if (!error.isCashboxReconcileRequired()) return first
    if (reconcile().isFailure) return first
    return attempt()
}
