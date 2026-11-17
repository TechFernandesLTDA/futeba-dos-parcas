package com.futebadosparcas.permissions

import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.WaitlistRepository
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameWaitlist
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.WaitlistStatus
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.domain.usecase.ConfirmationUseCase
import com.futebadosparcas.util.MockLogExtension
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Marcação de jogo: confirmação de presença, limite de vagas (goleiros contam no total)
 * e lista de espera quando o jogo está lotado. Também o prazo de resposta da fila.
 */
@ExtendWith(MockLogExtension::class)
class GameCapacityWaitlistTest {

    private lateinit var gameRepository: GameRepository
    private lateinit var waitlistRepository: WaitlistRepository
    private lateinit var userRepository: UserRepository
    private lateinit var useCase: ConfirmationUseCase

    private val jogador = User(id = "player-1", name = "Jogador", email = "jogador@example.test")

    private fun jogo(playersCount: Int, goalkeepersCount: Int) = Game(
        id = "game-1",
        date = "2026-11-20",
        time = "20:00",
        status = "CONFIRMED",
        maxPlayers = 14,
        maxGoalkeepers = 3,
        playersCount = playersCount,
        goalkeepersCount = goalkeepersCount,
        ownerId = "owner-1"
    )

    @BeforeEach
    fun setUp() {
        gameRepository = mockk(relaxed = true)
        waitlistRepository = mockk(relaxed = true)
        userRepository = mockk(relaxed = true)
        val firestore = mockk<FirebaseFirestore>()
        // updateConfirmationOrder captura exceções internamente: o erro aqui não deve afetar o resultado.
        every { firestore.collection(any()) } throws RuntimeException("sem firestore nos testes")

        coEvery { userRepository.getCurrentUser() } returns Result.success(jogador)
        coEvery { gameRepository.getGameConfirmations("game-1") } returns Result.success(emptyList())
        coEvery {
            gameRepository.confirmPresence("game-1", "LINE", false)
        } returns Result.success(GameConfirmation(gameId = "game-1", userId = "player-1", userName = "Jogador"))

        useCase = ConfirmationUseCase(
            gameRepository = gameRepository,
            waitlistRepository = waitlistRepository,
            notificationRepository = mockk<NotificationRepository>(relaxed = true),
            userRepository = userRepository,
            firestore = firestore,
            functions = mockk<FirebaseFunctions>(relaxed = true)
        )
    }

    @Test
    fun confirmPresence_vagaDisponivel_confirmaSemIrParaFila() = runTest {
        coEvery { gameRepository.getGameDetails("game-1") } returns Result.success(jogo(5, 1))

        val result = useCase.confirmPresence("game-1", "LINE")

        assertTrue(result.isSuccess)
        assertFalse(result.getOrThrow().addedToWaitlist)
        coVerify(exactly = 1) { gameRepository.confirmPresence("game-1", "LINE", false) }
        coVerify(exactly = 0) { waitlistRepository.addToWaitlist(any(), any(), any(), any(), any()) }
    }

    @Test
    fun confirmPresence_totalNoLimiteDeJogadoresEGoleiros_vaiParaListaDeEspera() = runTest {
        // 14 jogadores + 3 goleiros = 17 = maxPlayers + maxGoalkeepers: jogo lotado.
        coEvery { gameRepository.getGameDetails("game-1") } returns Result.success(jogo(14, 3))
        coEvery {
            waitlistRepository.addToWaitlist("game-1", "player-1", "Jogador", null, "LINE")
        } returns Result.success(
            GameWaitlist(gameId = "game-1", userId = "player-1", queuePosition = 2)
        )

        val result = useCase.confirmPresence("game-1", "LINE")

        val resultado = result.getOrThrow()
        assertTrue(resultado.addedToWaitlist)
        assertEquals(2, resultado.waitlistPosition)
        coVerify(exactly = 0) { gameRepository.confirmPresence(any(), any(), any()) }
    }

    @Test
    fun confirmPresence_goleirosContamNoLimiteTotal_lotaOJogoMesmoComVagaDeLinha() = runTest {
        // 14 jogadores (cheio de linha) + 2 goleiros: total 16 < 17, ainda há uma vaga.
        coEvery { gameRepository.getGameDetails("game-1") } returns Result.success(jogo(14, 2))

        val result = useCase.confirmPresence("game-1", "LINE")

        assertFalse(result.getOrThrow().addedToWaitlist)
        coVerify(exactly = 1) { gameRepository.confirmPresence("game-1", "LINE", false) }
    }

    @Test
    fun confirmPresence_lotadoSemUsuarioAutenticado_falhaSemEntrarNaFila() = runTest {
        coEvery { gameRepository.getGameDetails("game-1") } returns Result.success(jogo(14, 3))
        coEvery { userRepository.getCurrentUser() } returns Result.failure(Exception("sem sessão"))

        val result = useCase.confirmPresence("game-1", "LINE")

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { waitlistRepository.addToWaitlist(any(), any(), any(), any(), any()) }
    }

    @Test
    fun confirmPresence_jogoNaoEncontrado_falha() = runTest {
        coEvery { gameRepository.getGameDetails("game-1") } returns Result.failure(Exception("x"))

        val result = useCase.confirmPresence("game-1", "LINE")

        assertEquals("Jogo nao encontrado", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { gameRepository.confirmPresence(any(), any(), any()) }
    }

    @Test
    fun confirmPresence_repositorioRecusaConfirmacao_propagaFalha() = runTest {
        coEvery { gameRepository.getGameDetails("game-1") } returns Result.success(jogo(5, 1))
        coEvery {
            gameRepository.confirmPresence("game-1", "LINE", false)
        } returns Result.failure(IllegalStateException("Nao eh possivel confirmar apos o inicio do jogo"))

        val result = useCase.confirmPresence("game-1", "LINE")

        assertEquals(
            "Nao eh possivel confirmar apos o inicio do jogo",
            result.exceptionOrNull()?.message
        )
    }

    @Test
    fun gameWaitlist_prazoDeResposta_expiraDepoisDoDeadline() {
        val entrada = GameWaitlist(
            gameId = "game-1",
            userId = "player-1",
            status = WaitlistStatus.NOTIFIED.name,
            responseDeadline = 1_000L
        )

        assertFalse(entrada.isExpired(999L))
        assertTrue(entrada.isExpired(1_001L))
        assertEquals(WaitlistStatus.NOTIFIED, entrada.getStatusEnum())
    }
}
