package com.futebadosparcas.data.paging

import androidx.paging.PagingSource
import androidx.paging.PagingState
import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.local.model.GameEntity
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.ui.games.GameWithConfirmations
import com.futebadosparcas.util.MockLogExtension
import com.google.android.gms.tasks.Tasks
import com.google.firebase.firestore.CollectionReference
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QuerySnapshot
import io.mockk.every
import io.mockk.mockk
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import java.io.IOException

/**
 * Testes de CARACTERIZAÇÃO para CachedGamesPagingSource (A3 do plano).
 *
 * Descrevem o comportamento de HOJE. Pontos observados, congelados aqui:
 * - Primeira página com cache não vazio AGUARDA a rede (apesar do comentário
 *   "em background"). Se a rede falhar, o resultado é Error mesmo com cache.
 * - confirmedCount e isUserConfirmed são sempre 0/false (TODO no código).
 * - Na página do cache, nextKey é sempre null (TODO no código).
 * - getRefreshKey devolve sempre null.
 */
@ExtendWith(MockLogExtension::class)
class CachedGamesPagingSourceTest {

    private val pageSize = 20

    private lateinit var firestore: FirebaseFirestore
    private lateinit var gameDao: GameDao

    /**
     * Um único mock faz papel de CollectionReference e de Query: cada método
     * da cadeia (whereEqualTo, orderBy, limit, startAfter...) devolve ele mesmo.
     */
    private lateinit var collection: CollectionReference

    @org.junit.jupiter.api.BeforeEach
    fun setUp() {
        firestore = mockk()
        gameDao = mockk(relaxed = true)
        collection = mockk()

        every { firestore.collection("games") } returns collection
        every { collection.whereEqualTo(any<String>(), any<Any>()) } returns collection
        every { collection.whereIn(any<String>(), any<List<*>>()) } returns collection
        every { collection.orderBy(any<String>(), any<Query.Direction>()) } returns collection
        every { collection.limit(any<Long>()) } returns collection
        every { collection.startAfter(any<DocumentSnapshot>()) } returns collection
    }

    private fun source(
        groupId: String? = null,
        includeFinished: Boolean = true
    ) = CachedGamesPagingSource(
        firestore = firestore,
        gameDao = gameDao,
        groupId = groupId,
        includeFinished = includeFinished,
        pageSize = pageSize
    )

    private fun doc(id: String): DocumentSnapshot {
        val d = mockk<DocumentSnapshot>()
        every { d.id } returns id
        every { d.toObject(Game::class.java) } returns Game(id = id, status = "SCHEDULED")
        return d
    }

    private fun snapshot(vararg docs: DocumentSnapshot): QuerySnapshot {
        val s = mockk<QuerySnapshot>()
        every { s.documents } returns docs.toList()
        return s
    }

    private fun stubNetwork(result: QuerySnapshot) {
        every { collection.get() } returns Tasks.forResult(result)
    }

    private fun stubNetworkFailure(e: Exception) {
        every { collection.get() } returns Tasks.forException(e)
    }

    private fun entity(id: String) = GameEntity(
        id = id,
        scheduleId = "",
        date = "2026-11-10",
        time = "20:00",
        endTime = "21:00",
        status = "SCHEDULED",
        maxPlayers = 14,
        maxGoalkeepers = 2,
        players = emptyList(),
        dailyPrice = 0.0,
        confirmationClosesAt = null,
        numberOfTeams = 2,
        ownerId = "owner",
        ownerName = "Dono",
        locationId = "loc",
        fieldId = "field",
        locationName = "Local",
        locationAddress = "Rua A",
        locationLat = null,
        locationLng = null,
        fieldName = "Quadra",
        gameType = "FUTEBOL",
        recurrence = "NONE",
        createdAt = null
    )

    /** Converte o resultado para Page, falhando o teste se for Error. */
    private fun asPage(
        result: PagingSource.LoadResult<QuerySnapshot, GameWithConfirmations>
    ): PagingSource.LoadResult.Page<QuerySnapshot, GameWithConfirmations> {
        assertTrue(result is PagingSource.LoadResult.Page<*, *>, "esperado Page, veio $result")
        @Suppress("UNCHECKED_CAST")
        return result as PagingSource.LoadResult.Page<QuerySnapshot, GameWithConfirmations>
    }

    private fun refreshParams() = PagingSource.LoadParams.Refresh<QuerySnapshot>(
        key = null,
        loadSize = pageSize,
        placeholdersEnabled = false
    )

    private fun appendParams(key: QuerySnapshot, loadSize: Int = pageSize) =
        PagingSource.LoadParams.Append(key = key, loadSize = loadSize, placeholdersEnabled = false)

    // ---------------------------------------------------------------
    // Primeira página: cache offline-first
    // ---------------------------------------------------------------

    @Test
    fun load_primeiraPaginaComCache_retornaCacheSemConfirmacoesENextKeyNulo() = runTest {
        coEvery { gameDao.getUpcomingGamesSnapshot() } returns listOf(entity("c1"), entity("c2"))
        stubNetwork(snapshot(doc("n1")))

        val result = source().load(refreshParams())

        val page = asPage(result)
        assertEquals(listOf("c1", "c2"), page.data.map { it.game.id })
        assertTrue(page.data.all { it.confirmedCount == 0 && !it.isUserConfirmed })
        assertNull(page.prevKey)
        assertNull(page.nextKey)
    }

    @Test
    fun load_primeiraPaginaComCache_aguardaRedeEAtualizaCache() = runTest {
        coEvery { gameDao.getUpcomingGamesSnapshot() } returns listOf(entity("c1"))
        stubNetwork(snapshot(doc("n1"), doc("n2")))

        source().load(refreshParams())

        // HOJE a rede é chamada na mesma corrotina (não em background)
        verify(exactly = 1) { collection.get() }
        coVerify(exactly = 1) { gameDao.insertGames(match { it.map { e -> e.id } == listOf("n1", "n2") }) }
    }

    @Test
    fun load_primeiraPaginaComCache_redeFalha_retornaErrorMesmoComCache() = runTest {
        coEvery { gameDao.getUpcomingGamesSnapshot() } returns listOf(entity("c1"))
        stubNetworkFailure(IOException("sem rede"))

        val result = source().load(refreshParams())

        assertInstanceOf(PagingSource.LoadResult.Error::class.java, result)
    }

    @Test
    fun load_primeiraPaginaCacheVazio_buscaRedeEMontaPagina() = runTest {
        coEvery { gameDao.getUpcomingGamesSnapshot() } returns emptyList()
        stubNetwork(snapshot(doc("n1")))

        val result = source().load(refreshParams())

        val page = asPage(result)
        assertEquals(listOf("n1"), page.data.map { it.game.id })
        verify(exactly = 1) { collection.get() }
    }

    // ---------------------------------------------------------------
    // Páginas vindas da rede
    // ---------------------------------------------------------------

    @Test
    fun load_paginaDaRedeMenorQueLoadSize_nextKeyNulo() = runTest {
        coEvery { gameDao.getUpcomingGamesSnapshot() } returns emptyList()
        stubNetwork(snapshot(doc("n1"), doc("n2")))

        val result = source().load(refreshParams())

        val page = asPage(result)
        assertNull(page.nextKey)
    }

    @Test
    fun load_paginaDaRedeCheia_nextKeyEhOSnapshotAtual() = runTest {
        coEvery { gameDao.getUpcomingGamesSnapshot() } returns emptyList()
        val snap = snapshot(*Array(pageSize) { doc("n$it") })
        stubNetwork(snap)

        val result = source().load(refreshParams())

        val page = asPage(result)
        assertSame(snap, page.nextKey)
    }

    @Test
    fun load_paginaSeguinte_usaStartAfterComOUltimoDocumento() = runTest {
        val lastDoc = doc("ultimo")
        val previous = snapshot(doc("a"), lastDoc)
        stubNetwork(snapshot(doc("n3")))

        source().load(appendParams(previous))

        verify(exactly = 1) { collection.startAfter(lastDoc) }
    }

    @Test
    fun load_paginaSeguinte_nao_consultaCacheLocal() = runTest {
        val previous = snapshot(doc("a"))
        stubNetwork(snapshot(doc("n1")))

        source().load(appendParams(previous))

        coVerify(exactly = 0) { gameDao.getUpcomingGamesSnapshot() }
    }

    @Test
    fun load_documentoComErroDeParse_eIgnoradoNaPagina() = runTest {
        val ruim = mockk<DocumentSnapshot>()
        every { ruim.id } returns "ruim"
        every { ruim.toObject(Game::class.java) } throws IllegalStateException("campo inválido")
        coEvery { gameDao.getUpcomingGamesSnapshot() } returns emptyList()
        stubNetwork(snapshot(doc("ok"), ruim))

        val result = source().load(refreshParams())

        val page = asPage(result)
        assertEquals(listOf("ok"), page.data.map { it.game.id })
    }

    @Test
    fun load_excecaoDoFirestore_retornaError() = runTest {
        coEvery { gameDao.getUpcomingGamesSnapshot() } returns emptyList()
        stubNetworkFailure(IOException("timeout"))

        val result = source().load(refreshParams())

        assertInstanceOf(PagingSource.LoadResult.Error::class.java, result)
    }

    // ---------------------------------------------------------------
    // Filtros e ordenação da query
    // ---------------------------------------------------------------

    @Test
    fun load_comGroupId_aplicaWhereEqualToGroupId() = runTest {
        coEvery { gameDao.getUpcomingGamesSnapshot() } returns emptyList()
        stubNetwork(snapshot())

        source(groupId = "grupo-1").load(refreshParams())

        verify(exactly = 1) { collection.whereEqualTo("group_id", "grupo-1") }
    }

    @Test
    fun load_semGroupId_naoAplicaFiltroDeGrupo() = runTest {
        coEvery { gameDao.getUpcomingGamesSnapshot() } returns emptyList()
        stubNetwork(snapshot())

        source(groupId = null).load(refreshParams())

        verify(exactly = 0) { collection.whereEqualTo("group_id", any<Any>()) }
    }

    @Test
    fun load_includeFinishedFalse_aplicaWhereInSomenteStatusAtivos() = runTest {
        coEvery { gameDao.getUpcomingGamesSnapshot() } returns emptyList()
        stubNetwork(snapshot())

        source(includeFinished = false).load(refreshParams())

        verify(exactly = 1) {
            collection.whereIn("status", listOf("SCHEDULED", "CONFIRMED", "LIVE"))
        }
    }

    @Test
    fun load_includeFinishedTrue_naoAplicaWhereInDeStatus() = runTest {
        coEvery { gameDao.getUpcomingGamesSnapshot() } returns emptyList()
        stubNetwork(snapshot())

        source(includeFinished = true).load(refreshParams())

        verify(exactly = 0) { collection.whereIn("status", any<List<*>>()) }
    }

    @Test
    fun load_ordenaPorDateTimeAscendenteComLimitePageSize() = runTest {
        coEvery { gameDao.getUpcomingGamesSnapshot() } returns emptyList()
        stubNetwork(snapshot())

        source().load(refreshParams())

        verify(exactly = 1) { collection.orderBy("dateTime", Query.Direction.ASCENDING) }
        verify(exactly = 1) { collection.limit(pageSize.toLong()) }
    }

    // ---------------------------------------------------------------
    // getRefreshKey
    // ---------------------------------------------------------------

    @Test
    fun getRefreshKey_sempreRetornaNull() {
        val state = mockk<PagingState<QuerySnapshot, GameWithConfirmations>>()

        assertNull(source().getRefreshKey(state))
    }
}
