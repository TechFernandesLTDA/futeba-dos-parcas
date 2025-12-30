package com.futebadosparcas.ui.profile

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.R
import com.futebadosparcas.data.model.UserBadge
import com.futebadosparcas.data.model.BadgeType
import com.futebadosparcas.databinding.ItemUserBadgeBinding

class UserBadgesAdapter : ListAdapter<UserBadge, UserBadgesAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemUserBadgeBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(private val binding: ItemUserBadgeBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(userBadge: UserBadge) {
            val badgeType = try {
                BadgeType.valueOf(userBadge.badgeId)
            } catch (e: Exception) { null }

            binding.tvBadgeName.text = badgeType?.name ?: userBadge.badgeId
            
            if (userBadge.count > 1) {
                binding.tvCount.visibility = View.VISIBLE
                binding.tvCount.text = userBadge.count.toString()
            } else {
                binding.tvCount.visibility = View.GONE
            }

            // Simple mapping for MVP
            val colorRes = when (badgeType) {
                BadgeType.HAT_TRICK, BadgeType.PAREDAO -> R.color.gold
                BadgeType.ARTILHEIRO_MES, BadgeType.MITO -> R.color.primary
                BadgeType.STREAK_7, BadgeType.STREAK_30 -> R.color.secondary
                else -> R.color.outline
            }
            
            binding.ivBadgeIcon.setColorFilter(itemView.context.getColor(colorRes))
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<UserBadge>() {
        override fun areItemsTheSame(oldItem: UserBadge, newItem: UserBadge): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: UserBadge, newItem: UserBadge): Boolean {
            return oldItem == newItem
        }
    }
}
