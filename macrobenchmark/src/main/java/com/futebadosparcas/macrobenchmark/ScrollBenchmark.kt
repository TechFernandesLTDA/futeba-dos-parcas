package com.futebadosparcas.macrobenchmark

import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Benchmark de scroll na HomeScreen do Futeba dos Parças.
 *
 * Mede o frame timing durante scroll na LazyColumn da lista de jogos,
 * detectando jank (frames que ultrapassam o orçamento de 16ms em 60Hz).
 *
 * INTERPRETAR RESULTADOS:
 * - frameDurationCpuMs: tempo de CPU por frame (< 16ms = sem jank em 60Hz)
 * - frameOverrunMs: quanto cada frame excedeu o deadline (menor = melhor)
 * - Meta SLO (Issue #1094): janked frames < 5% do total na HomeScreen
 *
 * COMO RODAR LOCALMENTE:
 *   ./gradlew :macrobenchmark:connectedBenchmarkAndroidTest \
 *     -Pandroid.testInstrumentationRunnerArguments.class=com.futebadosparcas.macrobenchmark.ScrollBenchmark \
 *     -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.profiling.mode=None
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class ScrollBenchmark {

    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    /**
     * Mede frame timing durante scroll contínuo na lista de jogos da HomeScreen.
     * Realiza múltiplos swipes de baixo para cima para exercitar a LazyColumn.
     */
    @Test
    fun homeScreenScroll() {
        benchmarkRule.measureRepeated(
            packageName = PACKAGE_NAME,
            metrics = listOf(FrameTimingMetric()),
            compilationMode = CompilationMode.None(),
            startupMode = StartupMode.WARM,
            iterations = 5,
        ) {
            pressHome()
            startActivityAndWait()

            // Aguarda a HomeScreen renderizar
            device.wait(Until.hasObject(By.desc("Home")), TIMEOUT)
            device.waitForIdle()

            // Executa scroll para exercitar a LazyColumn de jogos
            repeat(5) {
                device.swipe(
                    device.displayWidth / 2,
                    device.displayHeight * 3 / 4,
                    device.displayWidth / 2,
                    device.displayHeight / 4,
                    // Velocidade de swipe: 20 steps = scroll rápido naturalista
                    20,
                )
                device.waitForIdle()
            }

            // Scroll de volta para o topo
            repeat(5) {
                device.swipe(
                    device.displayWidth / 2,
                    device.displayHeight / 4,
                    device.displayWidth / 2,
                    device.displayHeight * 3 / 4,
                    20,
                )
                device.waitForIdle()
            }
        }
    }

    private companion object {
        private const val PACKAGE_NAME = "com.futebadosparcas"
        private const val TIMEOUT = 10_000L
    }
}
