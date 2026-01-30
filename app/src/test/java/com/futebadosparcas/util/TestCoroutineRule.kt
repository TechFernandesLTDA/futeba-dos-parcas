package com.futebadosparcas.util

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.rules.TestRule
import org.junit.runner.Description
import org.junit.runners.model.Statement

/**
 * Regra JUnit para testes com corrotinas.
 *
 * Configura um TestDispatcher para substituir o Dispatcher.Main durante os testes,
 * permitindo controle total sobre a execução das corrotinas.
 *
 * Uso:
 * ```kotlin
 * @get:Rule
 * val coroutineRule = TestCoroutineRule()
 *
 * @Test
 * fun myTest() = coroutineRule.runTest {
 *     // Código de teste
 * }
 * ```
 */
class TestCoroutineRule(
    val testDispatcher: TestDispatcher = StandardTestDispatcher()
) : TestRule {

    override fun apply(base: Statement, description: Description): Statement {
        return object : Statement() {
            override fun evaluate() {
                Dispatchers.setMain(testDispatcher)
                try {
                    base.evaluate()
                } finally {
                    Dispatchers.resetMain()
                }
            }
        }
    }

    /**
     * Executa um bloco de teste com controle total sobre as corrotinas.
     * Avança automaticamente o relógio de teste até que todas as corrotinas sejam concluídas.
     *
     * @param testBody Bloco de código de teste
     */
    fun runTest(testBody: suspend kotlinx.coroutines.test.TestScope.() -> Unit) {
        kotlinx.coroutines.test.runTest(context = testDispatcher) {
            testBody()
        }
    }
}
