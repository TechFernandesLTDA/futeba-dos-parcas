package com.futebadosparcas.ui.groups

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.futebadosparcas.R
import com.futebadosparcas.data.model.User
import com.futebadosparcas.databinding.ItemInvitePlayerBinding

/**
 * Adapter para lista de jogadores que podem ser convidados para o grupo
 */
class InvitePlayersAdapter(
    private val onInviteClick: (User) -> Unit
) : ListAdapter<User, InvitePlayersAdapter.PlayerViewHolder>(PlayerDiffCallback()) {

    private var alreadyInvitedIds: Set<String> = emptySet()
    private var alreadyMemberIds: Set<String> = emptySet()

    /**
     * Define IDs de jogadores que já foram convidados mas ainda não aceitaram
     */
    fun setAlreadyInvited(ids: Set<String>) {
        alreadyInvitedIds = ids
        notifyDataSetChanged()
    }

    /**
     * Define IDs de jogadores que já são membros do grupo
     */
    fun setAlreadyMembers(ids: Set<String>) {
        alreadyMemberIds = ids
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PlayerViewHolder {
        val binding = ItemInvitePlayerBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return PlayerViewHolder(binding)
    }

    override fun onBindViewHolder(holder: PlayerViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class PlayerViewHolder(
        private val binding: ItemInvitePlayerBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(user: User) {
            // Carrega foto do jogador
            binding.ivPlayerAvatar.load(user.photoUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_person)
                error(R.drawable.ic_person)
                transformations(CircleCropTransformation())
            }
            
            // Nome do jogador
            binding.tvPlayerName.text = user.name

            // Mostra nickname (se houver) ou email como info secundária
            // Email é único e usado como identificador
            val secondaryInfo = when {
                !user.nickname.isNullOrEmpty() -> "@${user.nickname}"
                user.email.isNotEmpty() -> user.email
                else -> null
            }
            
            if (secondaryInfo != null) {
                binding.tvPlayerNickname.text = secondaryInfo
                binding.tvPlayerNickname.visibility = View.VISIBLE
            } else {
                binding.tvPlayerNickname.visibility = View.GONE
            }

            // Define estado do botão com base no status do jogador
            when {
                alreadyMemberIds.contains(user.id) -> {
                    binding.btnInvite.text = "Já é membro"
                    binding.btnInvite.isEnabled = false
                    binding.btnInvite.alpha = 0.5f
                }
                alreadyInvitedIds.contains(user.id) -> {
                    binding.btnInvite.text = "Pendente"
                    binding.btnInvite.isEnabled = false
                    binding.btnInvite.alpha = 0.5f
                }
                else -> {
                    binding.btnInvite.text = "Convidar"
                    binding.btnInvite.isEnabled = true
                    binding.btnInvite.alpha = 1f
                    binding.btnInvite.setOnClickListener {
                        onInviteClick(user)
                    }
                }
            }

            // Click no item para mais detalhes (opcional)
            binding.root.setOnClickListener {
                if (!alreadyMemberIds.contains(user.id) && !alreadyInvitedIds.contains(user.id)) {
                    onInviteClick(user)
                }
            }
        }
    }

    class PlayerDiffCallback : DiffUtil.ItemCallback<User>() {
        override fun areItemsTheSame(oldItem: User, newItem: User): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: User, newItem: User): Boolean {
            return oldItem == newItem
        }
    }
}
