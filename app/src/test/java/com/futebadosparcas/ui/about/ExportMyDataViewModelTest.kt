package com.futebadosparcas.ui.about

import android.net.Uri
import com.futebadosparcas.R
import com.futebadosparcas.data.repository.ExportMyDataError
import com.futebadosparcas.data.repository.ExportMyDataPayload
import com.futebadosparcas.data.repository.MyDataExportRepository
import com.futebadosparcas.data.repository.exportMyDataFileName
import com.futebadosparcas.data.repository.exportPayloadFromCallableData
import com.futebadosparcas.data.repository.mapExportMyDataError
import com.futebadosparcas.util.MockLogExtension
import com.google.firebase.functions.FirebaseFunctionsException
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import java.io.IOException
import java.time.LocalDate

@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("ExportMyData (#4483) ViewModel + funções puras")
@ExtendWith(MockLogExtension::class)
class ExportMyDataViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var repository: MyDataExportRepository
    private val uri: Uri = mockk()

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        repository = mockk(relaxed = true)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun functionsError(
        code: FirebaseFunctionsException.Code,
        details: Any? = null,
    ): FirebaseFunctionsException {
        val e = mockk<FirebaseFunctionsException>(relaxed = true)
        every { e.code } returns code
        every { e.details } returns details
        every { e.message } returns "erro"
        return e
    }

    private fun newViewModel() = ExportMyDataViewModel(repository) { LocalDate.of(2026, 11, 1) }

    @Nested
    @DisplayName("ViewModel")
    inner class ViewModelTests {

        @Test
        fun onFileChosen_completeExport_writesFileAndEmitsSuccess() = runTest(testDispatcher) {
            coEvery { repository.fetch() } returns ExportMyDataPayload(json = "{\"a\":1}", complete = true)
            val vm = newViewModel()

            vm.onFileChosen(uri)
            advanceUntilIdle()

            assertEquals(ExportMyDataUiState.Success(partial = false), vm.uiState.value)
            coVerify(exactly = 1) { repository.write(uri, "{\"a\":1}") }
            coVerify(exactly = 0) { repository.discard(any()) }
        }

        @Test
        fun onFileChosen_partialExport_savesAndFlagsPartial() = runTest(testDispatcher) {
            coEvery { repository.fetch() } returns ExportMyDataPayload(json = "{}", complete = false)
            val vm = newViewModel()

            vm.onFileChosen(uri)
            advanceUntilIdle()

            assertEquals(ExportMyDataUiState.Success(partial = true), vm.uiState.value)
            coVerify(exactly = 1) { repository.write(uri, "{}") }
            coVerify(exactly = 0) { repository.discard(any()) }
        }

        @Test
        fun onFileChosen_resourceExhausted_showsRateLimitAndDiscardsFile() = runTest(testDispatcher) {
            coEvery { repository.fetch() } throws functionsError(FirebaseFunctionsException.Code.RESOURCE_EXHAUSTED)
            val vm = newViewModel()

            vm.onFileChosen(uri)
            advanceUntilIdle()

            assertEquals(
                ExportMyDataUiState.Error(R.string.about_export_my_data_rate_limited),
                vm.uiState.value
            )
            coVerify(exactly = 0) { repository.write(any(), any()) }
            coVerify(exactly = 1) { repository.discard(uri) }
        }

        @Test
        fun onFileChosen_exportTooLarge_showsTooLarge() = runTest(testDispatcher) {
            coEvery { repository.fetch() } throws functionsError(
                FirebaseFunctionsException.Code.RESOURCE_EXHAUSTED,
                mapOf("reason" to "export-too-large")
            )
            val vm = newViewModel()

            vm.onFileChosen(uri)
            advanceUntilIdle()

            assertEquals(
                ExportMyDataUiState.Error(R.string.about_export_my_data_too_large),
                vm.uiState.value
            )
            coVerify(exactly = 1) { repository.discard(uri) }
        }

        @Test
        fun onFileChosen_genericError_showsGenericAndDiscardsFile() = runTest(testDispatcher) {
            coEvery { repository.fetch() } throws functionsError(FirebaseFunctionsException.Code.INTERNAL)
            val vm = newViewModel()

            vm.onFileChosen(uri)
            advanceUntilIdle()

            assertEquals(ExportMyDataUiState.Error(R.string.about_export_my_data_error), vm.uiState.value)
            coVerify(exactly = 1) { repository.discard(uri) }
        }

        @Test
        fun onFileChosen_writeFails_showsGenericAndDiscardsFile() = runTest(testDispatcher) {
            coEvery { repository.fetch() } returns ExportMyDataPayload(json = "{}", complete = true)
            coEvery { repository.write(any(), any()) } throws IOException("disco cheio")
            val vm = newViewModel()

            vm.onFileChosen(uri)
            advanceUntilIdle()

            assertEquals(ExportMyDataUiState.Error(R.string.about_export_my_data_error), vm.uiState.value)
            coVerify(exactly = 1) { repository.discard(uri) }
        }

        @Test
        fun onFileChosen_nullUri_doesNotCallCallable() = runTest(testDispatcher) {
            val vm = newViewModel()

            vm.onFileChosen(null)
            advanceUntilIdle()

            assertEquals(ExportMyDataUiState.Idle, vm.uiState.value)
            coVerify(exactly = 0) { repository.fetch() }
            coVerify(exactly = 0) { repository.discard(any()) }
        }

        @Test
        fun onFileChosen_whileLoading_ignoresSecondRequest() = runTest(testDispatcher) {
            val gate = CompletableDeferred<ExportMyDataPayload>()
            coEvery { repository.fetch() } coAnswers { gate.await() }
            val vm = newViewModel()

            vm.onFileChosen(uri)
            advanceUntilIdle()
            assertEquals(ExportMyDataUiState.Loading, vm.uiState.value)

            vm.onFileChosen(mockk())
            gate.complete(ExportMyDataPayload(json = "{}", complete = true))
            advanceUntilIdle()

            assertEquals(ExportMyDataUiState.Success(partial = false), vm.uiState.value)
            coVerify(exactly = 1) { repository.fetch() }
        }

        @Test
        fun dismissResult_afterError_returnsToIdle() = runTest(testDispatcher) {
            coEvery { repository.fetch() } throws IllegalStateException("x")
            val vm = newViewModel()
            vm.onFileChosen(uri)
            advanceUntilIdle()

            vm.dismissResult()

            assertEquals(ExportMyDataUiState.Idle, vm.uiState.value)
        }

        @Test
        fun onPickerUnavailable_showsGenericWithoutCallingCallable() = runTest(testDispatcher) {
            val vm = newViewModel()

            vm.onPickerUnavailable()

            assertEquals(ExportMyDataUiState.Error(R.string.about_export_my_data_error), vm.uiState.value)
            coVerify(exactly = 0) { repository.fetch() }
        }

        @Test
        fun suggestedFileName_usesLocalDate() {
            assertEquals("futeba-meus-dados-2026-11-01.json", newViewModel().suggestedFileName())
        }
    }

    @Nested
    @DisplayName("Funções puras")
    inner class PureFunctions {

        @Test
        fun mapExportMyDataError_classifiesCodesAndCause() {
            assertEquals(
                ExportMyDataError.RateLimited,
                mapExportMyDataError(functionsError(FirebaseFunctionsException.Code.RESOURCE_EXHAUSTED))
            )
            assertEquals(
                ExportMyDataError.TooLarge,
                mapExportMyDataError(
                    RuntimeException(
                        functionsError(
                            FirebaseFunctionsException.Code.RESOURCE_EXHAUSTED,
                            mapOf("reason" to "export-too-large")
                        )
                    )
                )
            )
            assertEquals(
                ExportMyDataError.Generic,
                mapExportMyDataError(functionsError(FirebaseFunctionsException.Code.UNAUTHENTICATED))
            )
            assertEquals(ExportMyDataError.Generic, mapExportMyDataError(IOException("rede")))
        }

        @Test
        fun exportPayloadFromCallableData_serializesNestedValues() {
            val data = mapOf(
                "schema_version" to 1,
                "complete" to true,
                "incomplete_sources" to emptyList<Any>(),
                "data" to mapOf(
                    "profile" to mapOf("name" to "Fulano", "deleted_at" to null, "xp" to 1234567890123L),
                    "games" to listOf(mapOf("score" to 2.5), "texto", false),
                ),
            )

            val payload = exportPayloadFromCallableData(data)

            assertTrue(payload.complete)
            val root = Json.parseToJsonElement(payload.json).jsonObject
            assertEquals(1, root["schema_version"]!!.jsonPrimitive.int)
            val profile = root["data"]!!.jsonObject["profile"]!!.jsonObject
            assertEquals("Fulano", profile["name"]!!.jsonPrimitive.content)
            assertEquals(JsonNull, profile["deleted_at"])
            assertEquals("1234567890123", profile["xp"]!!.jsonPrimitive.content)
            val games = root["data"]!!.jsonObject["games"]!!.jsonArray
            assertEquals("2.5", games[0].jsonObject["score"]!!.jsonPrimitive.content)
            assertEquals("texto", games[1].jsonPrimitive.content)
            assertFalse(games[2].jsonPrimitive.boolean)
        }

        @Test
        fun exportPayloadFromCallableData_completeFalse_isPartial() {
            assertFalse(exportPayloadFromCallableData(mapOf("complete" to false)).complete)
            assertTrue(exportPayloadFromCallableData(mapOf("schema_version" to 1)).complete)
        }

        @Test
        fun exportMyDataFileName_padsMonthAndDay() {
            assertEquals("futeba-meus-dados-2026-01-05.json", exportMyDataFileName(LocalDate.of(2026, 1, 5)))
        }
    }
}
