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
import com.futebadosparcas.databinding.ItemCashboxHeaderBinding
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Representa os itens que podem aparecer na lista do caixa
 */
sealed class CashboxListItem {
    data class Header(val title: String) : CashboxListItem()
    data class Entry(val entry: CashboxEntry) : CashboxListItem()
}

/**
 * Adapter para lista de entradas do caixa com suporte a cabeçalhos de mês
 */
class CashboxEntriesAdapter(
    private val onEntryClick: (CashboxEntry) -> Unit,
    private val onEntryLongClick: (CashboxEntry) -> Unit
) : ListAdapter<CashboxListItem, RecyclerView.ViewHolder>(EntryDiffCallback()) {

    private val dateFormat = SimpleDateFormat("dd/MM/yyyy 'às' HH:mm", Locale("pt", "BR"))
    private val currencyFormat = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))

    companion object {
        private const val TYPE_HEADER = 0
        private const val TYPE_ENTRY = 1
    }

    override fun getItemViewType(position: Int): Int {
        return when (getItem(position)) {
            is CashboxListItem.Header -> TYPE_HEADER
            is CashboxListItem.Entry -> TYPE_ENTRY
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            TYPE_HEADER -> {
                val binding = ItemCashboxHeaderBinding.inflate(inflater, parent, false)
                HeaderViewHolder(binding)
            }
            else -> {
                val binding = ItemCashboxEntryBinding.inflate(inflater, parent, false)
                EntryViewHolder(binding)
            }
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val item = getItem(position)
        when (holder) {
            is HeaderViewHolder -> holder.bind(item as CashboxListItem.Header)
            is EntryViewHolder -> holder.bind((item as CashboxListItem.Entry).entry)
        }
    }

    inner class HeaderViewHolder(
        private val binding: ItemCashboxHeaderBinding
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(header: CashboxListItem.Header) {
            binding.tvHeaderTitle.text = header.title
        }
    }

    inner class EntryViewHolder(
        private val binding: ItemCashboxEntryBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(entry: CashboxEntry) {
            val context = binding.root.context
            val entryType = entry.getTypeEnum()

            // Categoria
            binding.tvCategory.text = entry.getCategoryDisplayName()

            // Descrição (mais limpa)
            binding.tvDescription.text = entry.description.ifEmpty { "Sem descrição" }

            // Data
            val dateToShow = entry.createdAt ?: entry.referenceDate
            binding.tvDate.text = dateFormat.format(dateToShow)

            // Quem criou
            binding.tvCreatedBy.text = entry.createdByName.ifEmpty { "Sistema" }

            // Comprovante
            val hasReceipt = !entry.receiptUrl.isNullOrEmpty()
            binding.ivReceipt.visibility = if (hasReceipt) View.VISIBLE else View.GONE
            if (hasReceipt) {
                binding.ivReceipt.setOnClickListener {
                    try {
                        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(entry.receiptUrl))
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        // Toast alert? context is accessible
                        android.widget.Toast.makeText(context, "Não foi possível abrir o comprovante", android.widget.Toast.LENGTH_SHORT).show()
                    }
                }
            }

            // Valor com cor dependendo do tipo
            val amountText = currencyFormat.format(entry.amount)
            binding.tvAmount.text = if (entryType == CashboxEntryType.INCOME) {
                "+ $amountText"
            } else {
                "- $amountText"
            }

            // Estilos visuais baseados no tipo
            val colorRes = if (entryType == CashboxEntryType.INCOME) R.color.success else R.color.error
            val color = ContextCompat.getColor(context, colorRes)
            
            binding.tvAmount.setTextColor(color)
            binding.ivIcon.setColorFilter(color)

            // Listeners
            binding.root.setOnClickListener { onEntryClick(entry) }
            binding.root.setOnLongClickListener {
                onEntryLongClick(entry)
                true
            }
        }
    }

    class EntryDiffCallback : DiffUtil.ItemCallback<CashboxListItem>() {
        override fun areItemsTheSame(oldItem: CashboxListItem, newItem: CashboxListItem): Boolean {
            return if (oldItem is CashboxListItem.Header && newItem is CashboxListItem.Header) {
                oldItem.title == newItem.title
            } else if (oldItem is CashboxListItem.Entry && newItem is CashboxListItem.Entry) {
                oldItem.entry.id == newItem.entry.id
            } else false
        }

        override fun areContentsTheSame(oldItem: CashboxListItem, newItem: CashboxListItem): Boolean {
            return oldItem == newItem
        }
    }
}

