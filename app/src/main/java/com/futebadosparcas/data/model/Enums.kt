package com.futebadosparcas.data.model

enum class PlayerPosition {
    GOALKEEPER,  // Goleiro
    FIELD        // Linha
}

enum class PaymentStatus {
    PENDING,
    PARTIAL,  // Issue #69: Pagamento parcial
    PAID,
    OVERDUE,
    CANCELLED
}
