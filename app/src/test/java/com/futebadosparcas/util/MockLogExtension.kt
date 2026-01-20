package com.futebadosparcas.util

import android.util.Log
import io.mockk.every
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import org.junit.jupiter.api.extension.AfterEachCallback
import org.junit.jupiter.api.extension.BeforeEachCallback
import org.junit.jupiter.api.extension.ExtensionContext

/**
 * JUnit 5 Extension para mockar android.util.Log em testes unitários.
 * Resolve o erro "Method println in android.util.Log not mocked".
 */
class MockLogExtension : BeforeEachCallback, AfterEachCallback {

    override fun beforeEach(context: ExtensionContext?) {
        mockkStatic(Log::class)
        every { Log.v(any(), any()) } returns 0
        every { Log.v(any(), any(), any()) } returns 0
        every { Log.d(any(), any()) } returns 0
        every { Log.d(any(), any(), any()) } returns 0
        every { Log.i(any(), any()) } returns 0
        every { Log.i(any(), any(), any()) } returns 0
        every { Log.w(any(), any<String>()) } returns 0
        every { Log.w(any(), any<Throwable>()) } returns 0
        every { Log.w(any(), any<String>(), any()) } returns 0
        every { Log.e(any(), any()) } returns 0
        every { Log.e(any(), any(), any()) } returns 0
        every { Log.wtf(any(), any<String>()) } returns 0
        every { Log.wtf(any(), any<Throwable>()) } returns 0
        every { Log.wtf(any(), any<String>(), any()) } returns 0
        every { Log.println(any(), any(), any()) } returns 0
        every { Log.isLoggable(any(), any()) } returns false
        every { Log.getStackTraceString(any()) } returns ""
    }

    override fun afterEach(context: ExtensionContext?) {
        unmockkStatic(Log::class)
    }
}
