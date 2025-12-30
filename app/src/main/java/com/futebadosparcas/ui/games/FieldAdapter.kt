package com.futebadosparcas.ui.games

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.databinding.ItemFieldSelectionBinding
import java.text.NumberFormat
import java.util.Locale

class FieldAdapter(
    private val onFieldClick: (Field) -> Unit
) : ListAdapter<Field, FieldAdapter.ViewHolder>(FieldDiffCallback()) {

    private var selectedFieldId: String? = null

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemFieldSelectionBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    fun setSelectedField(fieldId: String?) {
        val previousSelected = selectedFieldId
        selectedFieldId = fieldId

        currentList.forEachIndexed { index, field ->
            if (field.id == previousSelected || field.id == fieldId) {
                notifyItemChanged(index)
            }
        }
    }

    inner class ViewHolder(
        private val binding: ItemFieldSelectionBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(field: Field) {
            binding.tvFieldName.text = field.name

            // Tipo da quadra
            val fieldType = field.getTypeEnum()
            binding.chipFieldType.text = fieldType.displayName
            binding.chipFieldType.setChipBackgroundColorResource(
                when (fieldType) {
                    FieldType.FUTSAL -> R.color.chip_futsal
                    FieldType.SOCIETY -> R.color.chip_society
                    FieldType.CAMPO -> R.color.chip_campo
                    else -> R.color.chip_society
                }
            )

            // Preco por hora
            if (field.hourlyPrice > 0) {
                val formatter = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))
                binding.tvFieldPrice.text = "${formatter.format(field.hourlyPrice)}/hora"
                binding.tvFieldPrice.visibility = View.VISIBLE
            } else {
                binding.tvFieldPrice.visibility = View.GONE
            }

            // Destacar se selecionado
            val isSelected = field.id == selectedFieldId
            binding.rbField.isChecked = isSelected
            binding.cardField.isChecked = isSelected
            binding.cardField.strokeWidth = if (isSelected) 4 else 1
            binding.cardField.strokeColor = if (isSelected) {
                binding.root.context.getColor(R.color.primary)
            } else {
                binding.root.context.getColor(R.color.divider)
            }

            binding.root.setOnClickListener {
                onFieldClick(field)
            }
        }
    }
}

class FieldDiffCallback : DiffUtil.ItemCallback<Field>() {
    override fun areItemsTheSame(oldItem: Field, newItem: Field): Boolean {
        return oldItem.id == newItem.id
    }

    override fun areContentsTheSame(oldItem: Field, newItem: Field): Boolean {
        return oldItem == newItem
    }
}
