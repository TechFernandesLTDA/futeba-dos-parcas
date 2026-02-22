package com.futebadosparcas.ui

import androidx.compose.ui.graphics.Color

fun getFieldTypeColor(fieldType: String): Color = when (fieldType.lowercase()) {
    "society" -> Color(0xFF4CAF50)
    "futsal" -> Color(0xFF2196F3)
    "grama", "campo" -> Color(0xFF8BC34A)
    "areia" -> Color(0xFFFF9800)
    else -> Color(0xFF9E9E9E)
}

fun formatPrice(price: Double): String {
    val parts = price.toString().split(".")
    val intPart = parts[0]
    val decPart = if (parts.size > 1) parts[1].padEnd(2, '0').take(2) else "00"
    return "$intPart.$decPart"
}
