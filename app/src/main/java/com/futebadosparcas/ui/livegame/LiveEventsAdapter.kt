package com.futebadosparcas.ui.livegame

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.data.model.GameEvent
import com.futebadosparcas.data.model.GameEventType
import com.futebadosparcas.databinding.ItemGameEventBinding

class LiveEventsAdapter : ListAdapter<GameEvent, LiveEventsAdapter.EventViewHolder>(EventDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): EventViewHolder {
        val binding = ItemGameEventBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return EventViewHolder(binding)
    }

    override fun onBindViewHolder(holder: EventViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class EventViewHolder(
        private val binding: ItemGameEventBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(event: GameEvent) {
            binding.apply {
                // Minuto
                tvMinute.text = "${event.minute}'"

                // Icone e descricao baseado no tipo
                when (event.getEventTypeEnum()) {
                    GameEventType.GOAL -> {
                        tvEventIcon.text = "⚽"
                        tvEventDescription.text = "Gol de ${event.playerName}"

                        if (event.assistedByName != null) {
                            tvEventSubtitle.visibility = View.VISIBLE
                            tvEventSubtitle.text = "Assistência: ${event.assistedByName}"
                        } else {
                            tvEventSubtitle.visibility = View.GONE
                        }
                    }
                    GameEventType.ASSIST -> {
                        tvEventIcon.text = "👟"
                        tvEventDescription.text = "Oé (Passe) de ${event.playerName}"
                        tvEventSubtitle.visibility = View.GONE
                    }
                    GameEventType.SAVE -> {
                        tvEventIcon.text = "🧤"
                        tvEventDescription.text = "Defesa de ${event.playerName}"
                        tvEventSubtitle.visibility = View.GONE
                    }
                    GameEventType.YELLOW_CARD -> {
                        tvEventIcon.text = "🟨"
                        tvEventDescription.text = "Cartão amarelo para ${event.playerName}"
                        tvEventSubtitle.visibility = View.GONE
                    }
                    GameEventType.RED_CARD -> {
                        tvEventIcon.text = "🟥"
                        tvEventDescription.text = "Cartão vermelho para ${event.playerName}"
                        tvEventSubtitle.visibility = View.GONE
                    }
                    else -> {
                        tvEventIcon.text = "⚽"
                        tvEventDescription.text = event.playerName
                        tvEventSubtitle.visibility = View.GONE
                    }
                }

                // Badge do time
                tvEventTeam.text = if (event.teamId.endsWith("1")) "T1" else "T2"
            }
        }
    }

    private class EventDiffCallback : DiffUtil.ItemCallback<GameEvent>() {
        override fun areItemsTheSame(oldItem: GameEvent, newItem: GameEvent): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: GameEvent, newItem: GameEvent): Boolean {
            return oldItem == newItem
        }
    }
}
