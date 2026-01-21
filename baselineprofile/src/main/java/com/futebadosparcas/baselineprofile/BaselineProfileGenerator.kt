package com.futebadosparcas.baselineprofile

import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Gerador de Baseline Profile para o Futeba dos Parças.
 *
 * Este teste gera um perfil de baseline que pré-compila caminhos críticos do app,
 * melhorando o tempo de startup e a performance geral.
 *
 * Para gerar o perfil, execute:
 * ./gradlew :baselineprofile:pixel6Api34BenchmarkAndroidTest -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.enabledRules=BaselineProfile
 *
 * Ou conecte um dispositivo físico e execute:
 * ./gradlew :app:generateBaselineProfile
 */
@RunWith(AndroidJUnit4::class)
@LargeTest
class BaselineProfileGenerator {

    @get:Rule
    val rule = BaselineProfileRule()

    /**
     * Gera o baseline profile percorrendo os fluxos críticos do app.
     */
    @Test
    fun generateBaselineProfile() {
        rule.collect(
            packageName = PACKAGE_NAME,
            includeInStartupProfile = true,
            maxIterations = 3,
        ) {
            // Inicia o app na tela de splash
            pressHome()
            startActivityAndWait()

            // Aguarda a splash screen carregar e navegar
            device.wait(Until.hasObject(By.pkg(PACKAGE_NAME).depth(0)), TIMEOUT)

            // Fluxo 1: Login Screen (se não logado)
            // A tela de login deve aparecer após a splash
            device.wait(Until.hasObject(By.text("Entrar com Google")), TIMEOUT)

            // Fluxo 2: Navegação principal (após login simulado ou em modo demo)
            // Nota: Em produção, o baseline profile é gerado com o app já configurado
            // Para testes, focamos na navegação principal

            // Aguarda a home screen carregar
            device.wait(Until.hasObject(By.desc("Home")), TIMEOUT)

            // Navega pelas abas principais usando a bottom navigation
            navigateToTab(device, "Jogos")
            navigateToTab(device, "Liga")
            navigateToTab(device, "Jogadores")
            navigateToTab(device, "Perfil")

            // Volta para Home
            navigateToTab(device, "Home")
        }
    }

    /**
     * Gera perfil específico para o fluxo de startup.
     */
    @Test
    fun generateStartupProfile() {
        rule.collect(
            packageName = PACKAGE_NAME,
            includeInStartupProfile = true,
            maxIterations = 5,
        ) {
            pressHome()
            startActivityAndWait()

            // Apenas aguarda o app inicializar completamente
            device.wait(Until.hasObject(By.pkg(PACKAGE_NAME).depth(0)), TIMEOUT)
        }
    }

    /**
     * Navega para uma aba específica da bottom navigation.
     */
    private fun navigateToTab(device: UiDevice, tabName: String) {
        val tab = device.findObject(By.desc(tabName))
        tab?.click()
        device.waitForIdle()
        // Pequena espera para a tela carregar
        Thread.sleep(500)
    }

    companion object {
        private const val PACKAGE_NAME = "com.futebadosparcas"
        private const val TIMEOUT = 10_000L
    }
}
