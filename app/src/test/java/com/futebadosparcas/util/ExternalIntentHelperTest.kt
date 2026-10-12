package com.futebadosparcas.util

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.widget.Toast
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import io.mockk.verify
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/** Testes para [ExternalIntentHelper] (#4376): sem app para o Intent, nao pode crashar. */
@ExtendWith(MockLogExtension::class)
class ExternalIntentHelperTest {

    private val context = mockk<Context>(relaxed = true)
    private val intent = mockk<Intent>(relaxed = true)
    private val toast = mockk<Toast>(relaxed = true)

    @BeforeEach
    fun setUp() {
        mockkStatic(Toast::class)
        every { Toast.makeText(any<Context>(), any<Int>(), any()) } returns toast
    }

    @AfterEach
    fun tearDown() {
        unmockkStatic(Toast::class)
    }

    @Test
    fun `retorna true e nao mostra toast quando ha app para o Intent`() {
        assertTrue(ExternalIntentHelper.startActivitySafely(context, intent))
        verify(exactly = 1) { context.startActivity(intent) }
        verify(exactly = 0) { toast.show() }
    }

    @Test
    fun `ActivityNotFoundException vira toast e retorna false`() {
        every { context.startActivity(intent) } throws ActivityNotFoundException("sem app de e-mail")

        assertFalse(ExternalIntentHelper.startActivitySafely(context, intent))
        verify(exactly = 1) { toast.show() }
    }

    @Test
    fun `SecurityException tambem nao derruba o app`() {
        every { context.startActivity(intent) } throws SecurityException("negado")

        assertFalse(ExternalIntentHelper.startActivitySafely(context, intent))
        verify(exactly = 1) { toast.show() }
    }
}
