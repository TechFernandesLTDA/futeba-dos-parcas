package com.futebadosparcas.ui.home

import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasScrollToNodeAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameStatus
import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.ui.games.GameWithConfirmations
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
 * Tela inicial (`HomeScreen`) em cada estado, com o ViewModel substituído por um mock.
 *
 * O conteúdo é uma lista preguiçosa: o cabeçalho aparece de cara, o resto (jogos, primeiros passos) só
 * existe depois de rolar (`rolarAte`).
 */
@RunWith(AndroidJUnit4::class)
class HomeScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private lateinit var viewModel: HomeViewModel
    private val uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    private val online = MutableStateFlow(true)
    private val naoLidas = MutableStateFlow(0)
    private val carregamento = MutableStateFlow<LoadingState>(LoadingState.Idle)
    private val atualizando = MutableStateFlow(false)

    private val jogosAbertos = mutableListOf<String>()
    private val jogosConfirmados = mutableListOf<String>()
    private var jornadaDeNivel = 0

    @Before
    fun setup() {
        viewModel = mockk(relaxed = true)
        every { viewModel.uiState } returns uiState
        every { viewModel.isOnline } returns online
        every { viewModel.unreadCount } returns naoLidas
        every { viewModel.loadingState } returns carregamento
        every { viewModel.isRefreshing } returns atualizando
    }

    private fun abrirTela() {
        composeTestRule.setContent {
            FutebaTheme {
                HomeScreen(
                    viewModel = viewModel,
                    onGameClick = { jogosAbertos += it },
                    onConfirmGame = { jogosConfirmados += it },
                    onLevelJourneyClick = { jornadaDeNivel++ }
                )
            }
        }
    }

    private fun lista(): SemanticsNodeInteraction =
        composeTestRule.onAllNodes(hasScrollToNodeAction()).onFirst()

    /** Rola a lista da Home até o item com o texto e devolve o nó. */
    private fun rolarAte(texto: String): SemanticsNodeInteraction {
        lista().performScrollToNode(hasText(texto))
        return composeTestRule.onNodeWithText(texto)
    }

    /** O telefone mostra "Nv. 5"; telas largas mostram "Nível 5 - Titular". */
    private fun seloDeNivel(): SemanticsNodeInteraction = composeTestRule.onNode(
        hasText(appString(R.string.hub_level_short, NIVEL)) or
            hasText(appString(R.string.hub_level_full, NIVEL, NOME_DO_NIVEL))
    )

    // --- Carregando e erro ---

    @Test
    fun carregando_naoMostraASaudacao() {
        abrirTela()

        composeTestRule.assertTextoAusente(appString(R.string.hub_welcome_back))
    }

    @Test
    fun erro_mostraAMensagemETentarNovamenteForcaORecarregamento() {
        uiState.value = HomeUiState.Error("Erro ao carregar dados")
        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.error_default)).assertIsDisplayed()
        composeTestRule.onNodeWithText("Erro ao carregar dados").assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.action_retry)).performClick()

        verify { viewModel.loadHomeData(forceRetry = true) }
    }

    // --- Cabeçalho ---

    @Test
    fun cabecalho_saudaPeloNome() {
        uiState.value = sucesso(user = usuario(nome = "João Silva"))

        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.hub_welcome_back)).assertIsDisplayed()
        composeTestRule.onNodeWithText("João Silva").assertIsDisplayed()
    }

    @Test
    fun cabecalho_usaOApelidoQuandoExiste() {
        uiState.value = sucesso(user = usuario(nome = "João Silva", apelido = "Craque"))

        abrirTela()

        composeTestRule.onNodeWithText("Craque").assertIsDisplayed()
        composeTestRule.assertTextoAusente("João Silva")
    }

    @Test
    fun cabecalho_mostraNivelProgressoEEstatisticas() {
        uiState.value = sucesso()

        abrirTela()

        seloDeNivel().assertIsDisplayed()
        composeTestRule.onNodeWithText("65%").assertIsDisplayed()
        composeTestRule.onNodeWithText("50").assertIsDisplayed() // jogos
        composeTestRule.onNodeWithText("30").assertIsDisplayed() // gols
    }

    @Test
    fun cabecalho_tocarNoNivelAbreAJornada() {
        uiState.value = sucesso()
        abrirTela()

        seloDeNivel().performClick()

        assertEquals(1, jornadaDeNivel)
    }

    // --- Conexão ---

    @Test
    fun online_naoMostraOAvisoDeOffline() {
        uiState.value = sucesso()

        abrirTela()

        composeTestRule.assertTextoAusente(appString(R.string.ui_offline_message))
    }

    @Test
    fun offline_mostraOAvisoEMantemOConteudo() {
        uiState.value = sucesso()
        online.value = false

        abrirTela()

        composeTestRule.onNodeWithText(appString(R.string.ui_offline_message)).assertIsDisplayed()
        composeTestRule.onNodeWithText(appString(R.string.hub_welcome_back)).assertIsDisplayed()
    }

    // --- Próximos jogos ---

    @Test
    fun jogosPendentes_ficamNaSecaoParaConfirmar() {
        uiState.value = sucesso(jogos = listOf(jogo("g1", "Arena Pendente", confirmado = false)))
        abrirTela()

        rolarAte("Arena Pendente").assertIsDisplayed()

        composeTestRule.onNodeWithText(appString(R.string.upcoming_games_pending)).assertIsDisplayed()
        composeTestRule.assertTextoAusente(appString(R.string.upcoming_games_confirmed))
    }

    @Test
    fun jogosConfirmados_ficamNaSecaoConfirmados() {
        uiState.value = sucesso(jogos = listOf(jogo("g1", "Arena Confirmada", confirmado = true)))
        abrirTela()

        rolarAte("Arena Confirmada").assertIsDisplayed()

        composeTestRule.onNodeWithText(appString(R.string.upcoming_games_confirmed)).assertIsDisplayed()
        composeTestRule.assertTextoAusente(appString(R.string.upcoming_games_pending))
    }

    @Test
    fun doisJogos_aparecemOsDois() {
        uiState.value = sucesso(
            jogos = listOf(jogo("g1", "Arena Test", confirmado = true), jogo("g2", "Quadra Central", confirmado = true))
        )
        abrirTela()

        rolarAte("Arena Test").assertIsDisplayed()
        rolarAte("Quadra Central").assertIsDisplayed()
    }

    @Test
    fun tocarNoJogo_abreODetalheDele() {
        uiState.value = sucesso(jogos = listOf(jogo("game123", "Arena Clicável", confirmado = true)))
        abrirTela()

        rolarAte("Arena Clicável").performClick()

        assertEquals(listOf("game123"), jogosAbertos)
    }

    @Test
    fun jogoPendente_botaoConfirmarChamaAConfirmacaoDoJogo() {
        uiState.value = sucesso(jogos = listOf(jogo("gameToConfirm", "Arena Pendente", confirmado = false)))
        abrirTela()
        rolarAte("Arena Pendente")

        composeTestRule.onNode(hasText(appString(R.string.confirm)) and hasClickAction()).performClick()

        assertEquals(listOf("gameToConfirm"), jogosConfirmados)
        assertEquals(emptyList<String>(), jogosAbertos)
    }

    @Test
    fun jogoConfirmado_naoTemBotaoConfirmar() {
        uiState.value = sucesso(jogos = listOf(jogo("g1", "Arena Confirmada", confirmado = true)))
        abrirTela()

        rolarAte("Arena Confirmada")

        composeTestRule.assertTextoAusente(appString(R.string.confirm))
    }

    // --- Sem conteúdo ---

    @Test
    fun semJogosNemEstatisticas_mostraBoasVindasEPrimeirosPassos() {
        uiState.value = sucesso(user = usuario(nome = "Maria Souza"), jogos = emptyList(), estatisticas = null)
        abrirTela()

        rolarAte(appString(R.string.welcome_greeting, "Maria")).assertIsDisplayed()
        rolarAte(appString(R.string.welcome_first_steps)).assertIsDisplayed()
    }

    // --- Atualizar ---

    @Test
    fun puxarParaBaixo_atualizaAHome() {
        uiState.value = sucesso()
        abrirTela()

        lista().performTouchInput { swipeDown() }
        composeTestRule.waitForIdle()

        verify { viewModel.refreshHomeData() }
    }

    // --- Dados de teste ---

    private fun usuario(nome: String = "Test User", apelido: String? = null) = User(
        id = "user123",
        name = nome,
        nickname = apelido,
        email = "teste@exemplo.com",
        level = NIVEL,
        experiencePoints = 2500L
    )

    private fun jogo(id: String, local: String, confirmado: Boolean) = GameWithConfirmations(
        game = Game(
            id = id,
            date = "2026-12-20",
            time = "20:00",
            status = GameStatus.SCHEDULED.name,
            locationName = local,
            fieldName = "Quadra 1",
            maxPlayers = 14,
            ownerId = "user123",
            ownerName = "Test User"
        ),
        confirmedCount = 10,
        isUserConfirmed = confirmado
    )

    private fun sucesso(
        user: User = usuario(),
        jogos: List<GameWithConfirmations> = emptyList(),
        estatisticas: Statistics? = Statistics(
            id = "user123",
            userId = "user123",
            totalGames = 50,
            totalGoals = 30,
            totalAssists = 15,
            totalWins = 25,
            totalDraws = 10,
            totalLosses = 15,
            mvpCount = 5
        )
    ) = HomeUiState.Success(
        user = user,
        games = jogos,
        gamificationSummary = GamificationSummary(
            level = NIVEL,
            levelName = NOME_DO_NIVEL,
            nextLevelXp = 500L,
            nextLevelName = "Craque",
            progressPercent = 65,
            isMaxLevel = false,
            division = LeagueDivision.OURO
        ),
        statistics = estatisticas
    )

    private companion object {
        const val NIVEL = 5
        const val NOME_DO_NIVEL = "Titular"
    }
}
