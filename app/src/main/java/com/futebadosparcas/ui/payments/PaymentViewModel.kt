package com.futebadosparcas.ui.payments

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Payment
import com.futebadosparcas.data.model.PaymentMethod
import com.futebadosparcas.data.model.PaymentStatus
import com.futebadosparcas.data.model.PaymentType
import com.futebadosparcas.data.repository.PaymentRepository
import com.futebadosparcas.domain.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PaymentViewModel @Inject constructor(
    private val paymentRepository: PaymentRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<PaymentUiState>(PaymentUiState.Idle)
    val uiState: StateFlow<PaymentUiState> = _uiState

    fun startPayment(gameId: String, amount: Double) {
        viewModelScope.launch {
            _uiState.value = PaymentUiState.Loading
            
            val userId = userRepository.getCurrentUserId()
            if (userId == null) {
                _uiState.value = PaymentUiState.Error("Usuário não identificado")
                return@launch
            }

            val payment = Payment(
                userId = userId,
                gameId = gameId,
                amount = amount,
                status = PaymentStatus.PENDING,
                type = PaymentType.DAILY,
                paymentMethod = PaymentMethod.PIX
            )

            paymentRepository.createPayment(payment).fold(
                onSuccess = { createdPayment ->
                    val pixCode = paymentRepository.generatePixCode(createdPayment)
                    // Update payment with pix code? 
                    // Not strictly necessary in DB if we generate on fly, but good practice.
                    // For now, just return to UI.
                    _uiState.value = PaymentUiState.PixGenerated(pixCode, createdPayment.id, amount)
                },
                onFailure = { error ->
                    _uiState.value = PaymentUiState.Error(error.message ?: "Erro ao iniciar pagamento")
                }
            )
        }
    }

    fun confirmPayment(paymentId: String) {
        viewModelScope.launch {
            _uiState.value = PaymentUiState.Loading
            paymentRepository.confirmPayment(paymentId).fold(
                onSuccess = {
                    _uiState.value = PaymentUiState.Success
                },
                onFailure = { error ->
                    _uiState.value = PaymentUiState.Error(error.message ?: "Erro ao confirmar pagamento")
                }
            )
        }
    }
}

sealed class PaymentUiState {
    object Idle : PaymentUiState()
    object Loading : PaymentUiState()
    data class PixGenerated(val pixCode: String, val paymentId: String, val amount: Double) : PaymentUiState()
    object Success : PaymentUiState()
    data class Error(val message: String) : PaymentUiState()
}
