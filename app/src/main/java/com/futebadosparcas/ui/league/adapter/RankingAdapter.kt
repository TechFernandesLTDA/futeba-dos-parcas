package com.futebadosparcas.ui.league.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.futebadosparcas.R
import com.futebadosparcas.databinding.ItemRankingBinding
import com.futebadosparcas.ui.league.RankingItem

/**
 * Adapter do RecyclerView de ranking da liga
 */
class RankingAdapter : ListAdapter<RankingItem, RankingAdapter.RankingViewHolder>(RankingDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RankingViewHolder {
        val binding = ItemRankingBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return RankingViewHolder(binding)
    }

    override fun onBindViewHolder(holder: RankingViewHolder, position: Int) {
        holder.bind(getItem(position), position + 1)
    }

    class RankingViewHolder(
        private val binding: ItemRankingBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: RankingItem, position: Int) {
            val participation = item.participation
            val user = item.user

            // Posição
            binding.tvPosition.text = position.toString()

            // Avatar
            if (!user.photoUrl.isNullOrEmpty()) {
                binding.ivAvatar.load(user.photoUrl) {
                    crossfade(true)
                    placeholder(R.drawable.ic_person)
                    error(R.drawable.ic_person)
                    transformations(CircleCropTransformation())
                }
            } else {
                binding.ivAvatar.setImageResource(R.drawable.ic_person)
            }

            // Nome
            binding.tvPlayerName.text = user.name

            // Estatísticas resumidas: "15J • 10V • ⚽12"
            val stats = buildString {
                append("${participation.gamesPlayed}J")
                append(" • ")
                append("${participation.wins}V")
                append(" • ")
                append("⚽${participation.goalsScored}")
            }
            binding.tvStats.text = stats

            // Pontos
            binding.tvPoints.text = "${participation.points}"

            // Estatísticas detalhadas
            binding.tvGoals.text = "${participation.goalsScored}"
            
            val goalDiff = participation.goalDifference
            binding.tvGoalDiff.text = if (goalDiff > 0) "+$goalDiff" else "$goalDiff"
            
            binding.tvMvp.text = "${participation.mvpCount}"
            
            val winRate = if (participation.gamesPlayed > 0) {
                ((participation.wins.toDouble() / participation.gamesPlayed) * 100).toInt()
            } else {
                0
            }
            binding.tvWinRate.text = "$winRate%"
        }
    }

    class RankingDiffCallback : DiffUtil.ItemCallback<RankingItem>() {
        override fun areItemsTheSame(oldItem: RankingItem, newItem: RankingItem): Boolean {
            return oldItem.participation.userId == newItem.participation.userId
        }

        override fun areContentsTheSame(oldItem: RankingItem, newItem: RankingItem): Boolean {
            return oldItem == newItem
        }
    }
}
