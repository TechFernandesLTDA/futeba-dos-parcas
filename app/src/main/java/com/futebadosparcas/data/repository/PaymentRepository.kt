package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.Payment
import com.futebadosparcas.data.model.PaymentStatus
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton
import java.util.Date
import java.util.Locale

@Singleton
class PaymentRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) {
    private val paymentsCollection = firestore.collection("payments")
    private val confirmationsCollection = firestore.collection("confirmations")
    
    suspend fun createPayment(payment: Payment): Result<Payment> {
        return try {
            val ref = paymentsCollection.document()
            val newPayment = payment.copy(id = ref.id, createdAt = Date())
            ref.set(newPayment).await()
            Result.success(newPayment)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun generatePixCode(payment: Payment): String {
        // Mock Pix generation
        val randomString = java.util.UUID.randomUUID().toString().replace("-", "").take(4).uppercase()
        return "00020126360014BR.GOV.BCB.PIX0114+55419999999995204000053039865406${String.format(Locale.getDefault(), "%.2f", payment.amount).replace(",", ".")}5802BR5913FutebaParcas6008CURITIBA62070503***6304$randomString"
    }
    
    suspend fun confirmPayment(paymentId: String): Result<Unit> {
        return try {
            val paymentRef = paymentsCollection.document(paymentId)
            
            firestore.runTransaction { transaction ->
                val snapshot = transaction.get(paymentRef)
                val payment = snapshot.toObject(Payment::class.java)
                    ?: throw Exception("Pagamento não encontrado")
                
                // Update Payment
                transaction.update(paymentRef, mapOf(
                    "status" to PaymentStatus.PAID,
                    "paid_at" to Date()
                ))
                
                // Update Confirmation if linked to game
                if (!payment.gameId.isNullOrEmpty() && payment.userId.isNotEmpty()) {
                    val confId = "${payment.gameId}_${payment.userId}"
                    val confRef = confirmationsCollection.document(confId)
                    // Check if confirmation exists before update to avoid error
                    // But transaction get cost... assume it exists if payment exists for it
                    transaction.update(confRef, "payment_status", "PAID")
                }
            }.await()
            
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getPaymentsByUser(userId: String): Result<List<Payment>> {
        return try {
            val snapshot = paymentsCollection
                .whereEqualTo("user_id", userId)
                .orderBy("created_at", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .get()
                .await()
            
            Result.success(snapshot.toObjects(Payment::class.java))
        } catch (e: Exception) {
             Result.failure(e)
        }
    }
}
