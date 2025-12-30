package com.futebadosparcas.ui.livegame

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.data.model.LivePlayerStats
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.databinding.ItemLivePlayerStatBinding

class LiveStatsAdapter : ListAdapter<LivePlayerStats, LiveStatsAdapter.StatsViewHolder>(StatsDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): StatsViewHolder {
        val binding = ItemLivePlayerStatBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return StatsViewHolder(binding)
    }

    override fun onBindViewHolder(holder: StatsViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class StatsViewHolder(
        private val binding: ItemLivePlayerStatBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(stats: LivePlayerStats) {
            binding.apply {
                tvPlayerName.text = stats.playerName

                // Posicao
                tvPosition.text = when (stats.getPositionEnum()) {
                    PlayerPosition.GOALKEEPER -> "Goleiro"
                    PlayerPosition.FIELD -> "Linha"
                }

                // Badge do time
                tvTeamBadge.text = if (stats.teamId.endsWith("1")) "T1" else "T2"

                // Mostrar apenas estatisticas relevantes
                if (stats.goals > 0) {
                    llGoals.visibility = View.VISIBLE
                    tvGoalsCount.text = stats.goals.toString()
                } else {
                    llGoals.visibility = View.GONE
                }

                if (stats.assists > 0) {
                    llAssists.visibility = View.VISIBLE
                    tvAssistsCount.text = stats.assists.toString()
                } else {
                    llAssists.visibility = View.GONE
                }

                if (stats.saves > 0) {
                    llSaves.visibility = View.VISIBLE
                    tvSavesCount.text = stats.saves.toString()
                } else {
                    llSaves.visibility = View.GONE
                }

                val totalCards = stats.yellowCards + stats.redCards
                if (totalCards > 0) {
                    llCards.visibility = View.VISIBLE
                    tvCardsCount.text = totalCards.toString()
                } else {
                    llCards.visibility = View.GONE
                }
            }
        }
    }

    private class StatsDiffCallback : DiffUtil.ItemCallback<LivePlayerStats>() {
        override fun areItemsTheSame(oldItem: LivePlayerStats, newItem: LivePlayerStats): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: LivePlayerStats, newItem: LivePlayerStats): Boolean {
            return oldItem == newItem
        }
    }
}
