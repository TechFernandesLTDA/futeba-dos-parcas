package com.futebadosparcas.ui.validation

import android.content.Context
import com.futebadosparcas.R
import com.futebadosparcas.domain.validation.ValidationErrorCode
import com.futebadosparcas.domain.validation.ValidationHelper
import com.futebadosparcas.domain.validation.ValidationResult
import io.mockk.every
import io.mockk.mockk
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ValidationMessagesTest {

    @Test
    fun gera_chave_para_email_obrigatorio() {
        val result = ValidationHelper.validateEmail("", "email")
        val invalid = result as ValidationResult.Invalid
        assertEquals("validation_model.email_required", invalid.messageKey)
    }

    @Test
    fun resolve_usa_string_pt_quando_ha_chave() {
        val context = mockk<Context>()
        every { context.getString(R.string.validation_model_email_required) } returns "Email é obrigatório"
        val invalid = ValidationResult.Invalid("email", "Email é obrigatório", ValidationErrorCode.REQUIRED_FIELD, "validation_model.email_required")
        assertEquals("Email é obrigatório", ValidationMessages.resolve(context, invalid))
    }

    @Test
    fun resolve_cai_para_message_quando_sem_chave() {
        val context = mockk<Context>()
        val invalid = ValidationResult.Invalid("x", "mensagem legado", ValidationErrorCode.GENERIC)
        assertEquals("mensagem legado", ValidationMessages.resolve(context, invalid))
    }
}
