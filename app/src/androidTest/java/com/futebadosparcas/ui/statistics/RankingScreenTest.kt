package com.futebadosparcas.ui.statistics

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.PlayerRankingItem
import com.futebadosparcas.domain.model.RankingCategory
import com.futebadosparcas.domain.model.RankingPeriod
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.util.appString
import com.futebadosparcas.util.assertTextoAusente
import com.futebadosparcas.util.assertTextoVisivel
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Tela de ranking (`RankingScreen`) em cada estado, com o ViewModel substituído por um mock.
 */
@RunWith(AndroidJUnit4::class)
class RankingScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var viewModel: RankingViewModel
    private val estado = MutableStateFlow(RankingUiState())
    private val clicados = mutableListOf<String>()

    @Before
    fun setup() {
        viewModel = mockk(relaxed = true)
        every { viewModel.rankingState } returns estado
    }

    private fun abrirTela() {
        composeTestRule.setContent {
            FutebaTheme {
                RankingScreen(viewModel = viewModel, onPlayerClick = { clicados += it })
            }
        }
    }

    @Test
    fun carregando_mostraOCabecalhoSemListaNemErro() {
        estado.value = RankingUiState(isLoading = true)

        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.league_ranking_title)).assertIsDisplayed()
        composeTestRule.assertTextoAusente(appString(R.string.retry))
        composeTestRule.assertTextoAusente(appString(R.string.empty_state_no_ranking_title))
    }

    @Test
    fun comRanking_mostraOPodioEORestoDaLista() {
        estado.value = RankingUiState(isLoading = false, rankings = jogadores())

        abrirTela()

        composeTestRule.assertTextoVisivel("Ana Lima")
        composeTestRule.assertTextoVisivel("Bruno Reis")
        composeTestRule.assertTextoVisivel("Caio Dias")
        composeTestRule.assertTextoVisivel("Davi Melo")
    }

    @Test
    fun comRanking_tocarNoJogadorForaDoPodioAbreOPerfilDele() {
        estado.value = RankingUiState(isLoading = false, rankings = jogadores())
        abrirTela()

        composeTestRule.onNodeWithText("Davi Melo").performClick()

        assertEquals(listOf("u4"), clicados)
    }

    @Test
    fun semRanking_mostraOEstadoVazio() {
        estado.value = RankingUiState(isLoading = false, rankings = emptyList())

        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.empty_state_no_ranking_title)).assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.empty_state_no_ranking_desc)).assertIsDisplayed()
    }

    @Test
    fun erro_mostraAMensagemETentarNovamenteRecarrega() {
        estado.value = RankingUiState(isLoading = false, error = "Erro ao carregar ranking")
        abrirTela()

        composeTestRule.onNodeWithText("Erro ao carregar ranking").assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.retry)).performClick()

        verify { viewModel.loadRanking() }
    }

    @Test
    fun filtros_trocamACategoriaEOPeriodoNoViewModel() {
        estado.value = RankingUiState(isLoading = false, rankings = jogadores())
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.assists)).performClick()
        composeTestRule.onNodeWithText(appString(R.string.week)).performClick()

        verify { viewModel.selectCategory(RankingCategory.ASSISTS) }
        verify { viewModel.selectPeriod(RankingPeriod.WEEK) }
    }

    private fun jogadores() = listOf(
        jogador(1, "u1", "Ana Lima", 12),
        jogador(2, "u2", "Bruno Reis", 9),
        jogador(3, "u3", "Caio Dias", 7),
        jogador(4, "u4", "Davi Melo", 5)
    )

    private fun jogador(rank: Int, userId: String, nome: String, gols: Long) = PlayerRankingItem(
        rank = rank,
        userId = userId,
        playerName = nome,
        value = gols,
        gamesPlayed = 10,
        average = gols / 10.0,
        level = 3
    )
}
