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
            binding.tvMemberCount.text = when (group.memberCount) {
                1 -> "1 membro"
                else -> "${group.memberCount} membros"
            }

            // Load group photo
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

            // Role chip
            val role = group.getRoleEnum()
            binding.chipRole.text = role.displayName
            binding.chipRole.setChipBackgroundColorResource(
                when (role) {
                    GroupMemberRole.OWNER -> R.color.chip_owner
                    GroupMemberRole.ADMIN -> R.color.chip_admin
                    GroupMemberRole.MEMBER -> R.color.chip_member
                }
            )
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
