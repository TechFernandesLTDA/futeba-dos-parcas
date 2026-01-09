package com.futebadosparcas.ui.statistics

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import com.futebadosparcas.data.model.LeagueDivision
import com.futebadosparcas.ui.theme.FutebaTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Fragment que hospeda a tela de Evolucao do jogador usando Compose.
 */
@AndroidEntryPoint
class EvolutionFragment : Fragment() {

    private val viewModel: RankingViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    EvolutionScreen(viewModel = viewModel)
                }
            }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        viewModel.loadEvolution()
    }
}

@Composable
fun EvolutionScreen(viewModel: RankingViewModel) {
    val state by viewModel.evolutionState.collectAsState()

    when (val currentState = state) {
        is EvolutionUiState.Loading -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
        }
        is EvolutionUiState.Error -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = currentState.message,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
        is EvolutionUiState.Success -> {
            EvolutionContent(data = currentState.data)
        }
    }
}

@Composable
private fun EvolutionContent(data: PlayerEvolutionData) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // Titulo
        Text(
            text = "Minha Evolucao",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        // Card de Nivel e XP
        PlayerEvolutionCard(
            currentLevel = data.currentLevel,
            levelName = data.levelName,
            currentXp = data.currentXp,
            xpProgress = data.xpProgress,
            xpNeeded = data.xpNeeded,
            progressPercentage = data.progressPercentage
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Card de Liga (se houver dados)
        data.leagueData?.let { league ->
            PlayerLeagueCard(
                division = league.division,
                leagueRating = league.leagueRating,
                promotionProgress = league.promotionProgress,
                relegationProgress = league.relegationProgress,
                protectionGames = league.protectionGames
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        // Proximos objetivos
        if (data.nextMilestones.isNotEmpty()) {
            Text(
                text = "Proximos Objetivos",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(vertical = 12.dp)
            )

            data.nextMilestones.forEach { milestone ->
                MilestoneProgressCard(
                    milestoneName = milestone.milestone.displayName,
                    description = milestone.milestone.description,
                    current = milestone.current,
                    target = milestone.target,
                    xpReward = milestone.milestone.xpReward
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
        }

        // Historico de XP recente
        if (data.xpHistory.isNotEmpty()) {
            Text(
                text = "Historico Recente",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(vertical = 12.dp)
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    data.xpHistory.take(10).forEach { log ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = log.source,
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "+${log.xpEarned} XP",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                                color = MaterialTheme.colorScheme.tertiary
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}
