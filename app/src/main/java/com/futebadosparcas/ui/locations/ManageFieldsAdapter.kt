package com.futebadosparcas.ui.locations

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.databinding.ItemManageFieldBinding

class ManageFieldsAdapter(
    private val onDeleteClick: (Field) -> Unit
) : ListAdapter<Field, ManageFieldsAdapter.FieldViewHolder>(FieldDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): FieldViewHolder {
        val binding = ItemManageFieldBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return FieldViewHolder(binding, onDeleteClick)
    }

    override fun onBindViewHolder(holder: FieldViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class FieldViewHolder(
        private val binding: ItemManageFieldBinding,
        private val onDeleteClick: (Field) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(field: Field) {
            binding.tvFieldName.text = field.name
            binding.tvFieldType.text = "${field.type} • R$ ${field.hourlyPrice.toInt()}/h"
            
            binding.btnDeleteField.setOnClickListener {
                onDeleteClick(field)
            }
        }
    }

    private class FieldDiffCallback : DiffUtil.ItemCallback<Field>() {
        override fun areItemsTheSame(oldItem: Field, newItem: Field): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Field, newItem: Field): Boolean {
            return oldItem == newItem
        }
    }
}
