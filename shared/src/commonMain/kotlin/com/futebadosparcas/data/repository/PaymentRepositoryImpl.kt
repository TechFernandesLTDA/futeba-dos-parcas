package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.Payment
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.logging.PlatformLogger
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import kotlin.math.roundToInt

/**
 * Implementacao compartilhada (KMP) do PaymentRepository.
 */
class PaymentRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : PaymentRepository {

    companion object {
        private const val TAG = "PaymentRepository"

        /**
         * Formata um Double para string com 2 casas decimais.
         * Funcao auxiliar compativel com KMP.
         */
        private fun formatDecimal(value: Double): String {
            val rounded = (value * 100).roundToInt() / 100.0
            val intPart = rounded.toInt()
            val decPart = ((rounded - intPart) * 100).toInt().coerceIn(0, 99)
            return "$intPart.${decPart.toString().padStart(2, '0')}"
        }
    }

    override suspend fun createPayment(payment: Payment): Result<Payment> {
        return withContext(Dispatchers.Default) {
            try {
                PlatformLogger.d(TAG, "Criando pagamento: userId=${payment.userId}, amount=${payment.amount}")

                return@withContext firebaseDataSource.createPayment(payment).also { result ->
                    result.onSuccess { newPayment ->
                        PlatformLogger.i(TAG, "Pagamento criado com sucesso: id=${newPayment.id}")
                    }.onFailure { error ->
                        PlatformLogger.e(TAG, "Erro ao criar pagamento", error)
                    }
                }
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Excecao ao criar pagamento", e)
                Result.failure(e)
            }
        }
    }

    override fun generatePixCode(payment: Payment): String {
        // Mock Pix generation - EM PRODUCAO integrar com API real (BCB, Gateway, etc)
        val randomString = (1..4)
            .map { ('A'..'Z').random() }
            .joinToString("")

        // Format compativel com KMP
        val amountFormatted = formatDecimal(payment.amount)

        // Payload PIX padrao EMV simplificado (mock)
        return "00020126360014BR.GOV.BCB.PIX0114+55419999999995204000053039865406" +
                "$amountFormatted" +
                "5802BR5913FutebaParcas6008CURITIBA62070503***6304$randomString"
    }

    override suspend fun confirmPayment(paymentId: String): Result<Unit> {
        return withContext(Dispatchers.Default) {
            try {
                PlatformLogger.d(TAG, "Confirmando pagamento: id=$paymentId")

                return@withContext firebaseDataSource.confirmPayment(paymentId).also { result ->
                    result.onSuccess {
                        PlatformLogger.i(TAG, "Pagamento confirmado com sucesso: id=$paymentId")
                    }.onFailure { error ->
                        PlatformLogger.e(TAG, "Erro ao confirmar pagamento", error)
                    }
                }
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Excecao ao confirmar pagamento", e)
                Result.failure(e)
            }
        }
    }

    override suspend fun getPaymentsByUser(userId: String): Result<List<Payment>> {
        return withContext(Dispatchers.Default) {
            try {
                PlatformLogger.d(TAG, "Buscando pagamentos do usuario: userId=$userId")

                return@withContext firebaseDataSource.getPaymentsByUser(userId).also { result ->
                    result.onSuccess { payments ->
                        PlatformLogger.i(TAG, "${payments.size} pagamentos encontrados para userId=$userId")
                    }.onFailure { error ->
                        PlatformLogger.e(TAG, "Erro ao buscar pagamentos", error)
                    }
                }
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Excecao ao buscar pagamentos", e)
                Result.failure(e)
            }
        }
    }
}
