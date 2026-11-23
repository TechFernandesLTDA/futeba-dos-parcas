package com.futebadosparcas.data

import kotlin.coroutines.Continuation
import kotlin.coroutines.EmptyCoroutineContext
import kotlin.coroutines.startCoroutine
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertSame
import kotlin.test.assertTrue

/**
 * Roda um bloco suspend que não suspende de verdade (os lambdas dos testes
 * respondem na hora). Assim o teste roda no JVM e no iOS sem coroutines-test.
 */
private fun <T> runSync(block: suspend () -> T): T {
    var outcome: Result<T>? = null
    block.startCoroutine(Continuation(EmptyCoroutineContext) { outcome = it })
    return checkNotNull(outcome) { "o bloco suspendeu" }.getOrThrow()
}

/** #4629: primeiro lançamento de um caixa novo reconcilia e tenta de novo. */
class CashboxSummaryReconcileTest {

    private val needsReconcile = Exception("Resumo do caixa precisa ser reconciliado")

    @Test
    fun `primeiro lancamento reconcilia e tenta de novo uma vez`() = runSync {
        var attempts = 0
        var reconciles = 0

        val result = withCashboxReconcileRetry(
            attempt = {
                attempts++
                if (attempts == 1) Result.failure(needsReconcile) else Result.success("entry-1")
            },
            reconcile = {
                reconciles++
                Result.success(Unit)
            }
        )

        assertEquals("entry-1", result.getOrNull())
        assertEquals(2, attempts)
        assertEquals(1, reconciles)
    }

    @Test
    fun `outro erro nao reconcilia`() = runSync {
        var reconciles = 0
        val other = Exception("Saldo insuficiente")

        val result = withCashboxReconcileRetry(
            attempt = { Result.failure<String>(other) },
            reconcile = {
                reconciles++
                Result.success(Unit)
            }
        )

        assertSame(other, result.exceptionOrNull())
        assertEquals(0, reconciles)
    }

    @Test
    fun `reconciliacao recusada devolve o erro original sem nova tentativa`() = runSync {
        var attempts = 0

        val result = withCashboxReconcileRetry(
            attempt = {
                attempts++
                Result.failure<String>(needsReconcile)
            },
            reconcile = { Result.failure<Unit>(Exception("Apenas administradores do grupo podem reconciliar o caixa")) }
        )

        assertSame(needsReconcile, result.exceptionOrNull())
        assertEquals(1, attempts)
    }

    @Test
    fun `se a segunda tentativa ainda falhar nao entra em laco`() = runSync {
        var attempts = 0
        var reconciles = 0

        val result = withCashboxReconcileRetry(
            attempt = {
                attempts++
                Result.failure<String>(needsReconcile)
            },
            reconcile = {
                reconciles++
                Result.success(Unit)
            }
        )

        assertTrue(result.isFailure)
        assertEquals(2, attempts)
        assertEquals(1, reconciles)
    }

    @Test
    fun `reconhece o pedido na causa e no campo invalido do resumo`() {
        assertTrue(Exception("INTERNAL", needsReconcile).isCashboxReconcileRequired())
        assertTrue(Exception("balance_cents precisa ser reconciliado").isCashboxReconcileRequired())
        assertFalse(Exception("Marcador idempotente sem transação correspondente").isCashboxReconcileRequired())
    }
}
