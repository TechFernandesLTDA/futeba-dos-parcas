package com.futebadosparcas.ui.players

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.R
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.User
import com.google.android.material.button.MaterialButton
import coil.load

class PlayersAdapter(
    private val onInviteClick: (User) -> Unit,
    private val onItemClick: (User) -> Unit
) : ListAdapter<User, PlayersAdapter.PlayerViewHolder>(PlayerDiffCallback()) {

    private var selectedIds = mutableSetOf<String>()
    private var isSelectionMode = false

    fun setSelectionMode(enabled: Boolean) {
        isSelectionMode = enabled
        selectedIds.clear()
        notifyDataSetChanged()
    }

    fun toggleSelection(userId: String) {
        if (selectedIds.contains(userId)) {
            selectedIds.remove(userId)
        } else {
            if (selectedIds.size < 2) {
                selectedIds.add(userId)
            }
        }
        notifyDataSetChanged()
    }

    fun getSelectedIds(): Set<String> = selectedIds

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PlayerViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_player_cartola, parent, false)
        return PlayerViewHolder(view, onInviteClick, onItemClick)
    }

    override fun onBindViewHolder(holder: PlayerViewHolder, position: Int) {
        val user = getItem(position)
        val isSelected = selectedIds.contains(user.id)
        holder.bind(user, isSelectionMode, isSelected)
    }

    class PlayerViewHolder(
        itemView: View,
        val onInviteClick: (User) -> Unit,
        val onItemClick: (User) -> Unit
    ) : RecyclerView.ViewHolder(itemView) {
        private val ivAvatar: ImageView = itemView.findViewById(R.id.ivPlayerAvatar)
        private val tvName: TextView = itemView.findViewById(R.id.tvPlayerName)
        private val tvPosition: TextView = itemView.findViewById(R.id.tvPlayerPosition)
        private val tvStrikerRating: TextView = itemView.findViewById(R.id.tvStrikerRating)
        private val tvMidRating: TextView = itemView.findViewById(R.id.tvMidRating)
        private val tvDefRating: TextView = itemView.findViewById(R.id.tvDefRating)
        private val tvGkRating: TextView = itemView.findViewById(R.id.tvGkRating)
        private val btnInvite: MaterialButton = itemView.findViewById(R.id.btnInvite)
        private val cardView: com.google.android.material.card.MaterialCardView = itemView as com.google.android.material.card.MaterialCardView

        fun bind(user: User, isSelectionMode: Boolean, isSelected: Boolean) {
            tvName.text = user.getDisplayName()

            // Visual Selection
            if (isSelected) {
                cardView.strokeColor = itemView.context.getColor(R.color.primary)
                cardView.strokeWidth = 4
                cardView.alpha = 1.0f
            } else {
                cardView.strokeColor = itemView.context.getColor(R.color.outlineVariant)
                cardView.strokeWidth = 1
                cardView.alpha = if (isSelectionMode) 0.6f else 1.0f
            }

            itemView.setOnClickListener { onItemClick(user) }

            // ... (rest of binding logic)
            // Position - mostra tipo de campo preferido
            val fieldTypes = user.preferredFieldTypes.joinToString(" • ") {
                it.displayName
            }
            tvPosition.text = if (fieldTypes.isNotEmpty()) {
                "Jogador • $fieldTypes"
            } else {
                "Jogador"
            }

            // Ratings
            tvStrikerRating.text = if (user.strikerRating > 0) user.strikerRating.toInt().toString() else "-"
            tvMidRating.text = if (user.midRating > 0) user.midRating.toInt().toString() else "-"
            tvDefRating.text = if (user.defenderRating > 0) user.defenderRating.toInt().toString() else "-"
            tvGkRating.text = if (user.gkRating > 0) user.gkRating.toInt().toString() else "-"

            // Logic for Level Badge
            val level = user.level
            val levelTextView = itemView.findViewById<TextView>(R.id.tvPlayerLevel)
            
            if (levelTextView != null) {
                levelTextView.text = "Nvl $level"
                val colorRes = when {
                    level >= 10 -> R.color.tertiary
                    level >= 7 -> R.color.warning
                    level >= 4 -> R.color.outline
                    else -> R.color.secondary
                }
                val context = itemView.context
                val color = androidx.core.content.ContextCompat.getColor(context, colorRes)
                levelTextView.background.setTint(color)
            }

            // Avatar
            if (user.photoUrl != null) {
                ivAvatar.load(user.photoUrl) {
                    crossfade(true)
                    placeholder(R.drawable.ic_person)
                    error(R.drawable.ic_person)
                }
            } else {
                ivAvatar.setImageResource(R.drawable.ic_person)
            }

            btnInvite.setOnClickListener { onInviteClick(user) }
            btnInvite.isEnabled = !isSelectionMode // Disable actions during selection
        }
    }

    class PlayerDiffCallback : DiffUtil.ItemCallback<User>() {
        override fun areItemsTheSame(oldItem: User, newItem: User): Boolean = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: User, newItem: User): Boolean = oldItem == newItem
    }
}
