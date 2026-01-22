package com.futebadosparcas.util

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.extension.AfterEachCallback
import org.junit.jupiter.api.extension.BeforeEachCallback
import org.junit.jupiter.api.extension.ExtensionContext

/**
 * Test Dispatchers for Unit Testing
 *
 * Provides TestDispatchers for all CoroutineDispatchers used in the app.
 * Works with Hilt DI for easy injection in tests.
 *
 * Usage:
 * ```kotlin
 * @Test
 * fun myTest() = runTest {
 *     val viewModel = MyViewModel(
 *         repository = mockRepository,
 *         ioDispatcher = testDispatchers.io
 *     )
 *     // Test code
 * }
 * ```
 */
@OptIn(ExperimentalCoroutinesApi::class)
class TestDispatchers(
    val testDispatcher: TestDispatcher = StandardTestDispatcher()
) {
    val io: CoroutineDispatcher = testDispatcher
    val default: CoroutineDispatcher = testDispatcher
    val main: CoroutineDispatcher = testDispatcher
    val unconfined: CoroutineDispatcher = testDispatcher
}

/**
 * JUnit 5 Extension for Main Dispatcher
 *
 * Automatically sets up and tears down the Main dispatcher for tests.
 *
 * Usage:
 * ```kotlin
 * @ExtendWith(MainDispatcherExtension::class)
 * class MyViewModelTest {
 *     @Test
 *     fun test() = runTest {
 *         // Main dispatcher is already set up
 *     }
 * }
 * ```
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MainDispatcherExtension : BeforeEachCallback, AfterEachCallback {

    private val testDispatcher = StandardTestDispatcher()

    override fun beforeEach(context: ExtensionContext?) {
        Dispatchers.setMain(testDispatcher)
    }

    override fun afterEach(context: ExtensionContext?) {
        Dispatchers.resetMain()
    }
}
