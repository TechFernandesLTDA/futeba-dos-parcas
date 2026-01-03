package com.futebadosparcas.ui.games

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.databinding.ItemGameDetailHeaderBinding
import coil.load
import coil.transform.CircleCropTransformation
import java.util.Locale

class GameDetailHeaderAdapter(
    private val onEditClick: () -> Unit,
    private val onCancelClick: () -> Unit,
    private val onToggleStatus: (Boolean) -> Unit,
    private val onStartGameClick: () -> Unit,
    private val onFinishGameClick: () -> Unit,
    private val onLocationClick: () -> Unit,
    private val onGenerateTeamsClick: () -> Unit
) : RecyclerView.Adapter<GameDetailHeaderAdapter.HeaderViewHolder>() {

    private var game: Game? = null
    private var isOwner: Boolean = false
    private var confirmedCount: Int = 0
    private var confirmationsList: List<com.futebadosparcas.data.model.GameConfirmation> = emptyList()

    private var currentUserId: String? = null

    fun updateGame(game: Game, isOwner: Boolean, count: Int, confirmations: List<com.futebadosparcas.data.model.GameConfirmation> = emptyList(), currentUserId: String? = null) {
        this.game = game
        this.isOwner = isOwner
        this.confirmedCount = count
        this.confirmationsList = confirmations
        this.currentUserId = currentUserId
        notifyItemChanged(0)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): HeaderViewHolder {
        val binding = ItemGameDetailHeaderBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return HeaderViewHolder(binding)
    }

    override fun onBindViewHolder(holder: HeaderViewHolder, position: Int) {
        game?.let { holder.bind(it, isOwner, confirmedCount, confirmationsList, currentUserId) }
    }

    override fun getItemCount(): Int = 1

    inner class HeaderViewHolder(private val binding: ItemGameDetailHeaderBinding) :
        RecyclerView.ViewHolder(binding.root) {

        init {
            binding.btnEditGame.setOnClickListener { onEditClick() }
            binding.btnCancelGame.setOnClickListener { onCancelClick() }
            binding.switchOpenList.setOnCheckedChangeListener { _, isChecked ->
                onToggleStatus(isChecked)
            }
        }

        fun bind(game: Game, isOwner: Boolean, count: Int, confirmations: List<com.futebadosparcas.data.model.GameConfirmation> = emptyList(), currentUserId: String? = null) {
            binding.apply {
                tvDate.text = game.date
                tvTime.text = game.time
                tvLocation.text = game.locationName.ifEmpty { "Local não definido" }
                tvLocation.setOnClickListener { onLocationClick() }
                
                // Status Badge
                val status = game.getStatusEnum()
                tvStatusBadge.text = when (status) {
                    com.futebadosparcas.data.model.GameStatus.SCHEDULED -> "ABERTO"
                    com.futebadosparcas.data.model.GameStatus.CONFIRMED -> "CONFIRMADO"
                    com.futebadosparcas.data.model.GameStatus.LIVE -> "AO VIVO"
                    com.futebadosparcas.data.model.GameStatus.FINISHED -> "FINALIZADO"
                    com.futebadosparcas.data.model.GameStatus.CANCELLED -> "CANCELADO"
                }
                
                val statusColor = when (status) {
                    com.futebadosparcas.data.model.GameStatus.SCHEDULED -> root.context.getColor(com.futebadosparcas.R.color.theme_blue_primary)
                    com.futebadosparcas.data.model.GameStatus.CONFIRMED -> root.context.getColor(com.futebadosparcas.R.color.primary)
                    com.futebadosparcas.data.model.GameStatus.LIVE -> root.context.getColor(com.futebadosparcas.R.color.theme_red_primary)
                    com.futebadosparcas.data.model.GameStatus.FINISHED -> root.context.getColor(com.futebadosparcas.R.color.outline)
                    com.futebadosparcas.data.model.GameStatus.CANCELLED -> root.context.getColor(com.futebadosparcas.R.color.error)
                }
                tvStatusBadge.backgroundTintList = android.content.res.ColorStateList.valueOf(statusColor)

                // Add visual cue for clickability (programmatic for now)
                if (game.locationLat != null && game.locationLng != null || game.locationAddress.isNotEmpty()) {
                    tvLocation.setTextColor(root.context.getColor(com.futebadosparcas.R.color.primary))
                    tvLocation.setCompoundDrawablesWithIntrinsicBounds(com.futebadosparcas.R.drawable.ic_location, 0, 0, 0)
                }
                
                tvFieldName.text = game.fieldName.ifEmpty { "Quadra" }
                
                // Court Status / Game Type
                binding.tvCourtStatus.text = "• ${game.gameType}"
                
                tvPlayersCount.text = "$count/${game.maxPlayers}"

                tvPrice.text = if (game.dailyPrice > 0) {
                    "R$ ${String.format(Locale.getDefault(), "%.2f", game.dailyPrice)}"
                } else {
                    "Grátis"
                }

                // Finished Summary
                if (status == com.futebadosparcas.data.model.GameStatus.FINISHED && !game.mvpId.isNullOrEmpty()) {
                    llFinishedSummary.visibility = android.view.View.VISIBLE
                    val mvp = confirmations.find { it.userId == game.mvpId }
                    if (mvp != null) {
                        tvMvpName.text = mvp.userName
                        if (!mvp.userPhoto.isNullOrEmpty()) {
                            ivMvpPhoto.load(mvp.userPhoto) {
                                transformations(CircleCropTransformation())
                                placeholder(com.futebadosparcas.R.drawable.ic_person)
                                error(com.futebadosparcas.R.drawable.ic_person)
                            }
                        } else {
                            ivMvpPhoto.setImageResource(com.futebadosparcas.R.drawable.ic_person)
                        }
                    } else {
                        llFinishedSummary.visibility = android.view.View.GONE
                    }
                } else {
                    llFinishedSummary.visibility = android.view.View.GONE
                }

                // Personal Performance
                val userConf = if (currentUserId != null) confirmations.find { it.userId == currentUserId } else null
                if (status == com.futebadosparcas.data.model.GameStatus.FINISHED && userConf != null && game.xpProcessed) {
                    cvPersonalPerformance.visibility = android.view.View.VISIBLE
                    tvPersonalXp.text = "+${userConf.xpEarned} XP"
                    
                    ivBadgeMvp.visibility = if (userConf.isMvp) android.view.View.VISIBLE else android.view.View.GONE
                    ivBadgeBestGk.visibility = if (userConf.isBestGk) android.view.View.VISIBLE else android.view.View.GONE
                    ivBadgeWorst.visibility = if (userConf.isWorstPlayer) android.view.View.VISIBLE else android.view.View.GONE
                } else {
                    cvPersonalPerformance.visibility = android.view.View.GONE
                }

                // Admin Logic
                if (isOwner) {
                    cvAdmin.visibility = android.view.View.VISIBLE
                    
                    // Switch Logic
                    switchOpenList.setOnCheckedChangeListener(null)
                    switchOpenList.isChecked = status == com.futebadosparcas.data.model.GameStatus.SCHEDULED
                    switchOpenList.setOnCheckedChangeListener { _, isChecked ->
                        onToggleStatus(isChecked)
                    }
                    // Disable switch if game is Live or Finished
                    switchOpenList.isEnabled = status == com.futebadosparcas.data.model.GameStatus.SCHEDULED || status == com.futebadosparcas.data.model.GameStatus.CONFIRMED

                    // Buttons Logic
                    btnStartGame.setOnClickListener { onStartGameClick() }
                    btnFinishGame.setOnClickListener { onFinishGameClick() }
                    btnGenerateTeams.setOnClickListener { onGenerateTeamsClick() }

                    when (status) {
                        com.futebadosparcas.data.model.GameStatus.SCHEDULED, com.futebadosparcas.data.model.GameStatus.CONFIRMED -> {
                            btnStartGame.visibility = android.view.View.VISIBLE
                            btnFinishGame.visibility = android.view.View.GONE
                        }
                        com.futebadosparcas.data.model.GameStatus.LIVE -> {
                            btnStartGame.visibility = android.view.View.GONE
                            btnFinishGame.visibility = android.view.View.VISIBLE
                        }
                        else -> {
                            btnStartGame.visibility = android.view.View.GONE
                            btnFinishGame.visibility = android.view.View.GONE
                        }
                    }
                } else {
                    cvAdmin.visibility = android.view.View.GONE
                }
            }
        }
    }
}
