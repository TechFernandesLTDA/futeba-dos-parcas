package com.futebadosparcas.ui.games

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.futebadosparcas.util.loadProfileImage
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.PaymentStatus
import com.futebadosparcas.databinding.ItemConfirmationBinding

class ConfirmationsAdapter(
    private var isOwner: Boolean = false,
    private var currentUserId: String? = null,
    private val onRemoveClick: (String) -> Unit = {},
    private val onPaymentClick: (GameConfirmation) -> Unit = {},
    private val onAcceptInvite: (GameConfirmation) -> Unit = {},
    private val onDeclineInvite: (GameConfirmation) -> Unit = {}
) : ListAdapter<GameConfirmation, ConfirmationsAdapter.ConfirmationViewHolder>(ConfirmationDiffCallback()) {

    fun setOwner(owner: Boolean) {
        if (isOwner != owner) {
            isOwner = owner
            notifyDataSetChanged()
        }
    }

    fun setCurrentUserId(userId: String?) {
        this.currentUserId = userId
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ConfirmationViewHolder {
        val binding = ItemConfirmationBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ConfirmationViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ConfirmationViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ConfirmationViewHolder(private val binding: ItemConfirmationBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(confirmation: GameConfirmation) {
            binding.apply {
                tvUserName.text = confirmation.getDisplayName().ifEmpty { "Desconhecido" }
                tvUserType.text = if (confirmation.isCasualPlayer) "Avulso" else "Mensalista"
                
                ivUserPhoto.loadProfileImage(confirmation.userPhoto)

                val isMe = currentUserId != null && currentUserId == confirmation.userId

                // Status and Actions Logic
                when (confirmation.status) {
                    "WAITLIST" -> {
                        tvPaymentStatus.visibility = View.VISIBLE
                        layoutPendingActions.visibility = View.GONE
                        tvPaymentStatus.text = "Lista de Espera"
                        tvPaymentStatus.setBackgroundResource(R.drawable.bg_status_waitlist)
                        tvPaymentStatus.setOnClickListener(null)
                    }
                    "PENDING" -> {
                        if (isMe) {
                            tvPaymentStatus.visibility = View.GONE
                            layoutPendingActions.visibility = View.VISIBLE
                            btnAccept.setOnClickListener { onAcceptInvite(confirmation) }
                            btnDecline.setOnClickListener { onDeclineInvite(confirmation) }
                        } else {
                            tvPaymentStatus.visibility = View.VISIBLE
                            layoutPendingActions.visibility = View.GONE
                            tvPaymentStatus.text = "Convidado"
                            tvPaymentStatus.setBackgroundResource(R.drawable.bg_status_waitlist) // Use same secondary color
                            tvPaymentStatus.setOnClickListener(null)
                        }
                    }
                    else -> { // CONFIRMED
                        tvPaymentStatus.visibility = View.VISIBLE
                        layoutPendingActions.visibility = View.GONE
                        if (confirmation.paymentStatus == PaymentStatus.PAID.name) {
                            tvPaymentStatus.text = "Pago"
                            tvPaymentStatus.setBackgroundResource(R.drawable.bg_status_confirmed)
                        } else {
                            tvPaymentStatus.text = "Pendente"
                            tvPaymentStatus.setBackgroundResource(android.R.color.transparent)
                        }

                        if (isOwner || isMe) {
                            tvPaymentStatus.setOnClickListener { onPaymentClick(confirmation) }
                        } else {
                            tvPaymentStatus.setOnClickListener(null)
                        }
                    }
                }

                if (confirmation.xpEarned > 0) {
                    llBadges.visibility = View.VISIBLE
                    tvXp.text = "+${confirmation.xpEarned} XP"
                    ivMvp.visibility = if (confirmation.isMvp) View.VISIBLE else View.GONE
                    ivBestGk.visibility = if (confirmation.isBestGk) View.VISIBLE else View.GONE
                    ivWorst.visibility = if (confirmation.isWorstPlayer) View.VISIBLE else View.GONE
                } else {
                    llBadges.visibility = View.GONE
                }

                // Show remove button only for owner
                btnRemovePlayer.visibility = if (isOwner) View.VISIBLE else View.GONE
                btnRemovePlayer.setOnClickListener {
                    onRemoveClick(confirmation.userId)
                }
            }
        }
    }

    class ConfirmationDiffCallback : DiffUtil.ItemCallback<GameConfirmation>() {
        override fun areItemsTheSame(oldItem: GameConfirmation, newItem: GameConfirmation): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: GameConfirmation, newItem: GameConfirmation): Boolean {
            return oldItem == newItem
        }
    }
}
