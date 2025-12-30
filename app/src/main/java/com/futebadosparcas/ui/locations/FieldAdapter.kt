package com.futebadosparcas.ui.locations

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Field
import java.text.NumberFormat
import java.util.Locale

class FieldAdapter(
    private val onFieldClick: (Field) -> Unit
) : ListAdapter<Field, FieldAdapter.FieldViewHolder>(FieldDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): FieldViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_field, parent, false)
        return FieldViewHolder(view, onFieldClick)
    }

    override fun onBindViewHolder(holder: FieldViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class FieldViewHolder(
        itemView: View,
        val onFieldClick: (Field) -> Unit
    ) : RecyclerView.ViewHolder(itemView) {
        private val tvName: TextView = itemView.findViewById(R.id.tvFieldName)
        private val tvType: TextView = itemView.findViewById(R.id.tvFieldType)
        private val tvPrice: TextView = itemView.findViewById(R.id.tvFieldPrice)

        fun bind(field: Field) {
            tvName.text = field.name
            tvType.text = field.type
            
            val priceFormat = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))
            tvPrice.text = "${priceFormat.format(field.hourlyPrice)}/h"

            itemView.setOnClickListener { onFieldClick(field) }
        }
    }

    class FieldDiffCallback : DiffUtil.ItemCallback<Field>() {
        override fun areItemsTheSame(oldItem: Field, newItem: Field): Boolean = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: Field, newItem: Field): Boolean = oldItem == newItem
    }
}
