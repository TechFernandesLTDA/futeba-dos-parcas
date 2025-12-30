package com.futebadosparcas.ui.badges.adapter

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.data.model.BadgeRarity
import com.futebadosparcas.data.model.BadgeType
import com.futebadosparcas.databinding.ItemBadgeBinding
import com.futebadosparcas.ui.badges.BadgeWithData
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Adapter do RecyclerView de badges
 */
class BadgesAdapter : ListAdapter<BadgeWithData, BadgesAdapter.BadgeViewHolder>(BadgeDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): BadgeViewHolder {
        val binding = ItemBadgeBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return BadgeViewHolder(binding)
    }

    override fun onBindViewHolder(holder: BadgeViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class BadgeViewHolder(
        private val binding: ItemBadgeBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(badgeWithData: BadgeWithData) {
            val userBadge = badgeWithData.userBadge
            val badge = badgeWithData.badge

            // Ícone
            binding.tvBadgeIcon.text = getBadgeIcon(badge.type)

            // Nome
            binding.tvBadgeName.text = badge.name

            // Descrição
            binding.tvBadgeDescription.text = badge.description

            // Cor de fundo baseada na raridade
            val backgroundColor = getRarityColor(badge.rarity)
            binding.vBadgeBackground.setBackgroundColor(backgroundColor)

            // Raridade
            binding.tvRarity.isVisible = true
            binding.tvRarity.text = getRarityText(badge.rarity)
            binding.tvRarity.setBackgroundColor(getRarityBadgeColor(badge.rarity))

            // Contador (quantas vezes conquistou)
            if (userBadge.count > 1) {
                binding.llBadgeCount.isVisible = true
                binding.tvBadgeCount.text = userBadge.count.toString()
            } else {
                binding.llBadgeCount.isVisible = false
            }

            // Data de desbloqueio
            userBadge.unlockedAt?.let { date ->
                binding.tvUnlockedDate.isVisible = true
                val dateFormat = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
                val formattedDate = dateFormat.format(date)
                binding.tvUnlockedDate.text = "Desbloqueado em $formattedDate"
            } ?: run {
                binding.tvUnlockedDate.isVisible = false
            }
        }

        /**
         * Retorna ícone (emoji) para cada tipo de badge
         */
        private fun getBadgeIcon(type: BadgeType): String {
            return when (type) {
                BadgeType.HAT_TRICK -> "⚽"
                BadgeType.PAREDAO -> "🧤"
                BadgeType.ARTILHEIRO_MES -> "👑"
                BadgeType.FOMINHA -> "📅"
                BadgeType.STREAK_7 -> "🔥"
                BadgeType.STREAK_30 -> "🔥🔥"
                BadgeType.ORGANIZADOR_MASTER -> "📋"
                BadgeType.INFLUENCER -> "📢"
                BadgeType.LENDA -> "⭐"
                BadgeType.FAIXA_PRETA -> "🥋"
                BadgeType.MITO -> "💎"
            }
        }

        /**
         * Retorna cor baseada na raridade
         */
        private fun getRarityColor(rarity: BadgeRarity): Int {
            return when (rarity) {
                BadgeRarity.COMUM -> Color.parseColor("#9E9E9E") // Cinza
                BadgeRarity.RARO -> Color.parseColor("#2196F3") // Azul
                BadgeRarity.EPICO -> Color.parseColor("#9C27B0") // Roxo
                BadgeRarity.LENDARIO -> Color.parseColor("#FFD700") // Dourado
            }
        }

        /**
         * Retorna cor do badge de raridade
         */
        private fun getRarityBadgeColor(rarity: BadgeRarity): Int {
            return when (rarity) {
                BadgeRarity.COMUM -> Color.parseColor("#757575")
                BadgeRarity.RARO -> Color.parseColor("#1976D2")
                BadgeRarity.EPICO -> Color.parseColor("#7B1FA2")
                BadgeRarity.LENDARIO -> Color.parseColor("#F57C00")
            }
        }

        /**
         * Retorna texto da raridade
         */
        private fun getRarityText(rarity: BadgeRarity): String {
            return when (rarity) {
                BadgeRarity.COMUM -> "COMUM"
                BadgeRarity.RARO -> "⭐ RARO"
                BadgeRarity.EPICO -> "🏆 ÉPICO"
                BadgeRarity.LENDARIO -> "👑 LENDÁRIO"
            }
        }
    }

    class BadgeDiffCallback : DiffUtil.ItemCallback<BadgeWithData>() {
        override fun areItemsTheSame(oldItem: BadgeWithData, newItem: BadgeWithData): Boolean {
            return oldItem.userBadge.id == newItem.userBadge.id
        }

        override fun areContentsTheSame(oldItem: BadgeWithData, newItem: BadgeWithData): Boolean {
            return oldItem == newItem
        }
    }
}
