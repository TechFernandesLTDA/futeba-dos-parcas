package com.futebadosparcas.ui.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class AuthErrorMessagesTest {
    private val fallback = "Não foi possível entrar."

    @Test
    fun emailInvalidoDoIosVirtaTextoEmPortugues() {
        val raw = "Error Domain=FIRAuthErrorDomain Code=17008 \"The email address is badly formatted.\" UserInfo={NSLocalizedDescription=x}"
        assertEquals("Esse e-mail não parece válido. Confira e tente de novo.", friendlyAuthError(raw, fallback))
    }

    @Test
    fun credencialInvalidaViraEmailOuSenhaIncorretos() {
        val raw = "Error Domain=FIRAuthErrorDomain Code=17004 \"The supplied auth credential is malformed or has expired.\""
        assertEquals("E-mail ou senha incorretos. Confira e tente de novo.", friendlyAuthError(raw, fallback))
    }

    @Test
    fun semInternetEMuitasTentativas() {
        assertEquals("Sem conexão com a internet. Confira sua rede e tente de novo.",
            friendlyAuthError("Error Domain=FIRAuthErrorDomain Code=17020 \"Network error\"", fallback))
        assertEquals("Muitas tentativas. Espere um pouco e tente de novo.",
            friendlyAuthError("Error Domain=FIRAuthErrorDomain Code=17010", fallback))
    }

    @Test
    fun erroTecnicoDesconhecidoUsaOTextoPadrao() {
        val out = friendlyAuthError("Error Domain=FIRAuthErrorDomain Code=17999 x", fallback)
        assertFalse("Domain" in out)
        assertEquals(fallback, friendlyAuthError("Serializer for class 'Any' is not found", fallback))
        assertEquals(fallback, friendlyAuthError(null, fallback))
    }

    @Test
    fun mensagemNossaEmPortuguesPassaIntacta() {
        assertEquals("Informe seu e-mail para recuperar a senha.",
            friendlyAuthError("Informe seu e-mail para recuperar a senha.", fallback))
    }
}
