package com.futebadosparcas.ui.admin

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.R
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.model.UserRole
import com.google.android.material.button.MaterialButton

import androidx.appcompat.widget.PopupMenu
import coil.load
import com.futebadosparcas.databinding.ItemUserManagementBinding
import com.google.android.material.chip.Chip
import com.google.android.material.imageview.ShapeableImageView

class UserManagementAdapter(
    private val onRoleChangeClick: (User, UserRole) -> Unit
) : ListAdapter<User, UserManagementAdapter.UserViewHolder>(UserDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): UserViewHolder {
        val binding = ItemUserManagementBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return UserViewHolder(binding, onRoleChangeClick)
    }

    override fun onBindViewHolder(holder: UserViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class UserViewHolder(
        private val binding: ItemUserManagementBinding,
        val onRoleChangeClick: (User, UserRole) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(user: User) {
            binding.tvUserName.text = user.getDisplayName()
            binding.tvUserEmail.text = user.email
            binding.chipRole.text = user.role

            // Avatar
            if (user.photoUrl != null) {
                binding.ivUserAvatar.load(user.photoUrl) {
                    crossfade(true)
                    placeholder(R.drawable.ic_player_placeholder)
                }
            } else {
                binding.ivUserAvatar.setImageResource(R.drawable.ic_player_placeholder)
            }

            // Role Styling
            val role = user.getRoleEnum()
            binding.chipRole.text = role.displayName
            
            // Options Menu
            binding.btnOptions.setOnClickListener { view ->
                val popup = PopupMenu(view.context, view)
                popup.menuInflater.inflate(R.menu.menu_user_roles, popup.menu)
                
                // Hide current role
                when (role) {
                    UserRole.ADMIN -> popup.menu.findItem(R.id.menu_role_admin).isVisible = false
                    UserRole.FIELD_OWNER -> popup.menu.findItem(R.id.menu_role_owner).isVisible = false
                    UserRole.PLAYER -> popup.menu.findItem(R.id.menu_role_player).isVisible = false
                }

                popup.setOnMenuItemClickListener { item ->
                    val newRole = when (item.itemId) {
                        R.id.menu_role_admin -> UserRole.ADMIN
                        R.id.menu_role_owner -> UserRole.FIELD_OWNER
                        else -> UserRole.PLAYER
                    }
                    onRoleChangeClick(user, newRole)
                    true
                }
                popup.show()
            }
        }
    }

    class UserDiffCallback : DiffUtil.ItemCallback<User>() {
        override fun areItemsTheSame(oldItem: User, newItem: User): Boolean = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: User, newItem: User): Boolean = oldItem == newItem
    }
}
