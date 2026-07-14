package com.futebadosparcas.ui.search

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.repository.GroupRepository
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.UserRepository
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GlobalSearchViewModel Tests")
class GlobalSearchViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var gameRepository: GameRepository
    private lateinit var groupRepository: GroupRepository
    private lateinit var userRepository: UserRepository
    private lateinit var locationRepository: LocationRepository

    @BeforeEach
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        gameRepository = mockk(relaxed = true)
        groupRepository = mockk(relaxed = true)
        userRepository = mockk(relaxed = true)
        locationRepository = mockk(relaxed = true)
        every { userRepository.getCurrentUserId() } returns "user-a"
        coEvery { userRepository.searchUsers(any(), any()) } returns Result.success(emptyList())
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    @DisplayName("carrega somente o histórico pertencente ao usuário atual")
    fun `loads only current user history`() = runTest(dispatcher) {
        val dataStore = FakePreferencesDataStore(
            mapOf(
                "search_history_recent_user-a" to "minha pelada\nmeu grupo",
                "search_history_recent_user-b" to "busca de outra conta"
            )
        )

        val viewModel = createViewModel(dataStore)
        advanceUntilIdle()

        assertEquals(listOf("minha pelada", "meu grupo"), viewModel.recentSearches.value)
        assertFalse(viewModel.recentSearches.value.contains("busca de outra conta"))
    }

    @Test
    @DisplayName("busca salva e limpeza remove a chave do usuário")
    fun `search saves and clear removes current user key`() = runTest(dispatcher) {
        val dataStore = FakePreferencesDataStore()
        val viewModel = createViewModel(dataStore)
        viewModel.onFilterSelected(SearchFilter.PLAYERS)

        viewModel.onQueryChange("arena central")
        advanceTimeBy(301)
        advanceUntilIdle()

        assertEquals(listOf("arena central"), viewModel.recentSearches.value)
        assertEquals(
            "arena central",
            dataStore.value[stringPreferencesKey("search_history_recent_user-a")]
        )

        viewModel.clearHistory()
        advanceUntilIdle()

        assertEquals(emptyList<String>(), viewModel.recentSearches.value)
        assertEquals(
            null,
            dataStore.value[stringPreferencesKey("search_history_recent_user-a")]
        )
    }

    private fun createViewModel(dataStore: DataStore<Preferences>) = GlobalSearchViewModel(
        gameRepository = gameRepository,
        groupRepository = groupRepository,
        userRepository = userRepository,
        locationRepository = locationRepository,
        dataStore = dataStore
    )
}

private class FakePreferencesDataStore(
    initialValues: Map<String, String> = emptyMap()
) : DataStore<Preferences> {
    private val state = MutableStateFlow<Preferences>(
        emptyPreferences().toMutablePreferences().apply {
            initialValues.forEach { (key, value) -> this[stringPreferencesKey(key)] = value }
        }
    )

    override val data: Flow<Preferences> = state
    val value: Preferences get() = state.value

    override suspend fun updateData(
        transform: suspend (t: Preferences) -> Preferences
    ): Preferences {
        val updated = transform(state.value)
        state.value = updated
        return updated
    }
}
