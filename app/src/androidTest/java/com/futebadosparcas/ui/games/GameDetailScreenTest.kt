package com.futebadosparcas.ui.games

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.ui.theme.FutebaTheme
import com.futebadosparcas.util.appString
import com.futebadosparcas.util.assertTextoAusente
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
 * Tela de detalhe do jogo (`GameDetailScreen`) em cada estado, com o ViewModel substituído por um mock.
 *
 * A lista de presença tem 12 jogadores de propósito: o chat, os comentários e os vídeos ficam no fim da
 * lista preguiçosa e criam os próprios ViewModels pelo Koin. Com a lista longa eles não entram na tela e o
 * teste não abre listener nenhum no Firestore.
 */
@RunWith(AndroidJUnit4::class)
class GameDetailScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var viewModel: GameDetailViewModel
    private val uiState = MutableStateFlow<GameDetailUiState>(GameDetailUiState.Loading)

    private var voltou = 0
    private val edicoes = mutableListOf<String>()
    private var prancheta = 0

    @Before
    fun setup() {
        viewModel = mockk(relaxed = true)
        every { viewModel.uiState } returns uiState
    }

    private fun abrirTela() {
        composeTestRule.setContent {
            FutebaTheme {
                GameDetailScreen(
                    viewModel = viewModel,
                    gameId = GAME_ID,
                    onNavigateBack = { voltou++ },
                    onNavigateToCreateGame = { edicoes += it },
                    onNavigateToMvpVote = {},
                    onNavigateToTacticalBoard = { prancheta++ }
                )
            }
        }
    }

    @Test
    fun carregando_pedeOJogoEASetaVolta() {
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.game_details)).assertIsDisplayed()
        verify { viewModel.loadGameDetails(GAME_ID) }
        composeTestRule.onNodeWithContentDescription(appString(R.string.back)).performClick()

        assertEquals(1, voltou)
    }

    @Test
    fun erro_mostraAMensagemETentarNovamenteRecarrega() {
        uiState.value = GameDetailUiState.Error("Jogo não encontrado")
        abrirTela()

        composeTestRule.onNodeWithText("Jogo não encontrado").assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.retry)).performClick()

        // Uma chamada ao abrir a tela e outra pelo botão.
        verify(exactly = 2) { viewModel.loadGameDetails(GAME_ID) }
    }

    @Test
    fun jogoCarregado_mostraDataHoraLocalEListaDePresenca() {
        uiState.value = sucesso()

        abrirTela()

        composeTestRule.onNodeWithText(JOGO.date).assertIsDisplayed()
        composeTestRule.onNodeWithText(JOGO.time).assertIsDisplayed()
        composeTestRule.onNodeWithText(JOGO.locationName).assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.attendance_list)).assertIsDisplayed()
        composeTestRule.onNodeWithText("12/14").assertIsDisplayed()
        composeTestRule.onNodeWithText("Jogador 01").assertIsDisplayed()
    }

    @Test
    fun quemNaoGerenciaOJogo_naoVeEditar() {
        uiState.value = sucesso(canManageGame = false)

        abrirTela()

        composeTestRule.assertTextoAusente(appString(R.string.edit))
        composeTestRule.onNodeWithText(appString(R.string.confirm_presence)).assertIsDisplayed()
    }

    @Test
    fun quemGerenciaOJogo_editarAbreOFormularioDoJogo() {
        uiState.value = sucesso(canManageGame = true)
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.edit)).performClick()

        assertEquals(listOf(GAME_ID), edicoes)
    }

    @Test
    fun jogadorConfirmado_cancelarConfirmacaoChamaOViewModel() {
        uiState.value = sucesso(isUserConfirmed = true)
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.cancel_presence)).performClick()

        verify { viewModel.toggleConfirmation(GAME_ID) }
    }

    @Test
    fun menu_pranchetaTaticaChamaANavegacao() {
        uiState.value = sucesso()
        abrirTela()

        composeTestRule.onNodeWithContentDescription(appString(R.string.more_options)).performClick()
        composeTestRule.onNodeWithText(appString(R.string.tactical_board)).performClick()

        assertEquals(1, prancheta)
    }

    private fun sucesso(isUserConfirmed: Boolean = false, canManageGame: Boolean = false) =
        GameDetailUiState.Success(
            game = JOGO,
            confirmations = (1..12).map { n ->
                GameConfirmation(
                    id = "${GAME_ID}_u$n",
                    gameId = GAME_ID,
                    userId = "u$n",
                    userName = "Jogador %02d".format(n)
                )
            },
            isUserConfirmed = isUserConfirmed,
            isOwner = canManageGame,
            canManageGame = canManageGame,
            currentUserId = "eu"
        )

    private companion object {
        const val GAME_ID = "game123"

        val JOGO = Game(
            id = GAME_ID,
            date = "20/12/2026",
            time = "19:30",
            status = GameStatus.SCHEDULED.name,
            maxPlayers = 14,
            locationId = "loc1",
            locationName = "Arena Central"
        )
    }
}
