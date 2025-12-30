package com.futebadosparcas.ui.statistics

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.futebadosparcas.R
import com.futebadosparcas.databinding.ItemRankingBinding

class RankingAdapter(private val rankingItems: List<PlayerRankingItem>) : RecyclerView.Adapter<RankingAdapter.ViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemRankingBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(rankingItems[position])
    }

    override fun getItemCount() = rankingItems.size

    inner class ViewHolder(private val binding: ItemRankingBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: PlayerRankingItem) {
            binding.tvPosition.text = item.rank.toString()
            binding.tvPlayerName.text = item.getDisplayName()
            binding.tvPoints.text = "${item.value} pts"
            binding.tvStats.text = "Stats" // Placeholder
            binding.ivAvatar.load(item.photoUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_launcher_foreground)
                error(R.drawable.ic_launcher_foreground)
            }
        }
    }
}