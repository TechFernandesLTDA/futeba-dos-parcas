package com.futebadosparcas.ui.statistics

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.futebadosparcas.databinding.FragmentStatisticsBinding
import androidx.navigation.fragment.findNavController
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.data.LineData
import com.github.mikephil.charting.data.LineDataSet
import com.github.mikephil.charting.formatter.IndexAxisValueFormatter

@AndroidEntryPoint
class StatisticsFragment : Fragment() {

    private var _binding: FragmentStatisticsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: StatisticsViewModel by viewModels()

    private lateinit var topScorersAdapter: RankingAdapter
    private lateinit var topGoalkeepersAdapter: RankingAdapter
    private lateinit var bestPlayersAdapter: RankingAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentStatisticsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerViews()
        setupNavigation()
        binding.swipeRefresh.setOnRefreshListener {
            viewModel.loadStatistics()
        }

        observeViewModel()
        viewModel.loadStatistics()
    }

    private fun setupNavigation() {
        binding.btnRanking.setOnClickListener {
            findNavController().navigate(StatisticsFragmentDirections.actionStatisticsToRanking())
        }
        binding.btnEvolution.setOnClickListener {
            findNavController().navigate(StatisticsFragmentDirections.actionStatisticsToEvolution())
        }
    }

    private fun setupRecyclerViews() {
        binding.rvTopScorers.layoutManager = LinearLayoutManager(requireContext())
        binding.rvTopGoalkeepers.layoutManager = LinearLayoutManager(requireContext())
        binding.rvBestPlayers.layoutManager = LinearLayoutManager(requireContext())
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is StatisticsUiState.Loading -> {
                        if (!binding.swipeRefresh.isRefreshing) {
                            binding.progressBar.visibility = View.VISIBLE
                            binding.contentGroup.visibility = View.GONE
                        }
                    }
                    is StatisticsUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        binding.contentGroup.visibility = View.VISIBLE

                        val combinedStats = state.statistics
                        val myStats = combinedStats.myStats

                        // Minhas Estatisticas
                        binding.tvGamesCount.text = myStats.totalGames.toString()
                        binding.tvGoalsCount.text = myStats.totalGoals.toString()
                        binding.tvBestPlayerCount.text = myStats.bestPlayerCount.toString()
                        binding.tvPresenceRate.text = "${(myStats.presenceRate * 100).toInt()}%"

                        // Setup Chart
                        setupChart(combinedStats.goalEvolution)

                        // Rankings
                        topScorersAdapter = RankingAdapter(combinedStats.topScorers)
                        binding.rvTopScorers.adapter = topScorersAdapter

                        topGoalkeepersAdapter = RankingAdapter(combinedStats.topGoalkeepers)
                        binding.rvTopGoalkeepers.adapter = topGoalkeepersAdapter

                        bestPlayersAdapter = RankingAdapter(combinedStats.bestPlayers)
                        binding.rvBestPlayers.adapter = bestPlayersAdapter
                    }
                    is StatisticsUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        // Voce pode querer mostrar uma mensagem de erro aqui
                    }
                }
            }
        }
    }

    private fun setupChart(data: Map<String, Int>) {
        if (data.isEmpty()) {
            binding.cardEvolution.visibility = View.GONE
            return
        }
        binding.cardEvolution.visibility = View.VISIBLE

        val entries = ArrayList<Entry>()
        val labels = ArrayList<String>()
        var index = 0f
        
        data.forEach { (date, goals) ->
            entries.add(Entry(index, goals.toFloat()))
            labels.add(date)
            index++
        }

        val dataSet = LineDataSet(entries, "Gols")
        dataSet.color = requireContext().getColor(com.futebadosparcas.R.color.primary)
        dataSet.valueTextColor = requireContext().getColor(com.futebadosparcas.R.color.text_primary)
        dataSet.lineWidth = 3f
        dataSet.circleRadius = 5f
        dataSet.setCircleColor(requireContext().getColor(com.futebadosparcas.R.color.primary))
        dataSet.setDrawValues(true)
        dataSet.valueTextSize = 10f
        dataSet.mode = LineDataSet.Mode.CUBIC_BEZIER
        dataSet.setDrawFilled(true)
        dataSet.fillColor = requireContext().getColor(com.futebadosparcas.R.color.primary)
        dataSet.fillAlpha = 50

        val lineData = LineData(dataSet)
        binding.chartEvolution.data = lineData
        
        // Styling
        binding.chartEvolution.description.isEnabled = false
        binding.chartEvolution.legend.isEnabled = false
        binding.chartEvolution.setTouchEnabled(false)
        binding.chartEvolution.axisRight.isEnabled = false
        
        // X Axis
        val xAxis = binding.chartEvolution.xAxis
        xAxis.position = XAxis.XAxisPosition.BOTTOM
        xAxis.valueFormatter = IndexAxisValueFormatter(labels)
        xAxis.granularity = 1f
        xAxis.textColor = requireContext().getColor(com.futebadosparcas.R.color.text_secondary)
        xAxis.setDrawGridLines(false)
        xAxis.setDrawAxisLine(false)

        // Left Axis
        val leftAxis = binding.chartEvolution.axisLeft
        leftAxis.textColor = requireContext().getColor(com.futebadosparcas.R.color.text_secondary)
        leftAxis.gridColor = requireContext().getColor(com.futebadosparcas.R.color.outline_variant)
        leftAxis.axisMinimum = 0f
        leftAxis.setDrawAxisLine(false)
        
        binding.chartEvolution.invalidate()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
