package com.futebadosparcas.ui.games

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.databinding.ItemGameBinding

class GamesAdapter(
    private val onGameClick: (Game) -> Unit,
    private val onQuickConfirm: (Game) -> Unit,
    private val onMapClick: (Game) -> Unit,
    private val onGameLongClick: (Game) -> Unit
) : ListAdapter<GameWithConfirmations, GamesAdapter.GameViewHolder>(GameDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): GameViewHolder {
        val binding = ItemGameBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return GameViewHolder(binding)
    }

    override fun onBindViewHolder(holder: GameViewHolder, position: Int) {
        val item = getItem(position)
        holder.bind(item)
    }

    inner class GameViewHolder(
        private val binding: ItemGameBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(gameWithConfirmations: GameWithConfirmations) {
            val game = gameWithConfirmations.game

            // --- Click Listeners ---
            binding.root.setOnClickListener {
                if (game.id.isNotEmpty()) {
                    onGameClick(game)
                }
            }

            binding.root.setOnLongClickListener {
                onGameLongClick(game)
                true // Consumed
            }

            binding.btnQuickConfirm.setOnClickListener {
                it.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
                val position = adapterPosition
                if (position != RecyclerView.NO_POSITION) {
                    onQuickConfirm(getItem(position).game)
                }
            }

            binding.btnMap.setOnClickListener {
                it.performHapticFeedback(android.view.HapticFeedbackConstants.VIRTUAL_KEY)
                val position = adapterPosition
                if (position != RecyclerView.NO_POSITION) {
                    onMapClick(getItem(position).game)
                }
            }

            // --- UI Binding ---
            binding.apply {
                tvDate.text = game.date
                tvTime.text = game.time
                tvLocation.text = game.locationName.ifEmpty { "Local nao definido" }
                tvField.text = game.fieldName

                // Confirmations
                tvConfirmed.text = "${gameWithConfirmations.confirmedCount}/${game.maxPlayers}"

                // Status badge com lógica de ocupação
                val context = root.context
                val setStatusStyle = { text: String, colorRes: Int ->
                    val color = androidx.core.content.ContextCompat.getColor(context, colorRes)
                    val bgColor = androidx.core.graphics.ColorUtils.setAlphaComponent(color, 50)

                    cvStatus.setCardBackgroundColor(bgColor)
                    tvStatus.text = text
                    tvStatus.setTextColor(color)
                    cvStatus.visibility = View.VISIBLE
                }

                when (game.getStatusEnum()) {
                    GameStatus.SCHEDULED -> {
                        layoutScoreboard.visibility = View.GONE
                        // Lógica de ocupação dinâmica
                        val occupancyRate = if (game.maxPlayers > 0) {
                            (gameWithConfirmations.confirmedCount.toFloat() / game.maxPlayers.toFloat())
                        } else {
                            0f
                        }

                        when {
                            occupancyRate >= 1.0f -> setStatusStyle("LOTADO", R.color.error)
                            occupancyRate >= 0.8f -> setStatusStyle("QUASE CHEIO", R.color.warning)
                            else -> setStatusStyle("ABERTO", R.color.success)
                        }
                    }
                    GameStatus.CONFIRMED -> {
                        layoutScoreboard.visibility = View.GONE
                        setStatusStyle("LISTA FECHADA", R.color.secondary)
                    }
                    GameStatus.LIVE -> {
                         // LIVE com destaque
                         setStatusStyle("● AO VIVO", R.color.error) // Vermelho vivo
                         cvStatus.alpha = 1.0f 
                         
                         // Show Scoreboard
                         layoutScoreboard.visibility = View.VISIBLE
                         tvScoreboardScore.text = "${game.team1Score}  -  ${game.team2Score}"
                         // Fallback names if empty
                         val t1 = if (game.team1Name.isNotEmpty()) game.team1Name else "Time 1"
                         val t2 = if (game.team2Name.isNotEmpty()) game.team2Name else "Time 2"
                         tvScoreboardTeams.text = "$t1 vs $t2"
                    }
                    GameStatus.FINISHED -> {
                         layoutScoreboard.visibility = View.GONE
                         val color = androidx.core.content.ContextCompat.getColor(context, R.color.outline)
                         cvStatus.setCardBackgroundColor(androidx.core.graphics.ColorUtils.setAlphaComponent(color, 40))
                         
                         if (game.xpProcessed) {
                             tvStatus.text = "FINALIZADO ✓" // Check indicando XP processado
                             tvStatus.setTextColor(androidx.core.content.ContextCompat.getColor(context, R.color.success)) // Verde sucesso
                         } else {
                             tvStatus.text = "FINALIZADO"
                             tvStatus.setTextColor(color)
                         }
                         cvStatus.visibility = View.VISIBLE
                    }
                    GameStatus.CANCELLED -> {
                        layoutScoreboard.visibility = View.GONE
                        setStatusStyle("CANCELADO", R.color.error)
                    }
                }

                // Price
                tvPrice.text = if (game.dailyPrice > 0) {
                    "R$ %.2f".format(game.dailyPrice)
                } else {
                    "Grátis"
                }

                // Organizer
                tvOrganizer.text = game.ownerName.ifEmpty { "Organizador" }
                tvGroupName.text = game.groupName ?: "Individual"

                // Quick Actions Logic
                if (game.getStatusEnum() == GameStatus.SCHEDULED) {
                    layoutActions.visibility = View.VISIBLE
                    dividerActions.visibility = View.VISIBLE

                    if (gameWithConfirmations.isUserConfirmed) {
                        btnQuickConfirm.text = "Você confirmou"
                        btnQuickConfirm.setIconResource(R.drawable.ic_check_circle)
                        btnQuickConfirm.isEnabled = false
                        btnQuickConfirm.alpha = 0.6f
                    } else {
                        btnQuickConfirm.text = "Confirmar"
                        btnQuickConfirm.setIconResource(R.drawable.ic_check)
                        btnQuickConfirm.isEnabled = true
                        btnQuickConfirm.alpha = 1.0f
                    }
                } else {
                    layoutActions.visibility = View.GONE
                    dividerActions.visibility = View.GONE
                }
            }
        }
    }

    private class GameDiffCallback : DiffUtil.ItemCallback<GameWithConfirmations>() {
        override fun areItemsTheSame(oldItem: GameWithConfirmations, newItem: GameWithConfirmations): Boolean {
            return oldItem.game.id == newItem.game.id
        }

        override fun areContentsTheSame(oldItem: GameWithConfirmations, newItem: GameWithConfirmations): Boolean {
            return oldItem == newItem
        }
    }
}
