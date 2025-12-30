package com.futebadosparcas.ui.games

import android.content.ClipData
import android.content.ClipDescription
import android.graphics.Color
import android.view.DragEvent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.data.model.Team
import com.futebadosparcas.databinding.ItemTeamBinding

class TeamsAdapter(
    private val onPlayerClick: (String, String) -> Unit = { _, _ -> },
    private val onPlayerMoved: (String, String, String) -> Unit = { _, _, _ -> }
) : ListAdapter<Team, TeamsAdapter.TeamViewHolder>(TeamDiffCallback()) {

    private var confirmations: List<com.futebadosparcas.data.model.GameConfirmation> = emptyList()
    private var isOwner: Boolean = false

    fun updateConfirmations(confirmations: List<com.futebadosparcas.data.model.GameConfirmation>) {
        this.confirmations = confirmations
        notifyDataSetChanged()
    }

    fun setOwner(isOwner: Boolean) {
        this.isOwner = isOwner
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TeamViewHolder {
        val binding = ItemTeamBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return TeamViewHolder(binding)
    }

    override fun onBindViewHolder(holder: TeamViewHolder, position: Int) {
        holder.bind(getItem(position), confirmations, isOwner, onPlayerClick, onPlayerMoved)
    }

    class TeamViewHolder(private val binding: ItemTeamBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(
            team: Team, 
            confirmations: List<com.futebadosparcas.data.model.GameConfirmation>,
            isOwner: Boolean,
            onPlayerClick: (String, String) -> Unit,
            onPlayerMoved: (String, String, String) -> Unit
        ) {
            binding.tvTeamName.text = team.name
            val originalColor = try {
                Color.parseColor(team.color)
            } catch (e: Exception) {
                Color.GRAY
            }
            binding.cardTeam.setCardBackgroundColor(originalColor)

            binding.llPlayers.removeAllViews()

            // Setup Drag Listener for the Team Card (Drop Target)
            if (isOwner) {
                binding.root.setOnDragListener { v, event ->
                    when (event.action) {
                        DragEvent.ACTION_DRAG_STARTED -> {
                            event.clipDescription.hasMimeType(ClipDescription.MIMETYPE_TEXT_PLAIN)
                        }
                        DragEvent.ACTION_DRAG_ENTERED -> {
                            binding.cardTeam.setCardBackgroundColor(Color.LTGRAY)
                            true
                        }
                        DragEvent.ACTION_DRAG_EXITED -> {
                            binding.cardTeam.setCardBackgroundColor(originalColor)
                            true
                        }
                        DragEvent.ACTION_DROP -> {
                            val item = event.clipData.getItemAt(0)
                            val dragData = item.text.toString()
                            val parts = dragData.split("|")
                            if (parts.size == 2) {
                                val playerId = parts[0]
                                val sourceTeamId = parts[1]
                                
                                if (sourceTeamId != team.id) {
                                    onPlayerMoved(playerId, sourceTeamId, team.id)
                                }
                            }
                            binding.cardTeam.setCardBackgroundColor(originalColor)
                            true
                        }
                        DragEvent.ACTION_DRAG_ENDED -> {
                            binding.cardTeam.setCardBackgroundColor(originalColor)
                            true
                        }
                        else -> false
                    }
                }
            } else {
                binding.root.setOnDragListener(null)
            }

            team.playerIds.forEachIndexed { index, playerId ->
                val conf = confirmations.find { it.userId == playerId }
                val context = binding.root.context
                
                val textView = TextView(context).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply {
                        setMargins(0, 8, 0, 8) // dimen to px simplified
                    }
                    
                    var displayName =  if (conf != null) {
                         var name = conf.getDisplayName()
                        if (conf.goals > 0) name += " ⚽${conf.goals}"
                        if (conf.assists > 0) name += " 👟${conf.assists}"
                        if (conf.yellowCards > 0) name += " 🟨${conf.yellowCards}"
                        if (conf.redCards > 0) name += " 🟥${conf.redCards}"
                        name
                    } else "Jogador Removido"

                    text = "${index + 1}. $displayName"
                    setTextColor(Color.WHITE)
                    textSize = 14f
                    
                    if (isOwner) {
                        // Add an icon to indicate interactable
                        setCompoundDrawablesWithIntrinsicBounds(0, 0, com.futebadosparcas.R.drawable.ic_swap_horiz, 0)
                        compoundDrawablePadding = 16
                        
                        val outValue = android.util.TypedValue()
                        context.theme.resolveAttribute(android.R.attr.selectableItemBackground, outValue, true)
                        setBackgroundResource(outValue.resourceId)
                        isClickable = true
                        
                        // Click to move (Legacy/Fallback)
                        setOnClickListener {
                            onPlayerClick(playerId, team.id)
                        }

                        // Long Click to Drag
                        setOnLongClickListener { view ->
                            val clipItem = ClipData.Item("$playerId|${team.id}")
                            val dragData = ClipData(
                                "PLAYER_MOVE",
                                arrayOf(ClipDescription.MIMETYPE_TEXT_PLAIN),
                                clipItem
                            )
                            
                            val shadow = View.DragShadowBuilder(view)
                            view.startDragAndDrop(dragData, shadow, null, 0)
                            true
                        }
                    }
                }
                
                binding.llPlayers.addView(textView)
            }
        }
    }

    class TeamDiffCallback : DiffUtil.ItemCallback<Team>() {
        override fun areItemsTheSame(oldItem: Team, newItem: Team): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Team, newItem: Team): Boolean {
            return oldItem == newItem
        }
    }
}
