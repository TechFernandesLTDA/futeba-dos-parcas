package com.futebadosparcas.macrobenchmark

import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Benchmark de cold startup do aplicativo Futeba dos Parças.
 *
 * Mede o tempo total desde o toque do usuário até a primeira frame
 * visível na HomeScreen (Time To Initial Display — TTID).
 *
 * INTERPRETAR RESULTADOS:
 * - timeToInitialDisplayMs: tempo até primeira frame renderizada
 * - timeToFullDisplayMs: tempo até o app reportar "completamente pronto"
 * - Meta SLO (Issue #1094): P95 < 1500 ms para cold start
 *
 * COMO RODAR LOCALMENTE:
 *   ./gradlew :macrobenchmark:connectedBenchmarkAndroidTest \
 *     -Pandroid.testInstrumentationRunnerArguments.class=com.futebadosparcas.macrobenchmark.StartupBenchmark \
 *     -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.profiling.mode=None
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class StartupBenchmark {

    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    /**
     * Cold startup sem compilação prévia — simula primeira execução após install.
     * Usa 5 iterações para estabilizar a média.
     */
    @Test
    fun coldStartup() {
        benchmarkRule.measureRepeated(
            packageName = PACKAGE_NAME,
            metrics = listOf(StartupTimingMetric()),
            compilationMode = CompilationMode.None(),
            startupMode = StartupMode.COLD,
            iterations = 5,
        ) {
            pressHome()
            startActivityAndWait()

            // Aguarda a HomeScreen ficar visível
            device.wait(Until.hasObject(By.desc("Home")), TIMEOUT)
            device.waitForIdle()
        }
    }

    /**
     * Warm startup — processo do app já existe em memória, Activity é recriada.
     * Representa re-abertura típica do usuário.
     */
    @Test
    fun warmStartup() {
        benchmarkRule.measureRepeated(
            packageName = PACKAGE_NAME,
            metrics = listOf(StartupTimingMetric()),
            compilationMode = CompilationMode.None(),
            startupMode = StartupMode.WARM,
            iterations = 5,
        ) {
            pressHome()
            startActivityAndWait()

            device.wait(Until.hasObject(By.desc("Home")), TIMEOUT)
            device.waitForIdle()
        }
    }

    private companion object {
        private const val PACKAGE_NAME = "com.futebadosparcas"
        private const val TIMEOUT = 10_000L
    }
}
