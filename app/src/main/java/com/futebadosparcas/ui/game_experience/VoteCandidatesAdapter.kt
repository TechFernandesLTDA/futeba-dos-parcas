package com.futebadosparcas.ui.game_experience

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.databinding.ItemVoteCandidateBinding
import com.futebadosparcas.data.model.PlayerPosition

class VoteCandidatesAdapter(
    private val onCandidateClick: (GameConfirmation) -> Unit
) : ListAdapter<GameConfirmation, VoteCandidatesAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemVoteCandidateBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(private val binding: ItemVoteCandidateBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(confirmation: GameConfirmation) {
            binding.tvPlayerName.text = confirmation.getDisplayName()
            
            // Translate position if possible or use raw
            val posEnum = try {
                PlayerPosition.valueOf(confirmation.position)
            } catch (e: Exception) { PlayerPosition.FIELD }
            
            binding.tvPlayerPosition.text = if (posEnum == PlayerPosition.GOALKEEPER) "Goleiro" else "Linha"

            binding.ivPlayerPhoto.load(confirmation.userPhoto) {
                crossfade(true)
                transformations(CircleCropTransformation())
                placeholder(R.drawable.ic_launcher_foreground) 
                error(R.drawable.ic_launcher_foreground)
            }

            binding.root.setOnClickListener {
                onCandidateClick(confirmation)
            }
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<GameConfirmation>() {
        override fun areItemsTheSame(oldItem: GameConfirmation, newItem: GameConfirmation): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: GameConfirmation, newItem: GameConfirmation): Boolean {
            return oldItem == newItem
        }
    }
}
