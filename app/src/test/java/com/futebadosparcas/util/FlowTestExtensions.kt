package com.futebadosparcas.util

import app.cash.turbine.test
import kotlinx.coroutines.flow.Flow
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/**
 * Flow Test Extensions
 *
 * Provides utilities for testing Kotlin Flows using Turbine.
 *
 * Usage:
 * ```kotlin
 * @Test
 * fun testFlow() = runTest {
 *     val flow = flowOf(1, 2, 3)
 *
 *     flow.test {
 *         assertEquals(1, awaitItem())
 *         assertEquals(2, awaitItem())
 *         assertEquals(3, awaitItem())
 *         awaitComplete()
 *     }
 * }
 * ```
 */

/**
 * Test that a Flow emits expected values in order
 */
suspend fun <T> Flow<T>.testEmissions(
    timeout: Duration = 5.seconds,
    vararg expectedValues: T
) {
    test(timeout = timeout) {
        expectedValues.forEach { expected ->
            val actual = awaitItem()
            assert(actual == expected) {
                "Expected $expected but got $actual"
            }
        }
        awaitComplete()
    }
}

/**
 * Test that a Flow emits a single value and completes
 */
suspend fun <T> Flow<T>.testSingleEmission(
    timeout: Duration = 5.seconds,
    expectedValue: T
) {
    test(timeout = timeout) {
        val actual = awaitItem()
        assert(actual == expectedValue) {
            "Expected $expectedValue but got $actual"
        }
        awaitComplete()
    }
}

/**
 * Test that a Flow emits an error
 */
suspend fun <T> Flow<T>.testError(
    timeout: Duration = 5.seconds,
    errorPredicate: (Throwable) -> Boolean = { true }
) {
    test(timeout = timeout) {
        val error = awaitError()
        assert(errorPredicate(error)) {
            "Error does not match predicate: $error"
        }
    }
}
