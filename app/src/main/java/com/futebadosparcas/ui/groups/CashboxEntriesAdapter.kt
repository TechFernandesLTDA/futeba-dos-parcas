package com.futebadosparcas.ui.groups

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.R
import com.futebadosparcas.data.model.CashboxEntry
import com.futebadosparcas.data.model.CashboxEntryType
import com.futebadosparcas.databinding.ItemCashboxEntryBinding
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Adapter para lista de entradas do caixa (receitas e despesas)
 */
class CashboxEntriesAdapter(
    private val onEntryClick: (CashboxEntry) -> Unit,
    private val onEntryLongClick: (CashboxEntry) -> Unit
) : ListAdapter<CashboxEntry, CashboxEntriesAdapter.EntryViewHolder>(EntryDiffCallback()) {

    private val dateFormat = SimpleDateFormat("dd/MM/yyyy 'às' HH:mm", Locale("pt", "BR"))
    private val currencyFormat = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): EntryViewHolder {
        val binding = ItemCashboxEntryBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return EntryViewHolder(binding)
    }

    override fun onBindViewHolder(holder: EntryViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class EntryViewHolder(
        private val binding: ItemCashboxEntryBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(entry: CashboxEntry) {
            val context = binding.root.context
            val entryType = entry.getTypeEnum()

            // Categoria - usa o displayName do enum
            binding.tvCategory.text = entry.getCategoryDisplayName()

            // Descrição (pode incluir nome do jogador)
            val descriptionText = if (!entry.playerName.isNullOrEmpty()) {
                "${entry.description} (${entry.playerName})"
            } else {
                entry.description
            }
            binding.tvDescription.text = descriptionText

            // Data
            val dateToShow = entry.createdAt ?: entry.referenceDate
            binding.tvDate.text = dateFormat.format(dateToShow)

            // Valor com cor dependendo do tipo
            val amountText = currencyFormat.format(entry.amount)
            binding.tvAmount.text = if (entryType == CashboxEntryType.INCOME) {
                "+ $amountText"
            } else {
                "- $amountText"
            }

            when (entryType) {
                CashboxEntryType.INCOME -> {
                    binding.tvAmount.setTextColor(
                        ContextCompat.getColor(context, R.color.success)
                    )
                    // Ícone verde para entrada
                    binding.ivIcon.setColorFilter(
                        ContextCompat.getColor(context, R.color.success)
                    )
                }
                CashboxEntryType.EXPENSE -> {
                    binding.tvAmount.setTextColor(
                        ContextCompat.getColor(context, R.color.error)
                    )
                    // Ícone vermelho para saída
                    binding.ivIcon.setColorFilter(
                        ContextCompat.getColor(context, R.color.error)
                    )
                }
            }

            // Listeners
            binding.root.setOnClickListener {
                onEntryClick(entry)
            }

            binding.root.setOnLongClickListener {
                onEntryLongClick(entry)
                true
            }
        }
    }

    class EntryDiffCallback : DiffUtil.ItemCallback<CashboxEntry>() {
        override fun areItemsTheSame(oldItem: CashboxEntry, newItem: CashboxEntry): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: CashboxEntry, newItem: CashboxEntry): Boolean {
            return oldItem == newItem
        }
    }
}
