package com.futebadosparcas.ui.groups

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.UserGroup
import com.futebadosparcas.databinding.ItemGroupBinding

class GroupsAdapter(
    private val onItemClick: (UserGroup) -> Unit
) : ListAdapter<UserGroup, GroupsAdapter.GroupViewHolder>(GroupDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): GroupViewHolder {
        val binding = ItemGroupBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return GroupViewHolder(binding)
    }

    override fun onBindViewHolder(holder: GroupViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class GroupViewHolder(
        private val binding: ItemGroupBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        init {
            binding.root.setOnClickListener {
                val position = bindingAdapterPosition
                if (position != RecyclerView.NO_POSITION) {
                    onItemClick(getItem(position))
                }
            }
        }

        fun bind(group: UserGroup) {
            binding.tvGroupName.text = group.groupName
            
            val memberText = if (group.memberCount == 1) "1 membro" else "${group.memberCount} membros"
            binding.tvMemberCount.text = memberText

            // Load group photo with border effect
            if (!group.groupPhoto.isNullOrEmpty()) {
                binding.ivGroupPhoto.load(group.groupPhoto) {
                    crossfade(true)
                    placeholder(R.drawable.ic_groups)
                    error(R.drawable.ic_groups)
                    transformations(CircleCropTransformation())
                }
            } else {
                binding.ivGroupPhoto.setImageResource(R.drawable.ic_groups)
            }

            // Role Badge Logic
            val role = group.getRoleEnum()
            binding.chipRole.text = role.displayName
            
            // Apply colors based on Role for Premium feel
            val (bgColor, textColor) = when (role) {
                GroupMemberRole.OWNER -> Pair(R.color.chip_owner, R.color.white) // Assume white text for owners
                GroupMemberRole.ADMIN -> Pair(R.color.chip_admin, R.color.white)
                GroupMemberRole.MEMBER -> Pair(R.color.chip_member, R.color.black)
            }
            
            // Note: Colors might need check if they exist, falling back to resource handling if complex
            // For now reverting to resource ID usage as per original but ensuring logic holds
            binding.chipRole.setChipBackgroundColorResource(
                when (role) {
                    GroupMemberRole.OWNER -> R.color.chip_owner // Gold/Orange usually
                    GroupMemberRole.ADMIN -> R.color.chip_admin // Blue/Green
                    GroupMemberRole.MEMBER -> R.color.chip_member // Grey
                }
            )

            // Gamification Logic (Simulated Level based on member count)
            val level = calculateLevel(group.memberCount)
            val progress = calculateProgress(group.memberCount, level)
            
            binding.tvLevelInfo.text = "Lvl $level"
            binding.pbGroupLevel.progress = progress
        }

        private fun calculateLevel(count: Int): Int {
            return when {
                count < 5 -> 1
                count < 15 -> 2
                count < 30 -> 3
                count < 50 -> 4
                else -> 5
            }
        }

        private fun calculateProgress(count: Int, level: Int): Int {
            // Calculate progress to next level
            val (min, max) = when (level) {
                1 -> Pair(0, 5)
                2 -> Pair(5, 15)
                3 -> Pair(15, 30)
                4 -> Pair(30, 50)
                else -> Pair(50, 100)
            }
            
            if (max == min) return 100 // Max level
            
            val totalNeeded = max - min
            val currentInLevel = count - min
            return ((currentInLevel.toFloat() / totalNeeded) * 100).toInt().coerceIn(0, 100)
        }
    }

    class GroupDiffCallback : DiffUtil.ItemCallback<UserGroup>() {
        override fun areItemsTheSame(oldItem: UserGroup, newItem: UserGroup): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: UserGroup, newItem: UserGroup): Boolean {
            return oldItem == newItem
        }
    }
}
