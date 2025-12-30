package com.futebadosparcas.ui.groups.dialogs

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.databinding.ItemTransferOwnershipMemberBinding

/**
 * Adapter para lista de membros no dialog de transferência de propriedade
 */
class TransferOwnershipAdapter(
    private val onMemberClick: (GroupMember) -> Unit
) : ListAdapter<GroupMember, TransferOwnershipAdapter.MemberViewHolder>(MemberDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MemberViewHolder {
        val binding = ItemTransferOwnershipMemberBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return MemberViewHolder(binding)
    }

    override fun onBindViewHolder(holder: MemberViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class MemberViewHolder(
        private val binding: ItemTransferOwnershipMemberBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(member: GroupMember) {
            binding.tvMemberName.text = member.getDisplayName()

            // Role badge
            val roleText = when (member.getRoleEnum()) {
                GroupMemberRole.ADMIN -> "Admin"
                GroupMemberRole.MEMBER -> "Membro"
                else -> ""
            }
            binding.tvMemberRole.text = roleText

            // Foto (CircleImageView já faz o crop circular)
            if (!member.userPhoto.isNullOrEmpty()) {
                binding.ivMemberPhoto.load(member.userPhoto) {
                    crossfade(true)
                    placeholder(R.drawable.ic_person)
                    error(R.drawable.ic_person)
                }
            } else {
                binding.ivMemberPhoto.setImageResource(R.drawable.ic_person)
            }

            binding.root.setOnClickListener {
                onMemberClick(member)
            }
        }
    }

    class MemberDiffCallback : DiffUtil.ItemCallback<GroupMember>() {
        override fun areItemsTheSame(oldItem: GroupMember, newItem: GroupMember): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: GroupMember, newItem: GroupMember): Boolean {
            return oldItem == newItem
        }
    }
}
