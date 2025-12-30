package com.futebadosparcas.ui.home

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.databinding.ItemGameCardBinding

class UpcomingGamesAdapter(
    private val onGameClick: (Game) -> Unit
) : ListAdapter<Game, UpcomingGamesAdapter.GameViewHolder>(GameDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): GameViewHolder {
        val binding = ItemGameCardBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return GameViewHolder(binding)
    }

    override fun onBindViewHolder(holder: GameViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class GameViewHolder(
        private val binding: ItemGameCardBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(game: Game) {
            binding.apply {
                tvDate.text = game.date
                tvTime.text = game.time
                tvLocation.text = game.locationName.ifEmpty { "Local" }
                tvFieldName.text = game.fieldName.ifEmpty { "Quadra" }
                tvPlayersCount.text = "${game.players.size}/${game.maxPlayers}"

                tvPrice.text = if (game.dailyPrice > 0) {
                    "R$ ${String.format("%.2f", game.dailyPrice)}"
                } else {
                    "Gratis"
                }

                // Status de confirmacao - simplificado para Firebase
                btnConfirm.text = "Acessar"
                btnConfirm.setBackgroundColor(root.context.getColor(R.color.primary))

                root.setOnClickListener { onGameClick(game) }
            }
        }
    }

    class GameDiffCallback : DiffUtil.ItemCallback<Game>() {
        override fun areItemsTheSame(oldItem: Game, newItem: Game): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Game, newItem: Game): Boolean {
            return oldItem == newItem
        }
    }
}
