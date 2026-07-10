package com.futebadosparcas.ui.groups

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.futebadosparcas.ui.theme.FutebaTheme
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GroupWallScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun compositorPermaneceVisivelQuandoMuralEstaVazio() {
        val viewModel = mockk<GroupWallViewModel>(relaxed = true)
        every { viewModel.uiState } returns MutableStateFlow(GroupWallUiState.Empty)
        every { viewModel.actionState } returns MutableStateFlow(GroupWallActionState.Idle)

        composeTestRule.setContent {
            FutebaTheme {
                GroupWallScreen(
                    groupId = "group-1",
                    canPost = true,
                    canManage = false,
                    onNavigateBack = {},
                    viewModel = viewModel
                )
            }
        }

        composeTestRule.onNodeWithText("Nenhuma publicação ainda").assertIsDisplayed()
        composeTestRule.onNodeWithText("Escreva algo para o grupo…").assertIsDisplayed()
    }
}
