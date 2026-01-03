package com.futebadosparcas.ui.players

import android.app.Dialog
import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.fragment.app.DialogFragment
import com.futebadosparcas.R
import com.futebadosparcas.data.model.PlayerRatingRole
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.databinding.DialogComparePlayersBinding
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.data.RadarData
import com.github.mikephil.charting.data.RadarDataSet
import com.github.mikephil.charting.data.RadarEntry
import com.github.mikephil.charting.formatter.IndexAxisValueFormatter
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import coil.load

class ComparePlayersDialogFragment : BottomSheetDialogFragment() {

    private var _binding: DialogComparePlayersBinding? = null
    private val binding get() = _binding!!

    private var userA: User? = null
    private var statsA: UserStatistics? = null
    private var userB: User? = null
    private var statsB: UserStatistics? = null

    fun setPlayers(
        uA: User, sA: UserStatistics?,
        uB: User, sB: UserStatistics?
    ) {
        this.userA = uA
        this.statsA = sA
        this.userB = uB
        this.statsB = sB
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogComparePlayersBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.btnClose.setOnClickListener { dismiss() }

        setupHeader()
        setupRadarChart()
        setupStatsTable()
    }

    private fun setupHeader() {
        userA?.let { u ->
            binding.tvNameA.text = u.name
            binding.ivPlayerA.load(u.photoUrl) {
                placeholder(R.drawable.ic_person)
                error(R.drawable.ic_person)
            }
        }

        userB?.let { u ->
            binding.tvNameB.text = u.name
            binding.ivPlayerB.load(u.photoUrl) {
                placeholder(R.drawable.ic_person)
                error(R.drawable.ic_person)
            }
        }
    }

    private fun setupStatsTable() {
        // A
        binding.tvGoalsA.text = (statsA?.totalGoals ?: 0).toString()
        binding.tvAssistsA.text = (statsA?.totalAssists ?: 0).toString()
        binding.tvGamesA.text = (statsA?.totalGames ?: 0).toString()
        binding.tvMvpA.text = "${statsA?.bestPlayerCount ?: 0}x"

        // B
        binding.tvGoalsB.text = (statsB?.totalGoals ?: 0).toString()
        binding.tvAssistsB.text = (statsB?.totalAssists ?: 0).toString()
        binding.tvGamesB.text = (statsB?.totalGames ?: 0).toString()
        binding.tvMvpB.text = "${statsB?.bestPlayerCount ?: 0}x"
    }

    private fun setupRadarChart() {
        val chart = binding.radarChart
        
        // Disable interactions for cleaner view
        chart.description.isEnabled = false
        chart.webLineWidth = 1f
        chart.webColor = Color.LTGRAY
        chart.webLineWidthInner = 1f
        chart.webColorInner = Color.LTGRAY
        chart.webAlpha = 100

        // Axis
        val xAxis = chart.xAxis
        xAxis.textSize = 12f
        xAxis.yOffset = 0f
        xAxis.xOffset = 0f
        xAxis.valueFormatter = IndexAxisValueFormatter(arrayOf("ATA", "MEI", "DEF", "GOL"))
        xAxis.textColor = requireContext().getColor(R.color.colorOnSurface)

        val yAxis = chart.yAxis
        yAxis.setLabelCount(5, false)
        yAxis.textSize = 9f
        yAxis.axisMinimum = 0f
        yAxis.axisMaximum = 5f // Rating 0-5
        yAxis.setDrawLabels(false)

        // Data
        val entriesA = ArrayList<RadarEntry>()
        val entriesB = ArrayList<RadarEntry>()

        // Order: ATA, MEI, DEF, GOL
        userA?.let {
            entriesA.add(RadarEntry(it.getEffectiveRating(PlayerRatingRole.STRIKER).toFloat()))
            entriesA.add(RadarEntry(it.getEffectiveRating(PlayerRatingRole.MID).toFloat()))
            entriesA.add(RadarEntry(it.getEffectiveRating(PlayerRatingRole.DEFENDER).toFloat()))
            entriesA.add(RadarEntry(it.getEffectiveRating(PlayerRatingRole.GOALKEEPER).toFloat()))
        }

        userB?.let {
            entriesB.add(RadarEntry(it.getEffectiveRating(PlayerRatingRole.STRIKER).toFloat()))
            entriesB.add(RadarEntry(it.getEffectiveRating(PlayerRatingRole.MID).toFloat()))
            entriesB.add(RadarEntry(it.getEffectiveRating(PlayerRatingRole.DEFENDER).toFloat()))
            entriesB.add(RadarEntry(it.getEffectiveRating(PlayerRatingRole.GOALKEEPER).toFloat()))
        }

        val primaryColor = requireContext().getColor(R.color.primary)
        val secondaryColor = requireContext().getColor(R.color.secondary)

        val setA = RadarDataSet(entriesA, userA?.name ?: "A")
        setA.color = primaryColor
        setA.fillColor = primaryColor
        setA.setDrawFilled(true)
        setA.fillAlpha = 100
        setA.lineWidth = 2f
        setA.isDrawHighlightCircleEnabled = true
        setA.setDrawHighlightIndicators(false)

        val setB = RadarDataSet(entriesB, userB?.name ?: "B")
        setB.color = secondaryColor
        setB.fillColor = secondaryColor
        setB.setDrawFilled(true)
        setB.fillAlpha = 100
        setB.lineWidth = 2f
        setB.isDrawHighlightCircleEnabled = true
        setB.setDrawHighlightIndicators(false)

        val data = RadarData(setA, setB)
        data.setValueTextSize(8f)
        data.setDrawValues(false)
        data.setValueTextColor(Color.WHITE)

        chart.data = data
        chart.invalidate()
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = super.onCreateDialog(savedInstanceState) as BottomSheetDialog
        dialog.setOnShowListener {
            val bottomSheet = dialog.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet) as FrameLayout?
            bottomSheet?.let { sheet ->
                BottomSheetBehavior.from(sheet).state = BottomSheetBehavior.STATE_EXPANDED
            }
        }
        return dialog
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "ComparePlayersDialog"
    }
}
