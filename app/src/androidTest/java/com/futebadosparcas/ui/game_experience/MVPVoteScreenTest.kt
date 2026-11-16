package com.futebadosparcas.ui.game_experience

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.VoteCategory
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
 * Tela de votação pós-jogo (`MVPVoteScreen`) em cada estado, com o ViewModel substituído por um mock.
 *
 * Os textos vêm do `strings.xml` do app (`appString`), para o teste não quebrar por mudança de redação.
 */
@RunWith(AndroidJUnit4::class)
class MVPVoteScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var viewModel: MVPVoteViewModel
    private val uiState = MutableStateFlow<MVPVoteUiState>(MVPVoteUiState.Loading())
    private var voltou = 0

    @Before
    fun setup() {
        viewModel = mockk(relaxed = true)
        every { viewModel.uiState } returns uiState
    }

    private fun abrirTela() {
        composeTestRule.setContent {
            FutebaTheme {
                MVPVoteScreen(viewModel = viewModel, gameId = GAME_ID, onNavigateBack = { voltou++ })
            }
        }
    }

    @Test
    fun carregando_pedeOsCandidatosDoJogoEMostraSoOTitulo() {
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.mvp_vote_title)).assertIsDisplayed()
        composeTestRule.assertTextoAusente(appString(R.string.mvp_who_was_star))
        verify { viewModel.loadCandidates(GAME_ID) }
    }

    @Test
    fun votando_mostraAEtapaAPerguntaEOsCandidatos() {
        uiState.value = votacao()

        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.mvp_vote_1_3)).assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.mvp_who_was_star)).assertIsDisplayed()
        composeTestRule.onNodeWithText("João Silva").assertIsDisplayed()
        composeTestRule.onNodeWithText("Carlão").assertIsDisplayed()
    }

    @Test
    fun votando_tocarNoCandidatoEnviaOVotoDaCategoria() {
        uiState.value = votacao()
        abrirTela()

        composeTestRule.onNodeWithText("João Silva").performClick()

        verify { viewModel.submitVote(GAME_ID, "player1", VoteCategory.MVP) }
    }

    @Test
    fun jaVotou_mostraOAvisoEFecharVolta() {
        uiState.value = MVPVoteUiState.AlreadyVoted(isOwner = false)
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.mvp_already_voted)).assertIsDisplayed()
        composeTestRule.assertTextoAusente(appString(R.string.mvp_finish_voting_owner))
        composeTestRule.onNodeWithText(appString(R.string.close)).performClick()

        assertEquals(1, voltou)
    }

    @Test
    fun jaVotou_donoDoJogoPodeEncerrarAVotacao() {
        uiState.value = MVPVoteUiState.AlreadyVoted(isOwner = true)
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.mvp_finish_voting_owner)).performClick()

        verify { viewModel.finalizeVoting(GAME_ID) }
    }

    @Test
    fun erro_mostraAMensagemETentarNovamenteRecarrega() {
        uiState.value = MVPVoteUiState.Error(message = "Erro ao carregar candidatos")
        abrirTela()

        composeTestRule.onNodeWithText("Erro ao carregar candidatos").assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.retry)).performClick()

        // Uma chamada ao abrir a tela e outra pelo botão.
        verify(exactly = 2) { viewModel.loadCandidates(GAME_ID) }
    }

    @Test
    fun setaDeVoltar_chamaONavegarDeVolta() {
        uiState.value = votacao()
        abrirTela()

        composeTestRule.onNodeWithContentDescription(appString(R.string.back)).performClick()

        assertEquals(1, voltou)
    }

    private fun votacao() = MVPVoteUiState.Voting(
        candidates = listOf(
            candidato("player1", "João Silva"),
            // O apelido tem prioridade sobre o nome.
            candidato("player2", "Carlos Santos", nickname = "Carlão")
        ),
        currentCategory = VoteCategory.MVP,
        isOwner = false
    )

    private fun candidato(userId: String, nome: String, nickname: String? = null) = GameConfirmation(
        id = "${GAME_ID}_$userId",
        gameId = GAME_ID,
        userId = userId,
        userName = nome,
        nickname = nickname
    )

    private companion object {
        const val GAME_ID = "game123"
    }
}
