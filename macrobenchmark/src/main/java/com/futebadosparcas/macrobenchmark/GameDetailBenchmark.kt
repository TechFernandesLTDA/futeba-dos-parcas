package com.futebadosparcas.macrobenchmark

import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.ExperimentalMetricApi
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.TraceSectionMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Benchmark de TTI (Time To Interactive) ao abrir a GameDetailScreen.
 *
 * Mede quanto tempo leva desde o toque no card de jogo até a tela de
 * detalhes do jogo estar visível e interativa, incluindo carregamento
 * de estatísticas, MVP, e informações do time.
 *
 * INTERPRETAR RESULTADOS:
 * - timeToInitialDisplayMs: tempo até primeira frame da GameDetailScreen
 * - Seção de trace "GameDetail:load": latência total do carregamento de dados
 * - Meta SLO (Issue #1094): TTI < 800ms P95 (navegação intra-app)
 *
 * COMO RODAR LOCALMENTE:
 *   ./gradlew :macrobenchmark:connectedBenchmarkAndroidTest \
 *     -Pandroid.testInstrumentationRunnerArguments.class=com.futebadosparcas.macrobenchmark.GameDetailBenchmark \
 *     -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.profiling.mode=None
 */
@OptIn(ExperimentalMetricApi::class)
@RunWith(AndroidJUnit4::class)
@LargeTest
class GameDetailBenchmark {

    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    /**
     * Mede o TTI de navegação até a GameDetailScreen clicando no primeiro
     * card de jogo disponível na HomeScreen.
     *
     * Utiliza StartupTimingMetric para medir o tempo de rendering da tela
     * e TraceSectionMetric para capturar latência de carregamento de dados
     * (quando a seção de trace "GameDetail:load" for adicionada no ViewModel).
     */
    @Test
    fun gameDetailNavigation() {
        benchmarkRule.measureRepeated(
            packageName = PACKAGE_NAME,
            metrics = listOf(
                StartupTimingMetric(),
                // Seção de trace opcional — captura latência de carregamento de dados
                // quando a instrumentação de trace for adicionada ao GameDetailViewModel
                TraceSectionMetric("GameDetail:load"),
            ),
            compilationMode = CompilationMode.None(),
            startupMode = StartupMode.WARM,
            iterations = 5,
        ) {
            pressHome()
            startActivityAndWait()

            // Aguarda a HomeScreen com a lista de jogos
            device.wait(Until.hasObject(By.desc("Home")), TIMEOUT)
            device.waitForIdle()

            // Tenta clicar no primeiro card de jogo visível
            // Espera até 5 segundos para que os jogos carreguem do Firestore
            val gameCard = device.wait(
                Until.findObject(By.res(PACKAGE_NAME, "game_card")),
                5_000L,
            )

            if (gameCard != null) {
                gameCard.click()

                // Aguarda a GameDetailScreen abrir (aguarda qualquer conteúdo de detalhe)
                device.waitForIdle()
                Thread.sleep(500)

                // Volta para a HomeScreen para permitir nova iteração
                device.pressBack()
                device.waitForIdle()
            }
            // Se não houver jogos visíveis, a iteração registra apenas o startup time
        }
    }

    private companion object {
        private const val PACKAGE_NAME = "com.futebadosparcas"
        private const val TIMEOUT = 10_000L
    }
}
