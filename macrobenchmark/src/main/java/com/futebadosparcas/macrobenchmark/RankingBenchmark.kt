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
 * Benchmark de scroll na RankingScreen (Liga) do Futeba dos Parças.
 *
 * A RankingScreen exibe a lista de classificação da liga com cards de jogadores,
 * que é uma das telas mais pesadas por combinar avatares, dados de XP e badges.
 *
 * INTERPRETAR RESULTADOS:
 * - frameDurationCpuMs: tempo de CPU por frame durante scroll
 * - frameOverrunMs: excesso de tempo além do deadline de frame
 * - Meta SLO (Issue #1094): janked frames < 5% do total na RankingScreen
 *
 * COMO RODAR LOCALMENTE:
 *   ./gradlew :macrobenchmark:connectedBenchmarkAndroidTest \
 *     -Pandroid.testInstrumentationRunnerArguments.class=com.futebadosparcas.macrobenchmark.RankingBenchmark \
 *     -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.profiling.mode=None
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class RankingBenchmark {

    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    /**
     * Mede frame timing durante scroll na lista de classificação da Liga.
     * Navega para a aba "Liga" (contentDescription = "Liga") antes de medir.
     */
    @Test
    fun rankingScreenScroll() {
        benchmarkRule.measureRepeated(
            packageName = PACKAGE_NAME,
            metrics = listOf(FrameTimingMetric()),
            compilationMode = CompilationMode.None(),
            startupMode = StartupMode.WARM,
            iterations = 5,
        ) {
            pressHome()
            startActivityAndWait()

            // Aguarda a HomeScreen ficar pronta
            device.wait(Until.hasObject(By.desc("Home")), TIMEOUT)
            device.waitForIdle()

            // Navega para a aba de Liga/Ranking
            val ligaTab = device.findObject(By.desc("Liga"))
                ?: device.findObject(By.text("Liga"))
            ligaTab?.click()

            // Aguarda a RankingScreen carregar
            device.waitForIdle()
            Thread.sleep(500)

            // Executa scroll para exercitar a LazyColumn de ranking
            repeat(5) {
                device.swipe(
                    device.displayWidth / 2,
                    device.displayHeight * 3 / 4,
                    device.displayWidth / 2,
                    device.displayHeight / 4,
                    20,
                )
                device.waitForIdle()
            }

            // Scroll de volta para o topo (para resetar o estado)
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
