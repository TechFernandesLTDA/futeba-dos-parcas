package com.futebadosparcas.ui.games

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.GameEvent
import com.futebadosparcas.data.model.GameEventType
import com.futebadosparcas.data.model.Team
import com.futebadosparcas.databinding.ItemLiveMatchSectionBinding
import com.futebadosparcas.databinding.ItemTeamScoreBinding
import com.futebadosparcas.databinding.ItemTimelineEventBinding

class LiveMatchAdapter(
    private val onAddEventClick: (GameEventType) -> Unit,
    private val onDeleteEventClick: (GameEvent) -> Unit
) : RecyclerView.Adapter<LiveMatchAdapter.LiveMatchViewHolder>() {

    private var canLogEvents: Boolean = false

    private var teams: List<Team> = emptyList()
    private var events: List<GameEvent> = emptyList()
    private var confirmations: List<GameConfirmation> = emptyList()
    private var game: com.futebadosparcas.data.model.Game? = null

    fun setCanLogEvents(canLog: Boolean) {
        if (canLogEvents != canLog) {
            canLogEvents = canLog
            notifyDataSetChanged()
        }
    }

    fun updateData(game: com.futebadosparcas.data.model.Game?, teams: List<Team>, events: List<GameEvent>, confirmations: List<GameConfirmation> = emptyList()) {
        this.game = game
        this.teams = teams
        this.events = events
        this.confirmations = confirmations
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LiveMatchViewHolder {
        val binding = ItemLiveMatchSectionBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return LiveMatchViewHolder(binding)
    }

    override fun onBindViewHolder(holder: LiveMatchViewHolder, position: Int) {
        holder.bind(game, teams, events, confirmations, canLogEvents)
    }

    override fun getItemCount(): Int = if (teams.isNotEmpty()) 1 else 0

    inner class LiveMatchViewHolder(private val binding: ItemLiveMatchSectionBinding) :
        RecyclerView.ViewHolder(binding.root) {

        private val scoresAdapter = TeamScoresAdapter()
        private val timelineAdapter = TimelineAdapter(canLogEvents, onDeleteEventClick)

        init {
            binding.rvScores.adapter = scoresAdapter
            binding.rvTimeline.adapter = timelineAdapter
            binding.btnAddEvent.setOnClickListener { onAddEventClick(GameEventType.GOAL) }
            
            // Fast Actions Listeners (Set once)
            binding.btnFastGoal.setOnClickListener { onAddEventClick(GameEventType.GOAL) }
            binding.btnFastSave.setOnClickListener { onAddEventClick(GameEventType.SAVE) }
            binding.btnFastAssist.setOnClickListener { onAddEventClick(GameEventType.ASSIST) } 
            binding.btnFastYellow.setOnClickListener { onAddEventClick(GameEventType.YELLOW_CARD) }
            binding.btnFastRed.setOnClickListener { onAddEventClick(GameEventType.RED_CARD) }
        }

        fun bind(game: com.futebadosparcas.data.model.Game?, teams: List<Team>, events: List<GameEvent>, confirmations: List<GameConfirmation>, canLogEvents: Boolean) {
            // Priority: Score from Game object (synced from live_scores)
            // Fallback: Calculate from events
            
            val teamScores = if (game != null && teams.size >= 2) {
                // Determine which team is team1 and team2 based on name or ID if possible
                // For now, assume teams[0] = team1, teams[1] = team2 as set in updateGameStatus
                listOf(
                    TeamScore(teams[0], game.team1Score),
                    TeamScore(teams[1], game.team2Score)
                )
            } else {
                val scoreMap = teams.associate { it.id to 0 }.toMutableMap()
                events.filter { it.getEventTypeEnum() == com.futebadosparcas.data.model.GameEventType.GOAL }.forEach { event ->
                    val teamId = event.teamId 
                    if (teamId.isNotEmpty()) {
                        val current = scoreMap[teamId] ?: 0
                        scoreMap[teamId] = current + 1
                    }
                }
                teams.map { team ->
                    TeamScore(team, scoreMap[team.id] ?: 0)
                }
            }
            
            scoresAdapter.submitList(teamScores)
            
            val playerMap = confirmations.associateBy { it.userId }
            timelineAdapter.setCanLogEvents(canLogEvents)
            timelineAdapter.setPlayerMap(playerMap)
            timelineAdapter.submitList(events)

            // Hide generic button, show fast actions if owner/allowed
            binding.btnAddEvent.visibility = View.GONE
            binding.llFastActions.visibility = if (canLogEvents) View.VISIBLE else View.GONE
        }
    }
}

data class TeamScore(val team: Team, val score: Int)

class TeamScoresAdapter : ListAdapter<TeamScore, TeamScoresAdapter.ScoreViewHolder>(DiffCallback) {

    class ScoreViewHolder(private val binding: ItemTeamScoreBinding) :
        RecyclerView.ViewHolder(binding.root) {
        fun bind(item: TeamScore) {
            binding.tvTeamName.text = item.team.name
            binding.tvScore.text = item.score.toString()
            try {
                binding.viewColor.setBackgroundColor(Color.parseColor(item.team.color))
            } catch (e: Exception) {
                binding.viewColor.setBackgroundColor(Color.GRAY)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ScoreViewHolder {
        val binding = ItemTeamScoreBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ScoreViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ScoreViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    object DiffCallback : DiffUtil.ItemCallback<TeamScore>() {
        override fun areItemsTheSame(oldItem: TeamScore, newItem: TeamScore) = oldItem.team.id == newItem.team.id
        override fun areContentsTheSame(oldItem: TeamScore, newItem: TeamScore) = oldItem == newItem
    }
}

class TimelineAdapter(
    private var canLogEvents: Boolean,
    private val onDeleteClick: (GameEvent) -> Unit
) : ListAdapter<GameEvent, TimelineAdapter.EventViewHolder>(EventDiffCallback) {

    private var playerMap: Map<String, GameConfirmation> = emptyMap()

    fun setCanLogEvents(canLog: Boolean) {
        if (canLogEvents != canLog) {
            canLogEvents = canLog
            notifyDataSetChanged()
        }
    }

    fun setPlayerMap(map: Map<String, GameConfirmation>) {
        playerMap = map
        notifyDataSetChanged()
    }

    inner class EventViewHolder(private val binding: ItemTimelineEventBinding) :
        RecyclerView.ViewHolder(binding.root) {
        fun bind(event: GameEvent) {
            val eventType = event.getEventTypeEnum()
            
            // Text Construction
            val descriptionBuilder = StringBuilder()
            val playerName = event.playerName.ifEmpty { "Jogador" }
            
            when(eventType) {
                GameEventType.GOAL -> {
                    descriptionBuilder.append("Gol de $playerName")
                    if (!event.assistedByName.isNullOrEmpty()) {
                        descriptionBuilder.append("\n(Ass: ${event.assistedByName})")
                    }
                }
                GameEventType.SAVE -> descriptionBuilder.append("Defesa: $playerName")
                GameEventType.YELLOW_CARD -> descriptionBuilder.append("Cartão Amarelo: $playerName")
                GameEventType.RED_CARD -> descriptionBuilder.append("Cartão Vermelho: $playerName")
                else -> descriptionBuilder.append(eventType.name)
            }
            
            binding.tvDescription.text = descriptionBuilder.toString()
            binding.tvTeamName.visibility = View.VISIBLE
            // Could map team ID to name if available, but passing teams map is expensive. 
            // Better to rely on color or context. For now, hiding team name or showing generic.
            binding.tvTeamName.text = "" // Or fetch from player's team if needed
            binding.tvTeamName.visibility = View.GONE
            
            // Icon
            val context = binding.root.context
            when(eventType) {
                GameEventType.GOAL -> {
                    binding.ivEventType.setImageResource(R.drawable.ic_sports_soccer)
                    binding.ivEventType.clearColorFilter()
                    binding.ivEventType.setColorFilter(context.getColor(R.color.success))
                }
                GameEventType.SAVE -> {
                     binding.ivEventType.setImageResource(R.drawable.ic_save_action)
                     binding.ivEventType.clearColorFilter()
                     binding.ivEventType.setColorFilter(context.getColor(R.color.theme_orange_primary))
                }
                GameEventType.YELLOW_CARD -> {
                    binding.ivEventType.setImageResource(R.drawable.ic_card_filled) 
                     binding.ivEventType.clearColorFilter()
                    binding.ivEventType.setColorFilter(Color.parseColor("#FFD600")) // Keep specific yellow
                }
                GameEventType.RED_CARD -> {
                    binding.ivEventType.setImageResource(R.drawable.ic_card_filled)
                     binding.ivEventType.clearColorFilter()
                    binding.ivEventType.setColorFilter(context.getColor(R.color.theme_red_primary))
                }
                else -> {
                    binding.ivEventType.setImageResource(R.drawable.ic_info)
                    binding.ivEventType.clearColorFilter()
                }
            }

            // Player Avatar
            val playerConf = playerMap[event.playerId]
            val photoUrl = playerConf?.userPhoto
            
            binding.ivPlayerPhoto.load(photoUrl ?: R.drawable.ic_player_placeholder) {
                crossfade(true)
                transformations(CircleCropTransformation())
                error(R.drawable.ic_player_placeholder)
            }

            binding.btnDelete.visibility = if (canLogEvents) View.VISIBLE else View.GONE
            binding.btnDelete.setOnClickListener { onDeleteClick(event) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): EventViewHolder {
        val binding = ItemTimelineEventBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return EventViewHolder(binding)
    }

    override fun onBindViewHolder(holder: EventViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    object EventDiffCallback : DiffUtil.ItemCallback<GameEvent>() {
        override fun areItemsTheSame(oldItem: GameEvent, newItem: GameEvent) = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: GameEvent, newItem: GameEvent) = oldItem == newItem
    }
}
