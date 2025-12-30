package com.futebadosparcas.ui.groups

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.PopupMenu
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.databinding.ItemGroupMemberBinding

class GroupMembersAdapter(
    private val onMemberClick: (GroupMember) -> Unit,
    private val onPromoteClick: (GroupMember) -> Unit,
    private val onDemoteClick: (GroupMember) -> Unit,
    private val onRemoveClick: (GroupMember) -> Unit
) : ListAdapter<GroupMember, GroupMembersAdapter.MemberViewHolder>(MemberDiffCallback()) {

    private var currentUserRole: GroupMemberRole? = null
    private var isFirstLoad = true

    fun setCurrentUserRole(role: GroupMemberRole?) {
        if (currentUserRole != role) {
            currentUserRole = role
            // Só notifica se já houver itens (evita rebind antes do submitList)
            if (itemCount > 0) {
                notifyDataSetChanged()
            }
        }
    }

    override fun submitList(list: List<GroupMember>?) {
        // Força rebind na primeira carga para garantir que as fotos sejam carregadas
        if (isFirstLoad && !list.isNullOrEmpty()) {
            isFirstLoad = false
            super.submitList(null)
            super.submitList(list?.toList())
        } else {
            super.submitList(list?.toList())
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MemberViewHolder {
        val binding = ItemGroupMemberBinding.inflate(
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
        private val binding: ItemGroupMemberBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(member: GroupMember) {
            // Carrega foto do membro (CircleImageView já faz o crop circular)
            if (!member.userPhoto.isNullOrEmpty()) {
                binding.ivMemberPhoto.load(member.userPhoto) {
                    crossfade(true)
                    placeholder(R.drawable.ic_person)
                    error(R.drawable.ic_person)
                }
            } else {
                binding.ivMemberPhoto.setImageResource(R.drawable.ic_person)
            }
            
            binding.tvMemberName.text = member.getDisplayName()

            // Set role text
            val memberRole = member.getRoleEnum()
            binding.tvMemberRole.text = when (memberRole) {
                GroupMemberRole.OWNER -> "Dono"
                GroupMemberRole.ADMIN -> "Admin"
                GroupMemberRole.MEMBER -> "Membro"
            }

            // Show/hide more options based on current user permissions
            val canManage = canManageMember(member)
            binding.btnMore.visibility = if (canManage) View.VISIBLE else View.GONE

            binding.root.setOnClickListener {
                onMemberClick(member)
            }

            binding.btnMore.setOnClickListener { view ->
                showPopupMenu(view, member)
            }
        }

        private fun canManageMember(member: GroupMember): Boolean {
            val memberRole = member.getRoleEnum()
            return when (currentUserRole) {
                GroupMemberRole.OWNER -> memberRole != GroupMemberRole.OWNER
                GroupMemberRole.ADMIN -> memberRole == GroupMemberRole.MEMBER
                else -> false
            }
        }

        private fun showPopupMenu(view: View, member: GroupMember) {
            val popup = PopupMenu(view.context, view)
            val memberRole = member.getRoleEnum()

            when (currentUserRole) {
                GroupMemberRole.OWNER -> {
                    when (memberRole) {
                        GroupMemberRole.ADMIN -> {
                            popup.menu.add("Rebaixar para Membro").setOnMenuItemClickListener {
                                onDemoteClick(member)
                                true
                            }
                        }
                        GroupMemberRole.MEMBER -> {
                            popup.menu.add("Promover a Admin").setOnMenuItemClickListener {
                                onPromoteClick(member)
                                true
                            }
                        }
                        else -> {}
                    }
                    popup.menu.add("Remover do Grupo").setOnMenuItemClickListener {
                        onRemoveClick(member)
                        true
                    }
                }
                GroupMemberRole.ADMIN -> {
                    if (memberRole == GroupMemberRole.MEMBER) {
                        popup.menu.add("Remover do Grupo").setOnMenuItemClickListener {
                            onRemoveClick(member)
                            true
                        }
                    }
                }
                else -> {}
            }

            if (popup.menu.size() > 0) {
                popup.show()
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
